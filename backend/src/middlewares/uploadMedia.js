const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { promisify } = require('util')
const multer = require('multer')
const { env } = require('../config/env')
const { AppError } = require('../utils/AppError')
const {
  isRemoteStorageEnabled,
  uploadLocalFileToRemoteStorage,
} = require('../services/mediaStorageService')
const { buildLoopVideoVariants } = require('../services/videoProcessingService')

const unlinkFile = promisify(fs.unlink)
const FILE_SIGNATURE_BYTES = 32
const DEFAULT_MEDIA_FILE_BYTES = 25 * 1024 * 1024
const LOOP_VIDEO_FILE_BYTES = 100 * 1024 * 1024

const uploadsRoot = env.uploadsDir || path.resolve(process.cwd(), 'uploads')

function ensureUploadsDirectory() {
  fs.mkdirSync(uploadsRoot, { recursive: true })
}

function createStorage(targetDirectory) {
  return multer.diskStorage({
    destination(req, file, callback) {
      const fullDirectory = path.join(uploadsRoot, targetDirectory)
      fs.mkdirSync(fullDirectory, { recursive: true })
      callback(null, fullDirectory)
    },
    filename(req, file, callback) {
      const extension = path.extname(file.originalname || '')
      callback(
        null,
        `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${extension}`,
      )
    },
  })
}

function mediaFileFilter(req, file, callback) {
  const declaredContentType = String(req.body?.contentType || req.headers['x-content-type'] || '')
    .trim()
    .toLowerCase()
  if (
    env.directVideoUploadsEnabled &&
    declaredContentType === 'loop' &&
    String(file.mimetype || '').startsWith('video/')
  ) {
    callback(new AppError('Loop videos must use direct object-storage upload.', 409))
    return
  }

  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/')
  ) {
    callback(null, true)
    return
  }

  callback(new AppError('Only image and video uploads are allowed.', 400))
}

function resolvePostMediaFileSizeLimit(contentType, mimeType) {
  const isLoopVideo =
    String(contentType || '').trim().toLowerCase() === 'loop' &&
    String(mimeType || '').startsWith('video/')

  return isLoopVideo ? LOOP_VIDEO_FILE_BYTES : DEFAULT_MEDIA_FILE_BYTES
}

function createUploadMiddleware(targetDirectory, maxFiles, options = {}) {
  ensureUploadsDirectory()

  const allowLargeLoopVideo = Boolean(options.allowLargeLoopVideo)
  const multerFileSizeLimit = allowLargeLoopVideo
    ? LOOP_VIDEO_FILE_BYTES
    : DEFAULT_MEDIA_FILE_BYTES

  const upload = multer({
    storage: createStorage(targetDirectory),
    fileFilter: mediaFileFilter,
    limits: {
      fileSize: multerFileSizeLimit,
      files: maxFiles,
    },
  })

  const uploadFiles = upload.array('media', maxFiles)

  return function uploadMedia(req, res, next) {
    req.uploadMaxFileSizeBytes = multerFileSizeLimit

    uploadFiles(req, res, async (error) => {
      if (error) {
        next(error)
        return
      }

      if (!allowLargeLoopVideo) {
        next()
        return
      }

      const contentType = String(req.body?.contentType || 'post').trim().toLowerCase()
      const oversizedNonLoopFile = (req.files || []).find((file) => {
        const allowedBytes = resolvePostMediaFileSizeLimit(contentType, file?.mimetype)
        return Number(file?.size || 0) > allowedBytes
      })

      if (!oversizedNonLoopFile) {
        next()
        return
      }

      await removeUploadedFiles(req.files)
      req.files = []
      next(new AppError('Loop disindaki medya dosyalari en fazla 25 MB olabilir.', 400))
    })
  }
}

function matchesSignature(buffer, signature, startIndex = 0) {
  if (!buffer || !signature) {
    return false
  }

  if (buffer.length < signature.length + startIndex) {
    return false
  }

  for (let index = 0; index < signature.length; index += 1) {
    if (buffer[startIndex + index] !== signature[index]) {
      return false
    }
  }

  return true
}

