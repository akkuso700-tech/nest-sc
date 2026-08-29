const PREFETCH_CACHE = new Set()
const MAX_CACHE_SIZE = 25
const activeAbortControllers = new Map()

function getBaseUrl(url) {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
    const pathname = parsed.pathname
    const lastSlash = pathname.lastIndexOf('/')
    parsed.pathname = lastSlash >= 0 ? pathname.slice(0, lastSlash + 1) : '/'
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return ''
  }
}

function resolveRelativeUrl(baseUrl, relativeOrAbsoluteUrl) {
  try {
    return new URL(relativeOrAbsoluteUrl, baseUrl).toString()
  } catch {
    return relativeOrAbsoluteUrl
  }
}

function parseMasterPlaylist(playlistText, masterUrl) {
  const baseUrl = getBaseUrl(masterUrl)
  const lines = playlistText.split(/\r?\n/)
  const variantUrls = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const nextLine = lines[i + 1]?.trim()
      if (nextLine && !nextLine.startsWith('#')) {
        variantUrls.push(resolveRelativeUrl(baseUrl, nextLine))
      }
    }
  }

  if (!variantUrls.length) {
    const hasMediaSegments = lines.some(
      (line) => line.endsWith('.ts') || line.endsWith('.m4s') || line.startsWith('#EXTINF:'),
    )
    if (hasMediaSegments) {
      return [masterUrl]
    }
  }

  return variantUrls
}

function parseMediaPlaylist(playlistText, playlistUrl) {
  const baseUrl = getBaseUrl(playlistUrl)
  const lines = playlistText.split(/\r?\n/)
  let initSegmentUrl = null
  const segmentUrls = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (line.startsWith('#EXT-X-MAP:')) {
      const uriMatch = line.match(/URI="([^"]+)"/i)
      if (uriMatch?.[1]) {
        initSegmentUrl = resolveRelativeUrl(baseUrl, uriMatch[1])
      }
    } else if (line.startsWith('#EXTINF:')) {
      const nextLine = lines[i + 1]?.trim()
      if (nextLine && !nextLine.startsWith('#')) {
        segmentUrls.push(resolveRelativeUrl(baseUrl, nextLine))
      }
    } else if (
      line &&
      !line.startsWith('#') &&
      (line.endsWith('.ts') || line.endsWith('.m4s') || line.endsWith('.mp4'))
    ) {
      segmentUrls.push(resolveRelativeUrl(baseUrl, line))
    }
  }

  return { initSegmentUrl, segmentUrls }
}

async function fetchResource(url, signal, headers = {}) {
  if (PREFETCH_CACHE.has(url)) {
    return null
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal,
    priority: 'low',
    credentials: 'same-origin',
  })

  if (response.ok) {
    if (PREFETCH_CACHE.size >= MAX_CACHE_SIZE) {
      const oldestKey = PREFETCH_CACHE.values().next().value
      PREFETCH_CACHE.delete(oldestKey)
    }
    PREFETCH_CACHE.add(url)
  }

  return response
}

/**
 * Prefetches the HLS manifest, lowest bitrate variant playlist, and the first video segment
 * so when user scrolls to the next video, it plays with zero startup delay.
 */
export async function prefetchHlsVideo(hlsUrl, fallbackUrl = '') {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return
  }

  const normalizedHlsUrl = String(hlsUrl || '').trim()
  const normalizedFallbackUrl = String(fallbackUrl || '').trim()
  const targetUrl = normalizedHlsUrl || normalizedFallbackUrl

  if (!targetUrl || PREFETCH_CACHE.has(targetUrl)) {
    return
  }

  if (activeAbortControllers.has(targetUrl)) {
    return
  }

  const controller = new AbortController()
  activeAbortControllers.set(targetUrl, controller)

  try {
    if (normalizedHlsUrl) {
      // 1. Fetch Master Playlist
      const masterRes = await fetchResource(normalizedHlsUrl, controller.signal)
      if (!masterRes) {
        return
      }

      const masterText = await masterRes.text()
      const variantUrls = parseMasterPlaylist(masterText, normalizedHlsUrl)
      const targetVariantUrl = variantUrls[0] || normalizedHlsUrl

      if (targetVariantUrl && targetVariantUrl !== normalizedHlsUrl) {
        // 2. Fetch Variant Playlist (Lowest bitrate, e.g. 360p)
        const variantRes = await fetchResource(targetVariantUrl, controller.signal)
        if (!variantRes) {
          return
        }

        const variantText = await variantRes.text()
        const { initSegmentUrl, segmentUrls } = parseMediaPlaylist(variantText, targetVariantUrl)

        // 3. Fetch Init Segment if fMP4
        if (initSegmentUrl) {
          await fetchResource(initSegmentUrl, controller.signal)
        }

        // 4. Fetch the very first media segment (e.g. segment_000.ts / .m4s)
        const firstSegment = segmentUrls[0]
        if (firstSegment) {
          await fetchResource(firstSegment, controller.signal)
        }
      }
    } else if (normalizedFallbackUrl) {
      // Progressive MP4 prefetch (first 1 MB for instant first frame)
      await fetchResource(normalizedFallbackUrl, controller.signal, {
        Range: 'bytes=0-1048575',
      })
    }
  } catch {
    // Network or abort errors during prefetch should be silently ignored
  } finally {
    activeAbortControllers.delete(targetUrl)
  }
}

export function cancelAllPrefetches() {
  activeAbortControllers.forEach((controller) => {
    try {
      controller.abort()
    } catch {
      // Ignore
    }
  })
  activeAbortControllers.clear()
}
