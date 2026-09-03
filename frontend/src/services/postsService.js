import { apiRequest } from '../lib/apiClient.js'

async function readDirectUploadResponse(response, fallbackMessage) {
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const error = new Error(payload?.message || fallbackMessage)
    error.status = response.status
    error.offset = Number(payload?.offset)
    throw error
  }
  return payload
}

async function fetchUploadAction(endpoint, action, options = {}) {
  const separator = endpoint.includes('?') ? '&' : '?'
  return fetch(`${endpoint}${separator}action=${encodeURIComponent(action)}`, options)
}

async function resolveRemoteOffset(endpoint, ticket) {
  const response = await fetchUploadAction(endpoint, 'status', {
    method: 'POST',
    headers: { 'X-Upload-Ticket': ticket },
  })
  const payload = await readDirectUploadResponse(response, 'Video upload status could not be read.')
  return payload
}

function getInitialChunkSize(maxAllowedBytes = 8 * 1024 * 1024) {
  const serverMax = Math.max(512 * 1024, Number(maxAllowedBytes) || 8 * 1024 * 1024)
  const connection = typeof navigator !== 'undefined' ? navigator.connection || null : null

  if (connection?.saveData) {
    return Math.min(serverMax, 512 * 1024)
  }

  const effectiveType = `${connection?.effectiveType || ''}`.toLowerCase()
  const downlink = Number(connection?.downlink || 0)
  const rtt = Number(connection?.rtt || 0)

  if (effectiveType === 'slow-2g' || effectiveType === '2g' || (rtt > 1000 && rtt !== 0)) {
    return Math.min(serverMax, 512 * 1024) // 512 KB for very slow/unstable networks
  }

  if (effectiveType === '3g' || (downlink > 0 && downlink < 2.5) || rtt > 350) {
    return Math.min(serverMax, 1.5 * 1024 * 1024) // 1.5 MB for 3G
  }

  if (effectiveType === '4g' || downlink >= 5) {
    if (downlink >= 15) {
      return serverMax // 8 MB on high-speed broadband / fast 4G
    }
    return Math.min(serverMax, 4 * 1024 * 1024) // 4 MB on normal 4G
  }

  // Safe balanced default for browsers without NetworkInformation API (Safari, Firefox)
  return Math.min(serverMax, 2 * 1024 * 1024) // 2 MB initial
}

function adaptNextChunkSize(currentSize, durationMs, maxAllowedBytes) {
  const minSize = 512 * 1024 // 512 KB floor
  const maxSize = Math.max(minSize, Number(maxAllowedBytes) || 8 * 1024 * 1024)

  if (durationMs > 7000) {
    // Transfer took too long, scale down chunk size to prevent timeouts and re-upload waste
    return Math.max(minSize, Math.floor(currentSize * 0.6))
  }

  if (durationMs < 1200 && currentSize < maxSize) {
    // Transfer completed quickly, scale up chunk size for maximum throughput
    return Math.min(maxSize, Math.floor(currentSize * 1.5))
  }

  return currentSize
}

export async function uploadLoopVideoDirect(file, options = {}) {
  let session
  try {
    session = await apiRequest('/posts/loop-upload-ticket', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'video/mp4',
        bytes: file.size,
      }),
    })
  } catch (error) {
    if (error?.status === 503) return null
    throw error
  }

  const { endpoint, ticket, sourceUrl } = session
  const maxChunkBytes = Math.max(512 * 1024, Number(session.chunkBytes) || 8 * 1024 * 1024)
  let currentChunkBytes = getInitialChunkSize(maxChunkBytes)
  let remoteState = await resolveRemoteOffset(endpoint, ticket)
  let offset = Math.max(0, Math.min(file.size, Number(remoteState.offset) || 0))

  while (!remoteState.complete && offset < file.size) {
    let uploaded = false
    let lastError = null

    for (let attempt = 0; attempt < 3 && !uploaded; attempt += 1) {
      try {
        const chunk = file.slice(offset, Math.min(file.size, offset + currentChunkBytes))
        const chunkStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const response = await fetchUploadAction(endpoint, 'chunk', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Upload-Ticket': ticket,
            'Upload-Offset': String(offset),
          },
          body: chunk,
          signal: options.signal,
        })
        const result = await readDirectUploadResponse(response, 'Video chunk could not be uploaded.')
        const chunkDurationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - chunkStartMs
        currentChunkBytes = adaptNextChunkSize(currentChunkBytes, chunkDurationMs, maxChunkBytes)
        offset = Number(result.offset)
        remoteState = result
        uploaded = true
        options.onProgress?.(Math.min(100, Math.round((offset / file.size) * 100)))
      } catch (error) {
        lastError = error
        if (options.signal?.aborted) throw error
        // On failure/retry, immediately scale down chunk size for better socket reliability
        currentChunkBytes = Math.max(512 * 1024, Math.floor(currentChunkBytes * 0.5))
        try {
          remoteState = await resolveRemoteOffset(endpoint, ticket)
          offset = Math.max(0, Math.min(file.size, Number(remoteState.offset) || 0))
          if (remoteState.complete || offset >= file.size) uploaded = true
        } catch {
          // Retry the same chunk; the status call on the next attempt will reconcile the offset.
        }
      }
    }
    if (!uploaded) throw lastError || new Error('Video upload could not be completed.')
  }

  const completeResponse = await fetchUploadAction(endpoint, 'complete', {
    method: 'POST',
    headers: { 'X-Upload-Ticket': ticket },
  })
  const completed = await readDirectUploadResponse(completeResponse, 'Video upload could not be finalized.')
  options.onProgress?.(100)
  return {
    ticket,
    sourceUrl: completed.url || sourceUrl,
  }
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

export function createPost(payload) {
  if (payload instanceof FormData) {
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

export function getPostLikes(postId, { page = 1, limit = 20, q = '' } = {}) {
  const query = new URLSearchParams()
  if (page) query.set('page', String(page))
  if (limit) query.set('limit', String(limit))
  if (q) query.set('q', String(q))

  return apiRequest(`/posts/${postId}/likes${query.toString() ? `?${query.toString()}` : ''}`)
}

export function getPostInsights(postId) {
  return apiRequest(`/posts/${postId}/insights`)
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
