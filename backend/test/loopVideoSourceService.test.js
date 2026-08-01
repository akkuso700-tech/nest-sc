const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { env } = require('../src/config/env')
const { VideoProcessingJob } = require('../src/models/VideoProcessingJob')
const {
  assertTrustedLoopSourceUrl,
  downloadRemoteLoopSource,
} = require('../src/services/loopVideoSourceService')

test('video jobs accept a trusted remote source without a local path', async () => {
  const job = new VideoProcessingJob({
    post: '507f1f77bcf86cd799439011',
    sourceUrl: 'https://upload-demo.nest-sc.com/media/posts/example.mp4',
  })
  await job.validate()
  assert.equal(job.sourcePath, '')
  assert.equal(job.sourceUrl, 'https://upload-demo.nest-sc.com/media/posts/example.mp4')
})

test('backfill accepts only configured media origins and /media paths', () => {
  const allowedOrigins = new Set(['https://upload-demo.nest-sc.com'])

  const parsed = assertTrustedLoopSourceUrl(
    'https://upload-demo.nest-sc.com/media/posts/example.mp4',
    allowedOrigins,
  )
  assert.equal(parsed.pathname, '/media/posts/example.mp4')

  assert.throws(
    () => assertTrustedLoopSourceUrl('https://example.com/media/posts/example.mp4', allowedOrigins),
    { code: 'UNTRUSTED_BACKFILL_SOURCE' },
  )
  assert.throws(
    () => assertTrustedLoopSourceUrl('https://upload-demo.nest-sc.com/private/example.mp4', allowedOrigins),
    { code: 'UNTRUSTED_BACKFILL_SOURCE' },
  )
})

test('backfill downloads a trusted video into the uploads directory', async () => {
  await fs.promises.mkdir(env.uploadsDir, { recursive: true })
  const destinationRoot = await fs.promises.mkdtemp(path.join(env.uploadsDir, 'backfill-test-'))
  const payload = Buffer.from('synthetic-video-payload')

  try {
    const downloadedPath = await downloadRemoteLoopSource(
      'https://upload-demo.nest-sc.com/media/posts/example.mp4',
      {
        allowedOrigins: new Set(['https://upload-demo.nest-sc.com']),
        destinationRoot,
        maxBytes: 1024,
        timeoutMs: 1000,
        jobId: 'test-job',
        fetchImpl: async () => new Response(payload, {
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': String(payload.length),
          },
        }),
      },
    )

    assert.equal(await fs.promises.readFile(downloadedPath, 'utf8'), payload.toString())
    assert.equal(path.extname(downloadedPath), '.mp4')
  } finally {
    await fs.promises.rm(destinationRoot, { recursive: true, force: true })
  }
})

test('backfill rejects sources larger than the configured limit', async () => {
  await assert.rejects(
    downloadRemoteLoopSource(
      'https://upload-demo.nest-sc.com/media/posts/example.mp4',
      {
        allowedOrigins: new Set(['https://upload-demo.nest-sc.com']),
        maxBytes: 4,
        timeoutMs: 1000,
        fetchImpl: async () => new Response(Buffer.from('too-large'), {
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '9',
          },
        }),
      },
    ),
    { code: 'BACKFILL_SOURCE_TOO_LARGE' },
  )
})
