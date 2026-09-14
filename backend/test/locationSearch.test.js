const test = require('node:test')
const assert = require('node:assert/strict')
const { searchLocations, normalizeText } = require('../src/services/locationSearchService')

test('normalizeText handles Turkish characters and casing correctly', () => {
  assert.equal(normalizeText('İstanbul'), 'istanbul')
  assert.equal(normalizeText('Isparta'), 'isparta')
  assert.equal(normalizeText('Eskişehir'), 'eskisehir')
  assert.equal(normalizeText('Diyarbakır'), 'diyarbakir')
  assert.equal(normalizeText('Münih'), 'munih')
  assert.equal(normalizeText('Çanakkale'), 'canakkale')
  assert.equal(normalizeText('Gümüşhane'), 'gumushane')
})

test('searchLocations finds Turkish provinces with Turkish characters and ASCII inputs', () => {
  const resultTr = searchLocations('istanbul')
  assert.ok(resultTr.length > 0)
  assert.equal(resultTr[0].city, 'İstanbul')
  assert.equal(resultTr[0].country, 'Türkiye')
  assert.equal(resultTr[0].flag, '🇹🇷')

  const resultAscii = searchLocations('eskisehir')
  assert.ok(resultAscii.some((item) => item.city === 'Eskişehir'))

  const resultIsp = searchLocations('ısp')
  assert.ok(resultIsp.length > 0)
  assert.equal(resultIsp[0].city, 'Isparta')
})

test('searchLocations finds world metropolises and countries', () => {
  const berlin = searchLocations('berlin')
  assert.ok(berlin.some((item) => item.city === 'Berlin' && item.country === 'Almanya'))

  const tokyo = searchLocations('tokyo')
  assert.ok(tokyo.some((item) => item.city === 'Tokyo' && item.country === 'Japonya'))

  const newYork = searchLocations('new york')
  assert.ok(newYork.some((item) => item.city === 'New York'))
})

test('searchLocations resolves aliases (e.g. munih/munich, londra/london)', () => {
  const munichAlias = searchLocations('munich')
  assert.ok(munichAlias.some((item) => item.city === 'Münih'))

  const londonAlias = searchLocations('london')
  assert.ok(londonAlias.some((item) => item.city === 'Londra'))

  const nycAlias = searchLocations('nyc')
  assert.ok(nycAlias.some((item) => item.city === 'New York'))
})

test('searchLocations supports multi-language outputs (en, de, es, tr)', () => {
  const resultEn = searchLocations('berlin', { lang: 'en' })
  assert.ok(resultEn.length > 0)
  assert.equal(resultEn[0].country, 'Germany')

  const resultDe = searchLocations('berlin', { lang: 'de' })
  assert.ok(resultDe.length > 0)
  assert.equal(resultDe[0].country, 'Deutschland')

  const resultEs = searchLocations('berlin', { lang: 'es' })
  assert.ok(resultEs.length > 0)
  assert.equal(resultEs[0].country, 'Alemania')

  const resultTr = searchLocations('berlin', { lang: 'tr' })
  assert.ok(resultTr.length > 0)
  assert.equal(resultTr[0].country, 'Almanya')
})
