const express = require('express')
const { validateRequest } = require('../middlewares/validateRequest')
const { authenticate } = require('../middlewares/authenticate')
const {
  register,
  requestSignUpCode,
  verifySignUpCode,
  startGoogleAuth,
  googleCallback,
  login,
  checkLoginIdentifier,
  checkEmailAvailability,
  getSignupContracts,
  requestPasswordReset,
  confirmPasswordReset,
  refreshSession,
  logout,
  getCurrentUser,
} = require('../controllers/authController')
const {
  registerSchema,
  signupRequestCodeSchema,
  signupVerificationSchema,
  loginSchema,
  loginIdentifierSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  emailAvailabilitySchema,
} = require('../validators/authValidators')

const authRouter = express.Router()

authRouter.post('/register', validateRequest(registerSchema), register)
authRouter.post('/register/request-code', validateRequest(signupRequestCodeSchema), requestSignUpCode)
authRouter.post('/register/verify-code', validateRequest(signupVerificationSchema), verifySignUpCode)
authRouter.post('/register/check-email', validateRequest(emailAvailabilitySchema), checkEmailAvailability)
authRouter.get('/signup-contracts', getSignupContracts)
authRouter.get('/google/start', startGoogleAuth)
authRouter.get('/google/callback', googleCallback)
authRouter.post('/login/check-identifier', validateRequest(loginIdentifierSchema), checkLoginIdentifier)
authRouter.post('/login', validateRequest(loginSchema), login)
authRouter.post('/password-reset/request', validateRequest(passwordResetRequestSchema), requestPasswordReset)
authRouter.post('/password-reset/confirm', validateRequest(passwordResetConfirmSchema), confirmPasswordReset)
authRouter.post('/refresh', refreshSession)
authRouter.post('/logout', logout)
authRouter.get('/me', authenticate, getCurrentUser)

module.exports = { authRouter }
