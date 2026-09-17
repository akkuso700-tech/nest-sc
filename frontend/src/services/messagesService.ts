import { apiBaseUrl, apiRequest } from '../lib/apiClient.js'
import type { Conversation, Message, ApiResponse } from '../types'

export interface GetConversationsResponse {
  conversations: Conversation[]
  unreadTotal?: number
}

export interface GetConversationMessagesResponse {
  messages: Message[]
  conversation?: Conversation
  hasMore?: boolean
}

export function getConversations(limit = 30): Promise<GetConversationsResponse> {
  return apiRequest<GetConversationsResponse>(`/messages/conversations?limit=${limit}`)
}

export function getConversationMessages(
  conversationId: string,
  limit = 50,
  before: string | null = null
): Promise<GetConversationMessagesResponse> {
  let url = `/messages/conversations/${conversationId}?limit=${limit}`
  if (before) {
    url += `&before=${encodeURIComponent(before)}`
  }
  return apiRequest<GetConversationMessagesResponse>(url)
}

export function sendMessage(
  payload: FormData | Record<string, any>,
  onProgress?: (percent: number) => void
): Promise<{ message: Message; conversation?: Conversation }> {
  if (payload instanceof FormData) {
    if (typeof onProgress === 'function') {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${apiBaseUrl}/messages`)
        xhr.withCredentials = true
        xhr.setRequestHeader('Accept', 'application/json')

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100)
            onProgress(percent)
          }
        }

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data)
            } else {
              reject(new Error(data?.message || 'Mesaj gönderilemedi.'))
            }
          } catch {
            reject(new Error('Sunucu yanıtı okunamadı.'))
          }
        }

        xhr.onerror = () => {
          reject(new Error('Ağ hatası oluştu.'))
        }

        xhr.send(payload)
      })
    }

    return apiRequest<{ message: Message; conversation?: Conversation }>('/messages', {
      method: 'POST',
      body: payload,
    })
  }

  return apiRequest<{ message: Message; conversation?: Conversation }>('/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function markConversationRead(conversationId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/messages/conversations/${conversationId}/read`, {
    method: 'POST',
  })
}

export function hideConversation(conversationId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/messages/conversations/${conversationId}/hide`, {
    method: 'POST',
  })
}

export function blockConversation(conversationId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/messages/conversations/${conversationId}/block`, {
    method: 'POST',
  })
}

export function updateMessage(messageId: string, payload: { text: string }): Promise<{ message: Message }> {
  return apiRequest<{ message: Message }>(`/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteMessage(messageId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/messages/${messageId}`, {
    method: 'DELETE',
  })
}

export function toggleMessageReaction(messageId: string, emoji: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  })
}
