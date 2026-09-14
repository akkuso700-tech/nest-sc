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

export async function getLocationsAutocomplete(params = {}, options = {}) {
  const queryString = buildQuery({
    q: params.q,
    limit: params.limit,
    lang: params.lang,
  })

  return apiRequest(`/locations/autocomplete${queryString}`, {
    method: 'GET',
    signal: options.signal,
  })
}
