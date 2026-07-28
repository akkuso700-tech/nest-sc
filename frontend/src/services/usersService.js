import { apiRequest } from '../lib/apiClient.js'

export function getMyProfile() {
  return apiRequest('/users/me/profile')
}

export function getMyVerificationRequest() {
  return apiRequest('/users/me/verification-request')
}

export function createMyVerificationRequest(payload) {
  return apiRequest('/users/me/verification-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateMyVerificationRequest(payload) {
  return apiRequest('/users/me/verification-request', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function withdrawMyVerificationRequest() {
  return apiRequest('/users/me/verification-request', { method: 'DELETE' })
}

export function checkUsernameAvailability(username) {
  const searchParams = new URLSearchParams({ username })
  return apiRequest(`/users/username-availability?${searchParams.toString()}`)
}

export function searchUsers(query = '', limit = 6) {
  const searchParams = new URLSearchParams()

  if (query) {
    searchParams.set('q', query)
  }

  searchParams.set('limit', String(limit))

  return apiRequest(`/users/search?${searchParams.toString()}`)
}

export function getDiscoverySuggestions(params = {}) {
  const searchParams = new URLSearchParams()

  if (params.mode) {
    searchParams.set('mode', params.mode)
  }

  if (typeof params.limit === 'number') {
    searchParams.set('limit', String(params.limit))
  }

  if (params.refresh) {
    searchParams.set('refresh', 'true')
  }

  return apiRequest(`/users/discovery/suggestions?${searchParams.toString()}`)
}

export function updateDiscoveryLocation(payload) {
  return apiRequest('/users/discovery/location', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getProfileByUsername(username) {
  return apiRequest(`/users/profile/${username}`)
}

export function toggleFollowByUsername(username) {
  return apiRequest(`/users/profile/${username}/follow`, {
    method: 'POST',
  })
}

export function getMyConnections(connectionType) {
  return apiRequest(`/users/me/${connectionType}`)
}

export function getProfileConnections(username, connectionType) {
  return apiRequest(`/users/profile/${username}/${connectionType}`)
}

export function updateMyProfile(payload) {
  return apiRequest('/users/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function changeMyPassword(payload) {
  return apiRequest('/users/me/password', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteMyAccount(payload) {
  return apiRequest('/users/me', {
    method: 'DELETE',
    body: JSON.stringify(payload),
  })
}
