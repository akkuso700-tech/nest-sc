const {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  UploadPartCommand,
} = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { env } = require('../config/env')
const { VideoUploadSession } = require('../models/VideoUploadSession')
const { AppError } = require('../utils/AppError')
const {
  buildS3ObjectKey,
  resolveS3Client,
} = require('./mediaStorageService')

const LOOP_VIDEO_MAX_BYTES = 100 * 1024 * 1024
const SUPPORTED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
])

function assertDirectVideoUploadsEnabled() {
  if (!env.directVideoUploadsEnabled || env.storageProvider !== 's3') {
    throw new AppError('Direct video uploads are not enabled.', 409)
  }
}

function normalizeMimeType(value) {
  return String(value || '').trim().toLowerCase()
}

function validateVideoUploadInput({ fileName, mimeType, bytes }) {
  const normalizedMimeType = normalizeMimeType(mimeType)
  const normalizedBytes = Number(bytes || 0)

  if (!SUPPORTED_VIDEO_MIME_TYPES.has(normalizedMimeType)) {
    throw new AppError('Unsupported Loop video format.', 400)
  }
  if (!Number.isSafeInteger(normalizedBytes) || normalizedBytes <= 0) {
    throw new AppError('Video size is invalid.', 400)
  }
  if (normalizedBytes > LOOP_VIDEO_MAX_BYTES) {
    throw new AppError('Loop videos can be at most 100 MB.', 400)
  }

  return {
    fileName: String(fileName || 'loop-video.mp4').slice(0, 240),
    mimeType: normalizedMimeType,
    bytes: normalizedBytes,
  }
}

async function createDirectVideoUpload({ ownerId, fileName, mimeType, bytes }) {
  assertDirectVideoUploadsEnabled()
  const input = validateVideoUploadInput({ fileName, mimeType, bytes })
  const partSizeBytes = env.directVideoUploadPartSizeBytes
  const partCount = Math.ceil(input.bytes / partSizeBytes)
  const objectKey = buildS3ObjectKey({
    folder: 'loop-sources',
    fileName: input.fileName,
  })
  const activeSessions = await VideoUploadSession.countDocuments({
    owner: ownerId,
    status: { $in: ['initiated', 'uploaded'] },
    expiresAt: { $gt: new Date() },
  })
  if (activeSessions >= 3) {
    throw new AppError('You can have at most three active video uploads.', 429)
  }
  const s3 = resolveS3Client()
  const created = await s3.send(new CreateMultipartUploadCommand({
    Bucket: env.s3SourceBucket,
    Key: objectKey,
    ContentType: input.mimeType,
    CacheControl: 'private, no-store',
    Metadata: {
      owner: String(ownerId),
      purpose: 'loop-source',
    },
  }))

  if (!created.UploadId) {
    throw new AppError('Object storage did not create an upload session.', 502)
  }

  const expiresAt = new Date(Date.now() + env.directVideoUploadSessionTtlHours * 60 * 60 * 1000)
  let session = null
  try {
    session = await VideoUploadSession.create({
      owner: ownerId,
      provider: 's3',
      bucket: env.s3SourceBucket,
      objectKey,
      multipartUploadId: created.UploadId,
      originalName: input.fileName,
      mimeType: input.mimeType,
      bytes: input.bytes,
      partSizeBytes,
      partCount,
      status: 'initiated',
      expiresAt,
      deleteAfter: new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    })
    const parts = await Promise.all(
      Array.from({ length: partCount }, async (_value, index) => {
        const partNumber = index + 1
        const url = await getSignedUrl(
          s3,
          new UploadPartCommand({
            Bucket: env.s3SourceBucket,
            Key: objectKey,
            UploadId: created.UploadId,
            PartNumber: partNumber,
          }),
          { expiresIn: env.directVideoUploadUrlTtlSeconds },
        )
        return { partNumber, url }
      }),
    )

    return {
      uploadId: session.id,
      partSizeBytes,
      partCount,
      expiresAt,
      parts,
    }
  } catch (error) {
    await Promise.allSettled([
      s3.send(new AbortMultipartUploadCommand({
        Bucket: env.s3SourceBucket,
        Key: objectKey,
        UploadId: created.UploadId,
      })),
      session ? VideoUploadSession.deleteOne({ _id: session._id }) : Promise.resolve(),
    ])
    throw error
  }
}

function normalizeCompletedParts(parts, expectedCount) {
  if (!Array.isArray(parts) || parts.length !== expectedCount) {
    throw new AppError('All video parts must be uploaded before completion.', 400)
  }

  const normalized = parts
    .map((part) => ({
      PartNumber: Number(part?.partNumber),
      ETag: String(part?.etag || '').trim(),
    }))
    .sort((left, right) => left.PartNumber - right.PartNumber)

  normalized.forEach((part, index) => {
    if (part.PartNumber !== index + 1 || !part.ETag || part.ETag.length > 200) {
      throw new AppError('Uploaded video part metadata is invalid.', 400)
    }
  })
  return normalized
}

