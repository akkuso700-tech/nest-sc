import { apiRequest } from '../lib/apiClient.js'

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || typeof value === 'undefined') {
      return
    }

    searchParams.set(key, value)
  })

  return searchParams.toString() ? `?${searchParams.toString()}` : ''
}

export function getSearchSuggestions(params = {}) {
  return apiRequest(`/search/suggest${buildQuery(params)}`)
}

export function getSearchResults(params = {}) {
  return apiRequest(`/search/results${buildQuery(params)}`)
}

export function getSearchHistory() {
  return apiRequest('/search/history')
}

export function saveSearchHistory(query) {
  return apiRequest('/search/history', {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}

export function deleteSearchHistory(query = '') {
  return apiRequest(`/search/history${buildQuery(query ? { q: query } : {})}`, {
    method: 'DELETE',
  })
}
