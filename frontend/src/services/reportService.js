import { apiRequest } from '../lib/apiClient.js'

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || typeof value === 'undefined') {
      return
    }

    searchParams.set(key, value)
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function createReport(payload) {
  return apiRequest('/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getMyReports(params = {}) {
  return apiRequest(`/reports/mine${buildQuery(params)}`)
}
