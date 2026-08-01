const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3')
const { env } = require('../config/env')
const { AppError } = require('../utils/AppError')

const dataImagePattern = /^data:image\/[a-zA-Z0-9.+-]+;base64,/
const maxProfileImageBytes = 8 * 1024 * 1024
let s3ClientInstance = null

function isS3StorageEnabled() {
  return env.storageProvider === 's3'
}

function isHostingerStorageEnabled() {
  return env.storageProvider === 'hostinger'
}

function isRemoteStorageEnabled() {
  return isS3StorageEnabled() || isHostingerStorageEnabled()
}

function sanitizeSegment(value, fallback = 'item') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || fallback
}

function sanitizeFileName(fileName = 'upload.bin') {
  const extension = path.extname(fileName || '').toLowerCase()
  const baseName = path.basename(fileName || 'upload', extension)
  const normalizedBaseName = sanitizeSegment(baseName, 'upload')

  return {
    extension: extension || '',
    normalizedBaseName,
  }
}

function buildUniqueFileName(fileName = 'upload.bin') {
  const { extension, normalizedBaseName } = sanitizeFileName(fileName)
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${normalizedBaseName}${extension}`
}

function resolveS3Client() {
  if (!isS3StorageEnabled()) {
    throw new AppError('S3 storage is not enabled.', 500)
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: env.s3Region || 'us-east-1',
      endpoint: env.s3Endpoint || undefined,
      forcePathStyle: env.s3ForcePathStyle,
      credentials: env.s3AccessKeyId && env.s3SecretAccessKey
        ? {
            accessKeyId: env.s3AccessKeyId,
            secretAccessKey: env.s3SecretAccessKey,
          }
        : undefined,
    })
  }

  return s3ClientInstance
}

function buildS3ObjectKey({ folder = 'uploads', fileName = 'upload.bin' }) {
  const root = sanitizeSegment(env.s3Prefix || 'nest-social', 'nest-social')
  const child = sanitizeSegment(folder, 'uploads')
  const uniqueName = buildUniqueFileName(fileName)
  return `${root}/${child}/${uniqueName}`
}

function resolveS3PublicUrl(key) {
  const normalizedKey = String(key || '').replace(/^\/+/, '')

  if (env.s3PublicBaseUrl) {
    return `${env.s3PublicBaseUrl.replace(/\/+$/, '')}/${normalizedKey}`
  }

  if (env.s3Endpoint) {
    const endpoint = env.s3Endpoint.replace(/\/+$/, '')

    try {
      const parsedUrl = new URL(endpoint)

      if (env.s3ForcePathStyle) {
        return `${parsedUrl.origin}/${env.s3Bucket}/${normalizedKey}`
      }

      return `${parsedUrl.protocol}//${env.s3Bucket}.${parsedUrl.host}/${normalizedKey}`
    } catch {
      return `${endpoint}/${env.s3Bucket}/${normalizedKey}`
    }
  }

  return `https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com/${normalizedKey}`
}

function resolveImageExtensionByMimeType(mimeType = '') {
  if (mimeType.includes('png')) return '.png'
  if (mimeType.includes('webp')) return '.webp'
  if (mimeType.includes('gif')) return '.gif'
  if (mimeType.includes('avif')) return '.avif'
  return '.jpg'
}

function normalizeHostName(value) {
  return String(value || '').trim().toLowerCase().replace(/^www\./, '')
}

function pushUniqueValue(target, value) {
  if (!value || target.includes(value)) {
    return
  }

  target.push(value)
}

function normalizeUploadEndpointUrl(value) {
  const rawValue = String(value || '').trim()

  if (!rawValue) {
    return ''
  }

  try {
    const parsedUrl = new URL(rawValue)
    const normalizedPathName = String(parsedUrl.pathname || '').trim().toLowerCase()
    const shouldForceUploadPath =
      !normalizedPathName ||
      normalizedPathName === '/' ||
      !normalizedPathName.endsWith('/upload.php')

    if (shouldForceUploadPath) {
      parsedUrl.pathname = '/upload.php'
    }

    return parsedUrl.toString()
  } catch {
    return ''
  }
}

