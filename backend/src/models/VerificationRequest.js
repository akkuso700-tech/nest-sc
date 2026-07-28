const mongoose = require('mongoose')

const verificationRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['individual', 'creator', 'business', 'organization', 'public_figure'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_review', 'needs_info', 'approved', 'rejected', 'withdrawn', 'revoked'],
      default: 'pending',
      index: true,
    },
    statement: { type: String, trim: true, required: true, maxlength: 1000 },
    evidenceLinks: {
      type: [String],
      default: [],
      validate: {
        validator: (items) => items.length <= 5,
        message: 'At most five evidence links are allowed.',
      },
    },
    termsAcceptedAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true, index: true },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, trim: true, default: '', maxlength: 1000 },
    requestedInformation: { type: String, trim: true, default: '', maxlength: 1000 },
    rejectionReason: { type: String, trim: true, default: '', maxlength: 1000 },
    resubmissionAllowedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

verificationRequestSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
)
verificationRequestSchema.index({ status: 1, submittedAt: -1 })

const VerificationRequest = mongoose.model('VerificationRequest', verificationRequestSchema)

module.exports = { VerificationRequest }
