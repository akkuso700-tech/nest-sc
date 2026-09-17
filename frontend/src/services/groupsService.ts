import { apiRequest } from '../lib/apiClient.js'
import type { Group, GroupMember, Post, ApiResponse, PaginatedResponse } from '../types'

export interface GroupsSidebarResponse {
  myGroups: Group[]
  suggestedGroups: Group[]
}

export function getGroupsSidebar(params: { q?: string; limit?: number } = {}): Promise<GroupsSidebarResponse> {
  const searchParams = new URLSearchParams()
  if (params.q) {
    searchParams.set('q', params.q)
  }
  if (params.limit) {
    searchParams.set('limit', String(params.limit))
  }
  const query = searchParams.toString()
  return apiRequest<GroupsSidebarResponse>(`/groups/sidebar${query ? `?${query}` : ''}`)
}

export function createGroup(payload: Partial<Group>): Promise<{ group: Group }> {
  return apiRequest<{ group: Group }>('/groups', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getGroupBySlug(slug: string): Promise<{ group: Group }> {
  return apiRequest<{ group: Group }>(`/groups/slug/${slug}`)
}

export function updateGroup(groupId: string, payload: Partial<Group>): Promise<{ group: Group }> {
  return apiRequest<{ group: Group }>(`/groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteGroup(groupId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/groups/${groupId}`, {
    method: 'DELETE',
  })
}

export function getGroupMembers(
  groupId: string,
  params: { q?: string; limit?: number; offset?: number; cursor?: string } = {}
): Promise<{ members: GroupMember[]; total?: number }> {
  const searchParams = new URLSearchParams()
  if (params.q) {
    searchParams.set('q', params.q)
  }
  if (params.limit) {
    searchParams.set('limit', String(params.limit))
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', String(params.offset))
  }
  if (params.cursor) {
    searchParams.set('cursor', params.cursor)
  }
  const query = searchParams.toString()
  return apiRequest<{ members: GroupMember[]; total?: number }>(`/groups/${groupId}/members${query ? `?${query}` : ''}`)
}

export function getGroupsFeed(
  payload: Record<string, any> = {},
  params: { limit?: number; offset?: number } = {}
): Promise<PaginatedResponse<Post>> {
  const searchParams = new URLSearchParams()
  if (params.limit) {
    searchParams.set('limit', String(params.limit))
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', String(params.offset))
  }
  const query = searchParams.toString()

  return apiRequest<PaginatedResponse<Post>>(`/groups/feed${query ? `?${query}` : ''}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateGroupMemberRole(groupId: string, userId: string, payload: { role: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/groups/${groupId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function removeGroupMember(groupId: string, userId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export function getGroupPosts(groupId: string, params: { limit?: number; offset?: number } = {}): Promise<{ posts: Post[] }> {
  const searchParams = new URLSearchParams()
  if (params.limit) {
    searchParams.set('limit', String(params.limit))
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', String(params.offset))
  }
  const query = searchParams.toString()
  return apiRequest<{ posts: Post[] }>(`/groups/${groupId}/posts${query ? `?${query}` : ''}`)
}

export function createGroupPost(groupId: string, payload: FormData | Record<string, any>): Promise<{ post: Post }> {
  if (payload instanceof FormData) {
    return apiRequest<{ post: Post }>(`/groups/${groupId}/posts`, {
      method: 'POST',
      body: payload,
    })
  }
  return apiRequest<{ post: Post }>(`/groups/${groupId}/posts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getPendingGroupPosts(groupId: string): Promise<{ posts: Post[] }> {
  return apiRequest<{ posts: Post[] }>(`/groups/${groupId}/pending-posts`)
}

export function approvePendingGroupPost(groupId: string, postId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/groups/${groupId}/pending-posts/${postId}/approve`, {
    method: 'POST',
  })
}

export function rejectPendingGroupPost(groupId: string, postId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/groups/${groupId}/pending-posts/${postId}/reject`, {
    method: 'POST',
  })
}

export function joinGroup(groupId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/groups/${groupId}/join`, {
    method: 'POST',
  })
}

export function leaveGroup(groupId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/groups/${groupId}/leave`, {
    method: 'POST',
  })
}

export function getJoinRequests(groupId: string): Promise<any> {
  return apiRequest(`/groups/${groupId}/join-requests`)
}

export function approveJoinRequest(groupId: string, userId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/groups/${groupId}/join-requests/${userId}/approve`, {
    method: 'POST',
  })
}

export function rejectJoinRequest(groupId: string, userId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/groups/${groupId}/join-requests/${userId}/reject`, {
    method: 'POST',
  })
}
