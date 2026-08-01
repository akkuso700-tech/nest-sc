const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const { env } = require('../config/env')

const binaryAvailabilityCache = new Map()

function resolveFfmpegBinary() {
  return env.ffmpegPath || ffmpegInstaller.path || 'ffmpeg'
}

function ensureBinaryExecutable(binary) {
  if (process.platform === 'win32' || !path.isAbsolute(binary) || !fileExists(binary)) {
    return
  }

  try {
    fs.chmodSync(binary, 0o755)
  } catch {
    // spawn() will return the actionable platform error if chmod is unavailable.
  }
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

function runBinary(binary, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    ensureBinaryExecutable(binary)
    const childProcess = spawn(binary, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(options.cwd ? { cwd: options.cwd } : {}),
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeoutMs = Number(options.timeoutMs || 0)
    const timeoutId = timeoutMs > 0
      ? setTimeout(() => {
          if (settled) return
          settled = true
          childProcess.kill('SIGKILL')
          const timeoutError = new Error(`Media command timed out after ${timeoutMs} ms.`)
          timeoutError.code = 'MEDIA_COMMAND_TIMEOUT'
          reject(timeoutError)
        }, timeoutMs)
      : null

    childProcess.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    childProcess.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    childProcess.on('error', (error) => {
      if (settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      reject(error)
    })
    childProcess.on('close', (code) => {
      if (settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(stderr || stdout || `Process exited with code ${code}`))
    })
  })
}

const ADAPTIVE_RENDITIONS = [
  { name: '360p', shortEdge: 360, bitrateKbps: 600 },
  { name: '540p', shortEdge: 540, bitrateKbps: 1300 },
  { name: '720p', shortEdge: 720, bitrateKbps: 2400 },
]

async function probeVideoMetadata(inputPath) {
  const ffmpegBinary = resolveFfmpegBinary()
  const { stderr } = await runBinary(
    ffmpegBinary,
    [
      '-hide_banner', '-i', inputPath,
      '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-',
    ],
    { timeoutMs: 30_000 },
  )
  const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i)
  const videoLine = stderr.split(/\r?\n/).find((line) => /Video:/i.test(line)) || ''
  const dimensionsMatch = videoLine.match(/(?:,|\s)(\d{2,5})x(\d{2,5})(?:[\s,])/)
  const durationSeconds = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : 0
  const width = Number(dimensionsMatch?.[1] || 0)
  const height = Number(dimensionsMatch?.[2] || 0)

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !width || !height) {
    const error = new Error('Video metadata could not be read.')
    error.code = 'INVALID_VIDEO_METADATA'
    error.permanent = true
    throw error
  }

  return { durationSeconds, width, height }
}

function selectAdaptiveRenditions(metadata) {
  const sourceShortEdge = Math.min(metadata.width, metadata.height)
  const selected = ADAPTIVE_RENDITIONS.filter((item) => item.shortEdge <= sourceShortEdge)
  return selected.length ? selected : [ADAPTIVE_RENDITIONS[0]]
}

function buildScaleFilter(shortEdge) {
  return `scale=w='if(gt(iw,ih),-2,min(${shortEdge},iw))':h='if(gt(iw,ih),min(${shortEdge},ih),-2)',format=yuv420p`
}

const LOW_RESOURCE_ENCODER_PROFILES = [
  { name: 'single-thread-veryfast', preset: 'veryfast', bitrateScale: 1 },
  { name: 'single-thread-superfast', preset: 'superfast', bitrateScale: 0.85 },
]

function buildAdaptiveEncodeArgs(localFilePath, mp4Path, rendition, profile) {
  const bitrateKbps = Math.max(300, Math.round(rendition.bitrateKbps * profile.bitrateScale))
  return [
    '-y', '-filter_threads', '1', '-filter_complex_threads', '1', '-i', localFilePath,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', buildScaleFilter(rendition.shortEdge), '-r', '30',
    '-c:v', 'libx264', '-profile:v', 'main', '-level:v', '4.0',
    '-preset', profile.preset, '-threads', '1',
    '-x264-params', 'threads=1:lookahead_threads=1',
    '-b:v', `${bitrateKbps}k`, '-maxrate', `${bitrateKbps}k`, '-bufsize', `${bitrateKbps * 2}k`,
    '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-ar', '48000',
    '-movflags', '+faststart', mp4Path,
  ]
}

