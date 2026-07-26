import { apiRequest } from '../lib/apiClient.js'

export function getConversations(limit = 30) {
  return apiRequest(`/messages/conversations?limit=${limit}`)
}

export function getConversationMessages(conversationId, limit = 50) {
  return apiRequest(`/messages/conversations/${conversationId}?limit=${limit}`)
}

export function sendMessage(payload) {
  if (payload instanceof FormData) {
    return apiRequest('/messages', {
      method: 'POST',
      body: payload,
    })
  }

  return apiRequest('/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function markConversationRead(conversationId) {
  return apiRequest(`/messages/conversations/${conversationId}/read`, {
    method: 'POST',
  })
}

export function hideConversation(conversationId) {
  return apiRequest(`/messages/conversations/${conversationId}/hide`, {
    method: 'POST',
  })
}

export function blockConversation(conversationId) {
  return apiRequest(`/messages/conversations/${conversationId}/block`, {
    method: 'POST',
  })
}

export function updateMessage(messageId, payload) {
  return apiRequest(`/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteMessage(messageId) {
  return apiRequest(`/messages/${messageId}`, {
    method: 'DELETE',
  })
}
