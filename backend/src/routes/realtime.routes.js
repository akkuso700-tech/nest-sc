const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const { validateRequest } = require('../middlewares/validateRequest')
const { syncRealtimeState } = require('../controllers/realtimeController')
const { syncSchema } = require('../validators/realtimeValidators')

const realtimeRouter = express.Router()

realtimeRouter.get('/sync', authenticate, validateRequest(syncSchema), syncRealtimeState)

module.exports = { realtimeRouter }
