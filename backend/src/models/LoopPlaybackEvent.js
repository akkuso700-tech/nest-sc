const mongoose = require('mongoose')

const loopPlaybackEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 64,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    viewerKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'waiting',
        'stalled',
        'error',
        'recover-failed',
        'time-gap',
        'dropped-frames',
      ],
      required: true,
      index: true,
    },
    mediaUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2048,
    },
    currentTimeSec: {
      type: Number,
      default: 0,
      min: 0,
      max: 24 * 60 * 60,
    },
    timeGapMs: {
      type: Number,
      default: 0,
      min: 0,
      max: 60 * 60 * 1000,
    },
    droppedFrames: {
      type: Number,
      default: 0,
      min: 0,
      max: 10 * 1000 * 1000,
    },
    totalFrames: {
      type: Number,
      default: 0,
      min: 0,
      max: 100 * 1000 * 1000,
    },
    network: {
      effectiveType: {
        type: String,
        trim: true,
        default: '',
        maxlength: 20,
      },
      downlinkMbps: {
        type: Number,
        default: 0,
        min: 0,
        max: 10000,
      },
      rttMs: {
        type: Number,
        default: 0,
        min: 0,
        max: 120000,
      },
      saveData: {
        type: Boolean,
        default: false,
      },
    },
    device: {
      userAgent: {
        type: String,
        trim: true,
        default: '',
        maxlength: 512,
      },
      platform: {
        type: String,
        trim: true,
        default: '',
        maxlength: 64,
      },
      viewport: {
        width: { type: Number, default: 0, min: 0, max: 10000 },
        height: { type: Number, default: 0, min: 0, max: 10000 },
      },
      deviceMemoryGb: {
        type: Number,
        default: 0,
        min: 0,
        max: 1024,
      },
      hardwareConcurrency: {
        type: Number,
        default: 0,
        min: 0,
        max: 512,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    sampleRate: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
  },
  {
    versionKey: false,
  },
)

loopPlaybackEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
loopPlaybackEventSchema.index({ post: 1, createdAt: -1 })

const LoopPlaybackEvent = mongoose.model('LoopPlaybackEvent', loopPlaybackEventSchema)

module.exports = { LoopPlaybackEvent }
