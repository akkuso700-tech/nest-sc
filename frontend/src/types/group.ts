import type { ISODateString } from './common'
import type { User } from './user'

export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member'

export interface GroupMember {
  user: User | string
  role: GroupRole
  joinedAt: ISODateString
}

export interface Group {
  _id: string
  id?: string
  name: string
  slug?: string
  description?: string
  avatarUrl?: string
  coverUrl?: string
  isPrivate?: boolean
  owner: User | string
  members?: GroupMember[]
  memberCount?: number
  postsCount?: number
  rules?: string[]
  tags?: string[]
  currentUserRole?: GroupRole | null
  isMember?: boolean
  createdAt: ISODateString
  updatedAt?: ISODateString
  [key: string]: any
}
