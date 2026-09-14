const mongoose = require('mongoose')

const payoutRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 250, // Minimum ₺250 çekim tutarı
    },
    currency: {
      type: String,
      default: 'TRY',
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    iban: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    bankName: {
      type: String,
      trim: true,
      default: '',
    },
    taxOrIdNumber: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'rejected'],
      default: 'pending',
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    transferReceiptUrl: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true },
)

payoutRequestSchema.index({ user: 1, createdAt: -1 })
payoutRequestSchema.index({ status: 1, requestedAt: -1 })

const PayoutRequest = mongoose.model('PayoutRequest', payoutRequestSchema)

module.exports = { PayoutRequest }
