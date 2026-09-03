const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { env } = require('../config/env')
const { CallLog } = require('../models/CallLog')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')

const uploadsRoot = env.uploadsDir || path.resolve(process.cwd(), 'uploads')
const callsDir = path.join(uploadsRoot, 'calls')

function ensureCallsDirectory() {
  fs.mkdirSync(callsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    ensureCallsDirectory()
    cb(null, callsDir)
  },
  filename(req, file, cb) {
    const callId = req.params.callId || 'call'
    const ext = file.mimetype.includes('video') ? '.webm' : '.webm'
    const safeCallId = callId.replace(/[^a-zA-Z0-9_-]/g, '')
    cb(null, `${safeCallId}-${Date.now()}${ext}`)
  },
})

const uploadCallRecordingMiddleware = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max
  },
  fileFilter(req, file, cb) {
    if (
      file.mimetype.startsWith('audio/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype === 'application/octet-stream'
    ) {
      cb(null, true)
    } else {
      cb(new AppError('Invalid media format for call recording.', 400))
    }
  },
}).single('recording')

const uploadRecording = asyncHandler(async (req, res) => {
  const { callId } = req.params
  const file = req.file

  if (!file) {
    throw new AppError('No recording file received.', 400)
  }

  let callLog = await CallLog.findOne({ callId })
  const relativeUrl = `/uploads/calls/${file.filename}`

  if (!callLog) {
    callLog = new CallLog({
      callId,
      caller: req.user._id,
      recipient: req.body.recipientId || req.user._id,
      callType: file.mimetype.startsWith('video/') ? 'video' : 'voice',
      status: 'completed',
      durationSec: Number(req.body.durationSec || 0),
      startedAt: new Date(Date.now() - (Number(req.body.durationSec || 0) * 1000)),
      endedAt: new Date(),
    })
  }

  if (!callLog.recordingUrl || file.size >= (callLog.fileSizeBytes || 0)) {
    callLog.recordingUrl = relativeUrl
    callLog.fileSizeBytes = file.size
    callLog.mimeType = file.mimetype
    callLog.recordedBy = req.user._id
    if (req.body.durationSec) {
      callLog.durationSec = Math.max(callLog.durationSec || 0, Number(req.body.durationSec))
    }
  }
  callLog.status = 'completed'
  await callLog.save()

  res.json({
    ok: true,
    callLog,
  })
})

module.exports = {
  uploadCallRecordingMiddleware,
  uploadRecording,
}
