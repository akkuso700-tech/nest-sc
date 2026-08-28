const mongoose = require('mongoose')
const { AppError } = require('../utils/AppError')
const { User } = require('../models/User')
const { Conversation } = require('../models/Conversation')
const { Message } = require('../models/Message')
const { normalizeMediaList } = require('../utils/mediaUrls')

function buildConversationKey(firstUserId, secondUserId) {
  return [firstUserId.toString(), secondUserId.toString()].sort().join(':')
}

function serializeMessage(message) {
  return {
    id: message._id,
    conversationId: message.conversation,
    sender: message.sender,
    recipient: message.recipient,
    text: message.text,
    media: normalizeMediaList(message.media || []),
    createdAt: message.createdAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
  }
}

function buildMessagePreview(text = '', media = []) {
  const trimmedText = text.trim()

  if (trimmedText) {
    return trimmedText.slice(0, 120)
  }

  if (!media.length) {
    return ''
  }

  if (media[0].type === 'video') {
    return 'Sent a video'
  }

  return media.length > 1 ? `Sent ${media.length} photos` : 'Sent a photo'
}

function ensureValidObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`${label} is invalid.`, 400)
  }
}

async function ensureRecipient(recipientId, senderId) {
  ensureValidObjectId(recipientId, 'Recipient id')

  if (recipientId.toString() === senderId.toString()) {
    throw new AppError('You cannot send a message to yourself.', 400)
  }

  const [recipient, sender] = await Promise.all([
    User.findById(recipientId),
    User.findById(senderId).select('blockedUserIds'),
  ])

  if (!recipient) {
    throw new AppError('Recipient not found.', 404)
  }

  const senderBlocksRecipient = (sender?.blockedUserIds || []).some(
    (blockedId) => blockedId.toString() === recipientId.toString(),
  )
  const recipientBlocksSender = (recipient.blockedUserIds || []).some(
    (blockedId) => blockedId.toString() === senderId.toString(),
  )

  if (senderBlocksRecipient || recipientBlocksSender) {
    throw new AppError('You cannot message this user.', 403)
  }

  return recipient
}

async function createMessageAndNotify({
  sender,
  recipientId,
  text,
  media = [],
  io = null,
}) {
  await ensureRecipient(recipientId, sender._id)

  const conversationKey = buildConversationKey(sender._id, recipientId)

  const conversation = await Conversation.findOneAndUpdate(
    { conversationKey },
    {
      $setOnInsert: {
        participantIds: [sender._id, recipientId],
        conversationKey,
      },
      $pull: {
        hiddenByUserIds: { $in: [sender._id, recipientId] },
      },
    },
    { upsert: true, returnDocument: 'after' },
  )

  const message = await Message.create({
    conversation: conversation._id,
    sender: sender._id,
    recipient: recipientId,
    text,
    media,
    deliveredAt: new Date(),
  })

  conversation.lastMessageId = message._id
  conversation.lastMessagePreview = buildMessagePreview(text, media)
  conversation.lastMessageAt = message.createdAt
  await conversation.save()

  const serializedMessage = serializeMessage(message)

  if (io) {
    const senderRoom = `user:${sender._id}`
    const recipientRoom = `user:${recipientId}`

    io.to(recipientRoom).emit('new_message', serializedMessage)
    io.to(senderRoom).emit('new_message', serializedMessage)
  }

  return {
    conversation,
    message,
    serializedMessage,
  }
}

async function assertConversationAccess(conversationId, userId) {
  ensureValidObjectId(conversationId, 'Conversation id')

  const conversation = await Conversation.findById(conversationId)

  if (!conversation) {
    throw new AppError('Conversation not found.', 404)
  }

  const isParticipant = conversation.participantIds.some(
    (participantId) => participantId.toString() === userId.toString(),
  )

  if (!isParticipant) {
    throw new AppError('Conversation access denied.', 403)
  }

  return conversation
}

async function markConversationAsRead({ conversationId, userId, io = null }) {
  const conversation = await assertConversationAccess(conversationId, userId)
  const readAt = new Date()

  await Message.updateMany(
    {
      conversation: conversationId,
      recipient: userId,
      readAt: null,
    },
    { readAt },
  )

  const payload = {
    conversationId,
    userId,
    readAt,
  }

  if (io) {
    conversation.participantIds.forEach((participantId) => {
      io.to(`user:${participantId}`).emit('messages_read', payload)
    })
  }

  return payload
}

module.exports = {
  buildConversationKey,
  buildMessagePreview,
  serializeMessage,
  ensureValidObjectId,
  createMessageAndNotify,
  assertConversationAccess,
  markConversationAsRead,
}
