import { apiRequest } from '../lib/apiClient.js'

let directUploadCapabilitiesPromise = null

function getDirectUploadCapabilities() {
  if (!directUploadCapabilitiesPromise) {
    directUploadCapabilitiesPromise = apiRequest('/video-uploads/capabilities')
      .then((payload) => payload?.capabilities || { enabled: false })
      .catch((error) => {
        directUploadCapabilitiesPromise = null
        throw error
      })
  }
  return directUploadCapabilitiesPromise
}

function uploadPartWithProgress({ url, blob, signal, onProgress }) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.timeout = 120000
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded)
    })
    request.addEventListener('load', () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Video part upload failed with HTTP ${request.status}.`))
        return
      }
      const etag = request.getResponseHeader('ETag')
      if (!etag) {
        reject(new Error('Object storage CORS must expose the ETag response header.'))
        return
      }
      resolve(etag)
    })
    request.addEventListener('error', () => reject(new Error('Video part upload failed.')))
    request.addEventListener('timeout', () => reject(new Error('Video part upload timed out.')))
    request.addEventListener('abort', () => reject(new DOMException('Upload aborted.', 'AbortError')))
    const abort = () => request.abort()
    signal?.addEventListener('abort', abort, { once: true })
    request.addEventListener('loadend', () => signal?.removeEventListener('abort', abort))
    request.send(blob)
  })
}

async function withRetry(task, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task(attempt)
    } catch (error) {
      lastError = error
      if (error?.name === 'AbortError' || attempt === attempts) throw error
      await new Promise((resolve) => window.setTimeout(resolve, 500 * 2 ** (attempt - 1)))
    }
  }
  throw lastError
}

async function uploadLoopVideoDirectly(file, options = {}) {
  const initialized = await apiRequest('/video-uploads', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      bytes: file.size,
    }),
  })
  const upload = initialized.upload
  const loadedByPart = new Map()
  const completedParts = new Array(upload.partCount)
  let nextPartIndex = 0

  const emitProgress = () => {
    const uploadedBytes = [...loadedByPart.values()].reduce((sum, value) => sum + value, 0)
    options.onUploadProgress?.({
      uploadedBytes,
      totalBytes: file.size,
      percent: Math.min(99, Math.round((uploadedBytes / file.size) * 100)),
    })
  }

  async function partWorker() {
    while (nextPartIndex < upload.parts.length) {
      const partIndex = nextPartIndex
      nextPartIndex += 1
      const part = upload.parts[partIndex]
      const start = partIndex * upload.partSizeBytes
      const end = Math.min(start + upload.partSizeBytes, file.size)
      const blob = file.slice(start, end)
      const etag = await withRetry(() => {
        loadedByPart.set(part.partNumber, 0)
        emitProgress()
        return uploadPartWithProgress({
          url: part.url,
          blob,
          signal: options.signal,
          onProgress: (loaded) => {
            loadedByPart.set(part.partNumber, loaded)
            emitProgress()
          },
        })
      })
      loadedByPart.set(part.partNumber, blob.size)
      completedParts[partIndex] = { partNumber: part.partNumber, etag }
      emitProgress()
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(3, upload.parts.length) }, () => partWorker()))
    await apiRequest(`/video-uploads/${upload.uploadId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ parts: completedParts }),
    })
    options.onUploadProgress?.({ uploadedBytes: file.size, totalBytes: file.size, percent: 100 })
    return upload.uploadId
  } catch (error) {
    await apiRequest(`/video-uploads/${upload.uploadId}`, { method: 'DELETE' }).catch(() => undefined)
    throw error
  }
}

function formDataToJson(formData) {
  const payload = {}
  formData.forEach((value, key) => {
    if (!(value instanceof Blob)) payload[key] = value
  })
  return payload
}

export function getFeed(params = {}) {
  const searchParams = new URLSearchParams()

  if (params.limit) {
    searchParams.set('limit', params.limit)
  }

  if (params.cursor) {
    searchParams.set('cursor', params.cursor)
  }

  if (typeof params.offset === 'number') {
    searchParams.set('offset', params.offset)
  }

  if (params.authorId) {
    searchParams.set('authorId', params.authorId)
  }

  if (params.topic) {
    searchParams.set('topic', params.topic)
  }

  if (params.view) {
    searchParams.set('view', params.view)
  }

  if (params.loopMode) {
    searchParams.set('loopMode', params.loopMode)
  }

  const query = searchParams.toString()

  return apiRequest(`/posts/feed${query ? `?${query}` : ''}`)
}

