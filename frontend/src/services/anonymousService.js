import { apiRequest } from '../lib/apiClient.js'

export const ANONYMOUS_AVATARS = [
  { key: 'avatar-1', label: 'Neon Tilki', emoji: '🦊', bgStyle: 'linear-gradient(135deg, #f97316, #f59e0b)' },
  { key: 'avatar-2', label: 'Siber Maske', emoji: '🎭', bgStyle: 'linear-gradient(135deg, #9333ea, #4f46e5)' },
  { key: 'avatar-3', label: 'Gece Baykuşu', emoji: '🦉', bgStyle: 'linear-gradient(135deg, #2563eb, #06b6d4)' },
  { key: 'avatar-4', label: 'Gölge Ninja', emoji: '🥷', bgStyle: 'linear-gradient(135deg, #374151, #18181b)' },
  { key: 'avatar-5', label: 'Siber Kedi', emoji: '🐱', bgStyle: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
  { key: 'avatar-6', label: 'Kozmik Panda', emoji: '🐼', bgStyle: 'linear-gradient(135deg, #10b981, #0f766e)' },
  { key: 'avatar-7', label: 'Alfa Kurt', emoji: '🐺', bgStyle: 'linear-gradient(135deg, #475569, #3730a3)' },
  { key: 'avatar-8', label: 'Galaksi Yolcusu', emoji: '🚀', bgStyle: 'linear-gradient(135deg, #7c3aed, #c026d3)' },
  { key: 'avatar-9', label: 'Sayborg', emoji: '🤖', bgStyle: 'linear-gradient(135deg, #06b6d4, #2563eb)' },
  { key: 'avatar-10', label: 'Neon Aslan', emoji: '🦁', bgStyle: 'linear-gradient(135deg, #eab308, #ea580c)' },
  { key: 'avatar-11', label: 'Kutup Ayısı', emoji: '🐻‍❄️', bgStyle: 'linear-gradient(135deg, #38bdf8, #2563eb)' },
  { key: 'avatar-12', label: 'Retro Canavar', emoji: '👾', bgStyle: 'linear-gradient(135deg, #84cc16, #059669)' },
]

export function getAvatarByKey(key) {
  return ANONYMOUS_AVATARS.find((a) => a.key === key) || ANONYMOUS_AVATARS[0]
}

export async function getAnonymousProfile() {
  const res = await apiRequest('/anonymous/profile')
  return res.profile
}

export async function updateAnonymousProfile(data) {
  const res = await apiRequest('/anonymous/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.profile
}

export async function randomizeAlias() {
  const res = await apiRequest('/anonymous/profile/randomize', {
    method: 'POST',
  })
  return res.profile
}

export async function getLoungeSummary() {
  const res = await apiRequest('/anonymous/summary')
  return res.summary
}

export async function getAnonymousRooms() {
  const res = await apiRequest('/anonymous/rooms')
  return res.rooms
}

export async function createAnonymousRoom({ name, topic, icon, color, isPrivate = false }) {
  const res = await apiRequest('/anonymous/rooms', {
    method: 'POST',
    body: JSON.stringify({ name, topic, icon, color, isPrivate }),
  })
  return res.room
}

export async function joinPrivateAnonymousRoom(accessCode) {
  const res = await apiRequest('/anonymous/rooms/join-private', {
    method: 'POST',
    body: JSON.stringify({ accessCode }),
  })
  return res.room
}

export async function getRoomMessages(roomId, limit = 50) {
  const res = await apiRequest(`/anonymous/rooms/${roomId}/messages?limit=${limit}`)
  return res.messages
}

export async function sendRoomMessage(roomId, text) {
  const res = await apiRequest(`/anonymous/rooms/${roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  return res.message
}

export async function deleteAnonymousRoom(roomId) {
  return apiRequest(`/anonymous/rooms/${roomId}`, {
    method: 'DELETE',
  })
}

export async function deleteRoomMessage(messageId) {
  return apiRequest(`/anonymous/messages/${messageId}`, {
    method: 'DELETE',
  })
}

export async function blockAnonymousUser(targetAnonymousId) {
  return apiRequest('/anonymous/block', {
    method: 'POST',
    body: JSON.stringify({ targetAnonymousId }),
  })
}

export async function unblockAnonymousUser(targetAnonymousId) {
  return apiRequest('/anonymous/unblock', {
    method: 'POST',
    body: JSON.stringify({ targetAnonymousId }),
  })
}

export async function uploadAnonymousMedia(formData) {
  const res = await apiRequest('/anonymous/upload', {
    method: 'POST',
    body: formData,
  })
  return res.media || []
}

export async function getAnonymousDirectChats() {
  const res = await apiRequest('/anonymous/direct-chats')
  return res.chats || []
}

export async function getOrCreateAnonymousDirectChat(targetAnonymousId, targetProfileData = null) {
  const res = await apiRequest('/anonymous/direct-chats', {
    method: 'POST',
    body: JSON.stringify({ targetAnonymousId, targetProfileData }),
  })
  return res.chat
}

export async function getDirectChatMessages(chatKey, limit = 50) {
  const res = await apiRequest(`/anonymous/direct-chats/${chatKey}/messages?limit=${limit}`)
  return res.messages || []
}

export async function deleteAnonymousDirectChat(chatKey) {
  return apiRequest(`/anonymous/direct-chats/${chatKey}`, {
    method: 'DELETE',
  })
}

export async function markAnonymousDirectChatRead(chatKey) {
  return apiRequest(`/anonymous/direct-chats/${chatKey}/read`, {
    method: 'POST',
  })
}

export async function requestRoomJoin(roomId) {
  return apiRequest(`/anonymous/rooms/${roomId}/request-join`, {
    method: 'POST',
  })
}

export async function approveRoomJoin(roomId, requesterAnonymousId) {
  return apiRequest(`/anonymous/rooms/${roomId}/approve-join`, {
    method: 'POST',
    body: JSON.stringify({ requesterAnonymousId }),
  })
}

export async function rejectRoomJoin(roomId, requesterAnonymousId) {
  return apiRequest(`/anonymous/rooms/${roomId}/reject-join`, {
    method: 'POST',
    body: JSON.stringify({ requesterAnonymousId }),
  })
}


