import {
  pinnedApiUrl as configPinnedApiUrl,
  pinnedFallbackApiUrl as configPinnedFallbackApiUrl,
} from './domainConfig.js'

function buildDefaultApiUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000/api/v1'
  }

  const hostname = window.location.hostname
  const protocol = window.location.protocol || 'https:'

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api/v1'
  }

  if (configPinnedApiUrl) {
    return configPinnedApiUrl
  }

  return `${protocol}//${hostname}/api/v1`
}

function resolvePinnedApiUrlByHost() {
  return configPinnedApiUrl
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
const apiBaseUrl = (effectiveEnvApiUrl || pinnedApiUrl || defaultApiUrl).replace(/\/$/, '')
const apiOrigin = apiBaseUrl.replace(/\/api\/v1$/, '')
const requestApiBaseCandidates = resolveApiBaseCandidates(apiBaseUrl, {
  fallbackBaseUrl: configPinnedFallbackApiUrl,
  lockToPrimary: Boolean(pinnedApiUrl || effectiveEnvApiUrl),
})
const configuredRequestTimeoutMs = Number(import.meta.env?.VITE_API_TIMEOUT_MS)
const API_REQUEST_TIMEOUT_MS = Number.isFinite(configuredRequestTimeoutMs)
  ? Math.min(Math.max(configuredRequestTimeoutMs, 3000), 60000)
  : 10000
const API_RETRY_DELAY_MS = 350

const ACCESS_TOKEN_STORAGE_KEY = 'nest_access_token'
const ACCESS_TOKEN_EXP_STORAGE_KEY = 'nest_access_token_exp'
const REFRESH_TOKEN_STORAGE_KEY = 'nest_refresh_token'

let memoryAccessToken = null
let memoryAccessTokenExp = 0
let memoryRefreshToken = null
let refreshPromise = null
const sessionExpiredListeners = new Set()

function parseJwtExpMs(token) {
  if (!token || typeof token !== 'string') return 0
  try {
    const parts = token.split('.')
    if (parts.length < 2) return 0
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const jsonPayload =
      typeof window !== 'undefined' && typeof window.atob === 'function'
        ? window.atob(padded)
        : typeof globalThis.Buffer !== 'undefined'
          ? globalThis.Buffer.from(padded, 'base64').toString('utf8')
          : ''
    if (!jsonPayload) return 0
    const parsed = JSON.parse(jsonPayload)
    return typeof parsed?.exp === 'number' ? parsed.exp * 1000 : 0
  } catch {
    return 0
  }
}

export function getAccessToken() {
  if (memoryAccessToken) {
    return memoryAccessToken
  }
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const stored = window.localStorage?.getItem(ACCESS_TOKEN_STORAGE_KEY)
    const storedExp = Number(window.localStorage?.getItem(ACCESS_TOKEN_EXP_STORAGE_KEY) || 0)
    if (stored) {
      memoryAccessToken = stored
      memoryAccessTokenExp = storedExp || parseJwtExpMs(stored)
      return stored
    }
  } catch {
    // Ignore storage errors
  }
  return null
}

export function isAccessTokenExpired(skewMs = 10000) {
  const token = getAccessToken()
  if (!token) return true
  const expMs = memoryAccessTokenExp || parseJwtExpMs(token)
  if (!expMs) return false
  return Date.now() + skewMs >= expMs
}

export function setAccessToken(token, expiresInMs = 0) {
  const normalized = typeof token === 'string' ? token.trim() : ''
  if (!normalized) {
    clearAccessToken()
    return
  }
  const expMs =
    Number(expiresInMs) > 0
      ? Date.now() + Number(expiresInMs)
      : parseJwtExpMs(normalized)
  memoryAccessToken = normalized
  memoryAccessTokenExp = expMs
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(ACCESS_TOKEN_STORAGE_KEY, normalized)
      if (expMs > 0) {
        window.localStorage?.setItem(ACCESS_TOKEN_EXP_STORAGE_KEY, String(expMs))
      }
    } catch {
      // Ignore storage errors
    }
  }
}

export function clearAccessToken() {
  memoryAccessToken = null
  memoryAccessTokenExp = 0
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.removeItem(ACCESS_TOKEN_STORAGE_KEY)
      window.localStorage?.removeItem(ACCESS_TOKEN_EXP_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }
}

export function getRefreshToken() {
  if (memoryRefreshToken) {
    return memoryRefreshToken
  }
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const stored = window.localStorage?.getItem(REFRESH_TOKEN_STORAGE_KEY)
    if (stored) {
      memoryRefreshToken = stored
      return stored
    }
  } catch {
    // Ignore storage errors
  }
  return null
}

export function setRefreshToken(token) {
  const normalized = typeof token === 'string' ? token.trim() : ''
  if (!normalized) {
    return
  }
  memoryRefreshToken = normalized
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(REFRESH_TOKEN_STORAGE_KEY, normalized)
    } catch {
      // Ignore storage errors
    }
  }
}

export function clearAuthTokens() {
  clearAccessToken()
  memoryRefreshToken = null
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }
}

function captureAuthTokensFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return
  if (typeof payload.accessToken === 'string' && payload.accessToken.trim()) {
    setAccessToken(payload.accessToken, payload.expiresInMs)
  }
  if (typeof payload.refreshToken === 'string' && payload.refreshToken.trim()) {
    setRefreshToken(payload.refreshToken)
  }
}

export function onSessionExpired(callback) {
  sessionExpiredListeners.add(callback)
  return () => sessionExpiredListeners.delete(callback)
}

function notifySessionExpired() {
  clearAuthTokens()
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Ignore listener error
    }
  })
}

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
  const { fallbackBaseUrl = '', lockToPrimary = false } = options
  const candidates = []
  pushUnique(candidates, primaryBaseUrl)
  if (fallbackBaseUrl) {
    pushUnique(candidates, fallbackBaseUrl)
  }

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
  return status === 408 || status === 425 || status >= 500
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
  const maxAttempts = retryEnabled ? 3 : 2
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

        const contentType = response.headers.get('content-type') || ''
        const isHtml = contentType.includes('text/html')
        const isNotFound = response.status === 404
        const hasAlternativeCandidate =
          requestApiBaseCandidates.length > 1 &&
          baseUrl !== requestApiBaseCandidates[requestApiBaseCandidates.length - 1]

        if ((isHtml || isNotFound) && hasAlternativeCandidate) {
          continue
        }

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
      await wait(API_RETRY_DELAY_MS * Math.pow(2, attempt))
    }
  }

  if (lastResponse) return lastResponse
  throw lastError || new Error('API request failed.')
}

export class ApiError extends Error {
  constructor(message, status, details = null, isNetworkError = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.isNetworkError = isNetworkError
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
    const storedRefreshToken = getRefreshToken()
    refreshPromise = fetchWithApiFallback(
      '/auth/refresh',
      {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          ...(storedRefreshToken ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(storedRefreshToken ? { body: JSON.stringify({ refreshToken: storedRefreshToken }) } : {}),
      },
      { retry: false, timeoutMs: 8000 },
    ).then(async (response) => {
      const payload = await parseResponse(response)

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          notifySessionExpired()
        }
        throw new ApiError(
          payload?.message || 'Session refresh failed.',
          response.status,
          payload?.issues || payload?.details || null,
        )
      }

      captureAuthTokensFromPayload(payload)
      return payload
    }).catch((error) => {
      if (error?.status === 401 || error?.status === 403) {
        notifySessionExpired()
      }
      throw error
    }).finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export async function apiRequest(path, options = {}, config = {}) {
  const { skipRefreshRetry = false, timeoutMs, retry } = config
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData
  const method = String(options.method || 'GET').toUpperCase()
  const isAuthPath = path.startsWith('/auth/')
  const isSafeRead = (method === 'GET' || method === 'HEAD') && !isAuthPath
  const defaultCache = isSafeRead ? 'default' : 'no-store'

  // If a session refresh is actively in-flight and our local access token is missing or expired,
  // wait for the refresh to complete so this request immediately uses the fresh token.
  if (!isAuthPath && refreshPromise && isAccessTokenExpired()) {
    try {
      await refreshPromise
    } catch {
      // Proceed; the request itself will handle guest or 401 state.
    }
  }

  const accessToken = getAccessToken()
  let requestBody = options.body
  if (path === '/auth/logout' && !requestBody) {
    const storedRefreshToken = getRefreshToken()
    if (storedRefreshToken) {
      requestBody = JSON.stringify({ refreshToken: storedRefreshToken })
    }
  }

  let response
  try {
    response = await fetchWithApiFallback(
      path,
      {
        ...options,
        ...(requestBody !== undefined ? { body: requestBody } : {}),
        cache: options.cache || defaultCache,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(!isSafeRead ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : {}),
          ...(!isFormDataBody && requestBody ? { 'Content-Type': 'application/json' } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...options.headers,
        },
      },
      { timeoutMs, retry },
    )
  } catch (error) {
    const isNetwork = !error?.status && (
      error?.name === 'TypeError' ||
      String(error?.message || '').toLowerCase().includes('fetch') ||
      error?.code === 'API_TIMEOUT'
    )
    if (isNetwork) {
      const friendlyMessage = 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı veya sunucu durumunu kontrol edin.'
      const apiErr = new ApiError(friendlyMessage, error?.status || 0, null, true)
      if (error?.code) apiErr.code = error.code
      throw apiErr
    }
    throw error
  }

  const payload = await parseResponse(response)

  if (payload) {
    captureAuthTokensFromPayload(payload)
  }

  if (path === '/auth/logout') {
    clearAuthTokens()
  }

  if (response.status === 401 && !skipRefreshRetry && !isAuthPath) {
    try {
      await refreshSession()
      return apiRequest(path, options, { ...config, skipRefreshRetry: true })
    } catch (refreshErr) {
      if (refreshErr?.status === 401 || refreshErr?.status === 403) {
        notifySessionExpired()
      }
      throw refreshErr
    }
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
