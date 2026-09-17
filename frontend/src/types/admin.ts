import type { ISODateString } from './common'
import type { User, UserRole, AccountStatus } from './user'
import type { Post } from './post'
import type { Conversation, Message, CallLog } from './chat'

export interface AuditLog {
  _id: string
  id?: string
  actor: User | string
  action: string
  targetType?: string
  targetId?: string
  reason?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  createdAt: ISODateString
}

export type ReportTargetType = 'post' | 'comment' | 'user' | 'message' | 'group'

export type ReportStatus = 'pending' | 'in_review' | 'resolved' | 'dismissed'

export interface Report {
  _id: string
  id?: string
  reporter: User | string
  targetType: ReportTargetType
  targetId: string
  reason: string
  status: ReportStatus
  actionTaken?: string
  resolutionNotes?: string
  resolvedBy?: User | string
  resolvedAt?: ISODateString
  createdAt: ISODateString
  [key: string]: any
}

export interface CreatorApplication {
  _id: string
  id?: string
  user: User | string
  status: 'pending' | 'approved' | 'rejected'
  category?: string
  monthlyViews?: number
  followerCount?: number
  notes?: string
  reviewedBy?: User | string
  reviewedAt?: ISODateString
  createdAt: ISODateString
  [key: string]: any
}

export interface PayoutRequest {
  _id: string
  id?: string
  user: User | string
  amount: number
  currency?: string
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  payoutMethod?: string
  payoutDetails?: Record<string, any>
  notes?: string
  processedAt?: ISODateString
  createdAt: ISODateString
  [key: string]: any
}

export interface AdminSetting {
  key: string
  value: any
  description?: string
  updatedAt?: ISODateString
}

export interface AdminUserDetailResponse {
  user: User
  posts: Post[]
  conversations: Conversation[]
  messages: Message[]
  locationLogs: any[]
  callLogs: CallLog[]
}

export interface UpdateUserStatusPayload {
  accountStatus: AccountStatus
  reason?: string
}

export interface UpdateUserRolePayload {
  role: UserRole
}
