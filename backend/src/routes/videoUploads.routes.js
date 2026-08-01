const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const {
  getCapabilities,
  initializeUpload,
  completeUpload,
  abortUpload,
} = require('../controllers/videoUploadsController')

const videoUploadsRouter = express.Router()

videoUploadsRouter.get('/capabilities', authenticate, getCapabilities)
videoUploadsRouter.post('/', authenticate, initializeUpload)
videoUploadsRouter.post('/:uploadId/complete', authenticate, completeUpload)
videoUploadsRouter.delete('/:uploadId', authenticate, abortUpload)

module.exports = { videoUploadsRouter }
