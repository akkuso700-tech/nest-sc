const mongoose = require('mongoose')

const videoProcessingJobSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    mediaIndex: { type: Number, min: 0, default: 0 },
    sourcePath: { type: String, required: true, trim: true },
    originalName: { type: String, default: 'loop-video' },
    mimeType: { type: String, default: 'video/mp4' },
    status: {
      type: String,
      enum: ['queued', 'processing', 'retry', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    attempts: { type: Number, min: 0, default: 0 },
    maxAttempts: { type: Number, min: 1, default: 3 },
    nextRunAt: { type: Date, default: Date.now, index: true },
    leaseExpiresAt: { type: Date, default: null, index: true },
    workerId: { type: String, default: '' },
    errorCode: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

videoProcessingJobSchema.index({ status: 1, nextRunAt: 1, leaseExpiresAt: 1, createdAt: 1 })
videoProcessingJobSchema.index({ post: 1, mediaIndex: 1 }, { unique: true })

const VideoProcessingJob = mongoose.model('VideoProcessingJob', videoProcessingJobSchema)

module.exports = { VideoProcessingJob }
