const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { Post } = require('../src/models/Post')
const { VideoProcessingJob } = require('../src/models/VideoProcessingJob')
const {
  selectAdaptiveRenditions,
  resolveFfmpegBinary,
} = require('../src/services/videoProcessingService')
const {
  assertPathInsideUploads,
  buildLocalMediaUrl,
} = require('../src/services/loopVideoPublishingService')
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
