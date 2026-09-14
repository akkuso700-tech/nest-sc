const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const monetizationController = require('../controllers/monetizationController')

const monetizationRouter = express.Router()

// Tüm para kazanma rotaları giriş yapmış kullanıcılar içindir
monetizationRouter.use(authenticate)

monetizationRouter.get('/status', monetizationController.getStatus)
monetizationRouter.post('/apply', monetizationController.apply)
monetizationRouter.get('/dashboard', monetizationController.getDashboard)
monetizationRouter.post('/payout-request', monetizationController.postPayoutRequest)
monetizationRouter.post('/payout-account', monetizationController.saveAccount)
monetizationRouter.post('/simulate', monetizationController.simulate)

module.exports = { monetizationRouter }
