import { createContext, useContext, useEffect } from 'react'
import {
  useAuthStore,
  hasLikelySession,
  markSessionActive,
  markSessionInactive,
} from './useAuthStore.ts'

export { hasLikelySession, markSessionActive, markSessionInactive }

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const auth = useAuthStore()

  useEffect(() => {
    return useAuthStore.getState().init()
  }, [])

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    return useAuthStore.getState()
  }
  return context
}