export function getTrendingTopics(params = {}) {
  const searchParams = new URLSearchParams()

  if (params.limit) {
    searchParams.set('limit', params.limit)
  }

  const query = searchParams.toString()

  return apiRequest(`/posts/trends${query ? `?${query}` : ''}`)
}

export async function createPost(payload, options = {}) {
  if (payload instanceof FormData) {
    const contentType = String(payload.get('contentType') || '').toLowerCase()
    const media = payload.getAll('media')
    const loopVideo = contentType === 'loop'
      ? media.find((item) => item instanceof File && item.type.startsWith('video/'))
      : null
    if (loopVideo) {
      const capabilities = await getDirectUploadCapabilities()
      if (capabilities.enabled) {
        const uploadSessionId = await uploadLoopVideoDirectly(loopVideo, options)
        try {
          return await apiRequest('/posts', {
            method: 'POST',
            body: JSON.stringify({
              ...formDataToJson(payload),
              uploadSessionId,
            }),
          })
        } catch (error) {
          await apiRequest(`/video-uploads/${uploadSessionId}`, { method: 'DELETE' }).catch(() => undefined)
          throw error
        }
      }
    }
    return apiRequest('/posts', {
      method: 'POST',
      body: payload,
    })
  }

  return apiRequest('/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getPostDetail(postId) {
  return apiRequest(`/posts/${postId}`)
}

export function registerPostView(postId, metrics = null, options = {}) {
  const hasPayload = Boolean(metrics && Object.keys(metrics).length)

  return apiRequest(`/posts/${postId}/view`, {
    method: 'POST',
    ...(options.keepalive ? { keepalive: true } : {}),
    ...(hasPayload ? { body: JSON.stringify(metrics) } : {}),
  })
}

export function recordLoopPlaybackTelemetry(postId, payload = {}) {
  return apiRequest(`/posts/${postId}/loop-telemetry`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createComment(postId, payload) {
  if (payload instanceof FormData) {
    return apiRequest(`/posts/${postId}/comments`, {
      method: 'POST',
      body: payload,
    })
  }

  return apiRequest(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function togglePostLike(postId, recommendation = null) {
  return apiRequest(`/posts/${postId}/like`, {
    method: 'POST',
    body: JSON.stringify(recommendation ? { recommendation } : {}),
  })
}

export function togglePostSave(postId, recommendation = null) {
  return apiRequest(`/posts/${postId}/save`, {
    method: 'POST',
    body: JSON.stringify(recommendation ? { recommendation } : {}),
  })
}

export function togglePostShare(postId, recommendation = null) {
  return apiRequest(`/posts/${postId}/share`, {
    method: 'POST',
    body: JSON.stringify(recommendation ? { recommendation } : {}),
  })
}

export function markPostNotInterested(postId, recommendation = null) {
  return apiRequest(`/posts/${postId}/not-interested`, {
    method: 'POST',
    body: JSON.stringify(recommendation ? { recommendation } : {}),
  })
}

export function togglePostArchive(postId) {
  return apiRequest(`/posts/${postId}/archive`, {
    method: 'POST',
  })
}

export function deletePost(postId) {
  return apiRequest(`/posts/${postId}`, {
    method: 'DELETE',
  })
}

export function updatePost(postId, payload) {
  return apiRequest(`/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function toggleCommentLike(commentId) {
  return apiRequest(`/posts/comments/${commentId}/like`, {
    method: 'POST',
  })
}

export function toggleCommentSave(commentId) {
  return apiRequest(`/posts/comments/${commentId}/save`, {
    method: 'POST',
  })
}

export function toggleCommentShare(commentId) {
  return apiRequest(`/posts/comments/${commentId}/share`, {
    method: 'POST',
  })
}

export function updateComment(commentId, payload) {
  return apiRequest(`/posts/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteComment(commentId) {
  return apiRequest(`/posts/comments/${commentId}`, {
    method: 'DELETE',
  })
}
