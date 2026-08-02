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
  const chunkBytes = Math.max(1024 * 1024, Number(session.chunkBytes) || 8 * 1024 * 1024)
  let remoteState = await resolveRemoteOffset(endpoint, ticket)
  let offset = Math.max(0, Math.min(file.size, Number(remoteState.offset) || 0))

  while (!remoteState.complete && offset < file.size) {
    let uploaded = false
    let lastError = null

    for (let attempt = 0; attempt < 3 && !uploaded; attempt += 1) {
      try {
        const chunk = file.slice(offset, Math.min(file.size, offset + chunkBytes))
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
        offset = Number(result.offset)
        remoteState = result
        uploaded = true
        options.onProgress?.(Math.min(100, Math.round((offset / file.size) * 100)))
      } catch (error) {
        lastError = error
        if (options.signal?.aborted) throw error
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
