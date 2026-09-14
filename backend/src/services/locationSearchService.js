const locations = require('../data/locationsData.json')

const SUPPORTED_LANGS = ['tr', 'en', 'de', 'es']

const DISPLAY_NAMES_CACHE = {}
SUPPORTED_LANGS.forEach((lang) => {
  try {
    DISPLAY_NAMES_CACHE[lang] = new Intl.DisplayNames([lang], { type: 'region' })
  } catch {
    DISPLAY_NAMES_CACHE[lang] = null
  }
})

const TURKISH_CHAR_MAP = {
  'I': 'i',
  'İ': 'i',
  'ı': 'i',
  'i': 'i',
  'Ş': 's',
  'ş': 's',
  'Ğ': 'g',
  'ğ': 'g',
  'Ü': 'u',
  'ü': 'u',
  'Ö': 'o',
  'ö': 'o',
  'Ç': 'c',
  'ç': 'c',
}

const TURKISH_CHAR_REGEX = /[IİıiŞşĞğÜüÖöÇç]/g

function normalizeText(value = '') {
  const safe = `${value ?? ''}`
  const mapped = safe.replace(TURKISH_CHAR_REGEX, (char) => TURKISH_CHAR_MAP[char] || char)
  return mapped
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

function getCountryByLang(item, lang = 'tr') {
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : 'tr'

  if (item.code && DISPLAY_NAMES_CACHE[safeLang]) {
    try {
      const localized = DISPLAY_NAMES_CACHE[safeLang].of(item.code)
      if (localized && !/\bUnknown\b/i.test(localized)) {
        return localized
      }
    } catch {
      // fallback
    }
  }

  if (safeLang === 'en' && item.countryEn) {
    return item.countryEn
  }

  return item.country || ''
}

function getDisplayLabel(item, lang = 'tr') {
  const country = getCountryByLang(item, lang)
  if (!item.city) {
    return country
  }
  return `${item.city}, ${country}`
}

function calculateScore(item, normalizedQuery, queryTokens, lang = 'tr') {
  const normalizedCity = normalizeText(item.rawCity || item.city)
  const normalizedCountryTr = normalizeText(item.country)
  const normalizedCountryEn = normalizeText(item.countryEn)
  const localizedCountry = normalizeText(getCountryByLang(item, lang))
  const normalizedLabel = normalizeText(getDisplayLabel(item, lang))

  // 1. Şehir ismi sorguyla tam başlıyorsa (en yüksek öncelik)
  if (normalizedCity && normalizedCity.startsWith(normalizedQuery)) {
    return 0
  }

  // 2. Aliaslardan biri sorguyla tam başlıyorsa (örn: munich, london, nyc, münchen, wien)
  if (item.aliases && item.aliases.some((alias) => normalizeText(alias).startsWith(normalizedQuery))) {
    return 1
  }

  // 3. Etiketin kendisi sorguyla başlıyorsa
  if (normalizedLabel.startsWith(normalizedQuery)) {
    return 2
  }

  // 4. Şehir içinde geçiyorsa
  if (normalizedCity && normalizedCity.includes(normalizedQuery)) {
    return 3
  }

  // 5. Ülke ismi sorguyla başlıyorsa (seçili dil, Türkçe veya İngilizce)
  if (
    localizedCountry.startsWith(normalizedQuery) ||
    normalizedCountryTr.startsWith(normalizedQuery) ||
    normalizedCountryEn.startsWith(normalizedQuery)
  ) {
    return 4
  }

  // 6. Tüm sorgu token'ları etikette veya aliaslarda geçiyorsa
  const allTokensMatch = queryTokens.every((token) => {
    return (
      normalizedLabel.includes(token) ||
      localizedCountry.includes(token) ||
      normalizedCountryEn.includes(token) ||
      (item.aliases && item.aliases.some((alias) => normalizeText(alias).includes(token)))
    )
  })

  if (allTokensMatch) {
    return 5
  }

  return 999
}

function searchLocations(query = '', { limit = 8, lang = 'tr' } = {}) {
  const cleanQuery = `${query ?? ''}`.trim()
  const normalizedQuery = normalizeText(cleanQuery)

  if (normalizedQuery.length < 2) {
    return []
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : 'tr'

  const matches = []

  for (let i = 0; i < locations.length; i += 1) {
    const item = locations[i]
    const score = calculateScore(item, normalizedQuery, queryTokens, safeLang)

    if (score < 999) {
      matches.push({
        item,
        score,
      })
    }
  }

  matches.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score
    }
    const lenA = (a.item.city || a.item.country).length
    const lenB = (b.item.city || b.item.country).length
    return lenA - lenB
  })

  return matches.slice(0, limit).map(({ item }) => {
    const country = getCountryByLang(item, safeLang)
    return {
      city: item.city || '',
      country,
      label: getDisplayLabel(item, safeLang),
      kind: item.kind,
      flag: item.flag || '📍',
      state: item.state || '',
      code: item.code || '',
    }
  })
}

module.exports = {
  SUPPORTED_LANGS,
  normalizeText,
  searchLocations,
  getCountryByLang,
}
