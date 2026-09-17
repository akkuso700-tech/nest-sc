import type { MediaItem, ISODateString } from './common'
import type { User } from './user'

export interface Comment {
  _id: string
  id?: string
  post: string
  author: User | { _id: string; username: string; firstName?: string; lastName?: string; avatarUrl?: string; isVerified?: boolean }
  text: string
  parentComment?: string | null
  replyCount?: number
  likesCount?: number
  likedByMe?: boolean
  replies?: Comment[]
  createdAt: ISODateString
  updatedAt?: ISODateString
  [key: string]: any
}

export type PostVisibility = 'public' | 'followers' | 'private'

export interface Post {
  _id: string
  id?: string
  author: User | { _id: string; username: string; firstName?: string; lastName?: string; avatarUrl?: string; isVerified?: boolean }
  content?: string
  text?: string
  media?: MediaItem[]
  likesCount?: number
  commentsCount?: number
  sharesCount?: number
  savesCount?: number
  repostsCount?: number
  likedByMe?: boolean
  savedByMe?: boolean
  repostedByMe?: boolean
  isArchived?: boolean
  visibility?: PostVisibility
  tags?: string[]
  mentions?: string[]
  location?: {
    city?: string
    country?: string
    name?: string
  }
  slug?: string
  createdAt: ISODateString
  updatedAt?: ISODateString
  [key: string]: any
}

export interface CreatePostPayload {
  content?: string
  text?: string
  media?: MediaItem[] | any[]
  visibility?: PostVisibility
  tags?: string[]
  groupId?: string
  scheduledAt?: ISODateString
}

export interface UpdatePostPayload {
  content?: string
  text?: string
  media?: MediaItem[] | any[]
  tags?: string[]
  visibility?: PostVisibility
}

export interface PostEngagement {
  postId: string
  type: 'like' | 'save' | 'share' | 'repost' | 'view'
}
