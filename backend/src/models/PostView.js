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
    quickSkipRecorded: {
      type: Boolean,
      default: false,
    },
    longViewRecorded: {
      type: Boolean,
      default: false,
    },
    feedSessionId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 64,
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
    feedView: {
      type: String,
      enum: ['', 'latest', 'explore', 'following', 'for-you', 'loop'],
      default: '',
    },
    loopMode: {
      type: String,
      enum: ['', 'explore', 'following', 'for-you'],
      default: '',
    },
    experimentId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },
    experimentVariant: {
      type: String,
      enum: ['', 'control', 'challenger'],
      default: '',
    },
  },
  {
    timestamps: true,
  },
)

postViewSchema.index({ post: 1, viewerKey: 1, dayBucket: 1 }, { unique: true })
postViewSchema.index({ viewerKey: 1, updatedAt: -1, post: 1 })
postViewSchema.index({ createdAt: -1, algorithm: 1, experimentId: 1, experimentVariant: 1 })
postViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const PostView = mongoose.model('PostView', postViewSchema)

module.exports = { PostView }
