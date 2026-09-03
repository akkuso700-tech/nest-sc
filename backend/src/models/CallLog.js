const mongoose = require('mongoose')

const callLogSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
      index: true,
    },
    callType: {
      type: String,
      enum: ['voice', 'video'],
      required: true,
      default: 'voice',
    },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'connected', 'completed', 'missed', 'declined', 'busy', 'failed'],
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
    recordingUrl: {
      type: String,
      default: null,
    },
    fileSizeBytes: {
      type: Number,
      default: null,
    },
    mimeType: {
      type: String,
      default: null,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

callLogSchema.index({ caller: 1, recipient: 1, createdAt: -1 })

const CallLog = mongoose.model('CallLog', callLogSchema)

module.exports = { CallLog }
