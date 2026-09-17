import type { ISODateString } from './common'
import type { User } from './user'

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'repost'
  | 'message'
  | 'system'
  | 'verification'
  | 'group_invite'
  | 'call'

export interface NotificationItem {
  _id: string
  id?: string
  recipient: User | string
  sender?: User | { _id: string; username: string; firstName?: string; lastName?: string; avatarUrl?: string }
  type: NotificationType
  entityId?: string
  entityType?: 'post' | 'comment' | 'user' | 'message' | 'group'
  text?: string
  isRead: boolean
  readAt?: ISODateString
  createdAt: ISODateString
  [key: string]: any
}
