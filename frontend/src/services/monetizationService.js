import { apiRequest } from '../lib/apiClient.js'

export function getMonetizationStatus() {
  return apiRequest('/monetization/status')
}

export function applyForMonetization(payload = {}) {
  return apiRequest('/monetization/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getCreatorDashboard() {
  return apiRequest('/monetization/dashboard')
}

export function requestPayout(payload) {
  return apiRequest('/monetization/payout-request', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function savePayoutAccount(payload) {
  return apiRequest('/monetization/payout-account', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function simulateEarning(payload) {
  return apiRequest('/monetization/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
