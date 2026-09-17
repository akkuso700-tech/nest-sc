import { apiRequest } from '../lib/apiClient.js'
import type { ApiResponse } from '../types'

export interface MonetizationStatus {
  isEligible?: boolean
  isMonetized?: boolean
  status?: 'none' | 'pending' | 'approved' | 'rejected'
  followersCount?: number
  requiredFollowers?: number
  viewsCount?: number
  requiredViews?: number
  earningsTotal?: number
  pendingPayout?: number
  payoutAccount?: {
    iban?: string
    accountHolder?: string
    bankName?: string
  }
}

export function getMonetizationStatus(): Promise<MonetizationStatus> {
  return apiRequest<MonetizationStatus>('/monetization/status')
}

export function applyForMonetization(payload: Record<string, any> = {}): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/monetization/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getCreatorDashboard(): Promise<any> {
  return apiRequest('/monetization/dashboard')
}

export function requestPayout(payload: { amount: number; method?: string; notes?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/monetization/payout-request', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function savePayoutAccount(payload: { iban: string; accountHolder: string; bankName?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/monetization/payout-account', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function simulateEarning(payload: Record<string, any>): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/monetization/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
