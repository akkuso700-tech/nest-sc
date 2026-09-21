const mongoose = require('mongoose')

const anonymousCallLogSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    callerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    callerAnonymousId: {
      type: String,
      required: true,
      index: true,
    },
    callerAlias: {
      type: String,
      default: 'Anonim',
    },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    recipientAnonymousId: {
      type: String,
      required: true,
      index: true,
    },
    recipientAlias: {
      type: String,
      default: 'Anonim',
    },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'connected', 'ended', 'missed', 'declined', 'failed'],
      default: 'initiated',
      index: true,
    },
    durationSec: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    connectedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

anonymousCallLogSchema.index({ callerUserId: 1, recipientUserId: 1, createdAt: -1 })
anonymousCallLogSchema.index({ sessionId: 1, createdAt: -1 })

const AnonymousCallLog = mongoose.model('AnonymousCallLog', anonymousCallLogSchema)

module.exports = { AnonymousCallLog }
