/**
 * Centralised domain → service-URL mapping.
 *
 * Every host-specific URL that was previously hardcoded across apiClient,
 * clientErrorReporter, webVitalsReporter, appEnvironment and media is now
 * derived from this single lookup table.  Adding a new environment (e.g.
 * staging.nest-sc.com) only requires editing the DOMAIN_MAP below.
 */

const DOMAIN_MAP = {
  'demo.nest-sc.com': {
    env: 'demo',
    api: 'https://api-demo.nest-sc.com/api/v1',
    upload: 'https://upload-demo.nest-sc.com',
  },
  'nest-sc.com': {
    env: 'live',
    api: 'https://api.nest-sc.com/api/v1',
    upload: 'https://upload.nest-sc.com',
  },
}

function getNormalizedHost() {
  if (typeof window === 'undefined') return ''
  return String(window.location.hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
}

const normalizedHost = getNormalizedHost()
const domainEntry = DOMAIN_MAP[normalizedHost] || null

/** Pinned API base URL (e.g. "https://api.nest-sc.com/api/v1") or empty string. */
export const pinnedApiUrl = domainEntry?.api || ''

/** Pinned upload CDN origin (e.g. "https://upload.nest-sc.com") or empty string. */
export const pinnedUploadOrigin = domainEntry?.upload || ''

/** Host-detected environment name: 'demo' | 'live' | '' */
export const pinnedEnvironment = domainEntry?.env || ''

/** True when the current hostname matched a known production/demo domain. */
export const isDomainPinned = Boolean(domainEntry)

/**
 * Build a full pinned endpoint URL for a given API sub-path.
 * Returns empty string when the host is not pinned.
 *
 * @example pinnedEndpoint('performance/client-errors')
 *   → "https://api.nest-sc.com/api/v1/performance/client-errors"
 */
export function pinnedEndpoint(subPath) {
  if (!domainEntry) return ''
  return `${domainEntry.api}/${subPath.replace(/^\//, '')}`
}
