import { create } from 'zustand'
import { apiRequest, onSessionExpired, refreshSession } from '../lib/apiClient.js'
import { clearGroupsSidebarCache } from '../features/groups/sidebarCache.js'
import { clearClientLoopFeedCache } from '../pages/LoopPage.jsx'
import { disconnectSocketClient } from '../services/socketClient.js'
import type { User } from '../types'

const SESSION_STORAGE_KEY = 'nest_has_session'

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
  } catch {
    // Ignore storage errors
  }
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: hasLikelySession() ? 'loading' : 'guest',
  isAuthenticated: false,
  isInitialized: false,

  init: () => {
    const unsubscribeSession = onSessionExpired(() => {
      markSessionInactive()
      set({
        status: 'guest',
        user: null,
        isAuthenticated: false,
      })
    })

    if (!hasLikelySession()) {
      set({ isInitialized: true, status: 'guest' })
      return unsubscribeSession
    }

    refreshSession()
      .then((payload) => {
        markSessionActive()
        set({
          status: 'authenticated',
          user: payload.user,
          isAuthenticated: true,
          isInitialized: true,
        })
      })
      .catch(() => {
        markSessionInactive()
        set({
          status: 'guest',
          user: null,
          isAuthenticated: false,
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
    set({
      status: 'authenticated',
      user: payload.user,
      isAuthenticated: true,
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
    set({
      status: 'authenticated',
      user: response.user,
      isAuthenticated: true,
    })

    return response
  },

  logout: async () => {
    markSessionInactive()
    try {
      clearGroupsSidebarCache()
    } catch {}
    try {
      clearClientLoopFeedCache()
    } catch {}
    try {
      disconnectSocketClient()
    } catch {}
    try {
      await apiRequest(
        '/auth/logout',
        { method: 'POST' },
        { skipRefreshRetry: true }
      )
    } finally {
      set({
        status: 'guest',
        user: null,
        isAuthenticated: false,
      })
    }
  },

  refreshUser: async () => {
    const payload = await apiRequest('/auth/me')
    markSessionActive()
    set({
      status: 'authenticated',
      user: payload.user,
      isAuthenticated: true,
    })
    return payload.user
  },

  setUser: (user) => {
    if (user) {
      markSessionActive()
    } else {
      markSessionInactive()
    }
    set({
      status: user ? 'authenticated' : 'guest',
      user: user || null,
      isAuthenticated: Boolean(user),
    })
  },
}))
