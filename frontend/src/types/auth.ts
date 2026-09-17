import type { User, SignupConsent } from './user'
import type { ApiResponse } from './common'

export interface LoginPayload {
  usernameOrEmail?: string
  email?: string
  password: string
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
  firstName?: string
  lastName?: string
  birthDate?: string
  city?: string
  country?: string
  signupConsent?: SignupConsent
}

export interface JwtTokens {
  accessToken?: string
  refreshToken?: string
  token?: string
}

export interface AuthSession {
  user: User
  token?: string
  accessToken?: string
  refreshToken?: string
}

export interface AuthResponse extends ApiResponse {
  user: User
  token?: string
  accessToken?: string
}

export interface PasswordResetRequestPayload {
  email: string
}

export interface PasswordResetConfirmPayload {
  token: string
  newPassword: string
}