function effectiveRenditionBitrate(rendition, profile) {
  return Math.max(300, Math.round(rendition.bitrateKbps * profile.bitrateScale))
}

function isEncoderResourceError(error) {
  return /error initializing output stream|error while opening encoder|cannot allocate memory|resource temporarily unavailable|pthread_create failed/i
    .test(String(error?.message || ''))
}

async function encodeRenditionWithFallback(ffmpegBinary, localFilePath, mp4Path, rendition, timeoutMs) {
  let lastError = null
  for (const profile of LOW_RESOURCE_ENCODER_PROFILES) {
    try {
      await runBinary(
        ffmpegBinary,
        buildAdaptiveEncodeArgs(localFilePath, mp4Path, rendition, profile),
        { timeoutMs },
      )
      return {
        ...profile,
        bitrateKbps: effectiveRenditionBitrate(rendition, profile),
      }
    } catch (error) {
      lastError = error
      if (!isEncoderResourceError(error)) throw error
      await fs.promises.rm(mp4Path, { force: true }).catch(() => undefined)
      console.warn(JSON.stringify({
        tag: 'loop_encoder_retry',
        rendition: rendition.name,
        profile: profile.name,
        errorCode: error?.code || 'ENCODER_RESOURCE_LIMIT',
      }))
    }
  }

  const error = lastError || new Error('Video encoder could not be started.')
  error.code = 'ENCODER_RESOURCE_LIMIT'
  throw error
}

