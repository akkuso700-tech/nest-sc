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

module.exports = {
  normalizeTopicToken,
  buildTopicSlug,
  formatTopicLabel,
  extractTopicsFromText,
}
