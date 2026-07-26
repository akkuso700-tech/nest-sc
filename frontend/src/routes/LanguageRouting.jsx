import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fallbackLanguage,
  getPreferredLanguage,
  isSupportedLanguage,
} from './constants.js'

export function RootLanguageRedirect() {
  const preferredLanguage = getPreferredLanguage(window.navigator.language)

  return <Navigate to={`/${preferredLanguage}/`} replace />
}

export function LanguageLayout({ children, overlayOnly = false }) {
  const { lang } = useParams()
  const location = useLocation()
  const { i18n } = useTranslation()

  useEffect(() => {
    if (lang && isSupportedLanguage(lang) && i18n.language !== lang) {
      i18n.changeLanguage(lang)
    }
  }, [i18n, lang])

  if (!lang || !isSupportedLanguage(lang)) {
    return (
      <Navigate
        to={`/${fallbackLanguage}/`}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return overlayOnly ? children : <Outlet />
}
