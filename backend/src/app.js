const express = require('express')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
const hpp = require('hpp')
const morgan = require('morgan')
const { env } = require('./config/env')
const { Post } = require('./models/Post')
const { buildTrendingTopics } = require('./controllers/postsController')
const { corsOptions } = require('./config/cors')
const { apiRouter } = require('./routes')
const { sanitizeRequest } = require('./middlewares/sanitizeRequest')
const { notFound } = require('./middlewares/notFound')
const { errorHandler } = require('./middlewares/errorHandler')
const { AppError } = require('./utils/AppError')
const { frontendIndexHtml } = require('./frontendIndexHtml')
const {
  accessTokenCookieName,
  refreshTokenCookieName,
  parseCookieHeader,
} = require('./utils/cookies')
const {
  buildAbsoluteUrl,
  buildCrawlerPostPreview,
  buildOpenGraphHtml,
  normalizeLanguageParam,
  shouldServeCrawlerPreview,
} = require('./utils/sharePreview')

function resolveFrontendDistDir() {
  const backendRootDir = path.resolve(__dirname, '..')
  const candidateDirs = [
    path.resolve(backendRootDir, 'public'),
    path.resolve(backendRootDir, 'frontend-dist'),
    path.resolve(process.cwd(), 'backend/public'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), '../../frontend/dist'),
    path.resolve(process.cwd(), '../deploy/hostinger/artifacts/frontend-hostinger'),
    path.resolve(process.cwd(), '../../deploy/hostinger/artifacts/frontend-hostinger'),
  ]

  for (const candidateDir of candidateDirs) {
    const indexPath = path.join(candidateDir, 'index.html')

    if (fs.existsSync(indexPath)) {
      return candidateDir
    }
  }

  return null
}

function resolveClientIp(req) {
  if (env.trustProxy) {
    const cfConnectingIp = String(req.headers['cf-connecting-ip'] || '').trim()
    if (cfConnectingIp) {
      return cfConnectingIp
    }

    const xRealIp = String(req.headers['x-real-ip'] || '').trim()
    if (xRealIp) {
      return xRealIp
    }

    const xForwardedFor = String(req.headers['x-forwarded-for'] || '').trim()
    if (xForwardedFor) {
      const [firstIp] = xForwardedFor
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

      if (firstIp) {
        return firstIp
      }
    }
  }

  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function normalizeOrigin(origin) {
  const rawOrigin = String(origin || '').trim()

  if (!rawOrigin) {
    return ''
  }

  try {
    return new URL(rawOrigin).origin.toLowerCase()
  } catch {
    return rawOrigin.replace(/\/+$/, '').toLowerCase()
  }
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const allowedOrigins = new Set(
  (env.corsOrigins || [])
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean),
)

function hasCookieAuth(req) {
  const cookies = req.cookies || parseCookieHeader(req.headers.cookie || '')
  return Boolean(cookies[accessTokenCookieName] || cookies[refreshTokenCookieName])
}

function hasBearerAuth(req) {
  return String(req.headers.authorization || '').startsWith('Bearer ')
}

function enforceCookieCsrfProtection(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next()
  }

  if (hasBearerAuth(req) || !hasCookieAuth(req)) {
    return next()
  }

  const originHeader = normalizeOrigin(req.headers.origin || '')

  if (originHeader && allowedOrigins.has(originHeader)) {
    return next()
  }

  const refererHeader = String(req.headers.referer || '').trim()
  const refererOrigin = normalizeOrigin(refererHeader)
  if (refererOrigin && allowedOrigins.has(refererOrigin)) {
    return next()
  }

  return next(new AppError('CSRF validation failed for cookie-authenticated request.', 403))
}

function shouldSkipWriteRateLimit(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true
  }

  const requestPath = String(req.path || '').toLowerCase()

  if (
    /^\/posts\/[^/]+\/view$/.test(requestPath) ||
    /^\/posts\/[^/]+\/loop-telemetry$/.test(requestPath) ||
    /^\/stories\/[^/]+\/view$/.test(requestPath)
  ) {
    return true
  }

  return false
}

