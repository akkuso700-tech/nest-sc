const mongoose = require('mongoose')

const emailVerificationTokenSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null, index: true },
    attemptCount: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
)

emailVerificationTokenSchema.index({ email: 1, createdAt: -1 })

const EmailVerificationToken = mongoose.model(
  'EmailVerificationToken',
  emailVerificationTokenSchema,
)

module.exports = { EmailVerificationToken }

