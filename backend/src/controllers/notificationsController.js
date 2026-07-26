const { Notification } = require('../models/Notification')
const { Comment } = require('../models/Comment')
const { Message } = require('../models/Message')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')
const { normalizeUserMedia } = require('../utils/mediaUrls')

function toIdString(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  return value.toString?.() || ''
}

async function decorateNotifications(items = []) {
  if (!items.length) {
    return []
  }

  const commentEntityIds = items
    .filter((notification) => notification.entityKind === 'comment' && notification.entityId)
    .map((notification) => notification.entityId)
  const messageEntityIds = items
    .filter((notification) => notification.entityKind === 'message' && notification.entityId)
    .map((notification) => notification.entityId)

  const [comments, messages] = await Promise.all([
    commentEntityIds.length
      ? Comment.find({ _id: { $in: commentEntityIds } }).select('_id post').lean()
      : Promise.resolve([]),
    messageEntityIds.length
      ? Message.find({ _id: { $in: messageEntityIds } }).select('_id conversation').lean()
      : Promise.resolve([]),
  ])

  const commentPostById = new Map(
    comments.map((comment) => [toIdString(comment._id), toIdString(comment.post)]),
  )
  const messageConversationById = new Map(
    messages.map((message) => [toIdString(message._id), toIdString(message.conversation)]),
  )

  return items.map((notification) => {
    const entityId = toIdString(notification.entityId)
    const targetPostId =
      notification.entityKind === 'post'
        ? entityId
        : notification.entityKind === 'comment'
          ? commentPostById.get(entityId) || null
          : null

    return {
      ...notification,
      actor: normalizeUserMedia(notification.actor),
      targetPostId,
      targetCommentId:
        notification.entityKind === 'comment' ? entityId || null : null,
      targetConversationId:
        notification.entityKind === 'message'
          ? messageConversationById.get(entityId) || null
          : null,
    }
  })
}

const listNotifications = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id }

  if (req.validated.query.unreadOnly) {
    filter.readAt = null
  }

  const notifications = await Notification.find(filter)
    .select('user actor type entityKind entityId title body readAt createdAt updatedAt')
    .populate('actor', 'firstName lastName username avatarUrl lastLoginAt')
    .sort({ createdAt: -1 })
    .limit(req.validated.query.limit)
    .lean()

  const decoratedNotifications = await decorateNotifications(notifications)

  res.json({
    notifications: decoratedNotifications,
  })
})

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: req.validated.params.notificationId,
      user: req.user._id,
    },
    { readAt: new Date() },
    { returnDocument: 'after' },
  ).populate('actor', 'firstName lastName username avatarUrl lastLoginAt')

  if (!notification) {
    throw new AppError('Notification not found.', 404)
  }

  const normalizedNotification = notification.toObject
    ? notification.toObject()
    : notification
  const [decoratedNotification] = await decorateNotifications([normalizedNotification])

  const io = req.app.locals.io || null

  if (io) {
    io
      .to(`user:${req.user._id}`)
      .emit('notification:read', decoratedNotification)
  }

  res.json({
    message: 'Notification marked as read.',
    notification: decoratedNotification,
  })
})

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const readAt = new Date()

  await Notification.updateMany(
    {
      user: req.user._id,
      readAt: null,
    },
    { readAt },
  )

  const io = req.app.locals.io || null

  if (io) {
    io.to(`user:${req.user._id}`).emit('notification:read:all', { readAt })
  }

  res.json({
    message: 'All notifications marked as read.',
    readAt,
  })
})

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
}
