import { create } from 'zustand'
import { apiRequest, clearAuthTokens, onSessionExpired, refreshSession } from '../lib/apiClient.js'
import { clearGroupsSidebarCache } from '../features/groups/sidebarCache.js'
import { clearClientLoopFeedCache } from '../features/loop/loopFeedCache.js'
import { disconnectSocketClient } from '../services/socketClient.js'
import type { User } from '../types'

const SESSION_STORAGE_KEY = 'nest_has_session'
const USER_CACHE_STORAGE_KEY = 'nest_user_cache'

export function hasLikelySession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.localStorage?.getItem(SESSION_STORAGE_KEY) === '1') {
      return true
    }
    if (window.location?.search && /[?&]google=success\b/.test(window.location.search)) {
      return true
    }
    if (typeof document !== 'undefined' && /(?:^|;\s*)nest_session=1(?:\s*;|$)/.test(document.cookie)) {
      return true
    }
  } catch {
    return false
  }
  return false
}

function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage?.getItem(USER_CACHE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && (parsed.id || parsed._id)) {
      return parsed as User
    }
  } catch {
    // Ignore storage / parse errors
  }
  return null
}

function writeCachedUser(user: User | null): void {
  if (typeof window === 'undefined') return
  try {
    if (user && (user.id || (user as any)._id)) {
      window.localStorage?.setItem(USER_CACHE_STORAGE_KEY, JSON.stringify(user))
    } else {
      window.localStorage?.removeItem(USER_CACHE_STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

export function markSessionActive(): void {
  try {
    window.localStorage?.setItem(SESSION_STORAGE_KEY, '1')
  } catch {
    // Ignore storage errors
  }
}

export function markSessionInactive(): void {
  try {
    window.localStorage?.removeItem(SESSION_STORAGE_KEY)
    window.localStorage?.removeItem(USER_CACHE_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
  clearAuthTokens()
}

export type AuthStatus = 'loading' | 'authenticated' | 'guest'

export interface AuthState {
  user: User | null
  status: AuthStatus
  isAuthenticated: boolean
  isInitialized: boolean

  init: () => () => void
  login: (credentials: Record<string, any>) => Promise<any>
  register: (payload: Record<string, any>) => Promise<any>
  logout: () => Promise<void>
  refreshUser: () => Promise<User>
  setUser: (user: User | null) => void
}

const initialLikelySession = hasLikelySession()
const initialCachedUser = initialLikelySession ? readCachedUser() : null

export const useAuthStore = create<AuthState>((set) => ({
  user: initialCachedUser,
  status: initialLikelySession ? (initialCachedUser ? 'authenticated' : 'loading') : 'guest',
  isAuthenticated: Boolean(initialCachedUser),
  isInitialized: !initialLikelySession,

  init: () => {
    const unsubscribeSession = onSessionExpired(() => {
      markSessionInactive()
      set({
        status: 'guest',
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      })
    })

    if (!hasLikelySession()) {
      markSessionInactive()
      set({
        isInitialized: true,
        status: 'guest',
        user: null,
        isAuthenticated: false,
      })
      return unsubscribeSession
    }

    refreshSession()
      .then((payload) => {
        markSessionActive()
        writeCachedUser(payload.user)
        set({
          status: 'authenticated',
          user: payload.user,
          isAuthenticated: true,
          isInitialized: true,
        })
      })
      .catch((error: any) => {
        const isAuthRejection = error?.status === 401 || error?.status === 403
        const cachedUser = readCachedUser()

        if (isAuthRejection || !cachedUser) {
          markSessionInactive()
          set({
            status: 'guest',
            user: null,
            isAuthenticated: false,
            isInitialized: true,
          })
          return
        }

        // Keep cached user active during transient network hiccups on page reload
        set({
          status: 'authenticated',
          user: cachedUser,
          isAuthenticated: true,
          isInitialized: true,
        })
      })

    return unsubscribeSession
  },

  login: async (credentials) => {
    const payload = await apiRequest(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      { skipRefreshRetry: true }
    )

    markSessionActive()
    writeCachedUser(payload.user)
    set({
      status: 'authenticated',
      user: payload.user,
      isAuthenticated: true,
      isInitialized: true,
    })

    return payload
  },

  register: async (payload) => {
    const response = await apiRequest(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { skipRefreshRetry: true }
    )

    markSessionActive()
    writeCachedUser(response.user)
    set({
      status: 'authenticated',
      user: response.user,
      isAuthenticated: true,
      isInitialized: true,
    })

    return response
  },

  logout: async () => {
    try {
      clearGroupsSidebarCache()
    } catch {}
    try {
      clearClientLoopFeedCache()
    } catch {}
    try {
      disconnectSocketClient(true)
    } catch {}
    try {
      await apiRequest(
        '/auth/logout',
        { method: 'POST' },
        { skipRefreshRetry: true }
      )
    } finally {
      markSessionInactive()
      set({
        status: 'guest',
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      })
    }
  },

  refreshUser: async () => {
    const payload = await apiRequest('/auth/me')
    markSessionActive()
    writeCachedUser(payload.user)
    set({
      status: 'authenticated',
      user: payload.user,
      isAuthenticated: true,
      isInitialized: true,
    })
    return payload.user
  },

  setUser: (user) => {
    if (user) {
      markSessionActive()
      writeCachedUser(user)
    } else {
      markSessionInactive()
    }
    set({
      status: user ? 'authenticated' : 'guest',
      user: user || null,
      isAuthenticated: Boolean(user),
      isInitialized: true,
    })
  },
}))
