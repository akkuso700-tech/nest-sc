const test = require('node:test')
const assert = require('node:assert/strict')
const { lookupIpLocation, isPrivateIp } = require('../src/services/locationService')

test('isPrivateIp correctly identifies local and private network addresses', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true)
  assert.equal(isPrivateIp('::1'), true)
  assert.equal(isPrivateIp('localhost'), true)
  assert.equal(isPrivateIp('192.168.1.10'), true)
  assert.equal(isPrivateIp('10.0.0.5'), true)
  assert.equal(isPrivateIp('172.20.0.1'), true)
  assert.equal(isPrivateIp('159.146.79.100'), false)
  assert.equal(isPrivateIp('178.233.189.151'), false)
})

test('lookupIpLocation resolves private IPs safely without throwing', () => {
  const result = lookupIpLocation('127.0.0.1')
  assert.equal(result.isLocal, true)
  assert.equal(result.city, 'Yerel Ağ')
  assert.equal(result.country, 'Localhost')
})

test('lookupIpLocation resolves public Turkish IP to city and country', () => {
  const result = lookupIpLocation('159.146.79.100')
  assert.equal(result.isLocal, false)
  assert.equal(result.city, 'İstanbul')
  assert.equal(result.countryCode, 'TR')
  assert.equal(result.country, 'Türkiye')
})

test('lookupIpLocation resolves Ankara IP correctly', () => {
  const result = lookupIpLocation('178.233.189.151')
  assert.equal(result.isLocal, false)
  assert.equal(result.city, 'Ankara')
  assert.equal(result.countryCode, 'TR')
  assert.equal(result.country, 'Türkiye')
})
