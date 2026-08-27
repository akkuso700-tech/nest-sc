const mongoose = require('mongoose')

const clientErrorSchema = new mongoose.Schema(
  {
    fingerprint: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      index: true,
    },
    kind: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      index: true,
    },
    source: {
      type: String,
      default: '',
      trim: true,
      maxlength: 180,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    stack: {
      type: String,
      default: '',
      maxlength: 4000,
    },
    route: {
      type: String,
      default: '/',
      trim: true,
      maxlength: 180,
      index: true,
    },
    userAgent: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

clientErrorSchema.index({ fingerprint: 1, createdAt: -1 })
clientErrorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 })

const ClientError = mongoose.model('ClientError', clientErrorSchema)

module.exports = { ClientError }
