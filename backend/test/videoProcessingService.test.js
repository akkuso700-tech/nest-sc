const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { Post } = require('../src/models/Post')
const { VideoProcessingJob } = require('../src/models/VideoProcessingJob')
const { WorkerLease } = require('../src/models/WorkerLease')
const {
  selectAdaptiveRenditions,
  resolveFfmpegBinary,
  LOW_RESOURCE_ENCODER_PROFILES,
  buildAdaptiveEncodeArgs,
  effectiveRenditionBitrate,
  isEncoderResourceError,
} = require('../src/services/videoProcessingService')
const {
  assertPathInsideUploads,
  buildLocalMediaUrl,
  mapWithConcurrency,
} = require('../src/services/loopVideoPublishingService')
const { LOOP_JOB_PRIORITIES } = require('../src/services/videoProcessingQueueService')
const { env } = require('../src/config/env')

test('adaptive ladder does not upscale a 540p source', () => {
  const renditions = selectAdaptiveRenditions({ width: 540, height: 960 })
  assert.deepEqual(renditions.map((item) => item.name), ['360p', '540p'])
})

test('adaptive ladder creates all target renditions for a 720p vertical source', () => {
  const renditions = selectAdaptiveRenditions({ width: 720, height: 1280 })
  assert.deepEqual(renditions.map((item) => item.name), ['360p', '540p', '720p'])
})

test('small sources receive one safe rendition instead of an empty playlist', () => {
  const renditions = selectAdaptiveRenditions({ width: 240, height: 426 })
  assert.deepEqual(renditions.map((item) => item.name), ['360p'])
})

test('processing states remain backwards compatible and include async states', () => {
  const processingPath = Post.schema.path('media').schema.path('processing')
  assert.ok(processingPath.enumValues.includes('raw'))
  assert.ok(processingPath.enumValues.includes('hls-ready'))
  assert.ok(processingPath.enumValues.includes('queued'))
  assert.ok(processingPath.enumValues.includes('processing'))
  assert.ok(processingPath.enumValues.includes('ready'))
  assert.ok(processingPath.enumValues.includes('failed'))
})

test('MongoDB index limits adaptive processing to one job across API instances', () => {
  const workerSlotIndex = VideoProcessingJob.schema.indexes().find(
    ([fields]) => fields.workerSlot === 1,
  )
  assert.ok(workerSlotIndex)
  assert.equal(workerSlotIndex[1].unique, true)
  assert.deepEqual(workerSlotIndex[1].partialFilterExpression, { status: 'processing' })
})

test('worker source paths are restricted to the uploads directory', () => {
  const safePath = path.join(env.uploadsDir, 'posts', 'video.mp4')
  assert.equal(assertPathInsideUploads(safePath), path.resolve(safePath))
  assert.throws(
    () => assertPathInsideUploads(path.resolve(env.uploadsDir, '..', 'outside.mp4')),
    /outside the configured uploads directory/,
  )
})

test('local nested adaptive files receive URL-safe media paths', () => {
  const localPath = path.join(env.uploadsDir, 'posts', 'video-adaptive', '720p', 'index.m3u8')
  assert.equal(
    buildLocalMediaUrl(localPath),
    '/uploads/posts/video-adaptive/720p/index.m3u8',
  )
})

test('a packaged FFmpeg binary is available without server-global installation', () => {
  assert.match(resolveFfmpegBinary(), /ffmpeg(?:\.exe)?$/i)
})

test('failed encoder jobs can be recovered only a bounded number of times', () => {
  assert.equal(VideoProcessingJob.schema.path('recoveryCount').defaultValue, 0)
  assert.equal(VideoProcessingJob.schema.path('recoveryCount').options.min, 0)
})

test('adaptive encoder profiles are single-threaded and include a superfast retry', () => {
  assert.deepEqual(
    LOW_RESOURCE_ENCODER_PROFILES.map((profile) => profile.preset),
    ['veryfast', 'superfast'],
  )
  const args = buildAdaptiveEncodeArgs(
    'input.mp4',
    'output.mp4',
    { name: '720p', shortEdge: 720, bitrateKbps: 2400 },
    LOW_RESOURCE_ENCODER_PROFILES[0],
  )
  assert.ok(args.includes('-filter_threads'))
  assert.ok(args.includes('-filter_complex_threads'))
  assert.equal(args[args.indexOf('-threads') + 1], '1')
  assert.match(args[args.indexOf('-x264-params') + 1], /threads=1/)
})

test('encoder resource errors are eligible for low-resource fallback', () => {
  assert.equal(isEncoderResourceError(new Error('Error while opening encoder for output stream')), true)
  assert.equal(isEncoderResourceError(new Error('disk is full')), false)
})

test('fallback profile reports its reduced effective bitrate in HLS metadata', () => {
  assert.equal(
    effectiveRenditionBitrate(
      { bitrateKbps: 2400 },
      LOW_RESOURCE_ENCODER_PROFILES[1],
    ),
    2040,
  )
})

test('worker lease model provides a unique named lease with expiry', () => {
  assert.equal(WorkerLease.schema.path('_id').instance, 'String')
  assert.equal(WorkerLease.schema.path('expiresAt').instance, 'Date')
})

test('new Loop uploads have higher queue priority than backfill jobs', () => {
  assert.ok(LOOP_JOB_PRIORITIES.USER_UPLOAD > LOOP_JOB_PRIORITIES.BACKFILL)
  assert.equal(VideoProcessingJob.schema.path('priority').defaultValue, LOOP_JOB_PRIORITIES.USER_UPLOAD)
  const priorityIndex = VideoProcessingJob.schema.indexes().find(
    ([fields]) => fields.status === 1 && fields.priority === -1,
  )
  assert.ok(priorityIndex)
})

test('remote HLS asset mapper preserves order and bounds concurrency', async () => {
  let active = 0
  let peak = 0
  const results = await mapWithConcurrency([1, 2, 3, 4, 5], 3, async (value) => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    return value * 2
  })

  assert.deepEqual(results, [2, 4, 6, 8, 10])
  assert.equal(peak, 3)
})
