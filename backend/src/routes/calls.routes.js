const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const {
  uploadCallRecordingMiddleware,
  uploadRecording,
} = require('../controllers/callsController')

const callsRouter = express.Router()

callsRouter.post(
  '/:callId/recording',
  authenticate,
  uploadCallRecordingMiddleware,
  uploadRecording,
)

module.exports = { callsRouter }
