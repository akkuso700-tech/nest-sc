const test = require('node:test')
const assert = require('node:assert/strict')
const {
  DEFAULT_MEDIA_FILE_BYTES,
  LOOP_VIDEO_FILE_BYTES,
  resolvePostMediaFileSizeLimit,
} = require('../src/middlewares/uploadMedia')

test('loop videos allow files up to 100 MB', () => {
  assert.equal(
    resolvePostMediaFileSizeLimit('loop', 'video/mp4'),
    LOOP_VIDEO_FILE_BYTES,
  )
  assert.equal(LOOP_VIDEO_FILE_BYTES, 100 * 1024 * 1024)
})

test('non-loop media keeps the existing 25 MB backend limit', () => {
  assert.equal(
    resolvePostMediaFileSizeLimit('post', 'video/mp4'),
    DEFAULT_MEDIA_FILE_BYTES,
  )
  assert.equal(
    resolvePostMediaFileSizeLimit('loop', 'image/webp'),
    DEFAULT_MEDIA_FILE_BYTES,
  )
  assert.equal(DEFAULT_MEDIA_FILE_BYTES, 25 * 1024 * 1024)
})
