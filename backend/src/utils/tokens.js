const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { env } = require('../config/env')
const { normalizeMediaUrl } = require('./mediaUrls')

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createTokenPair(user) {
  const subject = user._id.toString()
  const refreshTokenId = crypto.randomUUID()

  const accessToken = jwt.sign(
    {
      sub: subject,
      role: user.role,
      type: 'access',
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn },
  )

  const refreshToken = jwt.sign(
    {
      sub: subject,
      role: user.role,
      type: 'refresh',
      tokenId: refreshTokenId,
    },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn },
  )

  return { accessToken, refreshToken, refreshTokenId }
}

function createPasswordResetToken(user) {
  const subject = user._id.toString()
  const passwordVersion = hashToken(user.passwordHash).slice(0, 16)

  const resetToken = jwt.sign(
    {
      sub: subject,
      type: 'password-reset',
      passwordVersion,
    },
    env.jwt.passwordResetSecret,
    { expiresIn: env.jwt.passwordResetExpiresIn },
  )

  return { resetToken, passwordVersion }
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret)
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret)
}

function verifyPasswordResetToken(token) {
  return jwt.verify(token, env.jwt.passwordResetSecret)
}

function serializeUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    authProvider: user.authProvider,
    emailVerifiedAt: user.emailVerifiedAt,
    username: user.username,
    birthDate: user.birthDate,
    location: user.location,
    role: user.role,
    accountStatus: user.accountStatus,
    moderation: user.moderation,
    bio: user.bio,
    avatarUrl: normalizeMediaUrl(user.avatarUrl, {
      preferConfiguredOrigin: false,
    }),
    coverUrl: normalizeMediaUrl(user.coverUrl, {
      preferConfiguredOrigin: false,
    }),
    isPrivate: user.isPrivate,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }
}

module.exports = {
  hashToken,
  createTokenPair,
  createPasswordResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyPasswordResetToken,
  serializeUser,
}
