import type { ISODateString } from './common'

export type UserRole = 'user' | 'moderator' | 'admin'

export type AccountStatus = 'active' | 'suspended'

export interface SignupConsent {
  acceptedAt?: ISODateString
  policyVersion?: string
  ipAddress?: string
  userAgent?: string
  browserLanguage?: string
}

export interface UserActivity {
  likedPostIds?: string[]
  commentedPostIds?: string[]
  savedPostIds?: string[]
  sharedPostIds?: string[]
  viewedProfileIds?: string[]
  repostedPostIds?: string[]
}

export interface UserDiscovery {
  lastExactLocation?: {
    city?: string
    country?: string
    latitude?: number
    longitude?: number
    timestamp?: ISODateString
  }
  preferredLanguages?: string[]
}

export type VerificationStatus = 'none' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'revoked'

export interface UserVerification {
  status: VerificationStatus
  submittedAt?: ISODateString
  reviewedAt?: ISODateString
  reason?: string
}

export interface UserPrivacySettings {
  isPrivateAccount?: boolean
  allowDirectMessages?: 'everyone' | 'following' | 'none'
  showOnlineStatus?: boolean
  showReadReceipts?: boolean
}

export interface User {
  _id: string
  id?: string
  email: string
  username: string
  firstName?: string
  lastName?: string
  bio?: string
  city?: string
  country?: string
  avatarUrl?: string
  coverUrl?: string
  isVerified?: boolean
  role?: UserRole
  accountStatus?: AccountStatus
  emailVerifiedAt?: ISODateString | null
  birthDate?: ISODateString
  gender?: string
  followersCount?: number
  followingCount?: number
  postsCount?: number
  blockedUserIds?: string[]
  signupConsent?: SignupConsent
  activity?: UserActivity
  discovery?: UserDiscovery
  verification?: UserVerification
  privacySettings?: UserPrivacySettings
  isFollowing?: boolean
  isFollowedBy?: boolean
  isBlockedByMe?: boolean
  createdAt: ISODateString
  updatedAt?: ISODateString
  [key: string]: any
}

export interface UserProfile extends User {
  mutualFollowersCount?: number
  pinnedPostId?: string
}
