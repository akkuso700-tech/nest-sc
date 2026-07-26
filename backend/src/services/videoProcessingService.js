const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { env } = require('../config/env')

const binaryAvailabilityCache = new Map()

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

function runBinary(binary, args = []) {
  return new Promise((resolve, reject) => {
    const process = spawn(binary, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    process.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    process.on('error', (error) => reject(error))
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(stderr || stdout || `Process exited with code ${code}`))
    })
  })
}

async function isBinaryAvailable(binary) {
  if (!binaryAvailabilityCache.has(binary)) {
    binaryAvailabilityCache.set(
      binary,
      runBinary(binary, ['-version'])
        .then(() => true)
        .catch(() => false),
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
  const ffprobeBinary = env.ffprobePath || 'ffprobe'

  try {
    const { stdout } = await runBinary(ffprobeBinary, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ])
    return resolveDurationFromProbeOutput(stdout)
  } catch {
    return 0
  }
}

async function buildLoopVideoVariants(localFilePath, options = {}) {
  const { enableLoopVariants = true } = options
  const shouldTranscode = enableLoopVariants && env.loopTranscodeEnabled
  const shouldBuildHls = enableLoopVariants && env.loopHlsEnabled
  const ffmpegBinary = env.ffmpegPath || 'ffmpeg'
  const ffprobeBinary = env.ffprobePath || 'ffprobe'
  const ffmpegAvailable = await isBinaryAvailable(ffmpegBinary)
  const ffprobeAvailable = await isBinaryAvailable(ffprobeBinary)

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

  const durationSeconds = ffprobeAvailable ? await probeDurationSeconds(outputMediaPath) : 0

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
  buildLoopVideoVariants,
}
