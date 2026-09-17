import type { ISODateString } from './common'

export interface AnonymousRoom {
  _id: string
  id?: string
  name: string
  topic?: string
  description?: string
  isPrivate?: boolean
  activeCount?: number
  maxParticipants?: number
  language?: string
  passcode?: string
  createdBy?: string
  createdAt: ISODateString
  [key: string]: any
}

export interface AnonymousMessage {
  _id: string
  roomId: string
  senderAlias: string
  senderColor?: string
  senderAvatar?: string
  text: string
  isSystem?: boolean
  createdAt: ISODateString
  [key: string]: any
}

export type DirectChatStatus = 'pending' | 'accepted' | 'declined' | 'ended'

export interface AnonymousDirectChat {
  _id: string
  id?: string
  requesterAlias: string
  targetAlias: string
  requesterSocketId?: string
  targetSocketId?: string
  status: DirectChatStatus
  roomTopic?: string
  messages?: Array<{
    _id?: string
    senderAlias: string
    text: string
    createdAt: ISODateString
  }>
  createdAt: ISODateString
  [key: string]: any
}
