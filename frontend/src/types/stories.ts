import type { ISODateString } from './common'
import type { User } from './user'

export interface StoryItem {
  _id: string
  id?: string
  user: User | { _id: string; username: string; avatarUrl?: string; firstName?: string; lastName?: string }
  mediaUrl: string
  mediaType: 'image' | 'video'
  duration?: number
  expiresAt: ISODateString
  viewedByMe?: boolean
  viewsCount?: number
  createdAt: ISODateString
  [key: string]: any
}

export interface StoryGroup {
  user: User | { _id: string; username: string; avatarUrl?: string; firstName?: string; lastName?: string }
  stories: StoryItem[]
  hasUnseen?: boolean
}
