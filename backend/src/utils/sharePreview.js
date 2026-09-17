const mongoose = require('mongoose')
const { normalizeMediaUrl, normalizeUserMedia } = require('./mediaUrls')

const SOCIAL_CRAWLER_REGEX =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|TelegramBot|Discordbot|LinkedInBot|Pinterest|SkypeUriPreview|Google-Structured-Data-Testing-Tool|Googlebot|bingbot|Applebot|YandexBot|DuckDuckBot|Baiduspider|GPTBot|OAI-SearchBot|PerplexityBot|ClaudeBot|Claude-Web|cohere-ai|Google-Extended|meta-externalagent/i

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
  type = 'article',
  locale = 'tr_TR',
  siteName = 'Nest Social',
  jsonLd = null,
}) {
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  const escapedCanonicalUrl = escapeHtml(canonicalUrl)
  const escapedImageUrl = escapeHtml(imageUrl)
  const escapedSiteName = escapeHtml(siteName)
  const jsonLdString = jsonLd ? JSON.stringify(jsonLd) : null

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapedTitle}</title>
    <link rel="canonical" href="${escapedCanonicalUrl}" />
    <meta name="description" content="${escapedDescription}" />
    <meta property="og:type" content="${escapeHtml(type)}" />
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
    ${jsonLdString ? `<script type="application/ld+json">${jsonLdString}</script>` : ''}
  </head>
  <body style="font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1e293b;">
    <article>
      <header>
        <h1 style="font-size:24px;margin-bottom:12px;color:#0f172a;">${escapedTitle}</h1>
      </header>
      <p style="font-size:16px;color:#334155;">${escapedDescription}</p>
      ${escapedImageUrl ? `<div style="margin:20px 0;"><img src="${escapedImageUrl}" alt="${escapedTitle}" style="max-width:100%;border-radius:12px;" /></div>` : ''}
      <footer style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:14px;color:#64748b;">
        <p>Görüntülemek ve katılmak için: <a href="${escapedCanonicalUrl}" style="color:#2563eb;text-decoration:none;">${escapedCanonicalUrl}</a></p>
      </footer>
    </article>
    <script>
      (function() {
        var isBot = /bot|google|crawler|spider|gpt|perplexity|claude|bing|slurp|duckduck/i.test(navigator.userAgent || '');
        if (!isBot) {
          window.location.replace(${JSON.stringify(canonicalUrl)});
        }
      })();
    </script>
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
    .select('text media privacy archivedAt moderation publication author createdAt')
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    headline: title,
    articleBody: post.text || '',
    datePublished: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
    author: {
      '@type': 'Person',
      name: authorName,
      url: author.username ? `${baseUrl.replace(/\/$/, '')}/u/${author.username}` : undefined,
    },
    ...(imageUrl ? { image: imageUrl } : {}),
  }

  return {
    title,
    description,
    imageUrl,
    jsonLd,
  }
}

async function buildCrawlerProfilePreview({ User, username, baseUrl = '' }) {
  if (!username || typeof username !== 'string') {
    return null
  }

  const safeUsername = username.trim().toLowerCase()
  const user = await User.findOne({ username: safeUsername })
    .select('firstName lastName username bio avatarUrl accountStatus verification')
    .lean()

  if (!user || user.accountStatus === 'suspended') {
    return null
  }

  const normalizedUser = normalizeUserMedia(user)
  const fullName =
    `${normalizedUser.firstName || ''} ${normalizedUser.lastName || ''}`.trim() ||
    normalizedUser.username ||
    'Nest Social Kullanıcısı'
  const title = `${fullName} (@${normalizedUser.username}) - Nest Social`
  const description = truncateText(
    normalizedUser.bio ||
      `${fullName} profilini, paylaşımlarını ve Loop videolarını Nest Social üzerinde keşfet.`,
    220,
  )
  const imageUrl = normalizedUser.avatarUrl
    ? toAbsoluteUrl(normalizedUser.avatarUrl, baseUrl)
    : ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: fullName,
      alternateName: `@${normalizedUser.username}`,
      description: normalizedUser.bio || undefined,
      ...(imageUrl ? { image: imageUrl } : {}),
    },
  }

  return {
    title,
    description,
    imageUrl,
    jsonLd,
  }
}

module.exports = {
  buildAbsoluteUrl,
  buildCrawlerPostPreview,
  buildCrawlerProfilePreview,
  buildOpenGraphHtml,
  normalizeLanguageParam,
  shouldServeCrawlerPreview,
}