function extractOrigin(value) {
  const rawValue = String(value || '').trim()

  if (!rawValue) {
    return ''
  }

  try {
    const parsedUrl = new URL(rawValue)
    return parsedUrl.origin
  } catch {
    return ''
  }
}

function buildHostingerUploadUrlCandidates() {
  const candidates = []

  pushUniqueValue(candidates, normalizeUploadEndpointUrl(env.hostingerUploadUrl))

  const hostingerPublicOrigin = extractOrigin(env.hostingerPublicBaseUrl)

  if (hostingerPublicOrigin) {
    pushUniqueValue(
      candidates,
      normalizeUploadEndpointUrl(`${hostingerPublicOrigin}/upload.php`),
    )
  }

  if (env.clientUrl) {
    try {
      const parsedClientUrl = new URL(env.clientUrl)
      const protocol = parsedClientUrl.protocol
      const hostName = normalizeHostName(parsedClientUrl.hostname)
      const port = parsedClientUrl.port ? `:${parsedClientUrl.port}` : ''
      let derivedUploadHost = ''

      if (hostName.startsWith('api.')) {
        derivedUploadHost = `upload.${hostName.slice(4)}`
      } else if (hostName.startsWith('api-')) {
        derivedUploadHost = `upload-${hostName.slice(4)}`
      } else if (hostName.startsWith('demo.')) {
        derivedUploadHost = `upload-demo.${hostName.slice(5)}`
      } else {
        derivedUploadHost = `upload.${hostName}`
      }

      pushUniqueValue(
        candidates,
        normalizeUploadEndpointUrl(`${protocol}//${derivedUploadHost}${port}/upload.php`),
      )
    } catch {
      // Ignore invalid client URL values here. They are validated elsewhere.
    }
  }

  return candidates.filter(Boolean)
}

function resolvePreferredHostingerOrigin(preferredBaseUrl = '') {
  const candidates = [
    extractOrigin(preferredBaseUrl),
    extractOrigin(env.hostingerPublicBaseUrl),
    extractOrigin(env.hostingerUploadUrl),
  ].filter(Boolean)

  for (const candidate of candidates) {
    return candidate
  }

  return ''
}

function parseDataUriImage(dataUri) {
  const value = String(dataUri || '')
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)

  if (!match) {
    throw new AppError('Invalid profile image payload.', 400)
  }

  const mimeType = match[1]
  const base64Payload = match[2]
  const buffer = Buffer.from(base64Payload, 'base64')

  if (!buffer.length) {
    throw new AppError('Profile image payload is empty.', 400)
  }

  if (buffer.length > maxProfileImageBytes) {
    throw new AppError('Profile image payload is too large.', 400)
  }

  return { buffer, mimeType }
}

async function writeBufferToLocalUploads({
  buffer,
  folder = 'profiles',
  fileName = 'upload.jpg',
}) {
  const targetFolder = sanitizeSegment(folder, 'uploads')
  const localDirectory = path.join(env.uploadsDir, targetFolder)
  await fs.promises.mkdir(localDirectory, { recursive: true })

  const uniqueFileName = buildUniqueFileName(fileName)
  const localFilePath = path.join(localDirectory, uniqueFileName)

  await fs.promises.writeFile(localFilePath, buffer)
  return `/uploads/${targetFolder}/${uniqueFileName}`
}

async function uploadBufferToS3({
  buffer,
  fileName = 'upload.bin',
  folder = 'uploads',
  contentType = 'application/octet-stream',
}) {
  const s3Client = resolveS3Client()
  const objectKey = buildS3ObjectKey({
    folder,
    fileName,
  })
  const command = new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: objectKey,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    ...(env.s3ObjectAcl ? { ACL: env.s3ObjectAcl } : {}),
  })

  try {
    await s3Client.send(command)
  } catch {
    throw new AppError('Failed to upload media to object storage.', 502)
  }

  return {
    url: resolveS3PublicUrl(objectKey),
    bytes: buffer.length,
    durationSeconds: 0,
  }
}