function createApp() {
  const app = express()
  const frontendDistDir = resolveFrontendDistDir()

  if (env.trustProxy) {
    app.set('trust proxy', 1)
  }

  const apiWriteLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
    skip: shouldSkipWriteRateLimit,
  })
  const telemetryLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: Math.max(300, env.rateLimit.max * 3),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
  })
  const authIdentifierLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: Math.min(50, env.rateLimit.max),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
  })
  const authLoginLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: Math.min(20, env.rateLimit.max),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
  })
  const authRefreshLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: Math.min(80, env.rateLimit.max),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
  })
  const authPasswordResetLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: Math.min(10, env.rateLimit.max),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
  })

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )

  app.use(cors(corsOptions))
  app.use(compression())
  app.use(cookieParser())

  const staticUploadsDirectory = env.uploadsDir || path.resolve(process.cwd(), 'uploads')
  const staticUploadsOptions = {
    maxAge: '365d',
    immutable: true,
    etag: true,
    lastModified: true,
  }

  app.use('/uploads', express.static(staticUploadsDirectory, staticUploadsOptions))
  app.use('/media', express.static(staticUploadsDirectory, staticUploadsOptions))

  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(sanitizeRequest)
  app.use(hpp())

  if (env.isDevelopment) {
    app.use(morgan('dev'))
  }

  app.use('/api/v1/auth/login/check-identifier', authIdentifierLimiter)
  app.use('/api/v1/auth/register/check-email', authIdentifierLimiter)
  app.use('/api/v1/auth/login', authLoginLimiter)
  app.use('/api/v1/auth/refresh', authRefreshLimiter)
  app.use('/api/v1/auth/register/request-code', authPasswordResetLimiter)
  app.use('/api/v1/auth/password-reset/request', authPasswordResetLimiter)
  app.use('/api/v1/posts/:postId/view', telemetryLimiter)
  app.use('/api/v1/posts/:postId/loop-telemetry', telemetryLimiter)
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Surrogate-Control', 'no-store')
    next()
  })

  app.use('/api/v1', enforceCookieCsrfProtection)
  app.use('/api/v1', apiWriteLimiter, apiRouter)

  if (frontendDistDir) {
    app.get('/sitemap.xml', async (req, res, next) => {
      try {
        const requestHost = String(req.hostname || '').toLowerCase()
        if (requestHost.startsWith('api.')) {
          return next()
        }

        const supportedLangs = ['tr', 'en', 'de', 'es']
        const baseOrigin = buildAbsoluteUrl(req, '').replace(/\/$/, '')
        const nowIso = new Date().toISOString()
        const staticPaths = supportedLangs.flatMap((lang) => [
          { path: `/${lang}/`, lastmod: nowIso },
          { path: `/${lang}/loop`, lastmod: nowIso },
          { path: `/${lang}/search`, lastmod: nowIso },
        ])
        let trendingTopics = []
        if (mongoose.connection.readyState === 1) {
          try {
            trendingTopics = await buildTrendingTopics(120)
          } catch {
            trendingTopics = []
          }
        }
        const tagEntries = []

        trendingTopics.forEach((topic) => {
          const slug = `${topic?.slug || ''}`.trim()
          if (!slug) {
            return
          }

          supportedLangs.forEach((lang) => {
            tagEntries.push({
              path: `/${lang}/tag/${encodeURIComponent(slug)}`,
              lastmod: topic.lastActivityAt || nowIso,
            })
          })
        })

        const dedupedEntries = [...staticPaths, ...tagEntries].filter(
          (entry, index, all) => all.findIndex((item) => item.path === entry.path) === index,
        )

        const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${dedupedEntries
          .map(
            (entry) => `  <url>\n    <loc>${escapeXml(`${baseOrigin}${entry.path}`)}</loc>\n    <lastmod>${escapeXml(
              entry.lastmod,
            )}</lastmod>\n  </url>`,
          )
          .join('\n')}\n</urlset>`

        res.set('Cache-Control', 'public, max-age=600')
        return res.status(200).type('application/xml').send(sitemapXml)
      } catch (error) {
        return next(error)
      }
    })

    app.use(
      express.static(frontendDistDir, {
        etag: true,
        lastModified: true,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          const normalizedPath = String(filePath || '').replace(/\\/g, '/')
          const fileName = path.basename(normalizedPath)
          const isDynamicDoc =
            fileName === 'index.html' || fileName === 'robots.txt' || fileName === 'sitemap.xml'
          const isHashedAsset =
            normalizedPath.includes('/assets/') || /\-[A-Za-z0-9_-]{6,}\./.test(fileName)

          if (isDynamicDoc) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
          } else if (isHashedAsset) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          } else if (/\.(png|jpg|jpeg|gif|webp|avif|svg|ico|woff2|woff|ttf)$/i.test(fileName)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000')
          }
        },
        index: 'index.html',
      }),
    )

    async function handleCrawlerPostPreview(req, res, next) {
      try {
        const requestHost = String(req.hostname || '').toLowerCase()

        if (requestHost.startsWith('api.')) {
          return next()
        }

        if (!shouldServeCrawlerPreview(req.headers?.['user-agent'])) {
          return next()
        }

        const lang = normalizeLanguageParam(req.params?.lang || req.query?.lang || 'tr')
        const postId = req.params?.postId
        const preview = await buildCrawlerPostPreview({
          Post,
          postId,
          baseUrl: buildAbsoluteUrl(req, '/'),
        })

        if (!preview) {
          return next()
        }

        const canonicalPath = `/${lang}/posts/${postId}`
        const canonicalUrl = buildAbsoluteUrl(req, canonicalPath)
        const localeMap = {
          tr: 'tr_TR',
          en: 'en_US',
          de: 'de_DE',
          es: 'es_ES',
        }
        const html = buildOpenGraphHtml({
          title: preview.title,
          description: preview.description,
          canonicalUrl,
          imageUrl: preview.imageUrl,
          locale: localeMap[lang] || 'tr_TR',
          siteName: 'Nest Social',
        })

        res.set('Cache-Control', 'public, max-age=300')
        return res.status(200).type('html').send(html)
      } catch (error) {
        return next(error)
      }
    }

    function buildTagPreviewDescription(tagLabel, lang) {
      if (lang === 'en') {
        return `Discover the latest posts for ${tagLabel} on Nest Social.`
      }
      if (lang === 'de') {
        return `Entdecke die neuesten Beiträge zum Thema ${tagLabel} auf Nest Social.`
      }
      if (lang === 'es') {
        return `Descubre las publicaciones más recientes sobre ${tagLabel} en Nest Social.`
      }
      return `${tagLabel} etiketi altindaki en guncel paylasimlari kesfet.`
    }

    async function handleCrawlerTagPreview(req, res, next) {
      try {
        const requestHost = String(req.hostname || '').toLowerCase()

        if (requestHost.startsWith('api.')) {
          return next()
        }

        if (!shouldServeCrawlerPreview(req.headers?.['user-agent'])) {
          return next()
        }

        const lang = normalizeLanguageParam(req.params?.lang || 'tr')
        const rawSlug = decodeURIComponent(String(req.params?.tagSlug || '')).trim()
        const normalizedSlug = rawSlug.replace(/[^\p{L}\p{N}_]+/gu, '').toLowerCase()

        if (!normalizedSlug) {
          return next()
        }

        const tagLabel = `#${normalizedSlug}`
        const canonicalPath = `/${lang}/tag/${encodeURIComponent(normalizedSlug)}`
        const canonicalUrl = buildAbsoluteUrl(req, canonicalPath)
        const localeMap = {
          tr: 'tr_TR',
          en: 'en_US',
          de: 'de_DE',
          es: 'es_ES',
        }
        const html = buildOpenGraphHtml({
          title: `${tagLabel} - Nest Social`,
          description: buildTagPreviewDescription(tagLabel, lang),
          canonicalUrl,
          imageUrl: '',
          locale: localeMap[lang] || 'tr_TR',
          siteName: 'Nest Social',
        })

        res.set('Cache-Control', 'public, max-age=300')
        return res.status(200).type('html').send(html)
      } catch (error) {
        return next(error)
      }
    }

    app.get('/:lang/tag/:tagSlug', handleCrawlerTagPreview)
    app.get('/:lang/posts/:postId', handleCrawlerPostPreview)
    app.get('/post/:postId', handleCrawlerPostPreview)
  }

  function serveSpaIndex(req, res, next) {
    // Passenger may start while Hostinger is still swapping the current build.
    // Resolve the frontend directory at request time instead of caching a null
    // or stale directory from application startup.
    const runtimeFrontendDistDir = resolveFrontendDistDir()

    if (!runtimeFrontendDistDir) {
      res.set('Cache-Control', 'no-store')
      res.set('Retry-After', '2')
      return res.status(503).type('html').send(frontendIndexHtml)
    }

    res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate')
    return fs.readFile(path.join(runtimeFrontendDistDir, 'index.html'), 'utf8', (error, html) => {
      if (!error) {
        res.status(200).type('html').send(html)
        return
      }

      if (!res.headersSent) {
        res.set('Cache-Control', 'no-store')
        res.set('Retry-After', '2')
        res.status(503).type('html').send(frontendIndexHtml)
        return
      }

      next(error)
    })
  }

  // Localized client-side routes must always return the SPA shell.
  app.get(/^\/(?:tr|en|de|es)(?:\/.*)?$/, serveSpaIndex)

  // Also support non-localized client-side routes while preserving API/media 404s.
  app.get(/.*/, (req, res, next) => {
    const requestPath = String(req.path || '')

    if (
      requestPath.startsWith('/api/') ||
      requestPath.startsWith('/uploads/') ||
      requestPath.startsWith('/media/') ||
      requestPath.includes('.')
    ) {
      return next()
    }

    return serveSpaIndex(req, res, next)
  })

  app.use(notFound)
  app.use(errorHandler)

  return app
}

module.exports = { createApp }
