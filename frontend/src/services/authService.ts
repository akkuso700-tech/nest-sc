import { apiRequest } from '../lib/apiClient.js'
import type { ApiResponse } from '../types'

const authConfig = { skipRefreshRetry: true }

export interface CheckIdentifierResponse {
  exists: boolean
  hasPassword?: boolean
  authMethod?: string
  maskedEmail?: string
}

export interface SignupContractsResponse {
  privacyPolicy: string
  termsOfService: string
  kvkkConsent: string
  version: string
}

export function checkLoginIdentifier(emailOrUsername: string): Promise<CheckIdentifierResponse> {
  return apiRequest<CheckIdentifierResponse>(
    '/auth/login/check-identifier',
    {
      method: 'POST',
      body: JSON.stringify({ emailOrUsername }),
    },
    authConfig
  )
}

export function requestPasswordReset(email: string, language?: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(
    '/auth/password-reset/request',
    {
      method: 'POST',
      body: JSON.stringify({ email, language }),
    },
    authConfig
  )
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(
    '/auth/password-reset/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    },
    authConfig
  )
}

export function getSignupContracts(lang = 'tr'): Promise<SignupContractsResponse> {
  return apiRequest<SignupContractsResponse>(
    `/auth/signup-contracts?lang=${encodeURIComponent(lang)}`,
    {},
    authConfig
  )
}

export function checkEmailAvailability(email: string): Promise<{ available: boolean }> {
  return apiRequest<{ available: boolean }>(
    '/auth/register/check-email',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
    authConfig
  )
}

export function requestSignUpCode(email: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(
    '/auth/register/request-code',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
    authConfig
  )
}

export function verifySignUpCode(email: string, code: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(
    '/auth/register/verify-code',
    {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    },
    authConfig
  )
}
