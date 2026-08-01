const test = require('node:test')
const assert = require('node:assert/strict')
const { _test } = require('../src/services/directVideoUploadService')

test('direct Loop uploads accept supported videos up to 100 MB', () => {
  const input = _test.validateVideoUploadInput({
    fileName: 'loop.mp4',
    mimeType: 'video/mp4',
    bytes: 100 * 1024 * 1024,
  })
  assert.equal(input.bytes, 100 * 1024 * 1024)
  assert.equal(input.mimeType, 'video/mp4')
})

test('direct Loop uploads reject oversized or unsupported files', () => {
  assert.throws(() => _test.validateVideoUploadInput({
    fileName: 'loop.mp4', mimeType: 'video/mp4', bytes: 100 * 1024 * 1024 + 1,
  }))
  assert.throws(() => _test.validateVideoUploadInput({
    fileName: 'loop.exe', mimeType: 'application/octet-stream', bytes: 10,
  }))
})

test('multipart completion requires ordered, complete ETag metadata', () => {
  const parts = _test.normalizeCompletedParts([
    { partNumber: 2, etag: '"etag-2"' },
    { partNumber: 1, etag: '"etag-1"' },
  ], 2)
  assert.deepEqual(parts.map((part) => part.PartNumber), [1, 2])
  assert.throws(() => _test.normalizeCompletedParts([{ partNumber: 1, etag: 'x' }], 2))
})
