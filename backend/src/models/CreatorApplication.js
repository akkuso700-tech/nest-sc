const mongoose = require('mongoose')

const creatorApplicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    metricsSnapshot: {
      followersCount: { type: Number, default: 0 },
      viewsCount30d: { type: Number, default: 0 },
      isEmailVerified: { type: Boolean, default: false },
      accountAgeDays: { type: Number, default: 0 },
      hasNoActiveViolations: { type: Boolean, default: true },
      isProfileVerified: { type: Boolean, default: false },
    },
    statement: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    termsAcceptedAt: {
      type: Date,
      required: true,
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
    reviewNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true },
)

creatorApplicationSchema.index({ user: 1, createdAt: -1 })

const CreatorApplication = mongoose.model('CreatorApplication', creatorApplicationSchema)

module.exports = { CreatorApplication }
