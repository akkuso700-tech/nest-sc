import type { MediaItem, ISODateString } from './common'
import type { User } from './user'

export interface Message {
  _id: string
  id?: string
  conversation: string | Conversation
  sender: User | string
  text?: string
  media?: MediaItem[]
  isRead?: boolean
  readAt?: ISODateString
  isDeleted?: boolean
  deletedAt?: ISODateString
  audioDuration?: number
  replyTo?: string | Message
  createdAt: ISODateString
  updatedAt?: ISODateString
  [key: string]: any
}

export interface Conversation {
  _id: string
  id?: string
  participantIds: (User | string)[]
  lastMessage?: Message
  lastMessagePreview?: string
  lastMessageAt?: ISODateString
  unreadCount?: number
  isGroup?: boolean
  groupName?: string
  groupAvatarUrl?: string
  createdAt: ISODateString
  updatedAt?: ISODateString
  [key: string]: any
}

export type CallType = 'audio' | 'video'

export type CallStatus = 'ringing' | 'connected' | 'completed' | 'missed' | 'rejected' | 'busy'

export interface CallLog {
  _id: string
  callId: string
  caller: User | string
  receiver: User | string
  type: CallType
  status: CallStatus
  startedAt?: ISODateString
  endedAt?: ISODateString
  durationSec?: number
  recordingUrl?: string
  fileSizeBytes?: number
  createdAt: ISODateString
}

export interface SendMessagePayload {
  conversationId?: string
  recipientId?: string
  text?: string
  media?: MediaItem[] | any[]
  audioDuration?: number
  replyToId?: string
}
