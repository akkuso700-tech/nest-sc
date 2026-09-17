import { apiRequest } from '../lib/apiClient.js'
import type { NotificationItem, ApiResponse } from '../types'

export interface GetNotificationsParams {
  unreadOnly?: boolean
  limit?: number
}

export interface NotificationsResponse {
  notifications: NotificationItem[]
  unreadCount: number
}

export function getNotifications({ unreadOnly = false, limit = 40 }: GetNotificationsParams = {}): Promise<NotificationsResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('limit', String(limit))
  if (unreadOnly) {
    searchParams.set('unreadOnly', 'true')
  }

  return apiRequest<NotificationsResponse>(`/notifications?${searchParams.toString()}`)
}

export function markNotificationRead(notificationId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  })
}

export function markAllNotificationsRead(): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/notifications/read-all', {
    method: 'PATCH',
  })
}

export function deleteNotification(notificationId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/notifications/${notificationId}`, {
    method: 'DELETE',
  })
}
