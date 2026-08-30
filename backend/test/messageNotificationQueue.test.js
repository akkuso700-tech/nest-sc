const assert = require('node:assert/strict')
const test = require('node:test')
const { buildMessageNotificationEmail } = require('../src/templates/messageNotificationEmail')
const { processNotificationJob } = require('../src/workers/messageNotificationWorker')
const { User } = require('../src/models/User')
const { Message } = require('../src/models/Message')

test('buildMessageNotificationEmail generates expected subject, HTML and plain text with escaped content', () => {
  const result = buildMessageNotificationEmail({
    recipientName: 'Ali <test>',
    senderName: 'Ayşe & Co',
    senderUsername: 'ayse_99',
    senderAvatarUrl: 'https://example.com/avatar.jpg',
    messageCount: 3,
    previewText: 'Selam, nasılsın?',
    actionUrl: 'https://mysocial.com/messages',
    siteName: 'My Social',
  })

  assert.match(result.subject, /Ayşe &amp; Co sana 3 yeni mesaj gönderdi/)
  assert.match(result.html, /Ali &lt;test&gt;/)
  assert.match(result.html, /Ayşe &amp; Co/)
  assert.match(result.html, /Selam, nasılsın\?/)
  assert.match(result.html, /https:\/\/mysocial\.com\/messages/)
  assert.match(result.html, /3 Yeni Mesaj/)
  assert.match(result.text, /Selam, nasılsın\?/)
})

test('processNotificationJob skips when user has an active socket room', async () => {
  const mockIo = {
    sockets: {
      adapter: {
        rooms: new Map([['user:recipient_123', new Set(['socket_id_1'])]]),
      },
    },
  }

  const job = {
    data: {
      recipientId: 'recipient_123',
      lastSenderId: 'sender_456',
    },
  }

  const result = await processNotificationJob(job, { io: mockIo })
  assert.equal(result.skipped, true)
  assert.equal(result.reason, 'user_online_socket')
})

test('processNotificationJob skips when recipient has notifications disabled', async () => {
  const originalFindById = User.findById
  User.findById = async (id) => {
    if (id === 'user_disabled') {
      return {
        _id: 'user_disabled',
        email: 'user@example.com',
        accountStatus: 'active',
        preferences: {
          emailNotifications: {
            messages: false,
          },
        },
      }
    }
    return null
  }

  try {
    const job = {
      data: {
        recipientId: 'user_disabled',
        lastSenderId: 'sender_456',
      },
    }

    const result = await processNotificationJob(job, { io: null })
    assert.equal(result.skipped, true)
    assert.equal(result.reason, 'notifications_disabled_by_user')
  } finally {
    User.findById = originalFindById
  }
})

test('processNotificationJob skips when throttled by lastMessageEmailSentAt', async () => {
  const originalFindById = User.findById
  User.findById = async (id) => {
    if (id === 'user_throttled') {
      return {
        _id: 'user_throttled',
        email: 'user@example.com',
        accountStatus: 'active',
        preferences: { emailNotifications: { messages: true } },
        lastMessageEmailSentAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (throttle is 1h)
      }
    }
    return null
  }

  try {
    const job = {
      data: {
        recipientId: 'user_throttled',
        lastSenderId: 'sender_456',
      },
    }

    const result = await processNotificationJob(job, { io: null })
    assert.equal(result.skipped, true)
    assert.equal(result.reason, 'throttled')
  } finally {
    User.findById = originalFindById
  }
})

test('processNotificationJob skips when all messages are already read', async () => {
  const originalFindById = User.findById
  const originalMessageFind = Message.find

  User.findById = async (id) => {
    if (id === 'user_all_read') {
      return {
        _id: 'user_all_read',
        email: 'user@example.com',
        accountStatus: 'active',
        preferences: { emailNotifications: { messages: true } },
        lastMessageEmailSentAt: null,
      }
    }
    return null
  }

  Message.find = () => ({
    sort: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  })

  try {
    const job = {
      data: {
        recipientId: 'user_all_read',
        lastSenderId: 'sender_456',
      },
    }

    const result = await processNotificationJob(job, { io: null })
    assert.equal(result.skipped, true)
    assert.equal(result.reason, 'all_messages_already_read')
  } finally {
    User.findById = originalFindById
    Message.find = originalMessageFind
  }
})

test('enqueueOfflineMessageNotification successfully queues and debounces in in-memory fallback mode', async () => {
  const {
    enqueueOfflineMessageNotification,
    closeMessageNotificationQueue,
    getQueueStatus,
  } = require('../src/queues/messageNotificationQueue')

  const recipientId = '507f1f77bcf86cd799439011'
  const senderId = '507f1f77bcf86cd799439012'

  const firstResult = await enqueueOfflineMessageNotification({
    recipientId,
    senderId,
    messageId: '507f1f77bcf86cd799439013',
    delayMs: 100000,
  })

  assert.equal(firstResult.queued, true)
  assert.equal(firstResult.mode, 'in_memory_fallback')

  const debouncedResult = await enqueueOfflineMessageNotification({
    recipientId,
    senderId,
    messageId: '507f1f77bcf86cd799439014',
    delayMs: 100000,
  })

  assert.equal(debouncedResult.queued, true)
  assert.equal(debouncedResult.debounced, true)

  const status = getQueueStatus()
  assert.equal(status.activeMode, 'in_memory_fallback')
  assert.ok(status.pendingMemoryJobs >= 1)

  await closeMessageNotificationQueue()
})

