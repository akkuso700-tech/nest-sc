const mongoose = require('mongoose')

const recommendationEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'like',
        'unlike',
        'comment',
        'save',
        'unsave',
        'share',
        'unshare',
        'not-interested',
        'quick-skip',
        'long-view',
      ],
      required: true,
      index: true,
    },
    weight: {
      type: Number,
      required: true,
      min: -20,
      max: 20,
    },
    source: {
      type: String,
      enum: ['explicit', 'playback'],
      required: true,
    },
    feedSessionId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 64,
      index: true,
    },
    feedRank: {
      type: Number,
      default: null,
      min: 1,
      max: 10000,
    },
    algorithm: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    experimentId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
      index: true,
    },
    experimentVariant: {
      type: String,
      enum: ['', 'control', 'challenger'],
      default: '',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

recommendationEventSchema.index({ user: 1, createdAt: -1 })
recommendationEventSchema.index({ user: 1, post: 1, eventType: 1, createdAt: -1 })
recommendationEventSchema.index({ createdAt: -1, algorithm: 1, experimentId: 1, experimentVariant: 1 })
recommendationEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const RecommendationEvent = mongoose.model('RecommendationEvent', recommendationEventSchema)

module.exports = { RecommendationEvent }
