import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest, refreshSession } from '../lib/apiClient.js'

const SESSION_STORAGE_KEY = 'nest_has_session'

export function hasLikelySession() {
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

export function markSessionActive() {
  try {
    window.localStorage?.setItem(SESSION_STORAGE_KEY, '1')
  } catch {
    // Ignore storage errors
  }
}

export function markSessionInactive() {
  try {
    window.localStorage?.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => ({
    status: hasLikelySession() ? 'loading' : 'guest',
    user: null,
  }))
  const bootstrapRef = useRef(false)

  useEffect(() => {
    if (bootstrapRef.current) {
      return
    }

    bootstrapRef.current = true

    if (!hasLikelySession()) {
      return
    }

    async function bootstrapAuth() {
      try {
        const payload = await refreshSession()
        markSessionActive()

        setAuthState({
          status: 'authenticated',
          user: payload.user,
        })
      } catch {
        markSessionInactive()
        setAuthState({
          status: 'guest',
          user: null,
        })
      }
    }

    bootstrapAuth()
  }, [])

  const value = useMemo(
    () => ({
      ...authState,
      isAuthenticated: authState.status === 'authenticated',
      async login(credentials) {
        const payload = await apiRequest(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify(credentials),
          },
          { skipRefreshRetry: true },
        )

        markSessionActive()
        setAuthState({
          status: 'authenticated',
          user: payload.user,
        })

        return payload
      },
      async register(payload) {
        const response = await apiRequest(
          '/auth/register',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
          { skipRefreshRetry: true },
        )

        markSessionActive()
        setAuthState({
          status: 'authenticated',
          user: response.user,
        })

        return response
      },
      async logout() {
        markSessionInactive()
        try {
          await apiRequest(
            '/auth/logout',
            {
              method: 'POST',
            },
            { skipRefreshRetry: true },
          )
        } finally {
          setAuthState({
            status: 'guest',
            user: null,
          })
        }
      },
      async refreshUser() {
        const payload = await apiRequest('/auth/me')

        markSessionActive()
        setAuthState({
          status: 'authenticated',
          user: payload.user,
        })

        return payload.user
      },
      setUser(user) {
        if (user) {
          markSessionActive()
        } else {
          markSessionInactive()
        }
        setAuthState({
          status: user ? 'authenticated' : 'guest',
          user: user || null,
        })
      },
    }),
    [authState],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}

