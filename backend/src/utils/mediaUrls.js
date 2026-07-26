const { env } = require('../config/env')

function normalizeHostName(value) {
  return String(value || '').trim().toLowerCase().replace(/^www\./, '')
}

function resolvePreferredUploadOrigin() {
  const candidates = [
    String(env.hostingerPublicBaseUrl || '').trim(),
    String(env.hostingerUploadUrl || '').trim(),
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      return new URL(candidate).origin.replace(/\/+$/, '')
    } catch {
      // Continue with next candidate.
    }
  }

  const normalizedClientHost = normalizeHostName(new URL(env.clientUrl).hostname)

  if (!normalizedClientHost) {
    return ''
  }

  if (normalizedClientHost.startsWith('api.')) {
    return `https://upload.${normalizedClientHost.slice(4)}`
  }

  if (normalizedClientHost.startsWith('api-')) {
    return `https://upload-${normalizedClientHost.slice(4)}`
  }

  if (normalizedClientHost.startsWith('demo.')) {
    return `https://upload-demo.${normalizedClientHost.slice(5)}`
  }

  return `https://upload.${normalizedClientHost}`
}

function normalizeMediaUrl(url, options = {}) {
  const { preferConfiguredOrigin = true } = options
  const value = String(url || '').trim()

  if (!value) {
    return value
  }

  if (!/^https?:\/\//i.test(value)) {
    return value
  }

  try {
    const parsedUrl = new URL(value)
    const preferredOrigin = resolvePreferredUploadOrigin()
    const normalizedPathName = String(parsedUrl.pathname || '').trim()

    if (!normalizedPathName) {
      return value
    }

    const normalizedPath = normalizedPathName.startsWith('/uploads/')
      ? normalizedPathName.replace(/^\/uploads\//, '/media/')
      : normalizedPathName

    const isMediaPath = normalizedPath.startsWith('/media/')

    if (!isMediaPath) {
      return value
    }

    if (!preferredOrigin || !preferConfiguredOrigin) {
      return `${parsedUrl.origin}${normalizedPath}${parsedUrl.search}${parsedUrl.hash}`
    }

    const normalizedCurrentOrigin = parsedUrl.origin.replace(/\/+$/, '')

    if (normalizedCurrentOrigin !== preferredOrigin || normalizedPath !== normalizedPathName) {
      return `${preferredOrigin}${normalizedPath}${parsedUrl.search}${parsedUrl.hash}`
    }
  } catch {
    return value
  }

  return value
}

function normalizeMediaList(media = []) {
  if (!Array.isArray(media)) {
    return []
  }

  return media.map((item) => ({
    ...item,
    url: normalizeMediaUrl(item?.url),
    hlsUrl: normalizeMediaUrl(item?.hlsUrl),
    posterUrl: normalizeMediaUrl(item?.posterUrl),
  }))
}

function normalizeUserMedia(user = null) {
  if (!user) {
    return user
  }

  if (typeof user.toObject === 'function') {
    const plainUser = user.toObject()
    return {
      ...plainUser,
      avatarUrl: normalizeMediaUrl(plainUser.avatarUrl),
      coverUrl: normalizeMediaUrl(plainUser.coverUrl),
    }
  }

  return {
    ...user,
    avatarUrl: normalizeMediaUrl(user.avatarUrl),
    coverUrl: normalizeMediaUrl(user.coverUrl),
  }
}

module.exports = {
  normalizeMediaUrl,
  normalizeMediaList,
  normalizeUserMedia,
}
