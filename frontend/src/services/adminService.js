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

export function getAdminOverview() {
  return apiRequest('/admin/overview')
}

export function getAdminPerformanceSummary(params = {}) {
  return apiRequest(`/performance/web-vitals/summary${buildQuery(params)}`)
}

export function getAdminAuditLogs(params = {}) {
  return apiRequest(`/admin/audit-logs${buildQuery(params)}`)
}

export function getAdminUsers(params = {}) {
  return apiRequest(`/admin/users${buildQuery(params)}`)
}

export function getAdminUsersSummary(params = {}) {
  return apiRequest(`/admin/users/summary${buildQuery(params)}`)
}

export function getAdminContentSummary(params = {}) {
  return apiRequest(`/admin/content/summary${buildQuery(params)}`)
}

export function getAdminUserDetail(userId) {
  return apiRequest(`/admin/users/${userId}`)
}

export function updateAdminUserRole(userId, role) {
  return apiRequest(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function updateAdminUserStatus(userId, payload) {
  return apiRequest(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function bulkUpdateAdminUserStatus(payload) {
  return apiRequest('/admin/users/bulk-status', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function bulkDeleteAdminUsers(payload) {
  return apiRequest('/admin/users/bulk-delete', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getAdminContent(params = {}) {
  return apiRequest(`/admin/content${buildQuery(params)}`)
}

export function updateAdminPostModeration(postId, payload) {
  return apiRequest(`/admin/content/${postId}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function bulkUpdateAdminPostModeration(payload) {
  return apiRequest('/admin/content/bulk-moderation', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getAdminComments(params = {}) {
  return apiRequest(`/admin/comments${buildQuery(params)}`)
}

export function updateAdminCommentModeration(commentId, payload) {
  return apiRequest(`/admin/comments/${commentId}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getAdminReports(params = {}) {
  return apiRequest(`/admin/reports${buildQuery(params)}`)
}

export function updateAdminReportStatus(reportId, payload) {
  return apiRequest(`/admin/reports/${reportId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getAdminSignupNotificationSettings() {
  return apiRequest('/admin/settings/signup-notifications')
}

export function updateAdminSignupNotificationSettings(emails = []) {
  return apiRequest('/admin/settings/signup-notifications', {
    method: 'PATCH',
    body: JSON.stringify({ emails }),
  })
}

export function getAdminSignupContractsSettings() {
  return apiRequest('/admin/settings/contracts')
}

export function updateAdminSignupContractsSettings(contracts = {}) {
  return apiRequest('/admin/settings/contracts', {
    method: 'PATCH',
    body: JSON.stringify({ contracts }),
  })
}
