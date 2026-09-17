import { apiRequest } from '../lib/apiClient.js'
import type { Report, ApiResponse, PaginatedResponse } from '../types'

export interface CreateReportPayload {
  targetType: 'post' | 'comment' | 'user' | 'message' | 'group'
  targetId: string
  reason: string
  notes?: string
}

function buildQuery(params: Record<string, any> = {}): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || typeof value === 'undefined') {
      return
    }

    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function createReport(payload: CreateReportPayload): Promise<ApiResponse<Report>> {
  return apiRequest<ApiResponse<Report>>('/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getMyReports(params: Record<string, any> = {}): Promise<PaginatedResponse<Report>> {
  return apiRequest<PaginatedResponse<Report>>(`/reports/mine${buildQuery(params)}`)
}
