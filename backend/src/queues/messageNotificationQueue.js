const { Queue } = require('bullmq')
const IORedis = require('ioredis')
const { env } = require('../config/env')

const QUEUE_NAME = 'offline-message-notifications'

let redisConnection = null
let messageNotificationQueue = null
let isRedisAvailable = true
let lastRedisErrorLogAt = 0

function getRedisConnectionOptions() {
  if (env.redis.url) {
    return {
      connection: new IORedis(env.redis.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (times > 10) {
            isRedisAvailable = false
            return null
          }
          return Math.min(times * 500, 5000)
        },
      }),
    }
  }

  return {
    connection: {
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 10) {
          isRedisAvailable = false
          return null
        }
        return Math.min(times * 500, 5000)
      },
    },
  }
}

function getSharedRedisClient() {
  if (redisConnection) {
    return redisConnection
  }

  if (env.redis.url) {
    redisConnection = new IORedis(env.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  } else {
    redisConnection = new IORedis({
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  }

  redisConnection.on('error', (error) => {
    const now = Date.now()
    if (now - lastRedisErrorLogAt > 60_000) {
      lastRedisErrorLogAt = now
      console.warn(`[MessageNotificationQueue] Redis connection warning: ${error.message}`)
    }
  })

  redisConnection.on('connect', () => {
    isRedisAvailable = true
  })

  return redisConnection
}

function getMessageNotificationQueue() {
  if (!env.messageNotification.queueEnabled) {
    return null
  }

  if (messageNotificationQueue) {
    return messageNotificationQueue
  }

  try {
    const client = getSharedRedisClient()
    messageNotificationQueue = new Queue(QUEUE_NAME, {
      connection: client,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    })

    return messageNotificationQueue
  } catch (error) {
    console.error('[MessageNotificationQueue] Failed to initialize queue:', error.message)
    return null
  }
}

async function enqueueOfflineMessageNotification({
  recipientId,
  senderId,
  messageId,
  delayMs = null,
}) {
  if (!env.messageNotification.queueEnabled) {
    return { queued: false, reason: 'queue_disabled' }
  }

  const queue = getMessageNotificationQueue()
  if (!queue) {
    return { queued: false, reason: 'queue_unavailable' }
  }

  const normalizedRecipientId = recipientId.toString()
  const normalizedSenderId = senderId.toString()
  const normalizedMessageId = messageId ? messageId.toString() : null
  const delay = typeof delayMs === 'number' ? delayMs : env.messageNotification.delayMs

  const jobId = `offline_msg_${normalizedRecipientId}`

  try {
    const existingJob = await queue.getJob(jobId)
    if (existingJob) {
      const state = await existingJob.getState()
      if (state === 'delayed' || state === 'waiting') {
        await existingJob.updateData({
          recipientId: normalizedRecipientId,
          lastSenderId: normalizedSenderId,
          lastMessageId: normalizedMessageId,
          updatedAt: Date.now(),
        })
        return { queued: true, jobId, debounced: true, state }
      }
    }

    const job = await queue.add(
      'send_offline_message_notification',
      {
        recipientId: normalizedRecipientId,
        lastSenderId: normalizedSenderId,
        lastMessageId: normalizedMessageId,
        enqueuedAt: Date.now(),
      },
      {
        jobId,
        delay,
      },
    )

    return { queued: true, jobId: job.id, delay }
  } catch (error) {
    console.warn(`[MessageNotificationQueue] Enqueue failed for recipient ${normalizedRecipientId}:`, error.message)
    return { queued: false, reason: 'redis_error', error: error.message }
  }
}

async function closeMessageNotificationQueue() {
  if (messageNotificationQueue) {
    await messageNotificationQueue.close().catch(() => undefined)
    messageNotificationQueue = null
  }
  if (redisConnection) {
    await redisConnection.quit().catch(() => undefined)
    redisConnection = null
  }
}

module.exports = {
  QUEUE_NAME,
  getRedisConnectionOptions,
  getSharedRedisClient,
  getMessageNotificationQueue,
  enqueueOfflineMessageNotification,
  closeMessageNotificationQueue,
}
