export const supportedLanguages = ['en', 'tr', 'de', 'es']
export const fallbackLanguage = 'en'

export function getPreferredLanguage(locale) {
  if (!locale) {
    return fallbackLanguage
  }

  const primaryLanguage = locale.toLowerCase().split('-')[0]

  return supportedLanguages.includes(primaryLanguage)
    ? primaryLanguage
    : fallbackLanguage
}

export function isSupportedLanguage(lang) {
  return supportedLanguages.includes(lang)
}