async function completeDirectVideoUpload({ ownerId, uploadId, parts }) {
  assertDirectVideoUploadsEnabled()
  const session = await VideoUploadSession.findOne({
    _id: uploadId,
    owner: ownerId,
    status: { $in: ['initiated', 'uploaded'] },
    expiresAt: { $gt: new Date() },
  })
  if (!session) throw new AppError('Video upload session was not found or has expired.', 404)

  if (session.status === 'uploaded') return session

  const normalizedParts = normalizeCompletedParts(parts, session.partCount)
  const s3 = resolveS3Client()
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: session.bucket,
    Key: session.objectKey,
    UploadId: session.multipartUploadId,
    MultipartUpload: { Parts: normalizedParts },
  }))
  const head = await s3.send(new HeadObjectCommand({
    Bucket: session.bucket,
    Key: session.objectKey,
  }))
  if (Number(head.ContentLength || 0) !== session.bytes) {
    await s3.send(new DeleteObjectCommand({ Bucket: session.bucket, Key: session.objectKey }))
    session.status = 'aborted'
    await session.save()
    throw new AppError('Uploaded video size verification failed.', 400)
  }

  session.status = 'uploaded'
  session.uploadedAt = new Date()
  session.completedParts = normalizedParts.map((part) => ({
    partNumber: part.PartNumber,
    etag: part.ETag,
  }))
  await session.save()
  return session
}

async function abortDirectVideoUpload({ ownerId, uploadId }) {
  assertDirectVideoUploadsEnabled()
  const session = await VideoUploadSession.findOne({ _id: uploadId, owner: ownerId })
  if (!session) return false
  if (session.status === 'initiated') {
    await resolveS3Client().send(new AbortMultipartUploadCommand({
      Bucket: session.bucket,
      Key: session.objectKey,
      UploadId: session.multipartUploadId,
    })).catch(() => undefined)
  } else if (session.status === 'uploaded') {
    await resolveS3Client().send(new DeleteObjectCommand({
      Bucket: session.bucket,
      Key: session.objectKey,
    })).catch(() => undefined)
  }
  session.status = 'aborted'
  await session.save()
  return true
}

async function getDirectVideoUploadCapabilities() {
  return {
    enabled: Boolean(env.directVideoUploadsEnabled && env.storageProvider === 's3'),
    provider: env.directVideoUploadsEnabled ? 's3' : 'legacy',
    maxBytes: LOOP_VIDEO_MAX_BYTES,
    maxDurationSeconds: env.loopMaxDurationSeconds,
    resumable: Boolean(env.directVideoUploadsEnabled),
  }
}

async function getUploadedSessionForPost({ ownerId, uploadId }) {
  if (!env.directVideoUploadsEnabled) return null
  return VideoUploadSession.findOne({
    _id: uploadId,
    owner: ownerId,
    status: 'uploaded',
    expiresAt: { $gt: new Date() },
  })
}

async function cleanupExpiredDirectVideoUploads(limit = 20) {
  if (!env.directVideoUploadsEnabled) return 0
  const sessions = await VideoUploadSession.find({
    status: { $in: ['initiated', 'uploaded'] },
    expiresAt: { $lte: new Date() },
  }).sort({ expiresAt: 1 }).limit(Math.max(1, Math.min(100, Number(limit) || 20)))
  let cleaned = 0
  for (const session of sessions) {
    if (session.status === 'initiated') {
      await resolveS3Client().send(new AbortMultipartUploadCommand({
        Bucket: session.bucket,
        Key: session.objectKey,
        UploadId: session.multipartUploadId,
      })).catch(() => undefined)
    } else {
      await resolveS3Client().send(new DeleteObjectCommand({
        Bucket: session.bucket,
        Key: session.objectKey,
      })).catch(() => undefined)
    }
    session.status = 'expired'
    await session.save()
    cleaned += 1
  }
  return cleaned
}

async function deleteS3Object(objectKey) {
  if (!objectKey || env.storageProvider !== 's3') return
  await resolveS3Client().send(new DeleteObjectCommand({
    Bucket: env.s3SourceBucket,
    Key: objectKey,
  }))
}

async function deletePublishedMediaObjects(objectKeys = []) {
  const uniqueKeys = [...new Set((objectKeys || []).map((key) => String(key || '').trim()).filter(Boolean))]
  if (!uniqueKeys.length || env.storageProvider !== 's3') return
  for (let index = 0; index < uniqueKeys.length; index += 1000) {
    await resolveS3Client().send(new DeleteObjectsCommand({
      Bucket: env.s3Bucket,
      Delete: {
        Quiet: true,
        Objects: uniqueKeys.slice(index, index + 1000).map((Key) => ({ Key })),
      },
    }))
  }
}

function createS3SourceReadCommand(objectKey) {
  return new GetObjectCommand({ Bucket: env.s3SourceBucket, Key: objectKey })
}

module.exports = {
  LOOP_VIDEO_MAX_BYTES,
  createDirectVideoUpload,
  completeDirectVideoUpload,
  abortDirectVideoUpload,
  getDirectVideoUploadCapabilities,
  getUploadedSessionForPost,
  cleanupExpiredDirectVideoUploads,
  deleteS3Object,
  deletePublishedMediaObjects,
  createS3SourceReadCommand,
  _test: {
    validateVideoUploadInput,
    normalizeCompletedParts,
  },
}
