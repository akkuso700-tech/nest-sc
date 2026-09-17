const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const { Notification } = require('../src/models/Notification')

test('Notification schema supports shadow_message type and targetChatKey property', () => {
  const schemaObj = Notification.schema.obj
  assert.ok(schemaObj.targetChatKey, 'Notification schema must declare targetChatKey')
  assert.equal(schemaObj.targetChatKey.type, String)
  assert.equal(schemaObj.targetChatKey.default, null)

  const typeEnum = schemaObj.type.enum
  assert.ok(typeEnum.includes('shadow_message'), 'Notification type enum must include shadow_message')

  const entityKindEnum = schemaObj.entityKind.enum
  assert.ok(entityKindEnum.includes('shadow_message'), 'Notification entityKind enum must include shadow_message')
})

test('Notification instance correctly holds targetChatKey and shadow_message payload', () => {
  const fakeUserId = new mongoose.Types.ObjectId()
  const notif = new Notification({
    user: fakeUserId,
    actor: null,
    type: 'shadow_message',
    entityKind: 'shadow_message',
    targetChatKey: 'anon_direct_fake123_456',
    title: 'Gölge Modu',
    body: 'Gölge Gezgin: Selam, nasılsın?',
  })

  assert.equal(notif.type, 'shadow_message')
  assert.equal(notif.entityKind, 'shadow_message')
  assert.equal(notif.targetChatKey, 'anon_direct_fake123_456')
  assert.equal(notif.title, 'Gölge Modu')
  assert.equal(notif.body, 'Gölge Gezgin: Selam, nasılsın?')
  assert.equal(notif.unreadCount, 1)

  notif.unreadCount = 5
  assert.equal(notif.unreadCount, 5)
})