const mongoose = require('mongoose')
const { normalizeMediaUrl, normalizeUserMedia } = require('./mediaUrls')

const SOCIAL_CRAWLER_REGEX =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|TelegramBot|Discordbot|LinkedInBot|Pinterest|SkypeUriPreview|Google-Structured-Data-Testing-Tool|Googlebot/i

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncateText(value = '', maxLength = 220) {
  const safeValue = String(value || '').trim()

  if (safeValue.length <= maxLength) {
    return safeValue
  }

  return `${safeValue.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function toAbsoluteUrl(url, baseUrl = '') {
  const value = String(url || '').trim()
  const normalizedBaseUrl = String(baseUrl || '').trim()

  if (!value) {
    return ''
  }

  if (/^https?:\/\//i.test(value)) {
    return normalizeMediaUrl(value)
  }

  if (!normalizedBaseUrl) {
    return value
  }

  try {
    return new URL(value, normalizedBaseUrl).toString()
  } catch {
    return value
  }
}

function pickPreviewImage(post = {}, author = {}, options = {}) {
  const { baseUrl = '' } = options
  const mediaItems = Array.isArray(post.media) ? post.media : []
  const imageMedia = mediaItems.find((item) => item?.type === 'image' && item?.url)
  const videoMedia = mediaItems.find((item) => item?.type === 'video' && (item?.url || item?.hlsUrl))
  const fallbackMedia = mediaItems.find((item) => item?.url || item?.hlsUrl)

  if (imageMedia?.url) {
    return toAbsoluteUrl(normalizeMediaUrl(imageMedia.url), baseUrl)
  }

  if (videoMedia?.url) {
    return toAbsoluteUrl(normalizeMediaUrl(videoMedia.url), baseUrl)
  }

  if (videoMedia?.hlsUrl) {
    return toAbsoluteUrl(normalizeMediaUrl(videoMedia.hlsUrl), baseUrl)
  }

  if (fallbackMedia?.url || fallbackMedia?.hlsUrl) {
    const mediaUrl = fallbackMedia.url || fallbackMedia.hlsUrl
    return toAbsoluteUrl(normalizeMediaUrl(mediaUrl), baseUrl)
  }

  if (author?.avatarUrl) {
    return toAbsoluteUrl(normalizeMediaUrl(author.avatarUrl), baseUrl)
  }

  return ''
}

function buildOpenGraphHtml({
  title,
  description,
  canonicalUrl,
  imageUrl,
  locale = 'tr_TR',
  siteName = 'Nest Social',
}) {
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  const escapedCanonicalUrl = escapeHtml(canonicalUrl)
  const escapedImageUrl = escapeHtml(imageUrl)
  const escapedSiteName = escapeHtml(siteName)

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapedTitle}</title>
    <link rel="canonical" href="${escapedCanonicalUrl}" />
    <meta name="description" content="${escapedDescription}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:url" content="${escapedCanonicalUrl}" />
    <meta property="og:site_name" content="${escapedSiteName}" />
    <meta property="og:locale" content="${escapeHtml(locale)}" />
    ${
      escapedImageUrl
        ? `<meta property="og:image" content="${escapedImageUrl}" />
    <meta name="twitter:image" content="${escapedImageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />`
        : '<meta name="twitter:card" content="summary" />'
    }
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta http-equiv="refresh" content="0; url=${escapedCanonicalUrl}" />
  </head>
  <body>
    <p>Redirecting to <a href="${escapedCanonicalUrl}">${escapedCanonicalUrl}</a></p>
    <script>window.location.replace(${JSON.stringify(canonicalUrl)})</script>
  </body>
</html>`
}

function shouldServeCrawlerPreview(userAgent = '') {
  return SOCIAL_CRAWLER_REGEX.test(String(userAgent || ''))
}

function normalizeLanguageParam(lang = 'tr') {
  const safeLang = String(lang || '').toLowerCase()
  return safeLang === 'en' || safeLang === 'de' || safeLang === 'es' || safeLang === 'tr'
    ? safeLang
    : 'tr'
}

function buildAbsoluteUrl(req, pathname) {
  const host = req.get('host')
  const protocol = req.protocol || 'https'
  return `${protocol}://${host}${pathname}`
}

function canPreviewPost(post) {
  if (!post) {
    return false
  }

  const isVisible = (post.moderation?.visibility || 'visible') === 'visible'
  const isPublished =
    (post.publication?.status || 'published') !== 'scheduled' ||
    (post.publication?.scheduledFor && new Date(post.publication.scheduledFor) <= new Date())

  return Boolean(isVisible && !post.archivedAt && post.privacy === 'public' && isPublished)
}

async function buildCrawlerPostPreview({ Post, postId, baseUrl = '' }) {
  if (!mongoose.isValidObjectId(postId)) {
    return null
  }

  const post = await Post.findById(postId)
    .populate('author', 'firstName lastName username avatarUrl verification')
    .select('text media privacy archivedAt moderation publication author')
    .lean()

  if (!canPreviewPost(post)) {
    return null
  }

  const author = normalizeUserMedia(post.author || {})
  const authorName =
    `${author.firstName || ''} ${author.lastName || ''}`.trim() ||
    author.username ||
    'Nest Social'
  const title = `${authorName} - Nest Social`
  const description = truncateText(post.text || 'Nest Social paylasimi', 220)
  const imageUrl = pickPreviewImage(post, author, { baseUrl })

  return {
    title,
    description,
    imageUrl,
  }
}

module.exports = {
  buildAbsoluteUrl,
  buildCrawlerPostPreview,
  buildOpenGraphHtml,
  normalizeLanguageParam,
  shouldServeCrawlerPreview,
}
