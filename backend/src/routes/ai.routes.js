const express = require('express')
const rateLimit = require('express-rate-limit')
const { authenticateOptional } = require('../middlewares/authenticate')
const { streamChat, summarizePost, magicCompose, translateContent } = require('../controllers/aiController')

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
aiRouter.post('/summarize-post/:postId', authenticateOptional, aiRateLimiter, summarizePost)
aiRouter.get('/summarize-post/:postId', authenticateOptional, aiRateLimiter, summarizePost)
aiRouter.post('/magic-compose', authenticateOptional, aiRateLimiter, magicCompose)
aiRouter.post('/translate', authenticateOptional, aiRateLimiter, translateContent)

module.exports = { aiRouter }
