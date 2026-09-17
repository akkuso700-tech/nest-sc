import { createContext, useContext, useEffect } from 'react'
import { useThemeStore } from './useThemeStore.ts'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const themeState = useThemeStore()

  useEffect(() => {
    useThemeStore.getState().init()
  }, [])

  return <ThemeContext.Provider value={themeState}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    return useThemeStore.getState()
  }
  return context
}