function normalizeToAbsoluteUrl(value, preferredBaseUrl = '') {
  const urlValue = String(value || '').trim()

  if (!urlValue) {
    return ''
  }

  if (/^https?:\/\//i.test(urlValue)) {
    try {
      const parsedMediaUrl = new URL(urlValue)
      const normalizedPath = parsedMediaUrl.pathname || ''
      const preferredOrigin = resolvePreferredHostingerOrigin(preferredBaseUrl)

      // If upload response accidentally returns app host for /media,
      // force it to the upload host to keep media URLs stable.
      if (preferredOrigin && normalizedPath.startsWith('/media/')) {
        const normalizedPreferredOrigin = preferredOrigin.replace(/\/+$/, '')
        const normalizedMediaOrigin = parsedMediaUrl.origin.replace(/\/+$/, '')

        if (normalizedPreferredOrigin !== normalizedMediaOrigin) {
          return `${normalizedPreferredOrigin}${parsedMediaUrl.pathname}${parsedMediaUrl.search}${parsedMediaUrl.hash}`
        }
      }
    } catch {
      return urlValue
    }

    return urlValue
  }

  const baseOriginCandidates = [
    extractOrigin(preferredBaseUrl),
    extractOrigin(env.hostingerPublicBaseUrl),
    extractOrigin(env.clientUrl),
  ]
    .filter(Boolean)

  if (baseOriginCandidates.length) {
    return `${baseOriginCandidates[0]}/${urlValue.replace(/^\/+/, '')}`
  }

  return urlValue
}

async function uploadBlobToHostinger({
  blob,
  bytes = 0,
  fileName = 'upload.bin',
  folder = 'uploads',
  contentType = 'application/octet-stream',
  uploadClass = '',
}) {
  if (!isHostingerStorageEnabled()) {
    throw new AppError('Hostinger storage bridge is not enabled.', 500)
  }

  const safeFolder = sanitizeSegment(folder, 'uploads')
  const uploadUrlCandidates = buildHostingerUploadUrlCandidates()
  let lastFailureMessage = 'Failed to connect Hostinger upload endpoint.'

  for (const uploadUrl of uploadUrlCandidates) {
    const controller = new AbortController()
    const uploadTimeoutMs = uploadClass === 'loop-video'
      ? Math.max(env.hostingerUploadTimeoutMs || 0, 2 * 60 * 1000)
      : env.hostingerUploadTimeoutMs || 15000
    const timeoutId = setTimeout(() => controller.abort(), uploadTimeoutMs)
    let response
    let payload = {}
    let responseText = ''

    try {
      const formData = new FormData()
      formData.append('file', blob, buildUniqueFileName(fileName))
      formData.append('folder', safeFolder)
      if (uploadClass === 'loop-video') {
        formData.append('upload_class', uploadClass)
      }

      response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'x-upload-token': env.hostingerUploadToken,
        },
        body: formData,
        signal: controller.signal,
      })
      responseText = await response.text()
      if (responseText) {
        try {
          payload = JSON.parse(responseText)
        } catch {
          payload = {}
        }
      }
    } catch (error) {
      lastFailureMessage = `Failed to connect Hostinger upload endpoint (${uploadUrl}): ${error.message}`
      clearTimeout(timeoutId)
      continue
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      lastFailureMessage = responseText
        ? `Hostinger upload endpoint returned an error (status ${response.status}) on ${uploadUrl}: ${responseText.slice(0, 200)}`
        : `Hostinger upload endpoint returned an error (status ${response.status}) on ${uploadUrl}.`
      continue
    }

    const uploadBaseOrigin = (() => {
      try {
        return new URL(uploadUrl).origin
      } catch {
        return ''
      }
    })()

    const absoluteUrl = normalizeToAbsoluteUrl(
      payload?.url || payload?.path || '',
      uploadBaseOrigin,
    )

    if (!absoluteUrl) {
      lastFailureMessage = `Hostinger upload endpoint did not return a media url (${uploadUrl}).`
      continue
    }

    return {
      url: absoluteUrl,
      bytes: payload?.bytes || bytes || blob.size || 0,
      durationSeconds: 0,
    }
  }

  throw new AppError(lastFailureMessage, 502)
}

