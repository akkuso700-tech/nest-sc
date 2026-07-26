import { apiRequest } from '../lib/apiClient.js'

export function getNotifications({ unreadOnly = false, limit = 40 } = {}) {
  const searchParams = new URLSearchParams()
  searchParams.set('limit', String(limit))
  if (unreadOnly) {
    searchParams.set('unreadOnly', 'true')
  }

  return apiRequest(`/notifications?${searchParams.toString()}`)
}

export function markNotificationRead(notificationId) {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  })
}

export function markAllNotificationsRead() {
  return apiRequest('/notifications/read-all', {
    method: 'PATCH',
  })
}
