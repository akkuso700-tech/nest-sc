const { Worker } = require('bullmq')
const { env } = require('../config/env')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { User } = require('../models/User')
const { Message } = require('../models/Message')
const { sendEmail } = require('../services/emailService')
const { buildMessageNotificationEmail } = require('../templates/messageNotificationEmail')
const {
  QUEUE_NAME,
  getSharedRedisClient,
  closeMessageNotificationQueue,
} = require('../queues/messageNotificationQueue')
const { normalizeUserMedia } = require('../utils/mediaUrls')

let workerInstance = null
let stopping = false

function buildMessagePreviewText(message) {
  if (message.text && message.text.trim()) {
    return message.text.trim().slice(0, 120)
  }
  if (Array.isArray(message.media) && message.media.length > 0) {
    const firstMedia = message.media[0]
    if (firstMedia.type === 'video') return 'Bir video gönderdi'
    return message.media.length > 1
      ? `${message.media.length} fotoğraf gönderdi`
      : 'Bir fotoğraf gönderdi'
  }
  return 'Yeni bir mesaj'
}

async function processNotificationJob(job, options = {}) {
  const { io = null } = options
  const { recipientId, lastSenderId, lastMessageId } = job.data

  if (!recipientId) {
    return { skipped: true, reason: 'missing_recipient_id' }
  }

  // 1. Check if recipient currently has an active socket session
  if (io) {
    const userRoom = `user:${recipientId}`
    const activeSockets = io.sockets?.adapter?.rooms?.get(userRoom)?.size || 0
    if (activeSockets > 0) {
      return { skipped: true, reason: 'user_online_socket' }
    }
  }

  // 2. Load recipient
  const recipient = await User.findById(recipientId)
  if (!recipient) {
    return { skipped: true, reason: 'recipient_not_found' }
  }

  if (recipient.accountStatus === 'suspended') {
    return { skipped: true, reason: 'recipient_suspended' }
  }

  if (recipient.preferences?.emailNotifications?.messages === false) {
    return { skipped: true, reason: 'notifications_disabled_by_user' }
  }

  if (!recipient.email) {
    return { skipped: true, reason: 'recipient_has_no_email' }
  }

  // 3. Rate limiting (throttling) check
  if (recipient.lastMessageEmailSentAt) {
    const timeSinceLastEmail = Date.now() - new Date(recipient.lastMessageEmailSentAt).getTime()
    if (timeSinceLastEmail < env.messageNotification.throttleMs) {
      return {
        skipped: true,
        reason: 'throttled',
        timeSinceLastEmailMs: timeSinceLastEmail,
      }
    }
  }

  // 4. Query unread messages for this recipient
  const unreadMessages = await Message.find({
    recipient: recipientId,
    readAt: null,
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean()

  if (!unreadMessages || unreadMessages.length === 0) {
    return { skipped: true, reason: 'all_messages_already_read' }
  }

  // 5. Determine primary sender and preview text
  const primaryMessage = unreadMessages[0]
  const senderIdToLookup = primaryMessage.sender || lastSenderId
  const senderUser = await User.findById(senderIdToLookup).lean()

  const normalizedSender = senderUser ? normalizeUserMedia(senderUser) : null
  const senderName = normalizedSender
    ? `${normalizedSender.firstName || ''} ${normalizedSender.lastName || ''}`.trim() || normalizedSender.username
    : 'Bir kullanıcı'
  const senderUsername = normalizedSender?.username || ''
  const senderAvatarUrl = normalizedSender?.avatarUrl || ''

  const previewText = buildMessagePreviewText(primaryMessage)
  const actionUrl = `${env.clientUrl}/messages`

  const { subject, html, text } = buildMessageNotificationEmail({
    recipientName: recipient.firstName,
    senderName,
    senderUsername,
    senderAvatarUrl,
    messageCount: unreadMessages.length,
    previewText,
    actionUrl,
    siteName: 'My Social',
  })

  // 6. Send email notification
  if (env.emailProvider !== 'disabled') {
    try {
      await sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
      })
    } catch (emailError) {
      console.error(`[MessageNotificationWorker] Failed to send email to ${recipient.email}:`, emailError.message)
      throw emailError
    }
  } else {
    console.info(`[MessageNotificationWorker] Email sending skipped (emailProvider=disabled) for ${recipient.email}`)
  }

  // 7. Update lastMessageEmailSentAt timestamp to prevent spam
  await User.findByIdAndUpdate(recipientId, {
    lastMessageEmailSentAt: new Date(),
  })

  return {
    success: true,
    recipientEmail: recipient.email,
    unreadCount: unreadMessages.length,
    senderName,
  }
}

async function runMessageNotificationWorker(options = {}) {
  const manageDatabase = options.manageDatabase !== false
  const io = options.io || null

  if (manageDatabase) {
    await connectDatabase()
  }

  if (!env.messageNotification.queueEnabled) {
    console.info('[MessageNotificationWorker] Queue is disabled by configuration.')
    return null
  }

  const client = getSharedRedisClient()

  workerInstance = new Worker(
    QUEUE_NAME,
    async (job) => {
      return processNotificationJob(job, { io })
    },
    {
      connection: client,
      concurrency: 5,
    },
  )

  workerInstance.on('completed', (job, returnvalue) => {
    if (returnvalue?.skipped) {
      console.info(`[MessageNotificationWorker] Job ${job.id} skipped: ${returnvalue.reason}`)
    } else if (returnvalue?.success) {
      console.info(
        `[MessageNotificationWorker] Sent offline message email to ${returnvalue.recipientEmail} (${returnvalue.unreadCount} unread)`,
      )
    }
  })

  workerInstance.on('failed', (job, error) => {
    console.error(`[MessageNotificationWorker] Job ${job?.id} failed:`, error.message)
  })

  console.info(`[MessageNotificationWorker] BullMQ offline message worker started (mode=${manageDatabase ? 'external' : 'embedded'}).`)

  return workerInstance
}

async function stopMessageNotificationWorker() {
  stopping = true
  if (workerInstance) {
    await workerInstance.close().catch(() => undefined)
    workerInstance = null
  }
  await closeMessageNotificationQueue()
}

if (require.main === module) {
  process.on('SIGINT', async () => {
    await stopMessageNotificationWorker()
    await disconnectDatabase().catch(() => undefined)
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await stopMessageNotificationWorker()
    await disconnectDatabase().catch(() => undefined)
    process.exit(0)
  })

  runMessageNotificationWorker({ manageDatabase: true }).catch((error) => {
    console.error('Message notification worker startup error:', error)
    process.exitCode = 1
  })
}

module.exports = {
  processNotificationJob,
  runMessageNotificationWorker,
  stopMessageNotificationWorker,
}
