import { apiRequest } from '../lib/apiClient.js'

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
