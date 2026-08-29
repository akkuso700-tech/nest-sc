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
        type: { type: String, enum: ['image', 'video'], required: true },
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
