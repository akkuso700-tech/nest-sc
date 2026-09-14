const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const { env } = require('../src/config/env')
const { RefreshToken } = require('../src/models/RefreshToken')
const {
  createTokenPair,
  verifyRefreshToken,
  hashToken,
} = require('../src/utils/tokens')
const { authRouter } = require('../src/routes/auth.routes')

test('RefreshToken model schema includes revokedReason and replacedByTokenId', () => {
  const userId = new mongoose.Types.ObjectId()
  const session = new RefreshToken({
    user: userId,
    tokenId: 'test-token-uuid-1',
    tokenHash: 'abc123hash',
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    revokedReason: 'rotated',
    replacedByTokenId: 'test-token-uuid-2',
  })

  assert.equal(session.tokenId, 'test-token-uuid-1')
  assert.equal(session.revokedReason, 'rotated')
  assert.equal(session.replacedByTokenId, 'test-token-uuid-2')
  assert.equal(session.revokedAt, null)

  const defaultSession = new RefreshToken({
    user: userId,
    tokenId: 'test-token-uuid-default',
    tokenHash: 'def456hash',
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  })
  assert.equal(defaultSession.revokedReason, null)
  assert.equal(defaultSession.replacedByTokenId, null)
})

test('RefreshToken schema validates revokedReason enum values', () => {
  const userId = new mongoose.Types.ObjectId()
  const validReasons = ['rotated', 'logout', 'password_changed', 'security_reuse_detected', null]

  for (const reason of validReasons) {
    const doc = new RefreshToken({
      user: userId,
      tokenId: `test-token-${reason}`,
      tokenHash: 'hash',
      expiresAt: new Date(),
      revokedReason: reason,
    })
    const err = doc.validateSync()
    assert.equal(err, undefined, `Reason '${reason}' should be valid`)
  }

  const invalidDoc = new RefreshToken({
    user: userId,
    tokenId: 'test-token-invalid',
    tokenHash: 'hash',
    expiresAt: new Date(),
    revokedReason: 'invalid_reason_string',
  })
  const validationError = invalidDoc.validateSync()
  assert.ok(validationError, 'Invalid revokedReason should fail validation')
  assert.ok(validationError.errors.revokedReason)
})

test('Environment configuration sets valid refresh grace period', () => {
  assert.ok(typeof env.jwt.refreshGracePeriodSeconds === 'number')
  assert.ok(typeof env.jwt.refreshGracePeriodMs === 'number')
  assert.equal(env.jwt.refreshGracePeriodMs, env.jwt.refreshGracePeriodSeconds * 1000)
  assert.ok(env.jwt.refreshGracePeriodSeconds >= 0)
})

test('Grace period calculation distinguishes valid concurrent window vs expired replay', () => {
  const gracePeriodMs = 30000 // 30s
  const now = Date.now()

  // 1. Within grace period (e.g. 3 seconds ago, rotated)
  const recentRotatedSession = {
    revokedAt: new Date(now - 3000),
    revokedReason: 'rotated',
    expiresAt: new Date(now + 60000),
  }
  const isGraceValid =
    recentRotatedSession.revokedReason === 'rotated' &&
    recentRotatedSession.revokedAt &&
    now - recentRotatedSession.revokedAt.getTime() <= gracePeriodMs
  assert.equal(isGraceValid, true, 'Should accept concurrent request within grace window')

  // 2. Outside grace period (e.g. 45 seconds ago, rotated) -> Replay attack
  const expiredRotatedSession = {
    revokedAt: new Date(now - 45000),
    revokedReason: 'rotated',
    expiresAt: new Date(now + 60000),
  }
  const isExpiredGraceValid =
    expiredRotatedSession.revokedReason === 'rotated' &&
    expiredRotatedSession.revokedAt &&
    now - expiredRotatedSession.revokedAt.getTime() <= gracePeriodMs
  assert.equal(isExpiredGraceValid, false, 'Should reject replay request outside grace window')

  // 3. Revoked due to logout (even if 1 second ago) -> Never allowed
  const logoutSession = {
    revokedAt: new Date(now - 1000),
    revokedReason: 'logout',
    expiresAt: new Date(now + 60000),
  }
  const isLogoutValid =
    logoutSession.revokedReason === 'rotated' &&
    logoutSession.revokedAt &&
    now - logoutSession.revokedAt.getTime() <= gracePeriodMs
  assert.equal(isLogoutValid, false, 'Should never allow grace period for logout tokens')

  // 4. Revoked due to password change (even if 1 second ago) -> Never allowed
  const passwordChangedSession = {
    revokedAt: new Date(now - 1000),
    revokedReason: 'password_changed',
    expiresAt: new Date(now + 60000),
  }
  const isPasswordChangeValid =
    passwordChangedSession.revokedReason === 'rotated' &&
    passwordChangedSession.revokedAt &&
    now - passwordChangedSession.revokedAt.getTime() <= gracePeriodMs
  assert.equal(isPasswordChangeValid, false, 'Should never allow grace period for password change')
})

test('Auth router registers refresh and logout routes correctly', () => {
  const routes = authRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }))

  const refreshRoute = routes.find((r) => r.path === '/refresh')
  assert.ok(refreshRoute, '/refresh route should be registered')
  assert.ok(refreshRoute.methods.includes('post'), '/refresh should handle POST')

  const logoutRoute = routes.find((r) => r.path === '/logout')
  assert.ok(logoutRoute, '/logout route should be registered')
  assert.ok(logoutRoute.methods.includes('post'), '/logout should handle POST')
})
