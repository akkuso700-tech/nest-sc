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

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true)
      return
    }

    const normalizedOrigin = normalizeOrigin(origin)
    callback(null, allowedOrigins.has(normalizedOrigin))
  },
  credentials: true,
}

module.exports = { corsOptions }
