import { apiRequest } from '../lib/apiClient.js'
import type { StoryGroup, StoryItem, User, Comment, ApiResponse } from '../types'

export interface GetStoryRailsParams {
  limit?: number
}

export function getStoryRails(params: GetStoryRailsParams = {}): Promise<StoryGroup[]> {
  const searchParams = new URLSearchParams()

  if (params.limit) {
    searchParams.set('limit', String(params.limit))
  }

  const query = searchParams.toString()
  return apiRequest<StoryGroup[]>(`/stories/rails${query ? `?${query}` : ''}`)
}

export function getStoriesByUsername(username: string): Promise<StoryGroup> {
  return apiRequest<StoryGroup>(`/stories/user/${encodeURIComponent(username)}`)
}

export function createStory(payload: FormData | Record<string, any>): Promise<StoryItem> {
  if (payload instanceof FormData) {
    return apiRequest<StoryItem>('/stories', {
      method: 'POST',
      body: payload,
    })
  }

  return apiRequest<StoryItem>('/stories', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function registerStoryView(storyId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/stories/${storyId}/view`, {
    method: 'POST',
  })
}

export function getStoryViewers(storyId: string, params: { limit?: number; offset?: number } = {}): Promise<{ viewers: User[]; total: number }> {
  const searchParams = new URLSearchParams()
  if (params.limit) {
    searchParams.set('limit', String(params.limit))
  }
  if (typeof params.offset === 'number') {
    searchParams.set('offset', String(params.offset))
  }
  const query = searchParams.toString()
  return apiRequest<{ viewers: User[]; total: number }>(`/stories/${storyId}/viewers${query ? `?${query}` : ''}`)
}

export function toggleStoryLike(storyId: string): Promise<{ liked: boolean; likesCount: number }> {
  return apiRequest<{ liked: boolean; likesCount: number }>(`/posts/${storyId}/like`, {
    method: 'POST',
  })
}

export function toggleStorySave(storyId: string): Promise<{ saved: boolean }> {
  return apiRequest<{ saved: boolean }>(`/posts/${storyId}/save`, {
    method: 'POST',
  })
}

export function toggleStoryShare(storyId: string): Promise<{ shared: boolean; sharesCount: number }> {
  return apiRequest<{ shared: boolean; sharesCount: number }>(`/posts/${storyId}/share`, {
    method: 'POST',
  })
}

export function createStoryReply(storyId: string, payload: { text: string }): Promise<Comment> {
  return apiRequest<Comment>(`/posts/${storyId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getStoryDetail(storyId: string): Promise<any> {
  return apiRequest(`/posts/${storyId}`)
}

export function deleteStory(storyId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/stories/${storyId}`, {
    method: 'DELETE',
  })
}
