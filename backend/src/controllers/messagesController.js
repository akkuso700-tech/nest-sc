const { z } = require('zod')
const { Conversation } = require('../models/Conversation')
const { Message } = require('../models/Message')
const { User } = require('../models/User')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')
const {
  buildMediaItems,
  removeUploadedFiles,
} = require('../middlewares/uploadMedia')
const {
  createMessageAndNotify,
  assertConversationAccess,
  markConversationAsRead,
  serializeMessage,
} = require('../services/messagingService')
const { normalizeMediaList, normalizeUserMedia } = require('../utils/mediaUrls')

const sendMessageBodySchema = z.object({
  recipientId: z.string().trim().regex(/^[a-fA-F0-9]{24}$/),
  text: z.string().trim().max(5000).optional().default(''),
})

async function parseSendMessageInput(req) {
  const media = await buildMediaItems(req.files || [])
  const result = sendMessageBodySchema.safeParse(req.body || {})

  if (!result.success) {
    throw result.error
  }

  if (!result.data.text.trim() && !media.length) {
    throw new AppError('Message text or media is required.', 400)
  }

  return {
    recipientId: result.data.recipientId,
    text: result.data.text.trim(),
    media,
  }
}

const sendMessage = asyncHandler(async (req, res) => {
  let shouldCleanupUploadedFiles = true

  try {
    const io = req.app.locals.io || null
    const { recipientId, text, media } = await parseSendMessageInput(req)

    const result = await createMessageAndNotify({
      sender: req.user,
      recipientId,
      text,
      media,
      io,
    })

    shouldCleanupUploadedFiles = false

    res.status(201).json({
      message: 'Message sent successfully.',
      conversationId: result.conversation._id,
      messageItem: result.serializedMessage,
    })
  } catch (error) {
    if (shouldCleanupUploadedFiles) {
      await removeUploadedFiles(req.files)
    }

    throw error
  }
})

const listConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({
    participantIds: req.user._id,
    hiddenByUserIds: { $ne: req.user._id },
  })
    .select('participantIds lastMessageId lastMessagePreview lastMessageAt updatedAt')
    .populate('participantIds', 'firstName lastName username avatarUrl lastLoginAt')
    .populate('lastMessageId', 'media')
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(req.validated.query.limit)
    .lean()

  const unreadCounts = await Message.aggregate([
    {
      $match: {
        conversation: { $in: conversations.map((conversation) => conversation._id) },
        recipient: req.user._id,
        readAt: null,
        deletedByUserIds: { $ne: req.user._id },
      },
    },
    {
      $group: {
        _id: '$conversation',
        unreadCount: { $sum: 1 },
      },
    },
  ])

  const unreadCountByConversationId = new Map(
    unreadCounts.map((item) => [item._id.toString(), item.unreadCount]),
  )

  const items = conversations.map((conversation) => ({
    id: conversation._id,
    participants: conversation.participantIds
      .filter(
        (participant) => participant._id.toString() !== req.user._id.toString(),
      )
      .map((participant) => normalizeUserMedia(participant)),
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageAt: conversation.lastMessageAt,
    lastMessageId: conversation.lastMessageId?._id || null,
    lastMessageMedia: normalizeMediaList(conversation.lastMessageId?.media?.slice(0, 1) || []),
    updatedAt: conversation.updatedAt,
    unreadCount: unreadCountByConversationId.get(conversation._id.toString()) || 0,
  }))

  res.json({ conversations: items })
})

const listConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.validated.params
  const { limit } = req.validated.query

  await assertConversationAccess(conversationId, req.user._id)

  const messages = await Message.find({
    conversation: conversationId,
    deletedByUserIds: { $ne: req.user._id },
  })
    .select('conversation sender recipient text media createdAt deliveredAt readAt')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  res.json({
    messages: messages.reverse().map((message) => serializeMessage(message)),
  })
})

const markMessagesRead = asyncHandler(async (req, res) => {
  const io = req.app.locals.io || null
  const payload = await markConversationAsRead({
    conversationId: req.validated.params.conversationId,
    userId: req.user._id,
    io,
  })

  res.json({
    message: 'Conversation marked as read.',
    ...payload,
  })
})

const deleteMessageForCurrentUser = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.validated.params.messageId)

  if (!message) {
    throw new AppError('Message not found.', 404)
  }

  const isParticipant =
    message.sender.toString() === req.user._id.toString() ||
    message.recipient.toString() === req.user._id.toString()

  if (!isParticipant) {
    throw new AppError('You do not have access to this message.', 403)
  }

  const alreadyDeleted = message.deletedByUserIds.some(
    (userId) => userId.toString() === req.user._id.toString(),
  )

  if (!alreadyDeleted) {
    message.deletedByUserIds.push(req.user._id)
    await message.save()
  }

  res.json({
    message: 'Message hidden for the current user. Admin records remain intact.',
  })
})

const updateMessageForCurrentUser = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.validated.params.messageId)

  if (!message) {
    throw new AppError('Message not found.', 404)
  }

  if (message.sender.toString() !== req.user._id.toString()) {
    throw new AppError('Only the sender can edit this message.', 403)
  }

  const nextText = req.validated.body.text.trim()

  if (!nextText) {
    throw new AppError('Message text is required.', 400)
  }

  message.text = nextText
  await message.save()

  res.json({
    message: 'Message updated successfully.',
    messageItem: message,
  })
})

const hideConversationForCurrentUser = asyncHandler(async (req, res) => {
  const conversation = await assertConversationAccess(
    req.validated.params.conversationId,
    req.user._id,
  )

  const alreadyHidden = (conversation.hiddenByUserIds || []).some(
    (userId) => userId.toString() === req.user._id.toString(),
  )

  if (!alreadyHidden) {
    conversation.hiddenByUserIds.push(req.user._id)
    await conversation.save()
  }

  res.json({
    message: 'Conversation hidden successfully.',
  })
})

const blockConversationPeer = asyncHandler(async (req, res) => {
  const conversation = await assertConversationAccess(
    req.validated.params.conversationId,
    req.user._id,
  )
  const viewer = await User.findById(req.user._id)

  if (!viewer) {
    throw new AppError('User not found.', 404)
  }

  const peerId = (conversation.participantIds || []).find(
    (participantId) => participantId.toString() !== req.user._id.toString(),
  )

  if (!peerId) {
    throw new AppError('Conversation peer not found.', 404)
  }

  const alreadyBlocked = (viewer.blockedUserIds || []).some(
    (blockedId) => blockedId.toString() === peerId.toString(),
  )

  if (!alreadyBlocked) {
    viewer.blockedUserIds.push(peerId)
    await viewer.save()
  }

  const alreadyHidden = (conversation.hiddenByUserIds || []).some(
    (userId) => userId.toString() === req.user._id.toString(),
  )

  if (!alreadyHidden) {
    conversation.hiddenByUserIds.push(req.user._id)
    await conversation.save()
  }

  res.json({
    message: 'User blocked successfully.',
  })
})

module.exports = {
  sendMessage,
  listConversations,
  listConversationMessages,
  markMessagesRead,
  deleteMessageForCurrentUser,
  updateMessageForCurrentUser,
  hideConversationForCurrentUser,
  blockConversationPeer,
}