async function writeMasterPlaylist(outputDirectory, renditions) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS']
  renditions.forEach((rendition) => {
    const bandwidth = (rendition.bitrateKbps + 96) * 1000
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${bandwidth},RESOLUTION=${rendition.width}x${rendition.height},CODECS="avc1.4d401f,mp4a.40.2"`,
      `${rendition.name}/index.m3u8`,
    )
  })
  const masterPath = path.join(outputDirectory, 'master.m3u8')
  await fs.promises.writeFile(masterPath, `${lines.join('\n')}\n`, 'utf8')
  return masterPath
}

function buildHlsPackageArgs(mp4Path) {
  return [
    '-y', '-i', mp4Path, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy',
    '-f', 'hls', '-hls_time', '4', '-hls_list_size', '0', '-hls_playlist_type', 'vod',
    '-hls_segment_type', 'mpegts', '-hls_flags', 'independent_segments',
    '-hls_segment_filename', 'segment-%05d.ts',
    'index.m3u8',
  ]
}

async function buildAdaptiveLoopVariants(localFilePath, options = {}) {
  const ffmpegBinary = resolveFfmpegBinary()
  const timeoutMs = Number(options.timeoutMs || env.loopWorkerJobTimeoutMs)
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : async () => {}

  if (!(await isBinaryAvailable(ffmpegBinary))) {
    const error = new Error('FFmpeg must be installed for Loop processing.')
    error.code = 'MEDIA_BINARIES_UNAVAILABLE'
    throw error
  }

  const metadata = await probeVideoMetadata(localFilePath)
  if (metadata.durationSeconds > env.loopMaxDurationSeconds) {
    const error = new Error(`Loop videos must be ${env.loopMaxDurationSeconds} seconds or shorter.`)
    error.code = 'LOOP_DURATION_EXCEEDED'
    error.permanent = true
    throw error
  }

  const inputDirectory = path.dirname(localFilePath)
  const inputBaseName = path.basename(localFilePath, path.extname(localFilePath))
  const outputDirectory = path.join(inputDirectory, `${inputBaseName}-adaptive`)
  await fs.promises.mkdir(outputDirectory, { recursive: true })
  const posterPath = path.join(outputDirectory, 'poster.webp')
  const selected = selectAdaptiveRenditions(metadata)
  const renditions = []

  await runBinary(
    ffmpegBinary,
    [
      '-y', '-ss', '0.1', '-i', localFilePath, '-frames:v', '1',
      '-vf', "scale=w='if(gt(iw,ih),-2,min(720,iw))':h='if(gt(iw,ih),min(720,ih),-2)'",
      '-c:v', 'libwebp', '-quality', '76', posterPath,
    ],
    { timeoutMs: Math.min(timeoutMs, 60_000) },
  )
  await onProgress(10)

  for (let index = 0; index < selected.length; index += 1) {
    const rendition = selected[index]
    const renditionDirectory = path.join(outputDirectory, rendition.name)
    const mp4Path = path.join(renditionDirectory, `${rendition.name}.mp4`)
    const manifestPath = path.join(renditionDirectory, 'index.m3u8')
    let encodedBitrateKbps = rendition.bitrateKbps
    await fs.promises.mkdir(renditionDirectory, { recursive: true })

    try {
      const encoderProfile = await encodeRenditionWithFallback(
        ffmpegBinary,
        localFilePath,
        mp4Path,
        rendition,
        timeoutMs,
      )
      encodedBitrateKbps = encoderProfile.bitrateKbps
    } catch (error) {
      await fs.promises.rm(renditionDirectory, { recursive: true, force: true }).catch(() => undefined)
      if (!isEncoderResourceError(error) || renditions.length === 0) throw error
      console.warn(JSON.stringify({
        tag: 'loop_rendition_downgrade',
        skippedRendition: rendition.name,
        availableRenditions: renditions.map((item) => item.name),
      }))
      break
    }

    await runBinary(
      ffmpegBinary,
      buildHlsPackageArgs(mp4Path),
      { timeoutMs: Math.min(timeoutMs, 120_000), cwd: renditionDirectory },
    )

    const outputMetadata = await probeVideoMetadata(mp4Path)
    renditions.push({
      ...rendition,
      bitrateKbps: encodedBitrateKbps,
      width: outputMetadata.width,
      height: outputMetadata.height,
      mp4Path,
      manifestPath,
      directory: renditionDirectory,
    })
    await onProgress(10 + Math.round(((index + 1) / selected.length) * 70))
  }

  const masterPath = await writeMasterPlaylist(outputDirectory, renditions)
  await onProgress(85)
  const fallback = renditions[renditions.length - 1]

  return {
    outputDirectory,
    masterPath,
    posterPath,
    fallbackMp4Path: fallback.mp4Path,
    durationSeconds: Math.round(metadata.durationSeconds),
    width: metadata.width,
    height: metadata.height,
    renditions,
  }
}

async function isBinaryAvailable(binary) {
  if (!binaryAvailabilityCache.has(binary)) {
    binaryAvailabilityCache.set(
      binary,
      runBinary(binary, ['-version'])
        .then(() => true)
        .catch((error) => {
          console.error(JSON.stringify({
            tag: 'media_binary_unavailable',
            binary: path.basename(binary),
            errorCode: error?.code || 'BINARY_START_FAILED',
            errorMessage: error?.message || 'Media binary could not be started.',
          }))
          return false
        }),
    )
  }

  return binaryAvailabilityCache.get(binary)
}

function resolveDurationFromProbeOutput(output = '') {
  const parsed = Number(String(output || '').trim())
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return Math.round(parsed)
}

async function probeDurationSeconds(inputPath) {
  try {
    const metadata = await probeVideoMetadata(inputPath)
    return resolveDurationFromProbeOutput(metadata.durationSeconds)
  } catch {
    return 0
  }
}

async function buildLoopVideoVariants(localFilePath, options = {}) {
  const { enableLoopVariants = true } = options
  const shouldTranscode = enableLoopVariants && env.loopTranscodeEnabled
  const shouldBuildHls = enableLoopVariants && env.loopHlsEnabled
  // Preserve the legacy synchronous path: bundled FFmpeg is reserved for the
  // asynchronous Loop worker so ordinary video uploads do not gain new CPU work.
  const ffmpegBinary = env.ffmpegPath || 'ffmpeg'
  const ffmpegAvailable = await isBinaryAvailable(ffmpegBinary)

  if (!ffmpegAvailable) {
    return {
      mediaPath: localFilePath,
      hlsManifestPath: '',
      posterPath: '',
      cleanupPaths: [],
      durationSeconds: 0,
      processed: false,
    }
  }

  const inputDirectory = path.dirname(localFilePath)
  const inputExtension = path.extname(localFilePath)
  const inputBaseName = path.basename(localFilePath, inputExtension)
  const normalizedMp4Path = path.join(inputDirectory, `${inputBaseName}-normalized.mp4`)
  const hlsManifestPath = path.join(inputDirectory, `${inputBaseName}-hls.m3u8`)
  const hlsSegmentPath = path.join(inputDirectory, `${inputBaseName}-hls.ts`)
  const posterPath = path.join(inputDirectory, `${inputBaseName}-poster.jpg`)
  const cleanupPaths = []

  if (shouldTranscode) {
    await runBinary(ffmpegBinary, [
      '-y',
      '-i',
      localFilePath,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      'libx264',
      '-profile:v',
      'main',
      '-level',
      '4.0',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-b:v',
      `${env.loopTranscodeVideoBitrateKbps}k`,
      '-maxrate',
      `${env.loopTranscodeVideoBitrateKbps}k`,
      '-bufsize',
      `${env.loopTranscodeVideoBitrateKbps * 2}k`,
      '-c:a',
      'aac',
      '-b:a',
      `${env.loopTranscodeAudioBitrateKbps}k`,
      '-movflags',
      '+faststart',
      normalizedMp4Path,
    ])
    cleanupPaths.push(normalizedMp4Path)
  }

  const outputMediaPath =
    shouldTranscode && fileExists(normalizedMp4Path)
      ? normalizedMp4Path
      : localFilePath

  if (shouldBuildHls) {
    await runBinary(ffmpegBinary, [
      '-y',
      '-i',
      outputMediaPath,
      '-c:v',
      'copy',
      '-c:a',
      'copy',
      '-f',
      'hls',
      '-hls_time',
      '4',
      '-hls_list_size',
      '0',
      '-hls_playlist_type',
      'vod',
      '-hls_flags',
      'independent_segments+single_file',
      '-hls_segment_filename',
      hlsSegmentPath,
      hlsManifestPath,
    ])

    if (fileExists(hlsManifestPath)) {
      cleanupPaths.push(hlsManifestPath)
    }
    if (fileExists(hlsSegmentPath)) {
      cleanupPaths.push(hlsSegmentPath)
    }
  }

  try {
    await runBinary(ffmpegBinary, [
      '-y',
      '-ss',
      '0.1',
      '-i',
      outputMediaPath,
      '-frames:v',
      '1',
      '-vf',
      "scale=w='min(720,iw)':h=-2",
      '-q:v',
      '4',
      posterPath,
    ])

    if (fileExists(posterPath)) {
      cleanupPaths.push(posterPath)
    }
  } catch {
    // Poster generation is an optimization and must not block video uploads.
  }

  const durationSeconds = await probeDurationSeconds(outputMediaPath)

  return {
    mediaPath: outputMediaPath,
    hlsManifestPath: fileExists(hlsManifestPath) ? hlsManifestPath : '',
    posterPath: fileExists(posterPath) ? posterPath : '',
    cleanupPaths,
    durationSeconds,
    processed:
      outputMediaPath !== localFilePath || fileExists(hlsManifestPath) || fileExists(posterPath),
  }
}

module.exports = {
  ADAPTIVE_RENDITIONS,
  LOW_RESOURCE_ENCODER_PROFILES,
  resolveFfmpegBinary,
  runBinary,
  probeVideoMetadata,
  selectAdaptiveRenditions,
  buildAdaptiveEncodeArgs,
  buildHlsPackageArgs,
  effectiveRenditionBitrate,
  isEncoderResourceError,
  buildAdaptiveLoopVariants,
  buildLoopVideoVariants,
}
