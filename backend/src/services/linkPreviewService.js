const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi

// Simple in-memory cache with 1 hour TTL
const previewCache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000

function extractUrlsFromText(text = '') {
  if (!text || typeof text !== 'string') return []
  const matches = text.match(URL_REGEX) || []
  return Array.from(new Set(matches))
}

function isPrivateIpOrLocalhost(hostname) {
  if (!hostname) return true
  const lower = hostname.toLowerCase()

  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.lan') ||
    lower === '0.0.0.0'
  ) {
    return true
  }

  // IPv4 checks
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number)
    if (a === 127 || a === 10 || a === 0) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
  }

  return false
}

function decodeHtmlEntities(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function extractMetaContent(html, propertyOrName) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${propertyOrName}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${propertyOrName}["']`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      return decodeHtmlEntities(match[1])
    }
  }

  return ''
}

function resolveAbsoluteUrl(relativeUrl, baseUrl) {
  if (!relativeUrl) return ''
  try {
    return new URL(relativeUrl, baseUrl).toString()
  } catch {
    return relativeUrl
  }
}

async function fetchLinkPreview(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null

  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl.trim())
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return null
  }

  if (isPrivateIpOrLocalhost(parsedUrl.hostname)) {
    return null
  }

  const normalizedUrl = parsedUrl.toString()
  const cached = previewCache.get(normalizedUrl)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

  try {
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NestSocial/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return null
    }

    // Read only the first 256KB of HTML to extract metadata fast
    const reader = response.body.getReader()
    const chunks = []
    let totalBytes = 0
    const MAX_BYTES = 256 * 1024

    while (totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      totalBytes += value.length
    }

    // Cancel remaining stream
    reader.cancel().catch(() => {})

    const buffer = Buffer.concat(chunks)
    const html = buffer.toString('utf-8')

    // 1. Title
    let title =
      extractMetaContent(html, 'og:title') ||
      extractMetaContent(html, 'twitter:title')
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch && titleMatch[1]) {
        title = decodeHtmlEntities(titleMatch[1])
      }
    }

    // 2. Description
    const description =
      extractMetaContent(html, 'og:description') ||
      extractMetaContent(html, 'twitter:description') ||
      extractMetaContent(html, 'description')

    // 3. Image
    let rawImage =
      extractMetaContent(html, 'og:image:secure_url') ||
      extractMetaContent(html, 'og:image') ||
      extractMetaContent(html, 'twitter:image:src') ||
      extractMetaContent(html, 'twitter:image')

    const image = rawImage ? resolveAbsoluteUrl(rawImage, normalizedUrl) : ''

    // 4. Site Name
    let siteName =
      extractMetaContent(html, 'og:site_name') ||
      extractMetaContent(html, 'twitter:site') ||
      ''

    const domain = parsedUrl.hostname.replace(/^www\./i, '')
    if (!siteName) {
      siteName = domain
    }

    // 5. Favicon
    let rawFavicon = ''
    const faviconMatch =
      html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i)
    if (faviconMatch && faviconMatch[1]) {
      rawFavicon = faviconMatch[1]
    }

    const favicon = rawFavicon
      ? resolveAbsoluteUrl(rawFavicon, normalizedUrl)
      : `https://${parsedUrl.hostname}/favicon.ico`

    if (!title && !description && !image) {
      return null
    }

    const previewData = {
      url: normalizedUrl,
      title: title ? title.slice(0, 300) : domain,
      description: description ? description.slice(0, 600) : '',
      image,
      siteName: siteName.slice(0, 100),
      domain,
      favicon,
    }

    previewCache.set(normalizedUrl, {
      data: previewData,
      timestamp: Date.now(),
    })

    return previewData
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

module.exports = {
  extractUrlsFromText,
  fetchLinkPreview,
}
