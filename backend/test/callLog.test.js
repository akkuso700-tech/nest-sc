const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const { CallLog } = require('../src/models/CallLog')
const { callsRouter } = require('../src/routes/calls.routes')

test('CallLog model has required schema properties and default values', () => {
  const callerId = new mongoose.Types.ObjectId()
  const recipientId = new mongoose.Types.ObjectId()
  const call = new CallLog({
    callId: 'test-call-123',
    caller: callerId,
    recipient: recipientId,
    callType: 'video',
    status: 'completed',
    durationSec: 320,
    recordingUrl: '/uploads/calls/test-call-123.webm',
    fileSizeBytes: 4500000,
  })

  assert.equal(call.callId, 'test-call-123')
  assert.equal(call.caller.toString(), callerId.toString())
  assert.equal(call.recipient.toString(), recipientId.toString())
  assert.equal(call.callType, 'video')
  assert.equal(call.status, 'completed')
  assert.equal(call.durationSec, 320)
  assert.equal(call.recordingUrl, '/uploads/calls/test-call-123.webm')
  assert.equal(call.fileSizeBytes, 4500000)
})

test('callsRouter registers recording upload endpoint', () => {
  const routes = callsRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }))

  const recordingRoute = routes.find((r) => r.path === '/:callId/recording')
  assert.ok(recordingRoute, 'Recording route should be registered')
  assert.ok(recordingRoute.methods.includes('post'), 'Route should handle POST')
})
