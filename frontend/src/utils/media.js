import { apiOrigin } from '../lib/apiClient.js'
import { pinnedUploadOrigin } from '../lib/domainConfig.js'

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function sanitizeMediaSource(value) {
  if (value == null) {
    return ''
  }

  const normalizedValue = String(value).trim()
  const routeNotFoundMatch = normalizedValue.match(/Route not found:\s*(\/\S+)/i)

  if (routeNotFoundMatch?.[1]) {
    return routeNotFoundMatch[1]
      .replace(/%20404%20\(Not%20Found\)$/i, '')
      .replace(/\s+404\s*\(Not Found\)$/i, '')
      .trim()
  }

  return normalizedValue
    .replace(/\s+404\s*\(Not Found\)$/i, '')
    .replace(/%20404%20\(Not%20Found\)$/i, '')
    .replace(/\s+Route not found:.*$/i, '')
    .trim()
}

function resolveUploadsOrigin() {
  const envOrigin = normalizeBaseUrl(import.meta.env.VITE_UPLOADS_ORIGIN)

  if (envOrigin) {
    return envOrigin
  }

  try {
    const parsedApiOrigin = new URL(apiOrigin)
    const hostName = parsedApiOrigin.hostname || ''
    const port = parsedApiOrigin.port ? `:${parsedApiOrigin.port}` : ''

    if (hostName.startsWith('api.')) {
      return `${parsedApiOrigin.protocol}//upload.${hostName.slice(4)}${port}`
    }

    if (hostName.startsWith('api-')) {
      return `${parsedApiOrigin.protocol}//upload-${hostName.slice(4)}${port}`
    }
  } catch {
    return ''
  }

  return ''
}

function resolvePreferredUploadsOrigin(defaultOrigin) {
  return pinnedUploadOrigin || defaultOrigin
}

function pushUniqueUrl(target, value) {
  if (!value || target.includes(value)) {
    return
  }

  target.push(value)
}

function normalizeMediaPath(pathname) {
  if (!pathname) {
    return ''
  }

  if (pathname.startsWith('/uploads/')) {
    return `/media/${pathname.replace(/^\/uploads\//, '')}`
  }

  if (pathname.startsWith('/media/')) {
    return pathname
  }

  return ''
}

function buildAbsoluteMediaUrl(origin, mediaPath, search = '', hash = '') {
  if (!origin || !mediaPath) {
    return ''
  }

  return `${normalizeBaseUrl(origin)}${mediaPath}${search}${hash}`
}

const uploadsOrigin = resolveUploadsOrigin()
const preferredUploadsOrigin = resolvePreferredUploadsOrigin(uploadsOrigin)

export function resolveMediaUrlCandidates(url) {
  const sanitizedUrl = sanitizeMediaSource(url)

  if (!sanitizedUrl) {
    return []
  }

  if (sanitizedUrl.startsWith('blob:') || sanitizedUrl.startsWith('data:')) {
    return [sanitizedUrl]
  }

  if (sanitizedUrl.startsWith('http://') || sanitizedUrl.startsWith('https://')) {
    try {
      const parsedUrl = new URL(sanitizedUrl)
      const mediaPath = normalizeMediaPath(parsedUrl.pathname || '')

      if (!mediaPath) {
        return [sanitizedUrl]
      }

      const candidates = []
      const search = parsedUrl.search || ''
      const hash = parsedUrl.hash || ''

      pushUniqueUrl(
        candidates,
        buildAbsoluteMediaUrl(preferredUploadsOrigin, mediaPath, search, hash),
      )
      pushUniqueUrl(
        candidates,
        buildAbsoluteMediaUrl(parsedUrl.origin, mediaPath, search, hash),
      )
      pushUniqueUrl(
        candidates,
        buildAbsoluteMediaUrl(uploadsOrigin, mediaPath, search, hash),
      )
      pushUniqueUrl(
        candidates,
        buildAbsoluteMediaUrl(apiOrigin, mediaPath, search, hash),
      )

      return candidates
    } catch {
      return [sanitizedUrl]
    }
  }

  if (sanitizedUrl.startsWith('/')) {
    const mediaPath = normalizeMediaPath(sanitizedUrl)

    if (!mediaPath) {
      return [sanitizedUrl]
    }

    const candidates = []
    pushUniqueUrl(candidates, buildAbsoluteMediaUrl(preferredUploadsOrigin, mediaPath))
    pushUniqueUrl(candidates, buildAbsoluteMediaUrl(uploadsOrigin, mediaPath))
    pushUniqueUrl(candidates, buildAbsoluteMediaUrl(apiOrigin, mediaPath))

    return candidates
  }

  const normalizedRelative = sanitizedUrl.startsWith('media/')
    ? `/${sanitizedUrl}`
    : sanitizedUrl.startsWith('uploads/')
      ? `/uploads/${sanitizedUrl.replace(/^uploads\//, '')}`
      : ''

  if (!normalizedRelative) {
    return [`${apiOrigin}/${sanitizedUrl}`]
  }

  return resolveMediaUrlCandidates(normalizedRelative)
}

export function resolveMediaUrl(url) {
  return resolveMediaUrlCandidates(url)[0] || ''
}

export function generateVideoPosterFrame(file, targetTimeSec = 0.1) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !file) {
      resolve(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute('src')
      video.load()
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 4500)

    const captureFrame = () => {
      try {
        const width = video.videoWidth || 640
        const height = video.videoHeight || 360
        const canvas = document.createElement('canvas')
        const maxEdge = 960
        let targetWidth = width
        let targetHeight = height

        if (width > maxEdge || height > maxEdge) {
          if (width >= height) {
            targetWidth = maxEdge
            targetHeight = Math.round((height * maxEdge) / width)
          } else {
            targetHeight = maxEdge
            targetWidth = Math.round((width * maxEdge) / height)
          }
        }

        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight)

        canvas.toBlob(
          (blob) => {
            clearTimeout(timeoutId)
            cleanup()
            if (blob) {
              const posterUrl = URL.createObjectURL(blob)
              resolve({ blob, posterUrl, width: targetWidth, height: targetHeight })
            } else {
              resolve(null)
            }
          },
          'image/webp',
          0.85,
        )
      } catch {
        clearTimeout(timeoutId)
        cleanup()
        resolve(null)
      }
    }

    video.onloadeddata = () => {
      if (video.duration > 0 && targetTimeSec > 0) {
        video.currentTime = Math.min(targetTimeSec, Math.max(0, video.duration - 0.05))
      } else {
        captureFrame()
      }
    }

    video.onseeked = () => {
      captureFrame()
    }

    video.onerror = () => {
      clearTimeout(timeoutId)
      cleanup()
      resolve(null)
    }

    video.src = objectUrl
  })
}
