const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const {
  hashPassword,
  verifyPassword,
  isBcryptHash,
  isScryptHash,
} = require('../src/services/passwordService')

test('hashes password using scrypt:v1 and verifies successfully', async () => {
  const plain = 'SecretPassword987!'
  const hash = await hashPassword(plain)

  assert.ok(isScryptHash(hash), 'Must be identified as scrypt hash')
  assert.equal(isBcryptHash(hash), false, 'Must not be identified as bcrypt')

  const validResult = await verifyPassword(plain, hash)
  assert.equal(validResult.valid, true)
  assert.equal(validResult.needsRehash, false)

  const invalidResult = await verifyPassword('WrongPassword', hash)
  assert.equal(invalidResult.valid, false)
  assert.equal(invalidResult.needsRehash, false)
})

test('verifies legacy bcrypt hashes with needsRehash flag set to true', async () => {
  const plain = 'LegacyPassword123!'
  const legacyHash = await bcrypt.hash(plain, 10)

  assert.ok(isBcryptHash(legacyHash), 'Must be identified as bcrypt hash')
  assert.equal(isScryptHash(legacyHash), false, 'Must not be identified as scrypt')

  const validResult = await verifyPassword(plain, legacyHash)
  assert.equal(validResult.valid, true)
  assert.equal(validResult.needsRehash, true, 'Legacy hash must flag needsRehash')

  const invalidResult = await verifyPassword('WrongPassword', legacyHash)
  assert.equal(invalidResult.valid, false)
  assert.equal(invalidResult.needsRehash, false)
})

test('handles empty and malformed hashes safely', async () => {
  assert.deepEqual(await verifyPassword('', ''), { valid: false, needsRehash: false })
  assert.deepEqual(await verifyPassword('test', null), { valid: false, needsRehash: false })
  assert.deepEqual(await verifyPassword('test', 'garbage:format:short'), { valid: false, needsRehash: false })
})
