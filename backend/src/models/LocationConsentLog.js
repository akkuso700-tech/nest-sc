const mongoose = require('mongoose')

const locationConsentLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['granted', 'denied'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      trim: true,
      default: 'browser-geolocation',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: '',
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    latRounded: {
      type: Number,
      default: null,
    },
    lngRounded: {
      type: Number,
      default: null,
    },
    accuracy: {
      type: Number,
      default: null,
    },
    consentGivenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    usageContext: {
      type: String,
      enum: ['nearby-discovery'],
      default: 'nearby-discovery',
    },
  },
  {
    timestamps: true,
  },
)

locationConsentLogSchema.index({ user: 1, createdAt: -1 })

const LocationConsentLog = mongoose.model(
  'LocationConsentLog',
  locationConsentLogSchema,
)

module.exports = { LocationConsentLog }
