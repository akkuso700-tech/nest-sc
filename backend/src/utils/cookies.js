const { env } = require('../config/env')

const accessTokenCookieName = 'accessToken'
const refreshTokenCookieName = 'refreshToken'
const sessionMarkerCookieName = 'nest_session'

function resolveCookieDomain() {
  if (env.cookieDomain) {
    return env.cookieDomain
  }

  if (!env.isProduction) {
    return undefined
  }

  try {
    const parsed = new URL(env.clientUrl)
    const host = parsed.hostname.toLowerCase()
    if (host === 'nest-sc.com' || host.endsWith('.nest-sc.com')) {
      return '.nest-sc.com'
    }
  } catch {
    // Ignore URL parse error
  }

  return undefined
}

function buildBaseCookieOptions() {
  const domain = resolveCookieDomain()
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
  }
}

function buildMarkerCookieOptions() {
  const domain = resolveCookieDomain()
  return {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
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
  res.cookie(
    sessionMarkerCookieName,
    '1',
    buildSessionCookieOptions({
      ...buildMarkerCookieOptions(),
      maxAge: env.jwt.refreshExpiresMs,
    }, rememberMe),
  )
}

function clearAuthCookies(res) {
  const baseOptions = buildBaseCookieOptions()
  const markerOptions = buildMarkerCookieOptions()

  res.clearCookie(accessTokenCookieName, baseOptions)
  res.clearCookie(refreshTokenCookieName, baseOptions)
  res.clearCookie(sessionMarkerCookieName, markerOptions)

  // Also clear legacy host-only cookies if a domain is configured
  if (baseOptions.domain) {
    const { domain: _d1, ...hostOnlyBase } = baseOptions
    const { domain: _d2, ...hostOnlyMarker } = markerOptions
    res.clearCookie(accessTokenCookieName, hostOnlyBase)
    res.clearCookie(refreshTokenCookieName, hostOnlyBase)
    res.clearCookie(sessionMarkerCookieName, hostOnlyMarker)
  }
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