async function detectMediaTypeFromSignature(filePath) {
  const handle = await fs.promises.open(filePath, 'r')

  try {
    const buffer = Buffer.alloc(FILE_SIGNATURE_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, FILE_SIGNATURE_BYTES, 0)
    const header = buffer.subarray(0, bytesRead)

    if (
      matchesSignature(header, [0xff, 0xd8, 0xff]) ||
      matchesSignature(header, [0x89, 0x50, 0x4e, 0x47]) ||
      matchesSignature(header, [0x47, 0x49, 0x46, 0x38]) ||
      (matchesSignature(header, [0x52, 0x49, 0x46, 0x46]) &&
        matchesSignature(header, [0x57, 0x45, 0x42, 0x50], 8))
    ) {
      return 'image'
    }

    if (
      matchesSignature(header, [0x1a, 0x45, 0xdf, 0xa3]) ||
      matchesSignature(header, [0x4f, 0x67, 0x67, 0x53]) ||
      matchesSignature(header, [0x66, 0x74, 0x79, 0x70], 4)
    ) {
      return 'video'
    }

    return 'unknown'
  } finally {
    await handle.close()
  }
}

function resolveSafeMimeType(file, mediaType) {
  const sourceMimeType = String(file?.mimetype || '').toLowerCase()
  if (sourceMimeType.startsWith(`${mediaType}/`)) {
    return sourceMimeType
  }

  return mediaType === 'video' ? 'video/mp4' : 'image/jpeg'
}

async function validateUploadedFileSignature(file) {
  const declaredType = String(file?.mimetype || '').startsWith('video/')
    ? 'video'
    : String(file?.mimetype || '').startsWith('image/')
      ? 'image'
      : 'unknown'
  const detectedType = await detectMediaTypeFromSignature(file.path)

  if (declaredType === 'unknown' || detectedType === 'unknown' || declaredType !== detectedType) {
    throw new AppError('Uploaded file content does not match its declared media type.', 400)
  }

  return {
    ...file,
    safeMediaType: detectedType,
    safeMimeType: resolveSafeMimeType(file, detectedType),
  }
}

function buildLocalUploadUrl(filePath) {
  const directoryName = path.basename(path.dirname(filePath || 'uploads'))
  const fileName = path.basename(filePath || '')
  return `/uploads/${directoryName}/${fileName}`
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise
  }

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage || 'Operation timed out.'))
      }, timeoutMs)
    }),
  ])
}

async function uploadMediaPathToRemoteStorage(filePath, {
  folder,
  mimeType,
  originalName,
  uploadClass = '',
}) {
  return uploadLocalFileToRemoteStorage(
    {
      path: filePath,
      mimetype: mimeType,
      originalname: originalName || path.basename(filePath),
    },
    { folder, uploadClass },
  )
}

