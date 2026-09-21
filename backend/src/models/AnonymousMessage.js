const mongoose = require('mongoose')

const anonymousMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnonymousRoom',
      default: null,
      index: true,
    },
    conversationId: {
      type: String,
      default: null,
      index: true,
    },
    senderAnonymousId: {
      type: String,
      required: true,
      index: true,
    },
    senderAlias: {
      type: String,
      required: true,
      trim: true,
    },
    senderAvatar: {
      type: String,
      required: true,
      default: 'avatar-1',
    },
    text: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    media: [
      {
        url: { type: String, default: '' },
        posterUrl: { type: String, default: '' },
        type: { type: String, enum: ['image', 'video', 'audio'], default: 'image' },
        durationSeconds: { type: Number, default: 0 },
      },
    ],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

const AnonymousMessage = mongoose.model('AnonymousMessage', anonymousMessageSchema)

module.exports = { AnonymousMessage }
