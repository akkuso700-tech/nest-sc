const mongoose = require('mongoose')

const telemetryReceiptSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 64,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

telemetryReceiptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const TelemetryReceipt = mongoose.model('TelemetryReceipt', telemetryReceiptSchema)

module.exports = { TelemetryReceipt }
