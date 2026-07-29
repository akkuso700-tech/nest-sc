function normalizeTopicToken(value = '') {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function buildTopicSlug(value = '') {
  return value
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^\p{L}\p{N}_]+/gu, '')
}

function formatTopicLabel(value = '') {
  if (!value) {
    return ''
  }

  return value.startsWith('#') ? value : `#${value}`
}

function extractTopicsFromText(text = '') {
  if (!text.trim()) {
    return []
  }

  const topicMap = new Map()
  const hashtagMatches = text.match(/#[\p{L}\p{N}_]+/gu) || []

  hashtagMatches.forEach((tag) => {
    const normalized = normalizeTopicToken(tag.replace(/^#/, ''))

    if (!normalized || normalized.length < 3) {
      return
    }

    topicMap.set(normalized, formatTopicLabel(tag.replace(/^#/, '')))
  })

  return [...topicMap.entries()].slice(0, 4).map(([key, label]) => ({ key, label }))
}

const RECOMMENDATION_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'ama', 'auch', 'before', 'ben', 'bir', 'biz', 'bunu',
  'como', 'con', 'daha', 'das', 'dem', 'den', 'der', 'die', 'ein', 'eine', 'ella', 'ellos',
  'este', 'için', 'ile', 'ist', 'just', 'kadar', 'like', 'more', 'nicht', 'olan', 'olarak',
  'para', 'pero', 'que', 'schon', 'sen', 'sonra', 'the', 'this', 'und', 'veya', 'with', 'you',
].map((word) => normalizeTopicToken(word)))

function extractRecommendationTopicKeys(text = '', limit = 12) {
  const hashtagKeys = extractTopicsFromText(text).map((topic) => topic.key)
  const hashtagSet = new Set(hashtagKeys)
  const wordCounts = new Map()
  const words = text.normalize('NFKD').toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []

  words.forEach((word) => {
    const normalized = normalizeTopicToken(word)
    if (
      !normalized ||
      normalized.length < 4 ||
      RECOMMENDATION_STOP_WORDS.has(normalized) ||
      hashtagSet.has(normalized)
    ) {
      return
    }

    wordCounts.set(normalized, Number(wordCounts.get(normalized) || 0) + 1)
  })

  const keywordKeys = [...wordCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, Math.max(0, limit - hashtagKeys.length))
    .map(([word]) => `kw${word}`)

  return [...new Set([...hashtagKeys, ...keywordKeys])].slice(0, limit)
}

module.exports = {
  normalizeTopicToken,
  buildTopicSlug,
  formatTopicLabel,
  extractTopicsFromText,
  extractRecommendationTopicKeys,
}
