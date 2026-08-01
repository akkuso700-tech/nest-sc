const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { Transform, Readable } = require('stream')
const { pipeline } = require('stream/promises')
const { env } = require('../config/env')
const { assertPathInsideUploads } = require('./loopVideoPublishingService')

const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov', '.webm'])

function originOf(value) {
  try {
    return new URL(String(value || '').trim()).origin.toLowerCase()
  } catch {
    return ''
  }
}

function deriveUploadOrigin(clientUrl) {
  try {
    const parsed = new URL(clientUrl)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    let uploadHost = `upload.${host}`

    if (host.startsWith('api.')) uploadHost = `upload.${host.slice(4)}`
    else if (host.startsWith('api-')) uploadHost = `upload-${host.slice(4)}`
    else if (host.startsWith('demo.')) uploadHost = `upload-demo.${host.slice(5)}`

    return `${parsed.protocol}//${uploadHost}${parsed.port ? `:${parsed.port}` : ''}`.toLowerCase()
  } catch {
    return ''
  }
}

function configuredLoopSourceOrigins() {
  return new Set([
    originOf(env.hostingerPublicBaseUrl),
    originOf(env.hostingerUploadUrl),
    deriveUploadOrigin(env.clientUrl),
  ].filter(Boolean))
}

function assertTrustedLoopSourceUrl(sourceUrl, allowedOrigins = configuredLoopSourceOrigins()) {
  let parsed
  try {
    parsed = new URL(String(sourceUrl || '').trim())
  } catch {
    parsed = null
  }

  if (
    !parsed ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    !allowedOrigins.has(parsed.origin.toLowerCase()) ||
    !parsed.pathname.startsWith('/media/')
  ) {
    const error = new Error('Backfill source URL is not a trusted media URL.')
    error.code = 'UNTRUSTED_BACKFILL_SOURCE'
    error.permanent = true
    throw error
  }

  return parsed
}

function safeVideoExtension(parsedUrl, mimeType = '') {
  const extension = path.extname(parsedUrl.pathname).toLowerCase()
  if (VIDEO_EXTENSIONS.has(extension)) return extension
  if (String(mimeType).includes('webm')) return '.webm'
  if (String(mimeType).includes('quicktime')) return '.mov'
  return '.mp4'
}

function rebaseLegacyLoopSourcePath(sourcePath) {
  const normalizedPath = String(sourcePath || '').replace(/\\/g, '/')
  const uploadsMarker = '/uploads/'
  const uploadsIndex = normalizedPath.toLowerCase().lastIndexOf(uploadsMarker)

  if (uploadsIndex < 0) {
    const error = new Error('Video job path is outside the configured uploads directory.')
    error.code = 'INVALID_JOB_SOURCE_PATH'
    error.permanent = true
    throw error
  }

  const relativeParts = normalizedPath
    .slice(uploadsIndex + uploadsMarker.length)
    .split('/')
    .filter(Boolean)

  if (
    !relativeParts.length ||
    !['posts', 'loop-backfill'].includes(relativeParts[0].toLowerCase()) ||
    relativeParts.some((part) => part === '.' || part === '..')
  ) {
    const error = new Error('Video job path is outside the configured uploads directory.')
    error.code = 'INVALID_JOB_SOURCE_PATH'
    error.permanent = true
    throw error
  }

  return assertPathInsideUploads(path.join(env.uploadsDir, ...relativeParts))
}

async function downloadRemoteLoopSource(sourceUrl, options = {}) {
  const {
    allowedOrigins = configuredLoopSourceOrigins(),
    destinationRoot = path.join(env.uploadsDir, 'loop-backfill'),
    fetchImpl = fetch,
    maxBytes = env.loopBackfillMaxSourceBytes,
    timeoutMs = env.loopBackfillDownloadTimeoutMs,
    jobId = crypto.randomUUID(),
  } = options
  const parsedUrl = assertTrustedLoopSourceUrl(sourceUrl, allowedOrigins)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  let response

  try {
    response = await fetchImpl(parsedUrl, { signal: controller.signal, redirect: 'error' })
  } catch (error) {
    clearTimeout(timeoutId)
    const wrapped = new Error(`Failed to download Loop backfill source: ${error.message}`)
    wrapped.code = error?.name === 'AbortError' ? 'BACKFILL_DOWNLOAD_TIMEOUT' : 'BACKFILL_DOWNLOAD_FAILED'
    throw wrapped
  }

  if (!response.ok || !response.body) {
    clearTimeout(timeoutId)
    const error = new Error(`Loop backfill source returned HTTP ${response.status}.`)
    error.code = 'BACKFILL_SOURCE_HTTP_ERROR'
    error.permanent = response.status >= 400 && response.status < 500
    throw error
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentType && !contentType.startsWith('video/')) {
    clearTimeout(timeoutId)
    const error = new Error('Loop backfill source did not return a video.')
    error.code = 'BACKFILL_SOURCE_NOT_VIDEO'
    error.permanent = true
    throw error
  }
  if (contentLength > maxBytes) {
    clearTimeout(timeoutId)
    const error = new Error('Loop backfill source exceeds the configured size limit.')
    error.code = 'BACKFILL_SOURCE_TOO_LARGE'
    error.permanent = true
    throw error
  }

  await fs.promises.mkdir(destinationRoot, { recursive: true })
  const extension = safeVideoExtension(parsedUrl, contentType)
  const destinationPath = assertPathInsideUploads(
    path.join(destinationRoot, `${String(jobId).replace(/[^a-zA-Z0-9_-]/g, '-')}-${crypto.randomUUID().slice(0, 8)}${extension}`),
  )
  let downloadedBytes = 0
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length
      if (downloadedBytes > maxBytes) {
        const error = new Error('Loop backfill source exceeds the configured size limit.')
        error.code = 'BACKFILL_SOURCE_TOO_LARGE'
        error.permanent = true
        callback(error)
        return
      }
      callback(null, chunk)
    },
  })

  try {
    await pipeline(Readable.fromWeb(response.body), limiter, fs.createWriteStream(destinationPath))
    return destinationPath
  } catch (error) {
    await fs.promises.rm(destinationPath, { force: true }).catch(() => undefined)
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function materializeLoopJobSource(job, options = {}) {
  if (job?.sourcePath) {
    let sourcePath
    try {
      sourcePath = assertPathInsideUploads(job.sourcePath)
    } catch (error) {
      if (error?.code !== 'INVALID_JOB_SOURCE_PATH') throw error
      sourcePath = rebaseLegacyLoopSourcePath(job.sourcePath)
    }

    try {
      await fs.promises.access(sourcePath, fs.constants.R_OK)
    } catch {
      const error = new Error('The uploaded Loop source is no longer available after deployment.')
      error.code = 'VIDEO_JOB_SOURCE_MISSING'
      error.permanent = true
      throw error
    }
    return { sourcePath, temporary: false }
  }

  if (!job?.sourceUrl) {
    const error = new Error('Video job has no source path or source URL.')
    error.code = 'VIDEO_JOB_SOURCE_MISSING'
    error.permanent = true
    throw error
  }

  const sourcePath = await downloadRemoteLoopSource(job.sourceUrl, {
    ...options,
    jobId: job._id || job.id,
  })
  return { sourcePath, temporary: true }
}

module.exports = {
  configuredLoopSourceOrigins,
  assertTrustedLoopSourceUrl,
  downloadRemoteLoopSource,
  rebaseLegacyLoopSourcePath,
  materializeLoopJobSource,
}
