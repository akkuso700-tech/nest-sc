const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { env } = require('../config/env')
const {
  isRemoteStorageEnabled,
  uploadLocalFileToRemoteStorage,
} = require('./mediaStorageService')

function assertPathInsideUploads(filePath) {
  const uploadsRoot = path.resolve(env.uploadsDir)
  const resolvedPath = path.resolve(filePath)
  const relativePath = path.relative(uploadsRoot, resolvedPath)
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    const error = new Error('Video job path is outside the configured uploads directory.')
    error.code = 'INVALID_JOB_SOURCE_PATH'
    error.permanent = true
    throw error
  }
  return resolvedPath
}

function buildLocalMediaUrl(filePath) {
  const relativePath = path.relative(path.resolve(env.uploadsDir), path.resolve(filePath))
  return `/uploads/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`
}

function mimeTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.m3u8') return 'application/vnd.apple.mpegurl'
  if (extension === '.m4s' || extension === '.mp4') return 'video/mp4'
  if (extension === '.ts') return 'video/mp2t'
  if (extension === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

async function uploadGeneratedFile(filePath, folder = 'loops') {
  return uploadLocalFileToRemoteStorage(
    {
      path: filePath,
      mimetype: mimeTypeForPath(filePath),
      originalname: path.basename(filePath),
    },
    { folder, uploadClass: 'loop-video' },
  )
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const values = Array.from(items || [])
  if (!values.length) return []

  const results = new Array(values.length)
  const workerCount = Math.min(
    values.length,
    Math.max(1, Math.floor(Number(concurrency) || 1)),
  )
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(values[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

async function publishRemoteRendition(rendition) {
  const files = await fs.promises.readdir(rendition.directory)
  const assetFiles = files
    .filter((name) => name.endsWith('.ts'))
    .sort()
  const uploadedAssets = new Map()

  const uploaded = await mapWithConcurrency(
    assetFiles,
    env.loopUploadConcurrency,
    async (fileName) => {
      const result = await uploadGeneratedFile(path.join(rendition.directory, fileName))
      return [fileName, result.url]
    },
  )
  for (const [fileName, url] of uploaded) {
    uploadedAssets.set(fileName, url)
  }

  const sourceManifest = await fs.promises.readFile(rendition.manifestPath, 'utf8')
  const rewrittenManifest = sourceManifest
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith('#EXT-X-MAP:')) {
        return line.replace(/URI="([^"]+)"/, (match, fileName) => {
          const url = uploadedAssets.get(fileName)
          return url ? `URI="${url}"` : match
        })
      }
      if (line && !line.startsWith('#')) {
        return uploadedAssets.get(line) || line
      }
      return line
    })
    .join('\n')
  const rewrittenPath = path.join(rendition.directory, 'index-remote.m3u8')
  await fs.promises.writeFile(rewrittenPath, rewrittenManifest, 'utf8')
  const uploadedManifest = await uploadGeneratedFile(rewrittenPath)

  return {
    name: rendition.name,
    width: rendition.width,
    height: rendition.height,
    bitrateKbps: rendition.bitrateKbps,
    url: uploadedManifest.url,
  }
}

async function writeRemoteMaster(outputDirectory, renditions) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS']
  renditions.forEach((rendition) => {
    const bandwidth = (rendition.bitrateKbps + 96) * 1000
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${bandwidth},RESOLUTION=${rendition.width}x${rendition.height},CODECS="avc1.4d401f,mp4a.40.2"`,
      rendition.url,
    )
  })
  // The distinct name lets clients avoid legacy fMP4 manifests that some
  // shared-hosting HTTP stacks serve unreliably while preserving MP4 fallback.
  const filePath = path.join(outputDirectory, 'master-ts-remote.m3u8')
  await fs.promises.writeFile(filePath, `${lines.join('\n')}\n`, 'utf8')
  return filePath
}

function mountedMediaUrl(relativePath) {
  const baseUrl = String(env.hostingerPublicBaseUrl || '').replace(/\/+$/, '')
  return `${baseUrl}/media/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`
}

async function publishToMountedMediaRoot(result) {
  const mediaRoot = path.resolve(env.loopHostingerMediaRoot)
  const loopsRoot = path.join(mediaRoot, 'loops')
  const packageId = crypto.randomUUID()
  const stagingDirectory = path.join(loopsRoot, `.publishing-${packageId}`)
  const targetDirectory = path.join(loopsRoot, packageId)

  await fs.promises.mkdir(loopsRoot, { recursive: true })
  try {
    await fs.promises.cp(result.outputDirectory, stagingDirectory, { recursive: true, errorOnExist: true })
    await fs.promises.rename(stagingDirectory, targetDirectory)
  } catch (error) {
    await fs.promises.rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }

  const relativeRoot = path.join('loops', packageId)
  const fallbackRelativePath = path.join(
    relativeRoot,
    path.relative(result.outputDirectory, result.fallbackMp4Path),
  )
  return {
    url: mountedMediaUrl(fallbackRelativePath),
    hlsUrl: mountedMediaUrl(path.join(relativeRoot, 'master.m3u8')),
    posterUrl: mountedMediaUrl(path.join(relativeRoot, 'poster.webp')),
    durationSeconds: result.durationSeconds,
    width: result.width,
    height: result.height,
    renditions: result.renditions.map((rendition) => ({
      name: rendition.name,
      width: rendition.width,
      height: rendition.height,
      bitrateKbps: rendition.bitrateKbps,
      url: mountedMediaUrl(path.join(relativeRoot, rendition.name, 'index.m3u8')),
    })),
  }
}

async function publishAdaptiveLoopOutputs(result) {
  if (env.loopHostingerMediaRoot && env.hostingerPublicBaseUrl) {
    return publishToMountedMediaRoot(result)
  }

  if (!isRemoteStorageEnabled()) {
    return {
      url: buildLocalMediaUrl(result.fallbackMp4Path),
      hlsUrl: buildLocalMediaUrl(result.masterPath),
      posterUrl: buildLocalMediaUrl(result.posterPath),
      durationSeconds: result.durationSeconds,
      width: result.width,
      height: result.height,
      renditions: result.renditions.map((rendition) => ({
        name: rendition.name,
        width: rendition.width,
        height: rendition.height,
        bitrateKbps: rendition.bitrateKbps,
        url: buildLocalMediaUrl(rendition.manifestPath),
      })),
    }
  }

  const remoteRenditions = []
  for (const rendition of result.renditions) {
    remoteRenditions.push(await publishRemoteRendition(rendition))
  }
  const remoteMasterPath = await writeRemoteMaster(result.outputDirectory, remoteRenditions)
  const [fallback, poster, master] = await Promise.all([
    uploadGeneratedFile(result.fallbackMp4Path),
    uploadGeneratedFile(result.posterPath),
    uploadGeneratedFile(remoteMasterPath),
  ])

  return {
    url: fallback.url,
    hlsUrl: master.url,
    posterUrl: poster.url,
    durationSeconds: result.durationSeconds,
    width: result.width,
    height: result.height,
    renditions: remoteRenditions,
  }
}

module.exports = {
  assertPathInsideUploads,
  buildLocalMediaUrl,
  mapWithConcurrency,
  publishToMountedMediaRoot,
  publishAdaptiveLoopOutputs,
}
