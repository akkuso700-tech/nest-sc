const mongoose = require('mongoose')

const postViewSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    viewerKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    dayBucket: {
      type: Date,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    maxWatchRatio: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    replayCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxVisibleMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    swipeVelocity: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
)

postViewSchema.index({ post: 1, viewerKey: 1, dayBucket: 1 }, { unique: true })
postViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const PostView = mongoose.model('PostView', postViewSchema)

module.exports = { PostView }
