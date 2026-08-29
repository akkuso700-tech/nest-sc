import { apiRequest } from '../lib/apiClient.js'

const authConfig = { skipRefreshRetry: true }

export function checkLoginIdentifier(emailOrUsername) {
  return apiRequest('/auth/login/check-identifier', {
    method: 'POST',
    body: JSON.stringify({ emailOrUsername }),
  }, authConfig)
}

export function requestPasswordReset(email, language) {
  return apiRequest('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email, language }),
  }, authConfig)
}

export function confirmPasswordReset(token, newPassword) {
  return apiRequest('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  }, authConfig)
}

export function getSignupContracts(lang = 'tr') {
  return apiRequest(
    `/auth/signup-contracts?lang=${encodeURIComponent(lang)}`,
    {},
    authConfig,
  )
}

export function checkEmailAvailability(email) {
  return apiRequest('/auth/register/check-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, authConfig)
}

export function requestSignUpCode(email) {
  return apiRequest('/auth/register/request-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, authConfig)
}

export function verifySignUpCode(email, code) {
  return apiRequest('/auth/register/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  }, authConfig)
}
