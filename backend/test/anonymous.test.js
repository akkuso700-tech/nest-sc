const test = require('node:test')
const assert = require('node:assert/strict')
const {
  generateRandomAlias,
  getAnonymousId,
  serializeAnonymousProfile,
} = require('../src/services/anonymousService')
const { anonymousRouter } = require('../src/routes/anonymous.routes')

test('generateRandomAlias produces expected format', () => {
  const alias = generateRandomAlias()
  assert.match(alias, /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+#\d{3}$/)
})

test('getAnonymousId produces consistent 12-char deterministic hash masking Mongo id', () => {
  const fakeId = '507f1f77bcf86cd799439011'
  const anonId1 = getAnonymousId(fakeId)
  const anonId2 = getAnonymousId(fakeId)
  assert.equal(anonId1, anonId2)
  assert.equal(anonId1.length, 12)
  assert.notEqual(anonId1, fakeId)
})

test('serializeAnonymousProfile excludes sensitive user attributes and includes blockedAnonymousIds', () => {
  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    username: 'real_username_secret',
    email: 'secret@domain.com',
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    anonymousProfile: {
      alias: 'GeceKuşu#123',
      avatarKey: 'avatar-3',
      gender: 'male',
      ageRange: '25-34',
      status: 'Buradayım',
      isOnlineInLounge: true,
      blockedAnonymousIds: ['blocked_id_1'],
      lastActiveAt: new Date(),
    },
  }

  const serialized = serializeAnonymousProfile(mockUser)
  assert.equal(serialized.alias, 'GeceKuşu#123')
  assert.equal(serialized.avatarKey, 'avatar-3')
  assert.equal(serialized.gender, 'male')
  assert.equal(serialized.ageRange, '25-34')
  assert.equal(serialized.status, 'Buradayım')
  assert.equal(serialized.isOnlineInLounge, true)
  assert.deepEqual(serialized.blockedAnonymousIds, ['blocked_id_1'])
  // Ensure sensitive data is completely omitted
  assert.equal(serialized.username, undefined)
  assert.equal(serialized.email, undefined)
  assert.equal(serialized.firstName, undefined)
  assert.equal(serialized.lastName, undefined)
})

test('anonymousRouter is a valid express router and has delete and block routes', () => {
  assert.equal(typeof anonymousRouter, 'function')
  const routes = anonymousRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }))

  const hasDeleteRoom = routes.some(
    (r) => r.path === '/rooms/:id' && r.methods.includes('delete'),
  )
  const hasDeleteMessage = routes.some(
    (r) => r.path === '/messages/:id' && r.methods.includes('delete'),
  )
  const hasBlock = routes.some(
    (r) => r.path === '/block' && r.methods.includes('post'),
  )
  assert.ok(hasDeleteRoom, 'Should have DELETE /rooms/:id')
  assert.ok(hasDeleteMessage, 'Should have DELETE /messages/:id')
  assert.ok(hasBlock, 'Should have POST /block')
})
