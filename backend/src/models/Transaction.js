const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema(
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
      index: true,
    },
    type: {
      type: String,
      enum: [
        'loop_reward',
        'tip_received',
        'tip_sent',
        'group_subscription',
        'profile_subscription',
        'payout_withdrawal',
        'adjustment',
      ],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    platformFee: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'TRY',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'completed',
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    sourceUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    referenceModel: {
      type: String,
      enum: ['Post', 'Group', 'PayoutRequest', 'System', null],
      default: null,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true },
)

transactionSchema.index({ user: 1, createdAt: -1 })
transactionSchema.index({ status: 1, createdAt: -1 })

const Transaction = mongoose.model('Transaction', transactionSchema)

module.exports = { Transaction }
