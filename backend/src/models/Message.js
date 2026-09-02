const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
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
    text: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    media: [
      {
        url: { type: String, default: '' },
        posterUrl: { type: String, default: '' },
        type: { type: String, enum: ['image', 'video', 'audio'], required: true },
        durationSeconds: { type: Number, default: 0 },
      },
    ],
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deletedByUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        emoji: {
          type: String,
          required: true,
          trim: true,
          maxlength: 16,
        },
      },
    ],
    linkPreview: {
      url: { type: String, trim: true },
      title: { type: String, trim: true },
      description: { type: String, trim: true },
      image: { type: String, trim: true },
      siteName: { type: String, trim: true },
      domain: { type: String, trim: true },
      favicon: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  },
)

messageSchema.index({ conversation: 1, createdAt: -1 })
messageSchema.index({ sender: 1, createdAt: -1 })
messageSchema.index({ recipient: 1, readAt: 1, createdAt: -1 })

const Message = mongoose.model('Message', messageSchema)

module.exports = { Message }
