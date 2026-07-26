export function buildTagSlug(value = '') {
  return `${value}`
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^\p{L}\p{N}_]+/gu, '')
}

export function buildTagLabelFromSlug(slug = '') {
  const normalizedSlug = buildTagSlug(slug)
  return normalizedSlug ? `#${normalizedSlug}` : ''
}
