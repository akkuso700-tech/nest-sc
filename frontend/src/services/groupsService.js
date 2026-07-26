import { apiRequest } from '../lib/apiClient.js'

export function getGroupsSidebar(params = {}) {
  const searchParams = new URLSearchParams()
  if (params.q) {
    searchParams.set('q', params.q)
  }
  if (params.limit) {
    searchParams.set('limit', params.limit)
  }
  const query = searchParams.toString()
  return apiRequest(`/groups/sidebar${query ? `?${query}` : ''}`)
}

export function createGroup(payload) {
  return apiRequest('/groups', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getGroupBySlug(slug) {
  return apiRequest(`/groups/slug/${slug}`)
}

export function updateGroup(groupId, payload) {
  return apiRequest(`/groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteGroup(groupId) {
  return apiRequest(`/groups/${groupId}`, {
    method: 'DELETE',
  })
}

export function getGroupMembers(groupId, params = {}) {
  const searchParams = new URLSearchParams()
  if (params.q) {
    searchParams.set('q', params.q)
  }
  if (params.limit) {
    searchParams.set('limit', params.limit)
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', params.offset)
  }
  if (params.cursor) {
    searchParams.set('cursor', params.cursor)
  }
  const query = searchParams.toString()
  return apiRequest(`/groups/${groupId}/members${query ? `?${query}` : ''}`)
}

export function getGroupsFeed(payload = {}, params = {}) {
  const searchParams = new URLSearchParams()
  if (params.limit) {
    searchParams.set('limit', params.limit)
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', params.offset)
  }
  const query = searchParams.toString()

  return apiRequest(`/groups/feed${query ? `?${query}` : ''}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateGroupMemberRole(groupId, userId, payload) {
  return apiRequest(`/groups/${groupId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function removeGroupMember(groupId, userId) {
  return apiRequest(`/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export function getGroupPosts(groupId, params = {}) {
  const searchParams = new URLSearchParams()
  if (params.limit) {
    searchParams.set('limit', params.limit)
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', params.offset)
  }
  const query = searchParams.toString()
  return apiRequest(`/groups/${groupId}/posts${query ? `?${query}` : ''}`)
}

export function createGroupPost(groupId, payload) {
  if (payload instanceof FormData) {
    return apiRequest(`/groups/${groupId}/posts`, {
      method: 'POST',
      body: payload,
    })
  }
  return apiRequest(`/groups/${groupId}/posts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getPendingGroupPosts(groupId) {
  return apiRequest(`/groups/${groupId}/pending-posts`)
}

export function approvePendingGroupPost(groupId, postId) {
  return apiRequest(`/groups/${groupId}/pending-posts/${postId}/approve`, {
    method: 'POST',
  })
}

export function rejectPendingGroupPost(groupId, postId) {
  return apiRequest(`/groups/${groupId}/pending-posts/${postId}/reject`, {
    method: 'POST',
  })
}

export function joinGroup(groupId) {
  return apiRequest(`/groups/${groupId}/join`, {
    method: 'POST',
  })
}

export function leaveGroup(groupId) {
  return apiRequest(`/groups/${groupId}/leave`, {
    method: 'POST',
  })
}

export function getJoinRequests(groupId) {
  return apiRequest(`/groups/${groupId}/join-requests`)
}

export function approveJoinRequest(groupId, userId) {
  return apiRequest(`/groups/${groupId}/join-requests/${userId}/approve`, {
    method: 'POST',
  })
}

export function rejectJoinRequest(groupId, userId) {
  return apiRequest(`/groups/${groupId}/join-requests/${userId}/reject`, {
    method: 'POST',
  })
}
