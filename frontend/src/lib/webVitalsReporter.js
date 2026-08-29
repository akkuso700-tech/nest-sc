import { pinnedEndpoint } from './domainConfig.js'

const METRIC_NAMES = new Set(['LCP', 'CLS', 'INP', 'FCP', 'TTFB'])
const DEFAULT_PRODUCTION_SAMPLE_RATE = 0.2

function resolveSampleRate() {
  const configuredRate = Number(import.meta.env.VITE_WEB_VITALS_SAMPLE_RATE)
  if (Number.isFinite(configuredRate)) {
    return Math.min(Math.max(configuredRate, 0), 1)
  }

  return import.meta.env.PROD ? DEFAULT_PRODUCTION_SAMPLE_RATE : 1
}

function resolveMetricsEndpoint() {
  const pinned = pinnedEndpoint('performance/web-vitals')
  if (pinned) return pinned

  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api/v1/performance/web-vitals'
  }

  return `${window.location.origin}/api/v1/performance/web-vitals`
}

function normalizeRoute(pathname = '/') {
  return (pathname || '/')
    .replace(/\/posts\/[^/]+/gi, '/posts/:id')
    .replace(/\/u\/[^/]+/gi, '/u/:username')
    .replace(/\/groups\/(manage|joined)\/[^/]+/gi, '/groups/$1/:slug')
    .replace(/\/[a-f\d]{24}(?=\/|$)/gi, '/:id')
    .slice(0, 180)
}

function resolveDeviceClass() {
  if (window.innerWidth <= 767) return 'mobile'
  if (window.innerWidth <= 1024) return 'tablet'
  return 'desktop'
}

function resolveNavigationType() {
  const navigationEntry = performance.getEntriesByType?.('navigation')?.[0]
  const navigationType = navigationEntry?.type || 'unknown'
  return ['navigate', 'reload', 'back_forward', 'prerender'].includes(navigationType)
    ? navigationType
    : 'unknown'
}

function createPageViewId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
}

function roundMetricValue(name, value) {
  return name === 'CLS' ? Number(value.toFixed(4)) : Math.round(value)
}

export function startWebVitalsReporting() {
  if (
    typeof window === 'undefined' ||
    typeof PerformanceObserver === 'undefined' ||
    navigator.doNotTrack === '1' ||
    Math.random() > resolveSampleRate()
  ) {
    return () => {}
  }

  const pageViewId = createPageViewId()
  const metrics = new Map()
  const sentValues = new Map()
  const observers = []
  let isSending = false

  const recordMetric = (name, value) => {
    if (!METRIC_NAMES.has(name) || !Number.isFinite(value) || value < 0) return
    metrics.set(name, roundMetricValue(name, value))
  }

  const flushMetrics = async () => {
    if (isSending || !metrics.size) return

    const changedMetrics = [...metrics.entries()]
      .filter(([name, value]) => sentValues.get(name) !== value)
      .map(([name, value]) => ({ name, value }))

    if (!changedMetrics.length) return

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    const effectiveType = `${connection?.effectiveType || 'unknown'}`.toLowerCase()
    const connectionType = ['slow-2g', '2g', '3g', '4g'].includes(effectiveType)
      ? effectiveType
      : 'unknown'
    const payload = {
      pageViewId,
      route: normalizeRoute(window.location.pathname),
      navigationType: resolveNavigationType(),
      deviceClass: resolveDeviceClass(),
      connectionType,
      saveData: Boolean(connection?.saveData),
      metrics: changedMetrics,
    }

    isSending = true
    try {
      const response = await fetch(resolveMetricsEndpoint(), {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        changedMetrics.forEach(({ name, value }) => sentValues.set(name, value))
      }
    } catch {
      // Performance telemetry must never affect the page experience.
    } finally {
      isSending = false
    }
  }

  const observe = (options, callback) => {
    try {
      const observer = new PerformanceObserver((list) => callback(list.getEntries()))
      observer.observe(options)
      observers.push(observer)
    } catch {
      // Browsers may expose PerformanceObserver without every entry type.
    }
  }

  const navigationEntry = performance.getEntriesByType?.('navigation')?.[0]
  if (navigationEntry?.responseStart >= 0) {
    recordMetric('TTFB', navigationEntry.responseStart)
  }

  const firstContentfulPaint = performance.getEntriesByName?.('first-contentful-paint')?.[0]
  if (firstContentfulPaint) {
    recordMetric('FCP', firstContentfulPaint.startTime)
  } else {
    observe({ type: 'paint', buffered: true }, (entries) => {
      const entry = entries.find((item) => item.name === 'first-contentful-paint')
      if (entry) recordMetric('FCP', entry.startTime)
    })
  }

  observe({ type: 'largest-contentful-paint', buffered: true }, (entries) => {
    const latestEntry = entries[entries.length - 1]
    if (latestEntry) recordMetric('LCP', latestEntry.startTime)
  })

  let clsSessionValue = 0
  let clsSessionStart = 0
  let clsLastEntryTime = 0
  let maxClsSessionValue = 0
  recordMetric('CLS', 0)
  observe({ type: 'layout-shift', buffered: true }, (entries) => {
    entries.forEach((entry) => {
      if (entry.hadRecentInput) return

      const startsNewSession =
        !clsSessionStart ||
        entry.startTime - clsLastEntryTime > 1000 ||
        entry.startTime - clsSessionStart > 5000

      if (startsNewSession) {
        clsSessionValue = entry.value
        clsSessionStart = entry.startTime
      } else {
        clsSessionValue += entry.value
      }

      clsLastEntryTime = entry.startTime
      maxClsSessionValue = Math.max(maxClsSessionValue, clsSessionValue)
      recordMetric('CLS', maxClsSessionValue)
    })
  })

  const interactionDurations = new Map()
  observe({ type: 'event', buffered: true, durationThreshold: 40 }, (entries) => {
    entries.forEach((entry) => {
      if (!entry.interactionId) return
      interactionDurations.set(
        entry.interactionId,
        Math.max(interactionDurations.get(entry.interactionId) || 0, entry.duration),
      )
    })

    const durations = [...interactionDurations.values()].sort((left, right) => right - left)
    if (durations.length) {
      const percentileIndex = Math.min(durations.length - 1, Math.floor(durations.length / 50))
      recordMetric('INP', durations[percentileIndex])
    }
  })

  const flushTimer = window.setInterval(() => void flushMetrics(), 30000)
  const initialFlushTimer = window.setTimeout(() => void flushMetrics(), 10000)
  const handlePageExit = () => void flushMetrics()
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') handlePageExit()
  }

  window.addEventListener('pagehide', handlePageExit)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.clearInterval(flushTimer)
    window.clearTimeout(initialFlushTimer)
    window.removeEventListener('pagehide', handlePageExit)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    observers.forEach((observer) => observer.disconnect())
    void flushMetrics()
  }
}
