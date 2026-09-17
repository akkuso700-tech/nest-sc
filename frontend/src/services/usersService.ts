import { apiRequest } from '../lib/apiClient.js'
import type { User, UserProfile, ApiResponse } from '../types'

export function getMyProfile(): Promise<{ user: User }> {
  return apiRequest<{ user: User }>('/users/me/profile')
}

export function getMyVerificationRequest(): Promise<any> {
  return apiRequest('/users/me/verification-request')
}

export function createMyVerificationRequest(payload: Record<string, any>): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/users/me/verification-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateMyVerificationRequest(payload: Record<string, any>): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/users/me/verification-request', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function withdrawMyVerificationRequest(): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/users/me/verification-request', { method: 'DELETE' })
}

export function changeMySubscriptionPlan(payload: { plan: string; billingCycle?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/users/me/subscription/change-plan', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function cancelMySubscription(payload: Record<string, any> = {}): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/users/me/subscription/cancel', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
  const searchParams = new URLSearchParams({ username })
  return apiRequest<{ available: boolean }>(`/users/username-availability?${searchParams.toString()}`)
}

export function searchUsers(query = '', limit = 6): Promise<{ users: User[] }> {
  const searchParams = new URLSearchParams()

  if (query) {
    searchParams.set('q', query)
  }

  searchParams.set('limit', String(limit))

  return apiRequest<{ users: User[] }>(`/users/search?${searchParams.toString()}`)
}

export interface DiscoverySuggestionsParams {
  mode?: string
  limit?: number
  refresh?: boolean
}

export function getDiscoverySuggestions(params: DiscoverySuggestionsParams = {}): Promise<{ suggestions: User[] }> {
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

  return apiRequest<{ suggestions: User[] }>(`/users/discovery/suggestions?${searchParams.toString()}`)
}

export function updateDiscoveryLocation(payload: { latitude: number; longitude: number; city?: string; country?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/users/discovery/location', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getProfileByUsername(username: string): Promise<{ profile: UserProfile }> {
  return apiRequest<{ profile: UserProfile }>(`/users/profile/${username}`)
}

export function toggleFollowByUsername(username: string): Promise<{ isFollowing: boolean; followersCount: number }> {
  return apiRequest<{ isFollowing: boolean; followersCount: number }>(`/users/profile/${username}/follow`, {
    method: 'POST',
  })
}

export function getMyConnections(connectionType: 'followers' | 'following' | 'blocks'): Promise<{ users: User[] }> {
  return apiRequest<{ users: User[] }>(`/users/me/${connectionType}`)
}

export function getProfileConnections(username: string, connectionType: 'followers' | 'following'): Promise<{ users: User[] }> {
  return apiRequest<{ users: User[] }>(`/users/profile/${username}/${connectionType}`)
}

export function updateMyProfile(payload: Partial<User>): Promise<{ user: User }> {
  return apiRequest<{ user: User }>('/users/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function changeMyPassword(payload: { currentPassword?: string; newPassword?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/users/me/password', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteMyAccount(payload: { password?: string; reason?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/users/me', {
    method: 'DELETE',
    body: JSON.stringify(payload),
  })
}
