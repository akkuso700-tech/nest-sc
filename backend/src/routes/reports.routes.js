const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const { validateRequest } = require('../middlewares/validateRequest')
const { createReport, listMyReports } = require('../controllers/reportsController')
const { createReportSchema, listMyReportsSchema } = require('../validators/reportValidators')

const reportsRouter = express.Router()

reportsRouter.use(authenticate)
reportsRouter.get('/mine', validateRequest(listMyReportsSchema), listMyReports)
reportsRouter.post('/', validateRequest(createReportSchema), createReport)

module.exports = { reportsRouter }
