const fs = require('fs')
const path = require('path')
const { env } = require('../src/config/env')
const {
  resolveFfmpegBinary,
  runBinary,
  buildAdaptiveLoopVariants,
} = require('../src/services/videoProcessingService')
const { downloadRemoteLoopSource } = require('../src/services/loopVideoSourceService')

async function main() {
  await fs.promises.mkdir(env.uploadsDir, { recursive: true })
  const workingDirectory = await fs.promises.mkdtemp(
    path.join(env.uploadsDir, 'verify-loop-backfill-'),
  )
  const syntheticSource = path.join(workingDirectory, 'synthetic-source.mp4')

  try {
    await runBinary(resolveFfmpegBinary(), [
      '-y',
      '-f', 'lavfi',
      '-i', 'color=c=blue:s=720x1280:r=30:d=2',
      '-f', 'lavfi',
      '-i', 'sine=frequency=880:sample_rate=48000:duration=2',
      '-shortest',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      syntheticSource,
    ], { timeoutMs: 60_000 })

    const sourceBuffer = await fs.promises.readFile(syntheticSource)
    const downloadedSource = await downloadRemoteLoopSource(
      'https://upload-demo.nest-sc.com/media/posts/synthetic-source.mp4',
      {
        allowedOrigins: new Set(['https://upload-demo.nest-sc.com']),
        destinationRoot: workingDirectory,
        maxBytes: 10 * 1024 * 1024,
        timeoutMs: 10_000,
        jobId: 'integration-check',
        fetchImpl: async () => new Response(sourceBuffer, {
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': String(sourceBuffer.length),
          },
        }),
      },
    )

    const result = await buildAdaptiveLoopVariants(downloadedSource, {
      timeoutMs: 120_000,
    })
    const master = await fs.promises.readFile(result.masterPath, 'utf8')
    const renditionNames = result.renditions.map((item) => item.name)

    if (!master.includes('#EXTM3U') || !master.includes('#EXT-X-STREAM-INF')) {
      throw new Error('Adaptive HLS master manifest was not generated.')
    }
    if (!renditionNames.includes('360p') || !renditionNames.includes('540p') || !renditionNames.includes('720p')) {
      throw new Error(`Unexpected adaptive ladder: ${renditionNames.join(', ')}`)
    }
    await fs.promises.access(result.fallbackMp4Path, fs.constants.R_OK)
    await fs.promises.access(result.posterPath, fs.constants.R_OK)

    console.log(JSON.stringify({
      ok: true,
      renditions: renditionNames,
      master: path.basename(result.masterPath),
      fallback: path.basename(result.fallbackMp4Path),
      poster: path.basename(result.posterPath),
    }))
  } finally {
    await fs.promises.rm(workingDirectory, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
