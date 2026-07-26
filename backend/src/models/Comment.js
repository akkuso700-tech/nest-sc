const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    media: [
      {
        url: { type: String, default: '' },
        posterUrl: { type: String, default: '' },
        type: { type: String, enum: ['image', 'video'], required: true },
        durationSeconds: { type: Number, default: 0 },
      },
    ],
    moderation: {
      visibility: {
        type: String,
        enum: ['visible', 'hidden', 'removed'],
        default: 'visible',
        index: true,
      },
      reason: {
        type: String,
        trim: true,
        default: '',
      },
      actionedAt: {
        type: Date,
        default: null,
      },
      actionedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
    stats: {
      likes: { type: Number, default: 0 },
      replies: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
    },
    likedByUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    savedByUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    sharedByUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  },
)

commentSchema.index({ post: 1, createdAt: -1 })
commentSchema.index({ parentComment: 1, createdAt: 1 })

const Comment = mongoose.model('Comment', commentSchema)

module.exports = { Comment }
