const { Queue } = require('bullmq')
const IORedis = require('ioredis')
const { env } = require('../config/env')

const QUEUE_NAME = 'offline-message-notifications'

let redisConnection = null
let messageNotificationQueue = null
let isRedisAvailable = false
let redisChecked = false
let lastRedisErrorLogAt = 0
let appIoInstance = null

// In-memory fallback queue for environments without Redis (e.g. Hostinger, serverless)
const inMemoryFallbackJobs = new Map()

function setAppIo(io) {
  appIoInstance = io
}

function getAppIo() {
  return appIoInstance
}

function getSharedRedisClient() {
  if (redisConnection) {
    return redisConnection
  }

  const redisConfig = env.redis.url
    ? env.redis.url
    : {
        host: env.redis.host,
        port: env.redis.port,
        password: env.redis.password || undefined,
      }

  try {
    redisConnection = new IORedis(redisConfig, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 3000,
      retryStrategy: (times) => {
        if (times > 2) {
          isRedisAvailable = false
          return null // Stop retrying immediately if Redis is not running
        }
        return 1000
      },
    })

    redisConnection.on('error', (error) => {
      isRedisAvailable = false
      const now = Date.now()
      if (now - lastRedisErrorLogAt > 120_000) {
        lastRedisErrorLogAt = now
        console.warn(`[MessageNotificationQueue] Redis offline (${error.code || error.message}). Using resilient in-memory fallback queue.`)
      }
    })

    redisConnection.on('connect', () => {
      isRedisAvailable = true
      console.info('[MessageNotificationQueue] Redis connection established. Using BullMQ mode.')
    })
  } catch (error) {
    isRedisAvailable = false
    console.warn('[MessageNotificationQueue] Failed to initialize Redis client. Using fallback queue:', error.message)
  }

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
    if (!client) return null

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
    console.warn('[MessageNotificationQueue] BullMQ init skipped, using in-memory fallback:', error.message)
    return null
  }
}

async function enqueueViaInMemoryFallback({
  normalizedRecipientId,
  normalizedSenderId,
  normalizedMessageId,
  delay,
}) {
  const existingJob = inMemoryFallbackJobs.get(normalizedRecipientId)
  if (existingJob) {
    existingJob.lastSenderId = normalizedSenderId
    existingJob.lastMessageId = normalizedMessageId
    existingJob.updatedAt = Date.now()
    return {
      queued: true,
      jobId: `memory_msg_${normalizedRecipientId}`,
      debounced: true,
      mode: 'in_memory_fallback',
      delayMs: delay,
    }
  }

  const jobData = {
    recipientId: normalizedRecipientId,
    lastSenderId: normalizedSenderId,
    lastMessageId: normalizedMessageId,
    enqueuedAt: Date.now(),
  }

  const timer = setTimeout(async () => {
    inMemoryFallbackJobs.delete(normalizedRecipientId)
    try {
      // Lazy load processor to avoid circular dependency
      const { processNotificationJob } = require('../workers/messageNotificationWorker')
      const result = await processNotificationJob(
        { data: jobData, id: `memory_msg_${normalizedRecipientId}` },
        { io: getAppIo() },
      )
      if (result?.skipped) {
        console.info(`[MessageNotificationFallback] Notification skipped for ${normalizedRecipientId}: ${result.reason}`)
      } else if (result?.success) {
        console.info(`[MessageNotificationFallback] Email sent to ${result.recipientEmail} (${result.unreadCount} unread)`)
      }
    } catch (error) {
      console.error(`[MessageNotificationFallback] Execution failed for ${normalizedRecipientId}:`, error.message)
    }
  }, delay)

  timer.unref?.()

  inMemoryFallbackJobs.set(normalizedRecipientId, {
    ...jobData,
    timer,
  })

  return {
    queued: true,
    jobId: `memory_msg_${normalizedRecipientId}`,
    mode: 'in_memory_fallback',
    delayMs: delay,
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

  const normalizedRecipientId = recipientId.toString()
  const normalizedSenderId = senderId.toString()
  const normalizedMessageId = messageId ? messageId.toString() : null
  const delay = typeof delayMs === 'number' ? delayMs : env.messageNotification.delayMs

  // 1. Try BullMQ + Redis if configured and Redis is available
  if (isRedisAvailable || env.redis.url) {
    const queue = getMessageNotificationQueue()
    if (queue) {
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
            return { queued: true, jobId, debounced: true, state, mode: 'bullmq_redis' }
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

        return { queued: true, jobId: job.id, delay, mode: 'bullmq_redis' }
      } catch (redisError) {
        console.warn(`[MessageNotificationQueue] Redis enqueue error (${redisError.message}), switching to in-memory fallback.`)
        isRedisAvailable = false
      }
    }
  }

  // 2. Resilient In-Memory Fallback Queue (Runs anywhere without external Redis)
  return enqueueViaInMemoryFallback({
    normalizedRecipientId,
    normalizedSenderId,
    normalizedMessageId,
    delay,
  })
}

function getQueueStatus() {
  return {
    queueEnabled: env.messageNotification.queueEnabled,
    redisAvailable: isRedisAvailable,
    activeMode: isRedisAvailable ? 'bullmq_redis' : 'in_memory_fallback',
    pendingMemoryJobs: inMemoryFallbackJobs.size,
    delayMs: env.messageNotification.delayMs,
    throttleMs: env.messageNotification.throttleMs,
  }
}

async function closeMessageNotificationQueue() {
  // Clear in-memory timers
  for (const [, item] of inMemoryFallbackJobs) {
    if (item.timer) clearTimeout(item.timer)
  }
  inMemoryFallbackJobs.clear()

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
  setAppIo,
  getAppIo,
  getSharedRedisClient,
  getMessageNotificationQueue,
  enqueueOfflineMessageNotification,
  getQueueStatus,
  closeMessageNotificationQueue,
}