async function uploadBufferToHostinger(options) {
  const { buffer, contentType = 'application/octet-stream' } = options
  return uploadBlobToHostinger({
    ...options,
    blob: new Blob([buffer], { type: contentType }),
    bytes: buffer.length,
  })
}

async function uploadBufferToRemoteStorage({
  buffer,
  fileName = 'upload.bin',
  folder = 'uploads',
  contentType = 'application/octet-stream',
  uploadClass = '',
}) {
  if (isS3StorageEnabled()) {
    return uploadBufferToS3({
      buffer,
      fileName,
      folder,
      contentType,
      uploadClass,
    })
  }

  if (isHostingerStorageEnabled()) {
    return uploadBufferToHostinger({
      buffer,
      fileName,
      folder,
      contentType,
      uploadClass,
    })
  }

  throw new AppError('Remote storage provider is not enabled.', 500)
}

async function uploadLocalFileToRemoteStorage(file, {
  folder = 'uploads',
  uploadClass = '',
} = {}) {
  if (!file?.path) {
    throw new AppError('Uploaded file path is missing.', 400)
  }

  const originalName = file.originalname || path.basename(file.path) || 'upload.bin'
  const mimeType = file.mimetype || 'application/octet-stream'
  let uploaded

  if (isHostingerStorageEnabled() && typeof fs.openAsBlob === 'function') {
    const [fileBlob, fileStats] = await Promise.all([
      fs.openAsBlob(file.path, { type: mimeType }),
      fs.promises.stat(file.path),
    ])
    uploaded = await uploadBlobToHostinger({
      blob: fileBlob,
      bytes: fileStats.size,
      fileName: originalName,
      folder,
      contentType: mimeType,
      uploadClass,
    })
  } else {
    const fileBuffer = await fs.promises.readFile(file.path)
    uploaded = await uploadBufferToRemoteStorage({
      buffer: fileBuffer,
      fileName: originalName,
      folder,
      contentType: mimeType,
      uploadClass,
    })
  }

  return {
    ...uploaded,
    type: mimeType.startsWith('video/') ? 'video' : 'image',
  }
}

async function uploadProfileDataImage(dataUri, { username = 'user', kind = 'avatar' } = {}) {
  if (!dataImagePattern.test(String(dataUri || ''))) {
    return dataUri
  }

  const { buffer, mimeType } = parseDataUriImage(dataUri)
  const extension = resolveImageExtensionByMimeType(mimeType)
  const profileFileName = `${sanitizeSegment(username, 'user')}-${sanitizeSegment(kind, 'image')}${extension}`

  if (!isRemoteStorageEnabled()) {
    return writeBufferToLocalUploads({
      buffer,
      folder: 'profiles',
      fileName: profileFileName,
    })
  }

  try {
    const uploaded = await uploadBufferToRemoteStorage({
      buffer,
      fileName: profileFileName,
      folder: 'profiles',
      contentType: mimeType,
    })

    return uploaded.url
  } catch (error) {
    console.warn(
      `Remote profile media upload failed, using local fallback for ${username}/${kind}: ${error.message}`,
    )

    return writeBufferToLocalUploads({
      buffer,
      folder: 'profiles',
      fileName: profileFileName,
    })
  }
}

module.exports = {
  dataImagePattern,
  isRemoteStorageEnabled,
  uploadLocalFileToRemoteStorage,
  uploadProfileDataImage,
}
