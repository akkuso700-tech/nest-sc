import { apiRequest } from '../lib/apiClient.js'
import type {
  AnonymousRoom,
  AnonymousMessage,
  AnonymousDirectChat,
  ApiResponse,
} from '../types'

export interface AnonymousAvatar {
  key: string
  label: string
  emoji: string
  bgStyle: string
}

export const ANONYMOUS_AVATARS: AnonymousAvatar[] = [
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

export const ANONYMOUS_ADJECTIVES = [
  'Gizemli',
  'Sessiz',
  'Kozmik',
  'Mavi',
  'Cesur',
  'Gölge',
  'Sakin',
  'Kutup',
  'Parlak',
  'Hızlı',
  'Derin',
  'Uzak',
  'Gece',
  'Uçarı',
  'Sonsuz',
  'Gizli',
  'Yıldız',
  'Efsanevi',
  'Neon',
  'Şanslı',
]

export const ANONYMOUS_NOUNS = [
  'Gezgin',
  'Kuş',
  'Kurt',
  'Panda',
  'Yolcu',
  'Gölge',
  'Kedi',
  'Kaptan',
  'Rüzgar',
  'Avcı',
  'Pilot',
  'Şahin',
  'Gözcü',
  'Kaşif',
  'Sfenks',
  'Dalgıç',
  'Tilki',
  'Kartal',
]

export function generateRandomAlias(): string {
  const adj = ANONYMOUS_ADJECTIVES[Math.floor(Math.random() * ANONYMOUS_ADJECTIVES.length)]
  const noun = ANONYMOUS_NOUNS[Math.floor(Math.random() * ANONYMOUS_NOUNS.length)]
  const tag = Math.floor(100 + Math.random() * 900)
  return `${adj}${noun}#${tag}`
}

export function getAvatarByKey(key: string): AnonymousAvatar {
  return ANONYMOUS_AVATARS.find((a) => a.key === key) || ANONYMOUS_AVATARS[0]
}

export async function getAnonymousProfile(): Promise<any> {
  const res = await apiRequest('/anonymous/profile')
  return res.profile
}

export async function updateAnonymousProfile(data: Record<string, any>): Promise<any> {
  const res = await apiRequest('/anonymous/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.profile
}

export async function randomizeAlias(): Promise<any> {
  const res = await apiRequest('/anonymous/profile/randomize', {
    method: 'POST',
  })
  return res.profile
}

export async function getLoungeSummary(): Promise<any> {
  const res = await apiRequest('/anonymous/summary')
  return res.summary
}

export async function getAnonymousRooms(): Promise<AnonymousRoom[]> {
  const res = await apiRequest<{ rooms: AnonymousRoom[] }>('/anonymous/rooms')
  return res.rooms
}

export async function createAnonymousRoom({
  name,
  topic,
  icon,
  color,
  isPrivate = false,
}: {
  name: string
  topic?: string
  icon?: string
  color?: string
  isPrivate?: boolean
}): Promise<AnonymousRoom> {
  const res = await apiRequest<{ room: AnonymousRoom }>('/anonymous/rooms', {
    method: 'POST',
    body: JSON.stringify({ name, topic, icon, color, isPrivate }),
  })
  return res.room
}

export async function joinPrivateAnonymousRoom(accessCode: string): Promise<AnonymousRoom> {
  const res = await apiRequest<{ room: AnonymousRoom }>('/anonymous/rooms/join-private', {
    method: 'POST',
    body: JSON.stringify({ accessCode }),
  })
  return res.room
}

export async function getRoomMessages(roomId: string, limit = 50): Promise<AnonymousMessage[]> {
  const res = await apiRequest<{ messages: AnonymousMessage[] }>(`/anonymous/rooms/${roomId}/messages?limit=${limit}`)
  return res.messages
}

export async function sendRoomMessage(roomId: string, text: string): Promise<AnonymousMessage> {
  const res = await apiRequest<{ message: AnonymousMessage }>(`/anonymous/rooms/${roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  return res.message
}

export async function deleteAnonymousRoom(roomId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/anonymous/rooms/${roomId}`, {
    method: 'DELETE',
  })
}

export async function deleteRoomMessage(messageId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/anonymous/messages/${messageId}`, {
    method: 'DELETE',
  })
}

export async function blockAnonymousUser(targetAnonymousId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/anonymous/block', {
    method: 'POST',
    body: JSON.stringify({ targetAnonymousId }),
  })
}

export async function unblockAnonymousUser(targetAnonymousId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>('/anonymous/unblock', {
    method: 'POST',
    body: JSON.stringify({ targetAnonymousId }),
  })
}

export async function uploadAnonymousMedia(formData: FormData): Promise<any[]> {
  const res = await apiRequest('/anonymous/upload', {
    method: 'POST',
    body: formData,
  })
  return res.media || []
}

export async function getAnonymousDirectChats(): Promise<AnonymousDirectChat[]> {
  const res = await apiRequest<{ chats: AnonymousDirectChat[] }>('/anonymous/direct-chats')
  return res.chats || []
}

export async function getOrCreateAnonymousDirectChat(
  targetAnonymousId: string,
  targetProfileData: any = null
): Promise<AnonymousDirectChat> {
  const res = await apiRequest<{ chat: AnonymousDirectChat }>('/anonymous/direct-chats', {
    method: 'POST',
    body: JSON.stringify({ targetAnonymousId, targetProfileData }),
  })
  return res.chat
}

export async function getDirectChatMessages(chatKey: string, limit = 50): Promise<any[]> {
  const res = await apiRequest<{ messages: any[] }>(`/anonymous/direct-chats/${chatKey}/messages?limit=${limit}`)
  return res.messages || []
}

export async function deleteAnonymousDirectChat(chatKey: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/anonymous/direct-chats/${chatKey}`, {
    method: 'DELETE',
  })
}

export async function markAnonymousDirectChatRead(chatKey: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/anonymous/direct-chats/${chatKey}/read`, {
    method: 'POST',
  })
}

export async function requestRoomJoin(roomId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/anonymous/rooms/${roomId}/request-join`, {
    method: 'POST',
  })
}

export async function approveRoomJoin(roomId: string, requesterAnonymousId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/anonymous/rooms/${roomId}/approve-join`, {
    method: 'POST',
    body: JSON.stringify({ requesterAnonymousId }),
  })
}

export async function rejectRoomJoin(roomId: string, requesterAnonymousId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/anonymous/rooms/${roomId}/reject-join`, {
    method: 'POST',
    body: JSON.stringify({ requesterAnonymousId }),
  })
}

export async function kickRoomMember(roomId: string, targetAnonymousId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/anonymous/rooms/${roomId}/kick`, {
    method: 'POST',
    body: JSON.stringify({ targetAnonymousId }),
  })
}

export async function banRoomMember(roomId: string, targetAnonymousId: string): Promise<ApiResponse> {
  return apiRequest<ApiResponse>(`/anonymous/rooms/${roomId}/ban`, {
    method: 'POST',
    body: JSON.stringify({ targetAnonymousId }),
  })
}
