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
const envApiUrl = String(import.meta.env?.VITE_API_URL || '').trim()
const effectiveEnvApiUrl = shouldUseEnvApiUrl(envApiUrl) ? envApiUrl : ''
const apiBaseUrl = (pinnedApiUrl || effectiveEnvApiUrl || defaultApiUrl).replace(/\/$/, '')
const apiOrigin = apiBaseUrl.replace(/\/api\/v1$/, '')
const requestApiBaseCandidates = resolveApiBaseCandidates(apiBaseUrl, {
  lockToPrimary: Boolean(pinnedApiUrl),
})
const configuredRequestTimeoutMs = Number(import.meta.env?.VITE_API_TIMEOUT_MS)
const API_REQUEST_TIMEOUT_MS = Number.isFinite(configuredRequestTimeoutMs)
  ? Math.min(Math.max(configuredRequestTimeoutMs, 3000), 30000)
  : 10000
const API_RETRY_DELAY_MS = 250

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

function isIdempotentMethod(method = 'GET') {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase())
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function createTimedSignal(externalSignal, timeoutMs) {
  const controller = new AbortController()
  const handleExternalAbort = () => controller.abort(externalSignal?.reason)

  if (externalSignal?.aborted) {
    handleExternalAbort()
  } else {
    externalSignal?.addEventListener('abort', handleExternalAbort, { once: true })
  }

  const timeoutId = window.setTimeout(() => {
    const timeoutError = new Error('API request timed out.')
    timeoutError.name = 'TimeoutError'
    timeoutError.code = 'API_TIMEOUT'
    controller.abort(timeoutError)
  }, timeoutMs)

  return {
    signal: controller.signal,
    cleanup() {
      window.clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', handleExternalAbort)
    },
  }
}

async function fetchWithApiFallback(path, options = {}, config = {}) {
  let lastError = null
  let lastResponse = null
  const method = String(options.method || 'GET').toUpperCase()
  const retryEnabled = config.retry ?? isIdempotentMethod(method)
  const maxAttempts = retryEnabled ? 2 : 1
  const timeoutMs = Math.min(
    Math.max(Number(config.timeoutMs) || API_REQUEST_TIMEOUT_MS, 100),
    60000,
  )

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    for (const baseUrl of requestApiBaseCandidates) {
      const timedSignal = createTimedSignal(options.signal, timeoutMs)

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          signal: timedSignal.signal,
        })
        lastResponse = response

        if (!retryEnabled || !isRetryableStatus(response.status)) {
          return response
        }
      } catch (error) {
        lastError = timedSignal.signal.reason || error
        if (options.signal?.aborted) throw lastError
      } finally {
        timedSignal.cleanup()
      }
    }

    if (attempt < maxAttempts - 1) {
      await wait(API_RETRY_DELAY_MS * (attempt + 1))
    }
  }

  if (lastResponse) return lastResponse
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
    refreshPromise = fetchWithApiFallback(
      '/auth/refresh',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      },
      { retry: true },
    ).then(async (response) => {
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
  const { skipRefreshRetry = false, timeoutMs, retry } = config
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData
  const response = await fetchWithApiFallback(
    path,
    {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(!isFormDataBody && options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      ...options,
    },
    { timeoutMs, retry },
  )

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

export const _test = {
  createTimedSignal,
  fetchWithApiFallback,
  isIdempotentMethod,
  isRetryableStatus,
}

export { apiBaseUrl, apiOrigin, refreshSession }
