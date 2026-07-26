const mongoose = require('mongoose')

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
      index: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    title: {
      type: String,
      default: '',
      trim: true,
      maxlength: 80,
    },
    slug: {
      type: String,
      default: null,
      trim: true,
      maxlength: 140,
      index: true,
    },
    media: [
      {
        url: { type: String, default: '' },
        hlsUrl: { type: String, default: '' },
        posterUrl: { type: String, default: '' },
        type: { type: String, enum: ['image', 'video'], required: true },
        durationSeconds: { type: Number, default: 0 },
        processing: {
          type: String,
          enum: ['raw', 'transcoded', 'hls-ready'],
          default: 'raw',
        },
      },
    ],
    contentType: {
      type: String,
      enum: ['post', 'loop', 'story'],
      default: 'post',
      index: true,
    },
    storyExpiresAt: {
      type: Date,
      default: null,
    },
    storyMeta: {
      music: {
        title: {
          type: String,
          trim: true,
          default: '',
          maxlength: 120,
        },
        artist: {
          type: String,
          trim: true,
          default: '',
          maxlength: 120,
        },
      },
      stickers: [
        {
          type: String,
          trim: true,
          maxlength: 60,
        },
      ],
      mentions: [
        {
          type: String,
          trim: true,
          lowercase: true,
          maxlength: 40,
        },
      ],
      link: {
        url: {
          type: String,
          trim: true,
          default: '',
          maxlength: 1024,
        },
        label: {
          type: String,
          trim: true,
          default: '',
          maxlength: 120,
        },
      },
    },
    privacy: {
      type: String,
      enum: ['public', 'followers', 'private'],
      default: 'public',
    },
    publication: {
      status: {
        type: String,
        enum: ['published', 'scheduled'],
        default: 'published',
        index: true,
      },
      scheduledFor: {
        type: Date,
        default: null,
        index: true,
      },
    },
    groupModeration: {
      status: {
        type: String,
        enum: ['approved', 'pending', 'rejected'],
        default: 'approved',
        index: true,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
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
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
      loopCompletions: { type: Number, default: 0 },
      loopReplays: { type: Number, default: 0 },
      loopWatchRatioSum: { type: Number, default: 0 },
      loopSwipeVelocitySum: { type: Number, default: 0 },
      loopVisibleMsSum: { type: Number, default: 0 },
      loopSignalsCount: { type: Number, default: 0 },
      loopWaitingEvents: { type: Number, default: 0 },
      loopStalledEvents: { type: Number, default: 0 },
      loopErrorEvents: { type: Number, default: 0 },
      loopRecoverFailedEvents: { type: Number, default: 0 },
      loopTimeGapEvents: { type: Number, default: 0 },
      loopDroppedFramesSum: { type: Number, default: 0 },
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

postSchema.index({ author: 1, createdAt: -1 })
postSchema.index({ group: 1, createdAt: -1 })
postSchema.index({ slug: 1 }, { unique: true, sparse: true })
postSchema.index({ 'publication.status': 1, 'publication.scheduledFor': 1, createdAt: -1 })
postSchema.index({
  group: 1,
  privacy: 1,
  archivedAt: 1,
  'moderation.visibility': 1,
  createdAt: -1,
})
postSchema.index({
  group: 1,
  contentType: 1,
  privacy: 1,
  archivedAt: 1,
  'moderation.visibility': 1,
  createdAt: -1,
})
postSchema.index({
  group: 1,
  contentType: 1,
  'media.type': 1,
  privacy: 1,
  archivedAt: 1,
  'moderation.visibility': 1,
  createdAt: -1,
})
postSchema.index({ storyExpiresAt: 1 }, { expireAfterSeconds: 0 })

const Post = mongoose.model('Post', postSchema)

module.exports = { Post }