async function buildMediaItems(files = [], options = {}) {
  const { contentType = 'post', trace = null, deferLoopProcessing = false } = options
  const traceEnabled = Boolean(trace && typeof trace === 'object')
  const nowMs = () => Date.now()
  const totalStartMs = nowMs()
  const incrementTrace = (key, value) => {
    if (!traceEnabled) {
      return
    }
    trace[key] = Number(trace[key] || 0) + Number(value || 0)
  }
  const setTrace = (key, value) => {
    if (!traceEnabled) {
      return
    }
    trace[key] = value
  }
  const validatedFiles = []

  const signatureValidationStartMs = nowMs()
  for (const file of files) {
    // Validate file signatures server-side to prevent mimetype spoofing bypasses.
    validatedFiles.push(await validateUploadedFileSignature(file))
  }
  incrementTrace('signatureValidationMs', nowMs() - signatureValidationStartMs)
  setTrace('inputFileCount', files.length)
  setTrace('validatedFileCount', validatedFiles.length)

  const videoFiles = validatedFiles.filter((file) => file.safeMediaType === 'video')
  setTrace('videoFileCount', videoFiles.length)

  if (videoFiles.length > 1 || (videoFiles.length && validatedFiles.length > 1)) {
    throw new AppError('You can upload either up to 4 images or 1 video.', 400)
  }

  const shouldUseRemoteStorage = isRemoteStorageEnabled()
  const mediaItems = []
  const filesUploadedRemotely = []

  for (const file of validatedFiles) {
    const isVideo = file.safeMediaType === 'video'
    const shouldBuildLoopVariants = isVideo && contentType === 'loop'
    const fallbackUrl = buildLocalUploadUrl(file.path)
    let sourceMediaPath = file.path
    let sourceMimeType = file.safeMimeType
    let hlsFallbackUrl = ''
    let posterFallbackUrl = ''
    let processingState = 'raw'
    let resolvedDurationSeconds = 0
    const generatedPathsForCleanup = []

    if (shouldBuildLoopVariants && deferLoopProcessing) {
      let durableSourceUrl = ''

      if (shouldUseRemoteStorage) {
        const remoteUploadStartMs = nowMs()
        const folder = path.basename(path.dirname(file.path || 'posts'))
        const uploadedSource = await uploadLocalFileToRemoteStorage(
          {
            ...file,
            mimetype: file.safeMimeType,
          },
          { folder, uploadClass: 'loop-video' },
        )
        durableSourceUrl = uploadedSource.url
        incrementTrace('remoteUploadMs', nowMs() - remoteUploadStartMs)
        const remoteCleanupStartMs = nowMs()
        await removeUploadedFiles([file])
        incrementTrace('remoteCleanupMs', nowMs() - remoteCleanupStartMs)
      }

      mediaItems.push({
        url: durableSourceUrl || fallbackUrl,
        hlsUrl: '',
        posterUrl: '',
        type: 'video',
        durationSeconds: 0,
        processing: 'queued',
        processingProgress: 0,
        processingError: '',
        _processingSource: {
          path: durableSourceUrl ? '' : file.path,
          sourceUrl: durableSourceUrl,
          originalName: file.originalname || path.basename(file.path),
          mimeType: file.safeMimeType,
        },
      })
      continue
    }

    if (isVideo) {
      try {
        const videoProcessingStartMs = nowMs()
        const variantResult = await withTimeout(
          buildLoopVideoVariants(file.path, {
            enableLoopVariants: shouldBuildLoopVariants,
          }),
          env.loopProcessingTimeoutMs || 8000,
          'Video processing timed out.',
        )
        incrementTrace('videoProcessingMs', nowMs() - videoProcessingStartMs)
        if (variantResult.mediaPath && variantResult.mediaPath !== file.path) {
          sourceMediaPath = variantResult.mediaPath
          sourceMimeType = 'video/mp4'
          processingState = variantResult.hlsManifestPath ? 'hls-ready' : 'transcoded'
        }
        if (Number.isFinite(variantResult.durationSeconds) && variantResult.durationSeconds > 0) {
          resolvedDurationSeconds = variantResult.durationSeconds
        }
        if (variantResult.hlsManifestPath) {
          hlsFallbackUrl = buildLocalUploadUrl(variantResult.hlsManifestPath)
          if (processingState !== 'hls-ready') {
            processingState = 'hls-ready'
          }
        }
        if (variantResult.posterPath) {
          posterFallbackUrl = buildLocalUploadUrl(variantResult.posterPath)
        }
        generatedPathsForCleanup.push(...(variantResult.cleanupPaths || []))
      } catch (error) {
        // Keep original media path as a resilient fallback when processing fails.
        console.warn(
          `Video processing failed, using original media for ${file.originalname || file.path}: ${error.message}`,
        )
      }
    }

    let mediaItem = {
      url: fallbackUrl,
      hlsUrl: hlsFallbackUrl,
      posterUrl: posterFallbackUrl,
      type: isVideo ? 'video' : 'image',
      durationSeconds: resolvedDurationSeconds,
      processing: processingState,
    }

    if (shouldUseRemoteStorage) {
      try {
        const remoteUploadStartMs = nowMs()
        const folder = path.basename(path.dirname(file.path || 'uploads'))
        const uploadedMedia = await uploadMediaPathToRemoteStorage(sourceMediaPath, {
          folder,
          mimeType: sourceMimeType,
          originalName: file.originalname,
          uploadClass: shouldBuildLoopVariants ? 'loop-video' : '',
        })
        let uploadedHlsUrl = ''
        let uploadedPosterUrl = ''

        const posterPath = generatedPathsForCleanup.find((item) =>
          item.endsWith('-poster.jpg'),
        )
        if (posterPath) {
          const uploadedPoster = await uploadMediaPathToRemoteStorage(posterPath, {
            folder,
            mimeType: 'image/jpeg',
            originalName: `${path.basename(file.originalname || 'video', path.extname(file.originalname || ''))}-poster.jpg`,
          })
          uploadedPosterUrl = uploadedPoster.url
        }

        if (hlsFallbackUrl) {
          const hlsManifestPath = generatedPathsForCleanup.find((item) =>
            item.endsWith('.m3u8'),
          )
          const hlsSegmentPath = generatedPathsForCleanup.find((item) =>
            item.endsWith('.ts'),
          )

          if (hlsManifestPath && hlsSegmentPath) {
            const uploadedSegment = await uploadMediaPathToRemoteStorage(hlsSegmentPath, {
              folder,
              mimeType: 'video/mp2t',
              originalName: `${path.basename(file.originalname || 'loop', path.extname(file.originalname || ''))}-hls.ts`,
              uploadClass: 'loop-video',
            })

            const manifestText = await fs.promises.readFile(hlsManifestPath, 'utf8')
            const segmentBaseName = path.basename(hlsSegmentPath)
            const rewrittenManifestText = manifestText
              .split('\n')
              .map((line) => (line.includes(segmentBaseName) ? uploadedSegment.url : line))
              .join('\n')
            const rewrittenManifestPath = hlsManifestPath.replace(/\.m3u8$/i, '-rewritten.m3u8')
            await fs.promises.writeFile(rewrittenManifestPath, rewrittenManifestText, 'utf8')

            const uploadedManifest = await uploadMediaPathToRemoteStorage(rewrittenManifestPath, {
              folder,
              mimeType: 'application/vnd.apple.mpegurl',
              originalName: `${path.basename(file.originalname || 'loop', path.extname(file.originalname || ''))}-hls.m3u8`,
            })
            uploadedHlsUrl = uploadedManifest.url
            filesUploadedRemotely.push({
              path: rewrittenManifestPath,
            })
          }
        }
        incrementTrace('remoteUploadMs', nowMs() - remoteUploadStartMs)

        mediaItem = {
          url: uploadedMedia.url,
          hlsUrl: uploadedHlsUrl,
          posterUrl: uploadedPosterUrl || mediaItem.posterUrl,
          type: uploadedMedia.type,
          durationSeconds: uploadedMedia.durationSeconds || mediaItem.durationSeconds || 0,
          processing: uploadedHlsUrl
            ? 'hls-ready'
            : sourceMediaPath !== file.path
              ? 'transcoded'
              : mediaItem.processing,
        }

        filesUploadedRemotely.push(file)
        if (sourceMediaPath !== file.path) {
          filesUploadedRemotely.push({ path: sourceMediaPath })
        }
        generatedPathsForCleanup
          .filter((generatedPath) => generatedPath !== sourceMediaPath)
          .forEach((generatedPath) => {
            filesUploadedRemotely.push({ path: generatedPath })
          })
      } catch (error) {
        // Keep local file reference as a resilient fallback when remote upload is unavailable.
        console.warn(
          `Remote media upload failed, using local fallback for ${file.originalname || file.path}: ${error.message}`,
        )
      }
    }

    mediaItems.push(mediaItem)
  }

  if (shouldUseRemoteStorage && filesUploadedRemotely.length) {
    const cleanupStartMs = nowMs()
    await removeUploadedFiles(filesUploadedRemotely)
    incrementTrace('remoteCleanupMs', nowMs() - cleanupStartMs)
  }

  incrementTrace('buildMediaItemsTotalMs', nowMs() - totalStartMs)

  return mediaItems
}

async function removeUploadedFiles(files = []) {
  await Promise.allSettled(
    files
      .filter((file) => file?.path)
      .map((file) => unlinkFile(file.path)),
  )
}

module.exports = {
  uploadsRoot,
  DEFAULT_MEDIA_FILE_BYTES,
  LOOP_VIDEO_FILE_BYTES,
  resolvePostMediaFileSizeLimit,
  createUploadMiddleware,
  buildMediaItems,
  removeUploadedFiles,
}
