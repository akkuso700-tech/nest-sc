const mongoose = require('mongoose')

const webVitalSchema = new mongoose.Schema(
  {
    pageViewId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    name: {
      type: String,
      enum: ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    rating: {
      type: String,
      enum: ['good', 'needs-improvement', 'poor'],
      required: true,
    },
    route: {
      type: String,
      default: '/',
      trim: true,
      maxlength: 180,
    },
    navigationType: {
      type: String,
      enum: ['navigate', 'reload', 'back_forward', 'prerender', 'unknown'],
      default: 'unknown',
    },
    deviceClass: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop'],
      default: 'desktop',
    },
    connectionType: {
      type: String,
      enum: ['slow-2g', '2g', '3g', '4g', 'unknown'],
      default: 'unknown',
    },
    saveData: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

webVitalSchema.index({ pageViewId: 1, name: 1 }, { unique: true })
webVitalSchema.index({ name: 1, createdAt: -1 })
webVitalSchema.index({ route: 1, name: 1, createdAt: -1 })
webVitalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 })

const WebVital = mongoose.model('WebVital', webVitalSchema)

module.exports = { WebVital }
