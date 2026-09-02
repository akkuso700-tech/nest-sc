import { apiBaseUrl, apiRequest } from '../lib/apiClient.js'

export function getConversations(limit = 30) {
  return apiRequest(`/messages/conversations?limit=${limit}`)
}

export function getConversationMessages(conversationId, limit = 50, before = null) {
  let url = `/messages/conversations/${conversationId}?limit=${limit}`
  if (before) {
    url += `&before=${encodeURIComponent(before)}`
  }
  return apiRequest(url)
}

export function sendMessage(payload, onProgress) {
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

export function toggleMessageReaction(messageId, emoji) {
  return apiRequest(`/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  })
}
