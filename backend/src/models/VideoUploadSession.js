const mongoose = require('mongoose')

const videoUploadSessionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
      index: true,
    },
    provider: { type: String, enum: ['s3'], default: 's3', required: true },
    bucket: { type: String, required: true, trim: true },
    objectKey: { type: String, required: true, trim: true, unique: true },
    multipartUploadId: { type: String, required: true, trim: true },
    originalName: { type: String, default: 'loop-video.mp4', trim: true },
    mimeType: { type: String, required: true, trim: true },
    bytes: { type: Number, required: true, min: 1 },
    partSizeBytes: { type: Number, required: true, min: 5 * 1024 * 1024 },
    partCount: { type: Number, required: true, min: 1, max: 10000 },
    status: {
      type: String,
      enum: ['initiated', 'uploaded', 'attached', 'aborted', 'expired'],
      default: 'initiated',
      index: true,
    },
    completedParts: [
      {
        partNumber: { type: Number, required: true, min: 1 },
        etag: { type: String, required: true, trim: true },
      },
    ],
    expiresAt: { type: Date, required: true, index: true },
    deleteAfter: { type: Date, required: true },
    uploadedAt: { type: Date, default: null },
    attachedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

videoUploadSessionSchema.index({ deleteAfter: 1 }, { expireAfterSeconds: 0 })
videoUploadSessionSchema.index({ owner: 1, status: 1, createdAt: -1 })

const VideoUploadSession = mongoose.model('VideoUploadSession', videoUploadSessionSchema)

module.exports = { VideoUploadSession }
