require('dotenv').config({ path: '.env' })
const mongoose = require('mongoose')
const { User } = require('../src/models/User')
const { Post } = require('../src/models/Post')

const LIVE_FEED_URL = 'https://api.nest-sc.com/api/v1/posts/feed'
const LIVE_UPLOAD_ORIGIN = 'https://upload.nest-sc.com'
const DEMO_UPLOAD_ORIGIN = 'https://upload-demo.nest-sc.com'
const PROFILE_FILE_PATTERN = /-([a-z0-9_]+)-(avatar|cover)\.[a-z0-9]+$/i

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim()

  if (!value) {
    throw new Error(`Missing required env: ${name}`)
  }

  return value
}

async function fetchJson(url) {
  const response = await fetch(url)

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Feed request failed (${response.status}): ${url} ${body.slice(0, 160)}`)
  }

  return response.json()
}

async function headStatus(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.status
  } catch {
    return 0
  }
}

async function downloadBuffer(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`)
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  }
}

async function uploadToLive({ uploadUrl, uploadToken, folder, fileName, buffer, contentType }) {
  const formData = new FormData()
  formData.append('file', new Blob([buffer], { type: contentType }), fileName)
  formData.append('folder', folder)

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'x-upload-token': uploadToken,
    },
    body: formData,
  })
  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}): ${responseText.slice(0, 180)}`)
  }

  try {
    return JSON.parse(responseText)
  } catch {
    throw new Error(`Upload response is not JSON: ${responseText.slice(0, 180)}`)
  }
}

function collectFeedMediaCandidates(posts = []) {
  const candidates = new Map()

  for (const post of posts) {
    if (post?.author?.avatarUrl) {
      candidates.set(post.author.avatarUrl, { kind: 'profile' })
    }

    if (post?.author?.coverUrl) {
      candidates.set(post.author.coverUrl, { kind: 'profile' })
    }

    if (Array.isArray(post?.media)) {
      for (const mediaItem of post.media) {
        if (mediaItem?.url) {
          candidates.set(mediaItem.url, { kind: 'post-media' })
        }
      }
    }
  }

  return candidates
}

function resolveFolderFromPath(pathName) {
  if (pathName.includes('/profiles/')) {
    return 'profiles'
  }

  if (pathName.includes('/posts/')) {
    return 'posts'
  }

  return 'uploads'
}

async function main() {
  const mongoUri = requiredEnv('MONGODB_URI')
  const liveUploadUrl = requiredEnv('HOSTINGER_UPLOAD_URL')
  const liveUploadToken = requiredEnv('HOSTINGER_UPLOAD_TOKEN')
  const maxPages = Number(process.env.MEDIA_REPAIR_MAX_PAGES || 10)
  const limit = Number(process.env.MEDIA_REPAIR_LIMIT || 24)

  const mediaCandidates = new Map()

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * limit
    const payload = await fetchJson(
      `${LIVE_FEED_URL}?limit=${limit}&offset=${offset}&view=explore`,
    )
    const pageCandidates = collectFeedMediaCandidates(payload?.posts || [])

    for (const [url, meta] of pageCandidates.entries()) {
      mediaCandidates.set(url, meta)
    }

    if (!payload?.pagination?.hasMore) {
      break
    }
  }

  console.log(`Collected candidates: ${mediaCandidates.size}`)

  const missing = []

  for (const [liveUrl, meta] of mediaCandidates.entries()) {
    const normalizedLiveUrl = String(liveUrl || '').trim()

    if (!normalizedLiveUrl.startsWith(`${LIVE_UPLOAD_ORIGIN}/`)) {
      continue
    }

    const liveStatus = await headStatus(normalizedLiveUrl)

    if (liveStatus === 200) {
      continue
    }

    const demoUrl = normalizedLiveUrl.replace(
      `${LIVE_UPLOAD_ORIGIN}/`,
      `${DEMO_UPLOAD_ORIGIN}/`,
    )
    const demoStatus = await headStatus(demoUrl)

    if (demoStatus !== 200) {
      continue
    }

    missing.push({
      liveUrl: normalizedLiveUrl,
      demoUrl,
      kind: meta.kind,
    })
  }

  console.log(`Missing-and-recoverable media: ${missing.length}`)

  if (!missing.length) {
    return
  }

  await mongoose.connect(mongoUri)
  let userUpdates = 0
  let postUpdates = 0

  try {
    for (const item of missing) {
      const pathName = new URL(item.liveUrl).pathname
      const fileName = pathName.split('/').filter(Boolean).pop()

      if (!fileName) {
        continue
      }

      const folder = resolveFolderFromPath(pathName)
      const { buffer, contentType } = await downloadBuffer(item.demoUrl)
      const uploadResult = await uploadToLive({
        uploadUrl: liveUploadUrl,
        uploadToken: liveUploadToken,
        folder,
        fileName,
        buffer,
        contentType,
      })
      const newUrl = String(uploadResult?.url || '').trim()

      if (!newUrl) {
        continue
      }

      if (folder === 'profiles') {
        const match = fileName.match(PROFILE_FILE_PATTERN)

        if (!match?.[1] || !match?.[2]) {
          continue
        }

        const username = String(match[1]).toLowerCase()
        const field = String(match[2]).toLowerCase() === 'cover' ? 'coverUrl' : 'avatarUrl'
        const result = await User.updateOne({ username }, { $set: { [field]: newUrl } })

        if ((result.modifiedCount || 0) > 0) {
          userUpdates += 1
          console.log(`Updated ${field} for ${username}`)
        }
      } else if (folder === 'posts') {
        const result = await Post.updateMany(
          { 'media.url': item.liveUrl },
          { $set: { 'media.$[elem].url': newUrl } },
          { arrayFilters: [{ 'elem.url': item.liveUrl }] },
        )

        if ((result.modifiedCount || 0) > 0) {
          postUpdates += result.modifiedCount || 0
          console.log(`Updated post media URL: ${item.liveUrl}`)
        }
      }
    }
  } finally {
    await mongoose.disconnect()
  }

  console.log(`Repair summary -> users: ${userUpdates}, posts: ${postUpdates}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
