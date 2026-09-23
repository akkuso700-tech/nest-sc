/**
 * Language detection utility for post contents.
 * Lightweight, client-side, zero-latency detection for common languages.
 */

const TR_DISTINCTIVE_CHARS = /[çğıöşüÇĞİÖŞÜ]/g
const DE_DISTINCTIVE_CHARS = /[äßÄ]/g
const ES_DISTINCTIVE_CHARS = /[ñÑáíóúÁÍÓÚ¡¿]/g

const TR_WORDS = new Set([
  've', 'bir', 'bu', 'da', 'de', 'için', 'ile', 'çok', 'daha', 'gibi',
  'kadar', 'ama', 'fakat', 'ancak', 'ben', 'sen', 'o', 'biz', 'siz',
  'onlar', 'var', 'yok', 'olan', 'olarak', 'en', 'mi', 'mu', 'mü', 'mı',
  'ne', 'nasıl', 'neden', 'diye', 'her', 'şey', 'bunu', 'buna', 'burada',
  'böyle', 'şimdi', 'sonra', 'önce', 'tüm', 'ise', 'ya', 'yani', 'iyi',
  'güzel', 'merhaba', 'selam', 'harika', 'bugün', 'yarın', 'akşam', 'sabah',
  'günaydın', 'yeni', 'proje', 'zaman', 'gönderi', 'paylaşım', 'yorum',
  'arkadaşlar', 'oldu', 'olur', 'olacak', 'yoksa', 'zaten', 'bence', 'sizce',
  'bize', 'size', 'bana', 'sana', 'onlara', 'onun', 'benim', 'senin', 'bizim',
  'sizin', 'şurada', 'buraya', 'oraya', 'bütün', 'hiç', 'hep', 'birlikte',
])

const EN_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it',
  'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come',
  'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
  'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
  'any', 'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were',
  'hello', 'welcome', 'check', 'out', 'today', 'tomorrow', 'amazing', 'great',
])

const DE_WORDS = new Set([
  'der', 'die', 'das', 'und', 'in', 'zu', 'den', 'nicht', 'von', 'sie',
  'ist', 'des', 'sich', 'mit', 'dem', 'dass', 'er', 'es', 'ein', 'ich',
  'auf', 'so', 'eine', 'auch', 'als', 'an', 'nach', 'wie', 'im', 'für',
  'man', 'aber', 'aus', 'durch', 'wenn', 'nur', 'war', 'noch', 'werden',
  'guten', 'tag', 'morgen', 'hallo', 'heute', 'schön',
])

const ES_WORDS = new Set([
  'el', 'la', 'de', 'que', 'y', 'en', 'un', 'se', 'no', 'haber',
  'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo',
  'todo', 'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir',
  'otro', 'ese', 'si', 'me', 'ya', 'ver', 'porque', 'dar', 'cuando',
  'hola', 'buenos', 'días', 'gracias',
])

/**
 * Detects the dominant language of a text snippet.
 * @param {string} text
 * @returns {'tr' | 'en' | 'de' | 'es' | null}
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return null

  // Strip URLs, hashtags, mentions, and extra whitespace
  const clean = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[@#]\S+/g, ' ')
    .replace(/[\d\p{Emoji}\p{Punctuation}]/gu, ' ')
    .trim()

  if (clean.length < 3) return null

  let trScore = 0
  let enScore = 0
  let deScore = 0
  let esScore = 0

  // Check distinctive characters
  const trMatches = text.match(TR_DISTINCTIVE_CHARS)
  if (trMatches) {
    trScore += trMatches.length * 4
  }

  const deMatches = text.match(DE_DISTINCTIVE_CHARS)
  if (deMatches) {
    deScore += deMatches.length * 4
  }

  const esMatches = text.match(ES_DISTINCTIVE_CHARS)
  if (esMatches) {
    esScore += esMatches.length * 4
  }

  // Tokenize words
  const words = clean
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)

  if (words.length === 0) {
    if (trScore > 0) return 'tr'
    if (deScore > 0) return 'de'
    if (esScore > 0) return 'es'
    return null
  }

  for (const word of words) {
    if (TR_WORDS.has(word)) trScore += 3
    if (EN_WORDS.has(word)) enScore += 3
    if (DE_WORDS.has(word)) deScore += 3
    if (ES_WORDS.has(word)) esScore += 3
  }

  const scores = [
    { lang: 'tr', score: trScore },
    { lang: 'en', score: enScore },
    { lang: 'de', score: deScore },
    { lang: 'es', score: esScore },
  ]

  scores.sort((a, b) => b.score - a.score)
  const top = scores[0]

  // If highest score is positive, return it
  if (top.score > 0) {
    return top.lang
  }

  // If text is in ASCII Latin and at least 3 words, default to English as most common
  if (/^[a-zA-Z\s.,!?'"-]+$/.test(clean) && words.length >= 3) {
    return 'en'
  }

  return null
}
