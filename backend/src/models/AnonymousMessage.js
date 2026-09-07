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
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Auto-expire messages after 3 days
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  },
)

const AnonymousMessage = mongoose.model('AnonymousMessage', anonymousMessageSchema)

module.exports = { AnonymousMessage }
