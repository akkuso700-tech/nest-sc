import { apiRequest } from '../lib/apiClient.js'
import type {
  AdminUserDetailResponse,
  AuditLog,
  Report,
  CreatorApplication,
  PayoutRequest,
  User,
  Post,
  Comment,
  ApiResponse,
  PaginatedResponse,
} from '../types'

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

export function getAdminOverview(params: Record<string, any> = {}): Promise<any> {
  return apiRequest(`/admin/overview${buildQuery(params)}`)
}

export function getAdminNotificationFeed(params: Record<string, any> = {}): Promise<any> {
  return apiRequest(`/admin/notifications/feed${buildQuery(params)}`)
}

export function getAdminPerformanceSummary(params: Record<string, any> = {}): Promise<any> {
  return apiRequest(`/performance/web-vitals/summary${buildQuery(params)}`)
}

export function getAdminAuditLogs(params: Record<string, any> = {}): Promise<PaginatedResponse<AuditLog>> {
  return apiRequest<PaginatedResponse<AuditLog>>(`/admin/audit-logs${buildQuery(params)}`)
}

export function getAdminUsers(params: Record<string, any> = {}): Promise<PaginatedResponse<User>> {
  return apiRequest<PaginatedResponse<User>>(`/admin/users${buildQuery(params)}`)
}

export function getAdminVerificationRequests(params: Record<string, any> = {}): Promise<PaginatedResponse<any>> {
  return apiRequest<PaginatedResponse<any>>(`/admin/verification-requests${buildQuery(params)}`)
}

export function getAdminVerificationRequest(requestId: string): Promise<any> {
  return apiRequest(`/admin/verification-requests/${requestId}`)
}

export function updateAdminVerificationRequestStatus(requestId: string, payload: { status: string; reason?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/verification-requests/${requestId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function revokeAdminUserVerification(userId: string, reason: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/users/${userId}/verification/revoke`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  })
}

export function getAdminUsersSummary(params: Record<string, any> = {}): Promise<any> {
  return apiRequest(`/admin/users/summary${buildQuery(params)}`)
}

export function getAdminContentSummary(params: Record<string, any> = {}): Promise<any> {
  return apiRequest(`/admin/content/summary${buildQuery(params)}`)
}

export function getAdminUserDetail(userId: string): Promise<AdminUserDetailResponse> {
  return apiRequest<AdminUserDetailResponse>(`/admin/users/${userId}`)
}

export function updateAdminUserRole(userId: string, role: string): Promise<{ user: User }> {
  return apiRequest<{ user: User }>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function updateAdminUserStatus(userId: string, payload: { accountStatus: string; reason?: string }): Promise<{ user: User; message?: string }> {
  return apiRequest<{ user: User; message?: string }>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function bulkUpdateAdminUserStatus(payload: { userIds: string[]; accountStatus: string; reason?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/admin/users/bulk-status', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function bulkDeleteAdminUsers(payload: { userIds: string[]; reason?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/admin/users/bulk-delete', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getAdminContent(params: Record<string, any> = {}): Promise<PaginatedResponse<Post>> {
  return apiRequest<PaginatedResponse<Post>>(`/admin/content${buildQuery(params)}`)
}

export function updateAdminPostModeration(postId: string, payload: Record<string, any>): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/content/${postId}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function bulkUpdateAdminPostModeration(payload: { postIds: string[]; action: string; reason?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/admin/content/bulk-moderation', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getAdminComments(params: Record<string, any> = {}): Promise<PaginatedResponse<Comment>> {
  return apiRequest<PaginatedResponse<Comment>>(`/admin/comments${buildQuery(params)}`)
}

export function updateAdminCommentModeration(commentId: string, payload: Record<string, any>): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/comments/${commentId}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getAdminReports(params: Record<string, any> = {}): Promise<PaginatedResponse<Report>> {
  return apiRequest<PaginatedResponse<Report>>(`/admin/reports${buildQuery(params)}`)
}

export function updateAdminReportStatus(reportId: string, payload: { status: string; actionTaken?: string; resolutionNotes?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/reports/${reportId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getAdminSignupNotificationSettings(): Promise<any> {
  return apiRequest('/admin/settings/signup-notifications')
}

export function updateAdminSignupNotificationSettings(emails: string[] = []): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/admin/settings/signup-notifications', {
    method: 'PATCH',
    body: JSON.stringify({ emails }),
  })
}

export function getAdminSignupContractsSettings(): Promise<any> {
  return apiRequest('/admin/settings/contracts')
}

export function updateAdminSignupContractsSettings(contracts: Record<string, any> = {}): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/admin/settings/contracts', {
    method: 'PATCH',
    body: JSON.stringify({ contracts }),
  })
}

export function deleteAdminConversation(conversationId: string, reason = ''): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/conversations/${conversationId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  })
}

export function deleteAdminMessage(messageId: string, reason = ''): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/messages/${messageId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  })
}

export function getAdminMonetizationSummary(): Promise<any> {
  return apiRequest('/admin/creators/summary')
}

export function getAdminCreatorApplications(params: Record<string, any> = {}): Promise<PaginatedResponse<CreatorApplication>> {
  return apiRequest<PaginatedResponse<CreatorApplication>>(`/admin/creators/applications${buildQuery(params)}`)
}

export function updateAdminCreatorApplicationStatus(applicationId: string, payload: { status: string; notes?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/creators/applications/${applicationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getAdminPayoutRequests(params: Record<string, any> = {}): Promise<PaginatedResponse<PayoutRequest>> {
  return apiRequest<PaginatedResponse<PayoutRequest>>(`/admin/creators/payouts${buildQuery(params)}`)
}

export function updateAdminPayoutRequestStatus(payoutId: string, payload: { status: string; notes?: string }): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/creators/payouts/${payoutId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getAdminCreators(params: Record<string, any> = {}): Promise<any> {
  return apiRequest(`/admin/creators/users${buildQuery(params)}`)
}

export function updateAdminCreatorWalletStatus(userId: string, payload: Record<string, any>): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/admin/creators/users/${userId}/wallet-status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getAdminShadowChats(params: Record<string, any> = {}): Promise<any> {
  return apiRequest(`/admin/shadow/chats${buildQuery(params)}`)
}

export function getAdminShadowMessages(chatKey: string): Promise<any> {
  return apiRequest(`/admin/shadow/chats/${chatKey}/messages`)
}

export function getAdminShadowCalls(params: Record<string, any> = {}): Promise<any> {
  return apiRequest(`/admin/shadow/calls${buildQuery(params)}`)
}

export function getAdminShadowMedia(params: Record<string, any> = {}): Promise<any> {
  return apiRequest(`/admin/shadow/media${buildQuery(params)}`)
}

export function getAdminUnmaskedUser(anonymousId: string): Promise<any> {
  return apiRequest(`/admin/shadow/unmask/${anonymousId}`)
}

