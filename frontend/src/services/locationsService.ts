import { apiRequest } from '../lib/apiClient.js'

export interface LocationSuggestion {
  city: string
  country: string
  latitude?: number
  longitude?: number
  label?: string
}

export interface LocationAutocompleteParams {
  q?: string
  limit?: number
  lang?: string
}

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

export async function getLocationsAutocomplete(
  params: LocationAutocompleteParams = {},
  options: { signal?: AbortSignal } = {}
): Promise<LocationSuggestion[]> {
  const queryString = buildQuery({
    q: params.q,
    limit: params.limit,
    lang: params.lang,
  })

  return apiRequest<LocationSuggestion[]>(`/locations/autocomplete${queryString}`, {
    method: 'GET',
    signal: options.signal,
  })
}
