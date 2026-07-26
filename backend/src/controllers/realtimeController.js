const { Message } = require('../models/Message')
const { Notification } = require('../models/Notification')
const { asyncHandler } = require('../utils/asyncHandler')

const syncRealtimeState = asyncHandler(async (req, res) => {
  const since = req.validated.query.since
    ? new Date(req.validated.query.since)
    : new Date(0)
  const limit = req.validated.query.limit

  const [messages, notifications] = await Promise.all([
    Message.find({
      recipient: req.user._id,
      deletedByUserIds: { $ne: req.user._id },
      $or: [{ createdAt: { $gte: since } }, { readAt: { $gte: since } }],
    })
      .sort({ createdAt: -1 })
      .limit(limit),
    Notification.find({
      user: req.user._id,
      $or: [{ createdAt: { $gte: since } }, { readAt: { $gte: since } }],
    })
      .sort({ createdAt: -1 })
      .limit(limit),
  ])

  res.json({
    serverTime: new Date().toISOString(),
    messages,
    notifications,
  })
})

module.exports = { syncRealtimeState }
