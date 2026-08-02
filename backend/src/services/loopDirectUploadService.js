const crypto = require('crypto')
const path = require('path')
const { env } = require('../config/env')
const { AppError } = require('../utils/AppError')

const MAX_LOOP_UPLOAD_BYTES = 100 * 1024 * 1024
const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov', '.webm'])

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function extensionForUpload(fileName, mimeType) {
  const requested = path.extname(String(fileName || '')).toLowerCase()
  if (VIDEO_EXTENSIONS.has(requested)) return requested
  if (String(mimeType).toLowerCase() === 'video/webm') return '.webm'
  if (String(mimeType).toLowerCase() === 'video/quicktime') return '.mov'
  return '.mp4'
}

function normalizeUploadEndpoint(value) {
  const endpoint = String(value || '').trim()
  if (!endpoint) return ''
  const parsed = new URL(endpoint)
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}

function publicSourceUrl(payload, publicBaseUrl = env.hostingerPublicBaseUrl) {
  const baseUrl = String(publicBaseUrl || '').trim().replace(/\/+$/, '')
  if (!baseUrl) throw new AppError('Direct Loop upload public URL is not configured.', 503)
  return `${baseUrl}/media/ingest/${payload.uploadId}${payload.extension}`
}

function directUploadEnabled(options = {}) {
  const enabled = options.enabled ?? env.loopDirectUploadEnabled
  const secret = options.secret ?? env.loopDirectUploadSecret
  const endpoint = options.endpoint ?? env.loopDirectUploadUrl
  const publicBaseUrl = options.publicBaseUrl ?? env.hostingerPublicBaseUrl
  return Boolean(enabled && secret && endpoint && publicBaseUrl)
}

function signPayload(encodedPayload, secret) {
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function issueLoopUploadTicket({ userId, fileName, mimeType, bytes }, options = {}) {
  const secret = options.secret ?? env.loopDirectUploadSecret
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000)
  const ttlSeconds = Number(options.ttlSeconds ?? env.loopDirectUploadTicketTtlSeconds)
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase()
  const normalizedBytes = Number(bytes)

  if (!secret) throw new AppError('Direct Loop upload is not configured.', 503)
  if (!String(userId || '').trim()) throw new AppError('Upload user is required.', 400)
  if (!normalizedMimeType.startsWith('video/')) {
    throw new AppError('Only video files can be uploaded as a Loop.', 400)
  }
  if (!Number.isSafeInteger(normalizedBytes) || normalizedBytes <= 0 || normalizedBytes > MAX_LOOP_UPLOAD_BYTES) {
    throw new AppError('Loop videos can be up to 100 MB.', 400)
  }

  const payload = {
    version: 1,
    uploadId: crypto.randomUUID(),
    userId: String(userId),
    fileName: path.basename(String(fileName || 'loop-video.mp4')).slice(0, 180),
    mimeType: normalizedMimeType,
    bytes: normalizedBytes,
    extension: extensionForUpload(fileName, normalizedMimeType),
    folder: 'ingest',
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + Math.max(60, Math.min(1800, ttlSeconds || 600)),
  }
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  return {
    payload,
    ticket: `${encodedPayload}.${signPayload(encodedPayload, secret)}`,
  }
}

function verifyLoopUploadTicket(ticket, options = {}) {
  const secret = options.secret ?? env.loopDirectUploadSecret
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000)
  const [encodedPayload, providedSignature, ...extra] = String(ticket || '').split('.')

  if (!secret || !encodedPayload || !providedSignature || extra.length) {
    throw new AppError('Invalid Loop upload ticket.', 400)
  }

  const expectedSignature = signPayload(encodedPayload, secret)
  const expectedBuffer = Buffer.from(expectedSignature)
  const providedBuffer = Buffer.from(providedSignature)
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new AppError('Invalid Loop upload ticket.', 400)
  }

  let payload
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload))
  } catch {
    throw new AppError('Invalid Loop upload ticket.', 400)
  }

  if (
    payload?.version !== 1 ||
    !/^[0-9a-f-]{36}$/i.test(String(payload?.uploadId || '')) ||
    payload?.folder !== 'ingest' ||
    !VIDEO_EXTENSIONS.has(String(payload?.extension || '').toLowerCase()) ||
    !String(payload?.mimeType || '').startsWith('video/') ||
    !Number.isSafeInteger(payload?.bytes) ||
    payload.bytes <= 0 ||
    payload.bytes > MAX_LOOP_UPLOAD_BYTES ||
    !Number.isFinite(payload?.expiresAt) ||
    payload.expiresAt < nowSeconds
  ) {
    throw new AppError('Loop upload ticket is expired or invalid.', 400)
  }

  return payload
}

function verifyLoopUploadSubmission({ ticket, sourceUrl }, userId, options = {}) {
  if (!directUploadEnabled(options)) {
    throw new AppError('Direct Loop upload is not enabled.', 503)
  }
  const payload = verifyLoopUploadTicket(ticket, options)
  if (payload.userId !== String(userId || '')) {
    throw new AppError('This Loop upload belongs to another user.', 403)
  }
  const expectedUrl = publicSourceUrl(payload, options.publicBaseUrl ?? env.hostingerPublicBaseUrl)
  if (String(sourceUrl || '') !== expectedUrl) {
    throw new AppError('Loop upload URL does not match its ticket.', 400)
  }
  return { ...payload, sourceUrl: expectedUrl }
}

module.exports = {
  MAX_LOOP_UPLOAD_BYTES,
  directUploadEnabled,
  extensionForUpload,
  issueLoopUploadTicket,
  normalizeUploadEndpoint,
  publicSourceUrl,
  verifyLoopUploadSubmission,
  verifyLoopUploadTicket,
}
