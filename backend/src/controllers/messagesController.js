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
  replyToId: z.string().trim().regex(/^[a-fA-F0-9]{24}$/).optional().nullable(),
  durationSeconds: z.coerce.number().optional().default(0),
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

  if (result.data.durationSeconds > 0 && media.length === 1 && media[0].type === 'audio') {
    media[0].durationSeconds = Math.round(result.data.durationSeconds)
  }

  return {
    recipientId: result.data.recipientId,
    text: result.data.text.trim(),
    media,
    replyToId: result.data.replyToId || null,
  }
}

const sendMessage = asyncHandler(async (req, res) => {
  let shouldCleanupUploadedFiles = true

  try {
    const io = req.app.locals.io || null
    const { recipientId, text, media, replyToId } = await parseSendMessageInput(req)

    const result = await createMessageAndNotify({
      sender: req.user,
      recipientId,
      text,
      media,
      replyToId,
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
    .populate('participantIds', 'firstName lastName username avatarUrl lastLoginAt verification')
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
  const { limit, before } = req.validated.query

  await assertConversationAccess(conversationId, req.user._id)

  const filter = {
    conversation: conversationId,
    deletedByUserIds: { $ne: req.user._id },
  }

  if (before) {
    const mongoose = require('mongoose')
    if (mongoose.isValidObjectId(before)) {
      const beforeMessage = await Message.findById(before).select('createdAt').lean()
      if (beforeMessage?.createdAt) {
        filter.createdAt = { $lt: beforeMessage.createdAt }
      }
    } else {
      const beforeDate = new Date(before)
      if (!isNaN(beforeDate.getTime())) {
        filter.createdAt = { $lt: beforeDate }
      }
    }
  }

  const rawMessages = await Message.find(filter)
    .select('conversation sender recipient text media replyTo createdAt deliveredAt readAt')
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate({
      path: 'replyTo',
      select: 'sender text media createdAt',
    })
    .lean()

  const hasMore = rawMessages.length > limit
  const messages = hasMore ? rawMessages.slice(0, limit) : rawMessages

  res.json({
    messages: messages.reverse().map((message) => serializeMessage(message)),
    hasMore,
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

  const io = req.app.locals.io || null
  if (io) {
    const payload = {
      messageId: message._id,
      conversationId: message.conversation,
      deletedByUserId: req.user._id,
    }
    io.to(`user:${message.sender}`).emit('message_deleted', payload)
    io.to(`user:${message.recipient}`).emit('message_deleted', payload)
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

  const io = req.app.locals.io || null
  if (io) {
    const payload = {
      messageId: message._id,
      conversationId: message.conversation,
      text: nextText,
    }
    io.to(`user:${message.sender}`).emit('message_updated', payload)
    io.to(`user:${message.recipient}`).emit('message_updated', payload)
  }

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

  await Message.updateMany(
    {
      conversation: conversation._id,
      deletedByUserIds: { $ne: req.user._id },
    },
    {
      $addToSet: { deletedByUserIds: req.user._id },
    },
  )

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

  await Message.updateMany(
    {
      conversation: conversation._id,
      deletedByUserIds: { $ne: req.user._id },
    },
    {
      $addToSet: { deletedByUserIds: req.user._id },
    },
  )

  res.json({
    message: 'User blocked successfully.',
  })
})

const toggleMessageReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params
  const { emoji } = req.body
  const currentUserId = req.user._id

  const message = await Message.findById(messageId)
  if (!message) {
    throw new AppError('Message not found.', 404)
  }

  const isParticipant =
    String(message.sender) === String(currentUserId) ||
    String(message.recipient) === String(currentUserId)

  if (!isParticipant) {
    throw new AppError('You are not authorized to react to this message.', 403)
  }

  if (!Array.isArray(message.reactions)) {
    message.reactions = []
  }

  const existingIndex = message.reactions.findIndex(
    (r) => String(r.user?._id || r.user) === String(currentUserId),
  )

  let action = 'added'
  if (existingIndex > -1) {
    if (message.reactions[existingIndex].emoji === emoji) {
      // Same emoji -> remove reaction
      message.reactions.splice(existingIndex, 1)
      action = 'removed'
    } else {
      // Different emoji -> update reaction
      message.reactions[existingIndex].emoji = emoji
      action = 'updated'
    }
  } else {
    message.reactions.push({
      user: currentUserId,
      emoji,
    })
    action = 'added'
  }

  await message.save()

  const formattedReactions = message.reactions.map((r) => ({
    user: r.user?._id || r.user,
    emoji: r.emoji,
  }))

  const io = req.app.locals.io
  if (io) {
    const payload = {
      messageId: message._id.toString(),
      conversationId: message.conversation.toString(),
      reactions: formattedReactions,
      action,
      userId: currentUserId.toString(),
      emoji,
    }
    const otherUserId =
      String(message.sender) === String(currentUserId)
        ? message.recipient.toString()
        : message.sender.toString()

    io.to(`user:${currentUserId.toString()}`).emit('message:reaction', payload)
    io.to(`user:${otherUserId}`).emit('message:reaction', payload)
  }

  res.status(200).json({
    success: true,
    messageId: message._id,
    reactions: formattedReactions,
    action,
  })
})

const getLinkPreview = asyncHandler(async (req, res) => {
  const { url } = req.query
  if (!url || typeof url !== 'string') {
    throw new AppError('URL query parameter is required.', 400)
  }

  const { fetchLinkPreview } = require('../services/linkPreviewService')
  const preview = await fetchLinkPreview(url)

  res.status(200).json({
    success: true,
    preview: preview || null,
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
  toggleMessageReaction,
  getLinkPreview,
}
