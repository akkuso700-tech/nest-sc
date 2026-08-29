import { pinnedEndpoint } from './domainConfig.js'

const sentFingerprints = new Set()

function resolveClientErrorsEndpoint() {
  const pinned = pinnedEndpoint('performance/client-errors')
  if (pinned) return pinned

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api/v1/performance/client-errors'
  }

  return `${window.location.origin}/api/v1/performance/client-errors`
}

function normalizeRoute(pathname = '/') {
  return (pathname || '/')
    .replace(/\/posts\/[^/]+/gi, '/posts/:id')
    .replace(/\/u\/[^/]+/gi, '/u/:username')
    .replace(/\/groups\/(manage|joined)\/[^/]+/gi, '/groups/$1/:slug')
    .replace(/\/[a-f\d]{24}(?=\/|$)/gi, '/:id')
    .slice(0, 180)
}

function normalizeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Unknown client error',
      stack: error.stack || '',
    }
  }

  if (typeof error === 'string') {
    return { message: error, stack: '' }
  }

  try {
    return { message: JSON.stringify(error), stack: '' }
  } catch {
    return { message: 'Unknown client error', stack: '' }
  }
}

export function reportClientError(error, context = {}) {
  if (typeof window === 'undefined' || navigator.doNotTrack === '1') return

  const normalizedError = normalizeError(error)
  const kind = String(context.kind || 'runtime').slice(0, 40)
  const source = String(context.source || '').slice(0, 180)
  const message = normalizedError.message.slice(0, 500)
  const fingerprint = `${kind}|${source}|${message}`.slice(0, 720)

  if (sentFingerprints.has(fingerprint)) return
  sentFingerprints.add(fingerprint)

  const payload = {
    kind,
    source,
    message,
    stack: normalizedError.stack.slice(0, 4000),
    route: normalizeRoute(window.location.pathname),
    userAgent: String(navigator.userAgent || '').slice(0, 500),
  }

  void fetch(resolveClientErrorsEndpoint(), {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Error reporting must never make the original failure worse.
  })
}

export function installGlobalErrorReporting({ onFatalBootstrapError } = {}) {
  if (typeof window === 'undefined') return () => {}

  const handleError = (event) => {
    const resourceTarget = event.target
    const isScriptError = resourceTarget?.tagName === 'SCRIPT'
    const linkRel = String(resourceTarget?.rel || '').toLowerCase()
    const isCriticalLinkError =
      resourceTarget?.tagName === 'LINK' && ['modulepreload', 'stylesheet'].includes(linkRel)
    const isResourceError = isScriptError || isCriticalLinkError
    const source = isResourceError
      ? resourceTarget.src || resourceTarget.href || ''
      : event.filename || ''
    const error = event.error || event.message || 'Client resource failed to load.'

    reportClientError(error, {
      kind: isResourceError ? 'resource' : 'runtime',
      source,
    })

    let isApplicationAsset = false
    try {
      const resourceUrl = new URL(source, window.location.href)
      isApplicationAsset =
        resourceUrl.origin === window.location.origin &&
        resourceUrl.pathname.startsWith('/assets/')
    } catch {
      isApplicationAsset = false
    }

    if (isResourceError && isApplicationAsset) onFatalBootstrapError?.(error)
  }

  const handleUnhandledRejection = (event) => {
    reportClientError(event.reason, { kind: 'unhandled-rejection' })
    onFatalBootstrapError?.(event.reason)
  }

  window.addEventListener('error', handleError, true)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)

  return () => {
    window.removeEventListener('error', handleError, true)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }
}
