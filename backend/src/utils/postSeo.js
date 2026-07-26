function stripHtml(value = '') {
  return `${value || ''}`.replace(/<[^>]*>/g, ' ')
}

function sanitizeTitle(value = '') {
  const withoutHtml = stripHtml(value)
  return withoutHtml.replace(/\s+/g, ' ').trim().slice(0, 80)
}

function transliterateTurkish(value = '') {
  return `${value || ''}`
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
}

function slugifyTitle(value = '') {
  const normalized = transliterateTurkish(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

  return normalized
}

module.exports = {
  sanitizeTitle,
  slugifyTitle,
}
