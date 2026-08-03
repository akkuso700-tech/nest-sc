const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const { authorizeRoles } = require('../middlewares/authorizeRoles')
const { validateRequest } = require('../middlewares/validateRequest')
const {
  getWebVitalsSummary,
  recordClientError,
  recordWebVitals,
} = require('../controllers/performanceController')
const {
  recordClientErrorSchema,
  recordWebVitalsSchema,
  webVitalsSummarySchema,
} = require('../validators/performanceValidators')

const performanceRouter = express.Router()

performanceRouter.post(
  '/client-errors',
  validateRequest(recordClientErrorSchema),
  recordClientError,
)
performanceRouter.post(
  '/web-vitals',
  validateRequest(recordWebVitalsSchema),
  recordWebVitals,
)
performanceRouter.get(
  '/web-vitals/summary',
  authenticate,
  authorizeRoles('admin'),
  validateRequest(webVitalsSummarySchema),
  getWebVitalsSummary,
)

module.exports = { performanceRouter }
