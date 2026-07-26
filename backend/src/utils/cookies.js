const { env } = require('../config/env')

const accessTokenCookieName = 'accessToken'
const refreshTokenCookieName = 'refreshToken'

function buildBaseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
    domain: env.cookieDomain,
  }
}

function buildAccessCookieOptions() {
  return {
    ...buildBaseCookieOptions(),
    maxAge: env.jwt.accessExpiresMs,
  }
}

function buildRefreshCookieOptions() {
  return {
    ...buildBaseCookieOptions(),
    maxAge: env.jwt.refreshExpiresMs,
  }
}

function buildSessionCookieOptions(baseOptions, rememberMe = true) {
  if (rememberMe) {
    return baseOptions
  }

  const { maxAge, ...sessionOptions } = baseOptions
  return sessionOptions
}

function setAuthCookies(res, tokens, options = {}) {
  const rememberMe = options.rememberMe !== false

  res.cookie(
    accessTokenCookieName,
    tokens.accessToken,
    buildSessionCookieOptions(buildAccessCookieOptions(), rememberMe),
  )
  res.cookie(
    refreshTokenCookieName,
    tokens.refreshToken,
    buildSessionCookieOptions(buildRefreshCookieOptions(), rememberMe),
  )
}

function clearAuthCookies(res) {
  res.clearCookie(accessTokenCookieName, {
    ...buildAccessCookieOptions(),
    maxAge: undefined,
  })
  res.clearCookie(refreshTokenCookieName, {
    ...buildRefreshCookieOptions(),
    maxAge: undefined,
  })
}

function parseCookieHeader(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const [key, ...valueParts] = item.split('=')
      accumulator[key] = decodeURIComponent(valueParts.join('='))
      return accumulator
    }, {})
}

module.exports = {
  accessTokenCookieName,
  refreshTokenCookieName,
  setAuthCookies,
  clearAuthCookies,
  parseCookieHeader,
}
