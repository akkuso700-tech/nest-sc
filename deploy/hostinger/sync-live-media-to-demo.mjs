#!/usr/bin/env node

/**
 * Live -> Demo media sync helper
 *
 * What it does:
 * 1) Reads public feed pages from live API
 * 2) Collects media URLs (post media + author avatars)
 * 3) Checks if target exists on upload-demo
 * 4) Uploads missing files to upload-demo endpoint
 *
 * Usage (PowerShell):
 * $env:DEMO_UPLOAD_TOKEN="your-demo-token"
 * node deploy/hostinger/sync-live-media-to-demo.mjs
 *
 * Dry run:
 * node deploy/hostinger/sync-live-media-to-demo.mjs --dry-run
 */

const DEFAULT_LIVE_API_BASE = 'https://api.nest-sc.com/api/v1'
const DEFAULT_LIVE_MEDIA_BASE = 'https://upload.nest-sc.com'
const DEFAULT_DEMO_UPLOAD_URL = 'https://upload-demo.nest-sc.com/upload.php'
const DEFAULT_LIMIT = 24
const DEFAULT_MAX_PAGES = 20
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_PROFILE_PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X5xQAAAAASUVORK5CYII='

function parseArgs(argv) {
  const args = {
    dryRun: false,
    liveApiBase: process.env.LIVE_API_BASE || DEFAULT_LIVE_API_BASE,
    liveMediaBase: process.env.LIVE_MEDIA_BASE || DEFAULT_LIVE_MEDIA_BASE,
    demoUploadUrl: process.env.DEMO_UPLOAD_URL || DEFAULT_DEMO_UPLOAD_URL,
    demoUploadToken: process.env.DEMO_UPLOAD_TOKEN || '',
    limit: Number(process.env.SYNC_LIMIT || DEFAULT_LIMIT),
    maxPages: Number(process.env.SYNC_MAX_PAGES || DEFAULT_MAX_PAGES),
    timeoutMs: Number(process.env.SYNC_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    view: process.env.SYNC_VIEW || 'explore',
  }

  for (const rawArg of argv) {
    const arg = String(rawArg || '').trim()

    if (!arg) continue
    if (arg === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (arg.startsWith('--live-api=')) {
      args.liveApiBase = arg.split('=').slice(1).join('=').trim() || args.liveApiBase
      continue
    }
    if (arg.startsWith('--demo-upload=')) {
      args.demoUploadUrl = arg.split('=').slice(1).join('=').trim() || args.demoUploadUrl
      continue
    }
    if (arg.startsWith('--live-media=')) {
      args.liveMediaBase = arg.split('=').slice(1).join('=').trim() || args.liveMediaBase
      continue
    }
    if (arg.startsWith('--token=')) {
      args.demoUploadToken = arg.split('=').slice(1).join('=').trim() || args.demoUploadToken
      continue
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=').slice(1).join('=').trim())
      if (Number.isFinite(value) && value > 0) args.limit = value
      continue
    }
    if (arg.startsWith('--max-pages=')) {
      const value = Number(arg.split('=').slice(1).join('=').trim())
      if (Number.isFinite(value) && value > 0) args.maxPages = value
      continue
    }
    if (arg.startsWith('--view=')) {
      args.view = arg.split('=').slice(1).join('=').trim() || args.view
      continue
    }
  }

  args.liveApiBase = String(args.liveApiBase || '').replace(/\/+$/, '')
  args.liveMediaBase = String(args.liveMediaBase || '').replace(/\/+$/, '')
  args.demoUploadUrl = String(args.demoUploadUrl || '').trim()

  return args
}

function withTimeout(timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  }
}

async function fetchJson(url, timeoutMs) {
  const timer = withTimeout(timeoutMs)
  try {
    const response = await fetch(url, { signal: timer.signal })
    const text = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while requesting ${url}: ${text.slice(0, 240)}`)
    }

    return text ? JSON.parse(text) : null
  } finally {
    timer.clear()
  }
}

function normalizeMediaPath(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return ''

  try {
    const parsedUrl = new URL(value)
    const pathname = parsedUrl.pathname || ''
    if (pathname.startsWith('/media/')) return pathname
    if (pathname.startsWith('/uploads/')) return `/media/${pathname.replace(/^\/uploads\//, '')}`
    return ''
  } catch {
    if (value.startsWith('/media/')) return value
    if (value.startsWith('/uploads/')) return `/media/${value.replace(/^\/uploads\//, '')}`
    return ''
  }
}

function collectMediaUrlsFromPost(post) {
  const urls = []

  if (Array.isArray(post?.media)) {
    for (const mediaItem of post.media) {
      if (mediaItem?.url) urls.push(String(mediaItem.url))
    }
  }

  if (post?.author?.avatarUrl) {
    urls.push(String(post.author.avatarUrl))
  }

  if (post?.author?.coverUrl) {
    urls.push(String(post.author.coverUrl))
  }

  return urls
}

async function headStatus(url, timeoutMs) {
  const timer = withTimeout(timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: timer.signal,
    })
    return response.status
  } catch {
    return 0
  } finally {
    timer.clear()
  }
}

async function downloadFile(sourceUrl, timeoutMs) {
  const timer = withTimeout(timeoutMs)
  try {
    const response = await fetch(sourceUrl, { signal: timer.signal })
    if (!response.ok) {
      const responseText = await response.text().catch(() => '')
      throw new Error(`Download failed (${response.status}) ${sourceUrl} ${responseText.slice(0, 180)}`)
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const arrayBuffer = await response.arrayBuffer()
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    }
  } finally {
    timer.clear()
  }
}

function buildSourceCandidates({
  sourceUrl,
  mediaPath,
  liveApiBase,
  liveMediaBase,
}) {
  const candidates = new Set()

  if (sourceUrl) {
    candidates.add(sourceUrl)
  }

  if (!mediaPath) {
    return [...candidates]
  }

  const liveApiOrigin = String(liveApiBase || '').replace(/\/api\/v1$/i, '').replace(/\/+$/, '')
  const liveMediaOrigin = String(liveMediaBase || '').replace(/\/+$/, '')

  if (liveMediaOrigin) {
    candidates.add(`${liveMediaOrigin}${mediaPath}`)
  }

  if (liveApiOrigin) {
    candidates.add(`${liveApiOrigin}${mediaPath}`)
  }

  return [...candidates]
}

async function downloadFileWithFallback(options) {
  const { sourceCandidates, timeoutMs } = options
  let lastError = null

  for (const candidateUrl of sourceCandidates) {
    try {
      const payload = await downloadFile(candidateUrl, timeoutMs)
      return {
        ...payload,
        usedSourceUrl: candidateUrl,
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('Unable to download media from source candidates.')
}

function parseProfileFileMeta(mediaPath) {
  const fileName = resolveFileName(mediaPath)
  const match = fileName.match(/-([a-z0-9_]+)-(avatar|cover)\.[a-z0-9]+$/i)

  if (!match) {
    return {
      fileName,
      username: '',
      kind: '',
    }
  }

  return {
    fileName,
    username: String(match[1] || '').toLowerCase(),
    kind: String(match[2] || '').toLowerCase(),
  }
}

async function resolveUserProfilePayload({
  username,
  liveApiBase,
  timeoutMs,
  profileCache,
}) {
  if (!username) {
    return null
  }

  if (profileCache.has(username)) {
    return profileCache.get(username)
  }

  const url = `${liveApiBase}/users/profile/${encodeURIComponent(username)}`

  try {
    const payload = await fetchJson(url, timeoutMs)
    profileCache.set(username, payload)
    return payload
  } catch {
    profileCache.set(username, null)
    return null
  }
}

function resolveProfileMediaUrlFromPayload(payload, kind) {
  if (!payload || !payload.user) {
    return ''
  }

  if (kind === 'cover') {
    return String(payload.user.coverUrl || '').trim()
  }

  return String(payload.user.avatarUrl || '').trim()
}

function resolveTargetFolder(mediaPath) {
  const chunks = mediaPath.split('/').filter(Boolean)
  // /media/posts/file.webp => posts
  // /media/profiles/file.webp => profiles
  return chunks.length >= 2 ? chunks[1] : 'posts'
}

function resolveFileName(mediaPath, fallbackExt = '') {
  const chunks = mediaPath.split('/').filter(Boolean)
  const fileName = chunks[chunks.length - 1] || ''
  if (fileName) return fileName
  return `sync-${Date.now()}${fallbackExt}`
}

async function uploadToDemo({
  uploadUrl,
  token,
  folder,
  fileName,
  targetName,
  contentType,
  buffer,
  timeoutMs,
}) {
  const formData = new FormData()
  const blob = new Blob([buffer], { type: contentType || 'application/octet-stream' })

  formData.append('file', blob, fileName)
  formData.append('folder', folder)
  formData.append('preserve_name', '1')
  formData.append('target_name', targetName || fileName)

  const timer = withTimeout(timeoutMs)
  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-upload-token': token,
      },
      body: formData,
      signal: timer.signal,
    })
    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`Upload failed (${response.status}): ${responseText.slice(0, 220)}`)
    }

    return responseText
  } finally {
    timer.clear()
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.dryRun && !args.demoUploadToken) {
    throw new Error('DEMO_UPLOAD_TOKEN missing. Set env var or pass --token=...')
  }

  let demoUploadOrigin = ''
  try {
    demoUploadOrigin = new URL(args.demoUploadUrl).origin.replace(/\/+$/, '')
  } catch {
    throw new Error(`Invalid demo upload URL: ${args.demoUploadUrl}`)
  }

  console.log('--- Sync Configuration ---')
  console.log(`liveApiBase   : ${args.liveApiBase}`)
  console.log(`liveMediaBase : ${args.liveMediaBase}`)
  console.log(`demoUploadUrl : ${args.demoUploadUrl}`)
  console.log(`view          : ${args.view}`)
  console.log(`limit         : ${args.limit}`)
  console.log(`maxPages      : ${args.maxPages}`)
  console.log(`dryRun        : ${args.dryRun}`)
  console.log('--------------------------')

  const sourceUrls = new Set()
  let pageCount = 0
  let offset = 0

  while (pageCount < args.maxPages) {
    const feedUrl = `${args.liveApiBase}/posts/feed?limit=${args.limit}&offset=${offset}&view=${encodeURIComponent(args.view)}`
    const payload = await fetchJson(feedUrl, args.timeoutMs)
    const posts = Array.isArray(payload?.posts) ? payload.posts : []

    if (!posts.length) {
      break
    }

    for (const post of posts) {
      for (const mediaUrl of collectMediaUrlsFromPost(post)) {
        const mediaPath = normalizeMediaPath(mediaUrl)
        if (!mediaPath) continue

        // Convert to live upload canonical source when possible
        const sourceUrl = mediaUrl.startsWith('http')
          ? mediaUrl
          : `${args.liveApiBase.replace(/\/api\/v1$/, '')}${mediaUrl}`

        sourceUrls.add(String(sourceUrl))
      }
    }

    pageCount += 1
    offset += args.limit
  }

  const sortedSourceUrls = [...sourceUrls]
  console.log(`Collected media candidates: ${sortedSourceUrls.length}`)

  let checked = 0
  let alreadyExists = 0
  let uploaded = 0
  let failed = 0
  let fallbackUsed = 0
  let fallbackProfileBuffer = null
  const profilePayloadCache = new Map()

  for (const sourceUrl of sortedSourceUrls) {
    checked += 1
    const mediaPath = normalizeMediaPath(sourceUrl)

    if (!mediaPath) {
      failed += 1
      console.log(`[${checked}] SKIP invalid media path: ${sourceUrl}`)
      continue
    }

    const demoTargetUrl = `${demoUploadOrigin}${mediaPath}`
    const targetStatus = await headStatus(demoTargetUrl, args.timeoutMs)

    if (targetStatus >= 200 && targetStatus < 400) {
      alreadyExists += 1
      console.log(`[${checked}] EXISTS ${demoTargetUrl}`)
      continue
    }

    if (args.dryRun) {
      console.log(`[${checked}] MISS (dry-run) ${demoTargetUrl} <= ${sourceUrl}`)
      continue
    }

    try {
      const sourceCandidates = buildSourceCandidates({
        sourceUrl,
        mediaPath,
        liveApiBase: args.liveApiBase,
        liveMediaBase: args.liveMediaBase,
      })
      const { buffer, contentType, usedSourceUrl } = await downloadFileWithFallback({
        sourceCandidates,
        timeoutMs: args.timeoutMs,
      })
      const folder = resolveTargetFolder(mediaPath)
      const fileName = resolveFileName(mediaPath)

      await uploadToDemo({
        uploadUrl: args.demoUploadUrl,
        token: args.demoUploadToken,
        folder,
        fileName,
        targetName: fileName,
        contentType,
        buffer,
        timeoutMs: args.timeoutMs,
      })

      if (mediaPath.startsWith('/media/profiles/')) {
        fallbackProfileBuffer = { buffer, contentType }
      }

      uploaded += 1
      console.log(`[${checked}] UPLOADED ${folder}/${fileName} <= ${usedSourceUrl}`)
    } catch (error) {
      if (mediaPath.startsWith('/media/profiles/')) {
        try {
          const { fileName, username, kind } = parseProfileFileMeta(mediaPath)
          const profilePayload = await resolveUserProfilePayload({
            username,
            liveApiBase: args.liveApiBase,
            timeoutMs: args.timeoutMs,
            profileCache: profilePayloadCache,
          })
          const profileMediaUrl = resolveProfileMediaUrlFromPayload(profilePayload, kind)
          let uploadedViaFallback = false

          if (profileMediaUrl) {
            try {
              const profileMediaPath = normalizeMediaPath(profileMediaUrl)
              const fallbackCandidates = buildSourceCandidates({
                sourceUrl: profileMediaUrl,
                mediaPath: profileMediaPath,
                liveApiBase: args.liveApiBase,
                liveMediaBase: args.liveMediaBase,
              })
              const downloadedFallback = await downloadFileWithFallback({
                sourceCandidates: fallbackCandidates,
                timeoutMs: args.timeoutMs,
              })

              await uploadToDemo({
                uploadUrl: args.demoUploadUrl,
                token: args.demoUploadToken,
                folder: resolveTargetFolder(mediaPath),
                fileName,
                targetName: fileName,
                contentType: downloadedFallback.contentType,
                buffer: downloadedFallback.buffer,
                timeoutMs: args.timeoutMs,
              })

              fallbackProfileBuffer = {
                buffer: downloadedFallback.buffer,
                contentType: downloadedFallback.contentType,
              }
              fallbackUsed += 1
              uploaded += 1
              uploadedViaFallback = true
              console.log(`[${checked}] UPLOADED (profile-fallback) ${fileName} <= ${downloadedFallback.usedSourceUrl}`)
            } catch {
              // Continue to clone/placeholder fallback.
            }
          }

          if (uploadedViaFallback) {
            continue
          }

          if (fallbackProfileBuffer?.buffer?.length) {
            await uploadToDemo({
              uploadUrl: args.demoUploadUrl,
              token: args.demoUploadToken,
              folder: resolveTargetFolder(mediaPath),
              fileName,
              targetName: fileName,
              contentType: fallbackProfileBuffer.contentType || 'image/webp',
              buffer: fallbackProfileBuffer.buffer,
              timeoutMs: args.timeoutMs,
            })

            fallbackUsed += 1
            uploaded += 1
            uploadedViaFallback = true
            console.log(`[${checked}] UPLOADED (profile-clone-fallback) ${fileName}`)
          }

          if (uploadedViaFallback) {
            continue
          }

          const placeholderBuffer = Buffer.from(DEFAULT_PROFILE_PLACEHOLDER_PNG_BASE64, 'base64')
          await uploadToDemo({
            uploadUrl: args.demoUploadUrl,
            token: args.demoUploadToken,
            folder: resolveTargetFolder(mediaPath),
            fileName,
            targetName: fileName,
            contentType: 'image/png',
            buffer: placeholderBuffer,
            timeoutMs: args.timeoutMs,
          })

          fallbackUsed += 1
          uploaded += 1
          console.log(`[${checked}] UPLOADED (profile-placeholder-fallback) ${fileName}`)
          continue
        } catch (fallbackError) {
          failed += 1
          console.log(`[${checked}] ERROR ${sourceUrl}`)
          console.log(`  -> ${fallbackError.message}`)
          continue
        }
      }

      failed += 1
      console.log(`[${checked}] ERROR ${sourceUrl}`)
      console.log(`  -> ${error.message}`)
    }
  }

  console.log('\n=== Sync Summary ===')
  console.log(`checked       : ${checked}`)
  console.log(`alreadyExists : ${alreadyExists}`)
  console.log(`uploaded      : ${uploaded}`)
  console.log(`fallbackUsed  : ${fallbackUsed}`)
  console.log(`failed        : ${failed}`)
}

main().catch((error) => {
  console.error(`\nSync failed: ${error.message}`)
  process.exit(1)
})
