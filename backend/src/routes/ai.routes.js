const express = require('express')
const rateLimit = require('express-rate-limit')
const { authenticateOptional } = require('../middlewares/authenticate')
const { streamChat } = require('../controllers/aiController')

const aiRouter = express.Router()

// Dedicated rate limit for AI completions to protect against abuse
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 25, // limit each IP to 25 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Çok fazla yapay zeka isteği gönderdiniz. Lütfen bir dakika sonra tekrar deneyiniz.',
  },
})

aiRouter.post('/stream', authenticateOptional, aiRateLimiter, streamChat)

module.exports = { aiRouter }
