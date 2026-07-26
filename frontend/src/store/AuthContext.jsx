import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest, refreshSession } from '../lib/apiClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    status: 'loading',
    user: null,
  })
  const bootstrapRef = useRef(false)

  useEffect(() => {
    if (bootstrapRef.current) {
      return
    }

    bootstrapRef.current = true

    async function bootstrapAuth() {
      try {
        const payload = await refreshSession()

        setAuthState({
          status: 'authenticated',
          user: payload.user,
        })
      } catch {
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

        setAuthState({
          status: 'authenticated',
          user: response.user,
        })

        return response
      },
      async logout() {
        await apiRequest(
          '/auth/logout',
          {
            method: 'POST',
          },
          { skipRefreshRetry: true },
        )

        setAuthState({
          status: 'guest',
          user: null,
        })
      },
      async refreshUser() {
        const payload = await apiRequest('/auth/me')

        setAuthState({
          status: 'authenticated',
          user: payload.user,
        })

        return payload.user
      },
      setUser(user) {
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

