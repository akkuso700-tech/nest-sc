const { User } = require('../models/User')
const { AppError } = require('../utils/AppError')
const { parseCookieHeader } = require('../utils/cookies')
const { verifyAccessToken } = require('../utils/tokens')

function extractAccessToken(req) {
  const authorizationHeader = req.headers.authorization || ''
  const bearerToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice(7)
    : null
  const cookies = req.cookies || parseCookieHeader(req.headers.cookie)

  return bearerToken || cookies.accessToken || null
}

async function attachUserFromAccessToken(req) {
  const accessToken = extractAccessToken(req)

  if (!accessToken) {
    return null
  }

  const payload = verifyAccessToken(accessToken)
  const user = await User.findById(payload.sub)

  if (!user) {
    throw new AppError('User not found.', 401)
  }

  if (user.accountStatus === 'suspended') {
    throw new AppError('Your account is suspended.', 403)
  }

  req.user = user
  req.auth = payload

  return user
}

async function authenticate(req, res, next) {
  try {
    const user = await attachUserFromAccessToken(req)

    if (!user) {
      next(new AppError('Authentication required.', 401))
      return
    }

    next()
  } catch (error) {
    next(error)
  }
}

async function authenticateOptional(req, res, next) {
  try {
    await attachUserFromAccessToken(req)
    next()
  } catch (error) {
    req.user = null
    req.auth = null
    next()
  }
}

module.exports = {
  authenticate,
  authenticateOptional,
  extractAccessToken,
  attachUserFromAccessToken,
}
