const mongoose = require('mongoose')
const { asyncHandler } = require('../utils/asyncHandler')
const { AppError } = require('../utils/AppError')
const {
  createDirectVideoUpload,
  completeDirectVideoUpload,
  abortDirectVideoUpload,
  getDirectVideoUploadCapabilities,
} = require('../services/directVideoUploadService')

const getCapabilities = asyncHandler(async (_req, res) => {
  res.json({ capabilities: await getDirectVideoUploadCapabilities() })
})

const initializeUpload = asyncHandler(async (req, res) => {
  const upload = await createDirectVideoUpload({
    ownerId: req.user._id,
    fileName: req.body?.fileName,
    mimeType: req.body?.mimeType,
    bytes: req.body?.bytes,
  })
  res.status(201).json({ upload })
})

const completeUpload = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.uploadId)) {
    throw new AppError('Invalid video upload id.', 400)
  }
  const session = await completeDirectVideoUpload({
    ownerId: req.user._id,
    uploadId: req.params.uploadId,
    parts: req.body?.parts,
  })
  res.json({
    upload: {
      id: session.id,
      status: session.status,
      bytes: session.bytes,
      uploadedAt: session.uploadedAt,
    },
  })
})

const abortUpload = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.uploadId)) {
    throw new AppError('Invalid video upload id.', 400)
  }
  await abortDirectVideoUpload({ ownerId: req.user._id, uploadId: req.params.uploadId })
  res.status(204).end()
})

module.exports = { getCapabilities, initializeUpload, completeUpload, abortUpload }
