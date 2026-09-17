import { apiRequest } from '../lib/apiClient.js'
import type { User, Post, Group, ApiResponse } from '../types'

function buildQuery(params: Record<string, any> = {}): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || typeof value === 'undefined') {
      return
    }

    searchParams.set(key, String(value))
  })

  return searchParams.toString() ? `?${searchParams.toString()}` : ''
}

export interface SearchSuggestions {
  users?: User[]
  tags?: Array<{ tag: string; count?: number }>
  queries?: string[]
}

export interface SearchResults {
  users?: User[]
  posts?: Post[]
  groups?: Group[]
  tags?: Array<{ tag: string; count?: number }>
  total?: number
}

export function getSearchSuggestions(params: Record<string, any> = {}): Promise<SearchSuggestions> {
  return apiRequest<SearchSuggestions>(`/search/suggest${buildQuery(params)}`)
}

export function getSearchResults(params: Record<string, any> = {}): Promise<SearchResults> {
  return apiRequest<SearchResults>(`/search/results${buildQuery(params)}`)
}

export function getSearchHistory(): Promise<string[]> {
  return apiRequest<string[]>('/search/history')
}

export function saveSearchHistory(query: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/search/history', {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}

export function deleteSearchHistory(query = ''): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/search/history${buildQuery(query ? { q: query } : {})}`, {
    method: 'DELETE',
  })
}
