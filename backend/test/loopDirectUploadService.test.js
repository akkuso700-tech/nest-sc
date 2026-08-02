const test = require('node:test')
const assert = require('node:assert/strict')
const {
  issueLoopUploadTicket,
  publicSourceUrl,
  verifyLoopUploadSubmission,
  verifyLoopUploadTicket,
} = require('../src/services/loopDirectUploadService')

const secret = 'test-direct-upload-secret-that-is-long-enough'
const enabledOptions = {
  enabled: true,
  secret,
  endpoint: 'https://upload.nest-sc.com/upload.php',
  publicBaseUrl: 'https://upload.nest-sc.com',
  nowMs: 1_700_000_000_000,
  ttlSeconds: 600,
}

test('issues a user-bound direct Loop upload ticket', () => {
  const issued = issueLoopUploadTicket({
    userId: 'user-123',
    fileName: 'clip.mov',
    mimeType: 'video/quicktime',
    bytes: 12_345,
  }, enabledOptions)

  const payload = verifyLoopUploadTicket(issued.ticket, enabledOptions)
  assert.equal(payload.userId, 'user-123')
  assert.equal(payload.extension, '.mov')
  assert.equal(payload.bytes, 12_345)
  assert.equal(
    publicSourceUrl(payload, enabledOptions.publicBaseUrl),
    `https://upload.nest-sc.com/media/ingest/${payload.uploadId}.mov`,
  )
})

test('rejects a tampered direct upload ticket', () => {
  const issued = issueLoopUploadTicket({
    userId: 'user-123',
    fileName: 'clip.mp4',
    mimeType: 'video/mp4',
    bytes: 2_048,
  }, enabledOptions)

  assert.throws(
    () => verifyLoopUploadTicket(`${issued.ticket}x`, enabledOptions),
    /Invalid Loop upload ticket/,
  )
})

test('rejects an upload submission from another user', () => {
  const issued = issueLoopUploadTicket({
    userId: 'user-123',
    fileName: 'clip.mp4',
    mimeType: 'video/mp4',
    bytes: 2_048,
  }, enabledOptions)
  const sourceUrl = publicSourceUrl(issued.payload, enabledOptions.publicBaseUrl)

  assert.throws(
    () => verifyLoopUploadSubmission({ ticket: issued.ticket, sourceUrl }, 'user-456', enabledOptions),
    /belongs to another user/,
  )
})

test('rejects an expired direct upload ticket', () => {
  const issued = issueLoopUploadTicket({
    userId: 'user-123',
    fileName: 'clip.mp4',
    mimeType: 'video/mp4',
    bytes: 2_048,
  }, enabledOptions)

  assert.throws(
    () => verifyLoopUploadTicket(issued.ticket, {
      ...enabledOptions,
      nowMs: enabledOptions.nowMs + 601_000,
    }),
    /expired or invalid/,
  )
})
