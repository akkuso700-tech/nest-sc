const mongoose = require('mongoose')

const anonymousDirectChatSchema = new mongoose.Schema(
  {
    chatKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    participants: {
      type: [String],
      required: true,
      index: true,
    },
    participantUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    participantProfiles: {
      type: Map,
      of: new mongoose.Schema(
        {
          alias: { type: String, trim: true, default: '' },
          avatarKey: { type: String, trim: true, default: 'avatar-1' },
          gender: { type: String, default: 'unspecified' },
          ageRange: { type: String, default: 'unspecified' },
          status: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: {},
    },
    lastMessage: {
      text: { type: String, default: '' },
      senderAnonymousId: { type: String, default: '' },
      senderAlias: { type: String, default: '' },
      hasMedia: { type: Boolean, default: false },
      mediaType: { type: String, default: '' },
      createdAt: { type: Date, default: Date.now },
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deletedBy: {
      type: [String],
      default: [],
    },
    blockedBy: {
      type: [String],
      default: [],
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    lastReadAt: {
      type: Map,
      of: Date,
      default: {},
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days inactivity TTL
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  },
)

anonymousDirectChatSchema.index({ participants: 1 })
anonymousDirectChatSchema.index({ lastMessageAt: -1 })

const AnonymousDirectChat = mongoose.model('AnonymousDirectChat', anonymousDirectChatSchema)

module.exports = { AnonymousDirectChat }
