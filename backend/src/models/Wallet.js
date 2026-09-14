const mongoose = require('mongoose')

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimeEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'TRY',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'frozen', 'restricted'],
      default: 'active',
      index: true,
    },
    defaultPayoutAccount: {
      fullName: { type: String, trim: true, default: '' },
      iban: { type: String, trim: true, default: '' },
      bankName: { type: String, trim: true, default: '' },
      taxOrIdNumber: { type: String, trim: true, default: '' },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
)

const Wallet = mongoose.model('Wallet', walletSchema)

module.exports = { Wallet }
