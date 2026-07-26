import { apiRequest } from '../lib/apiClient.js'

export function getStoryRails(params = {}) {
  const searchParams = new URLSearchParams()

  if (params.limit) {
    searchParams.set('limit', params.limit)
  }

  const query = searchParams.toString()
  return apiRequest(`/stories/rails${query ? `?${query}` : ''}`)
}

export function getStoriesByUsername(username) {
  return apiRequest(`/stories/user/${encodeURIComponent(username)}`)
}

export function createStory(payload) {
  if (payload instanceof FormData) {
    return apiRequest('/stories', {
      method: 'POST',
      body: payload,
    })
  }

  return apiRequest('/stories', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function registerStoryView(storyId) {
  return apiRequest(`/stories/${storyId}/view`, {
    method: 'POST',
  })
}

export function getStoryViewers(storyId, params = {}) {
  const searchParams = new URLSearchParams()
  if (params.limit) {
    searchParams.set('limit', params.limit)
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', params.offset)
  }
  const query = searchParams.toString()
  return apiRequest(`/stories/${storyId}/viewers${query ? `?${query}` : ''}`)
}

export function toggleStoryLike(storyId) {
  return apiRequest(`/posts/${storyId}/like`, {
    method: 'POST',
  })
}

export function toggleStorySave(storyId) {
  return apiRequest(`/posts/${storyId}/save`, {
    method: 'POST',
  })
}

export function toggleStoryShare(storyId) {
  return apiRequest(`/posts/${storyId}/share`, {
    method: 'POST',
  })
}

export function createStoryReply(storyId, payload) {
  return apiRequest(`/posts/${storyId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getStoryDetail(storyId) {
  return apiRequest(`/posts/${storyId}`)
}

export function deleteStory(storyId) {
  return apiRequest(`/stories/${storyId}`, {
    method: 'DELETE',
  })
}
