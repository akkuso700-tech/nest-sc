function buildDefaultApiUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000/api/v1'
  }

  const hostname = window.location.hostname
  const protocol = window.location.protocol || 'https:'
  const normalizedHost = hostname.replace(/^www\./, '')

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api/v1'
  }

  if (normalizedHost === 'demo.nest-sc.com') {
    return 'https://api-demo.nest-sc.com/api/v1'
  }

  if (normalizedHost === 'nest-sc.com') {
    return 'https://api.nest-sc.com/api/v1'
  }

  return `${protocol}//${hostname}/api/v1`
}

function resolvePinnedApiUrlByHost() {
  if (typeof window === 'undefined') {
    return ''
  }

  const normalizedHost = String(window.location.hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')

  if (normalizedHost === 'demo.nest-sc.com') {
    return 'https://api-demo.nest-sc.com/api/v1'
  }

  if (normalizedHost === 'nest-sc.com') {
    return 'https://api.nest-sc.com/api/v1'
  }

  return ''
}

function shouldUseEnvApiUrl(value) {
  const envValue = String(value || '').trim()

  if (!envValue) {
    return false
  }

  if (typeof window === 'undefined') {
    return true
  }

  const normalizedHost = String(window.location.hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
  const isLocalHost =
    normalizedHost === 'localhost' || normalizedHost === '127.0.0.1'
  const isLocalEnvUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(
    envValue,
  )

  if (!isLocalHost && isLocalEnvUrl) {
    return false
  }

  return true
}

const pinnedApiUrl = resolvePinnedApiUrlByHost()
const defaultApiUrl = buildDefaultApiUrl()
const envApiUrl = String(import.meta.env.VITE_API_URL || '').trim()
const effectiveEnvApiUrl = shouldUseEnvApiUrl(envApiUrl) ? envApiUrl : ''
const apiBaseUrl = (pinnedApiUrl || effectiveEnvApiUrl || defaultApiUrl).replace(/\/$/, '')
const apiOrigin = apiBaseUrl.replace(/\/api\/v1$/, '')
const requestApiBaseCandidates = resolveApiBaseCandidates(apiBaseUrl, {
  lockToPrimary: Boolean(pinnedApiUrl),
})

let refreshPromise = null

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function pushUnique(target, value) {
  const normalizedValue = normalizeBaseUrl(value)

  if (!normalizedValue || target.includes(normalizedValue)) {
    return
  }

  target.push(normalizedValue)
}

function resolveApiBaseCandidates(primaryBaseUrl, options = {}) {
  const { lockToPrimary = false } = options
  const candidates = []
  pushUnique(candidates, primaryBaseUrl)

  if (lockToPrimary) {
    return candidates
  }

  if (typeof window === 'undefined') {
    return candidates
  }

  const protocol = window.location.protocol || 'https:'
  const hostName = window.location.hostname || ''
  const normalizedHost = hostName.replace(/^www\./, '')
  const appOrigin = window.location.origin || `${protocol}//${window.location.host}`

  pushUnique(candidates, `${appOrigin}/api/v1`)

  if (normalizedHost && normalizedHost !== 'localhost' && normalizedHost !== '127.0.0.1') {
    pushUnique(candidates, `${protocol}//api.${normalizedHost}/api/v1`)
    pushUnique(candidates, `${protocol}//${normalizedHost}/api/v1`)
    pushUnique(candidates, `${protocol}//www.${normalizedHost}/api/v1`)
  }

  return candidates
}

async function fetchWithApiFallback(path, options) {
  let lastError = null

  for (const baseUrl of requestApiBaseCandidates) {
    try {
      const response = await fetch(`${baseUrl}${path}`, options)
      return response
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('API request failed.')
}

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return null
  }

  return response.json()
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetchWithApiFallback('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    }).then(async (response) => {
      const payload = await parseResponse(response)

      if (!response.ok) {
        throw new ApiError(
          payload?.message || 'Session refresh failed.',
          response.status,
          payload?.issues || payload?.details || null,
        )
      }

      return payload
    }).finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export async function apiRequest(path, options = {}, config = {}) {
  const { skipRefreshRetry = false } = config
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData
  const response = await fetchWithApiFallback(path, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(!isFormDataBody && options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      ...(isFormDataBody && options.body?.get?.('contentType')
        ? { 'X-Content-Type': String(options.body.get('contentType')) }
        : {}),
    },
  })

  const payload = await parseResponse(response)

  if (response.status === 401 && !skipRefreshRetry && !path.startsWith('/auth/')) {
    await refreshSession()

    return apiRequest(path, options, { skipRefreshRetry: true })
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.message || 'Request failed.',
      response.status,
      payload?.issues || payload?.details || null,
    )
  }

  return payload
}

export { apiBaseUrl, apiOrigin, refreshSession }
