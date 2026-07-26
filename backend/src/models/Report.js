const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetKind: {
      type: String,
      enum: ['user', 'post', 'comment', 'message'],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    details: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    resolutionNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
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
  {
    timestamps: true,
  },
)

reportSchema.index({ status: 1, createdAt: -1 })
reportSchema.index({ targetKind: 1, targetId: 1, createdAt: -1 })

const Report = mongoose.model('Report', reportSchema)

module.exports = { Report }
