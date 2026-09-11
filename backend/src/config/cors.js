const { env } = require('./env')

function normalizeOrigin(origin) {
  const rawOrigin = String(origin || '').trim()

  if (!rawOrigin) {
    return ''
  }

  try {
    return new URL(rawOrigin).origin.toLowerCase()
  } catch {
    return rawOrigin.replace(/\/+$/, '').toLowerCase()
  }
}

const allowedOrigins = new Set(
  (env.corsOrigins || []).map((origin) => normalizeOrigin(origin)).filter(Boolean),
)

function isOriginAllowed(origin) {
  if (!origin) {
    return true
  }

  const normalizedOrigin = normalizeOrigin(origin)
  if (allowedOrigins.has(normalizedOrigin)) {
    return true
  }

  // Allow any localhost port in development/testing
  if (!env.isProduction) {
    try {
      const parsed = new URL(normalizedOrigin)
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return true
      }
    } catch {
      // Ignore parse error
    }
  }

  // Allow nest-sc.com subdomains
  try {
    const parsed = new URL(normalizedOrigin)
    const hostname = parsed.hostname.toLowerCase()
    if (hostname === 'nest-sc.com' || hostname.endsWith('.nest-sc.com')) {
      return true
    }
  } catch {
    // Ignore parse error
  }

  return false
}

const corsOptions = {
  origin(origin, callback) {
    callback(null, isOriginAllowed(origin))
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
}

module.exports = { corsOptions, isOriginAllowed, normalizeOrigin }

