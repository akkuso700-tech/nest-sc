const TURKISH_CHAR_MAP = {
  I: 'i',
  '\u0130': 'i', // İ
  '\u0131': 'i', // ı
  '\u015E': 's', // Ş
  '\u015F': 's', // ş
  '\u011E': 'g', // Ğ
  '\u011F': 'g', // ğ
  '\u00DC': 'u', // Ü
  '\u00FC': 'u', // ü
  '\u00D6': 'o', // Ö
  '\u00F6': 'o', // ö
  '\u00C7': 'c', // Ç
  '\u00E7': 'c', // ç
}

const TURKISH_CHAR_REGEX = /[I\u0130\u0131\u015E\u015F\u011E\u011F\u00DC\u00FC\u00D6\u00F6\u00C7\u00E7]/g

export function normalizeSearchText(value = '', { trim = true } = {}) {
  const safeValue = `${value ?? ''}`
  const mappedValue = safeValue.replace(
    TURKISH_CHAR_REGEX,
    (character) => TURKISH_CHAR_MAP[character] || character,
  )
  const loweredValue = mappedValue.toLowerCase()

  return trim ? loweredValue.trim() : loweredValue
}

export function normalizeSearchTokens(value = '') {
  return normalizeSearchText(value).split(/[\s,]+/).filter(Boolean)
}
