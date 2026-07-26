import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Seo from '../components/seo/Seo.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import AuthShell from '../components/auth/AuthShell.jsx'
import { AuthEyeIcon } from '../components/auth/AuthIcons.jsx'
import { authInputClassName } from '../components/auth/authStyles.js'
import { apiRequest } from '../lib/apiClient.js'
import { apiOrigin } from '../lib/apiClient.js'
import { useAuth } from '../store/AuthContext.jsx'

const rememberedLoginKey = 'Nest Social-Login'

function resolveGoogleAuthUrl(lang) {
  const manualUrl = (import.meta.env.VITE_GOOGLE_AUTH_URL || '').trim()

  if (manualUrl) {
    return manualUrl
  }

  const normalizedLang = String(lang || 'tr').trim() || 'tr'
  return `${apiOrigin}/api/v1/auth/google/start?lang=${encodeURIComponent(normalizedLang)}`
}

function LoginPage() {
  const { lang } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { isAuthenticated, status, login } = useAuth()
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState('login')
  const [formState, setFormState] = useState({
    emailOrUsername: '',
    password: '',
    rememberMe: true,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingIdentifier, setIsCheckingIdentifier] = useState(false)
  const [forgotState, setForgotState] = useState({
    email: '',
    isSubmitting: false,
    error: '',
  })
  const [error, setError] = useState('')
  const [toast, setToast] = useState({
    message: '',
    tone: 'success',
  })
  const googleAuthUrl = resolveGoogleAuthUrl(lang)

  useEffect(() => {
    if (!toast.message) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast({
        message: '',
        tone: 'success',
      })
    }, 2600)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search)
    const authError = queryParams.get('authError')

    if (!authError) {
      return
    }

    setToast({
      message: authError,
      tone: 'error',
    })

    queryParams.delete('authError')
    queryParams.delete('google')
    const nextSearch = queryParams.toString()
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    )
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    const rememberedIdentifier = window.localStorage.getItem(rememberedLoginKey)

    if (!rememberedIdentifier) {
      return
    }

    setFormState((currentState) => ({
      ...currentState,
      emailOrUsername: rememberedIdentifier,
      rememberMe: true,
    }))
  }, [])

  if (isAuthenticated) {
    return <Navigate to={`/${lang}/`} replace />
  }

  function closePage() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(`/${lang}/`, { replace: true })
  }

  async function handleIdentifierSubmit() {
    if (!formState.emailOrUsername.trim()) {
      setError('Lutfen e-posta veya kullanici adi gir.')
      return
    }

    setIsCheckingIdentifier(true)
    setError('')

    try {
      await apiRequest(
        '/auth/login/check-identifier',
        {
          method: 'POST',
          body: JSON.stringify({
            emailOrUsername: formState.emailOrUsername.trim(),
          }),
        },
        { skipRefreshRetry: true },
      )

      setStep(2)
    } catch (submitError) {
      setError(submitError.message || 'Kayit bulunamadi.')
    } finally {
      setIsCheckingIdentifier(false)
    }
  }

  async function handleLogin() {
    if (!formState.emailOrUsername.trim() || !formState.password) {
      setError('Lutfen sifreni gir.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await login({
        emailOrUsername: formState.emailOrUsername.trim(),
        password: formState.password,
        rememberMe: formState.rememberMe,
      })

      if (formState.rememberMe) {
        window.localStorage.setItem(rememberedLoginKey, formState.emailOrUsername.trim())
      } else {
        window.localStorage.removeItem(rememberedLoginKey)
      }

      navigate(`/${lang}/`, { replace: true })
    } catch (submitError) {
      setError(submitError.message || 'Giris yapilamadi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    if (!forgotState.email.trim()) {
      setForgotState({
        email: forgotState.email,
        isSubmitting: false,
        error: 'Lutfen e-posta adresini gir.',
      })
      return
    }

    setForgotState({
      email: forgotState.email,
      isSubmitting: true,
      error: '',
    })

    try {
      const payload = await apiRequest(
        '/auth/password-reset/request',
        {
          method: 'POST',
          body: JSON.stringify({
            email: forgotState.email.trim(),
          }),
        },
        { skipRefreshRetry: true },
      )

      setToast({
        message: payload.message,
        tone: 'success',
      })
      if (payload.resetToken) {
        navigate(`/${lang}/reset-password?token=${encodeURIComponent(payload.resetToken)}`)
      } else {
        setMode('login')
      }
    } catch (requestError) {
      setForgotState({
        email: forgotState.email,
        isSubmitting: false,
        error: requestError.message || 'Sifre sifirlama istegi gonderilemedi.',
      })
      return
    }

    setForgotState({
      email: '',
      isSubmitting: false,
      error: '',
    })
  }

  function handleBackToIdentifier() {
    setStep(1)
    setError('')
    setFormState((currentState) => ({
      ...currentState,
      password: '',
    }))
  }

  function handleGoogleLogin() {
    if (!googleAuthUrl) {
      setToast({
        message: t('auth.googleUnavailable'),
        tone: 'error',
      })
      return
    }

    window.location.href = googleAuthUrl
  }

  function handleOpenForgotPassword() {
    setMode('forgot')
    setError('')
  }

  function handleCloseForgotPassword() {
    setMode('login')
    setForgotState({
      email: '',
      isSubmitting: false,
      error: '',
    })
  }

  return (
    <>
      <Seo
        title="My Social 1 - Login"
        description="Iki adimli uye girisi, kullanici kontrolu ve sifre adimi ile guvenli oturum acma deneyimi."
      />

      <AuthShell
        title={mode === 'forgot' ? 'Sifremi Unuttum' : t('auth.loginTitle')}
        subtitle={
          mode === 'forgot'
            ? t('auth.forgotPasswordSubtitle')
            : step === 1
              ? t('auth.loginSubtitle')
              : t('auth.passwordStepSubtitle')
        }
        onClose={closePage}
        onBack={step === 2 || mode === 'forgot' ? (mode === 'forgot' ? handleCloseForgotPassword : handleBackToIdentifier) : null}
        footer={
          <>
            {t('auth.noAccount')}{' '}
            <Link className="font-semibold text-zinc-950 dark:text-white" to={`/${lang}/signup`}>
              {t('auth.signUpLink')}
            </Link>
          </>
        }
      >
        {mode === 'forgot' ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              handleForgotPassword()
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {t('auth.email')}
              </span>
              <input
                type="email"
                autoFocus
                value={forgotState.email}
                onChange={(event) =>
                  setForgotState((currentState) => ({
                    ...currentState,
                    email: event.target.value,
                  }))
                }
                className={authInputClassName}
              />
            </label>

            {forgotState.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {forgotState.error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={forgotState.isSubmitting}
              className="w-full rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
            >
              {forgotState.isSubmitting ? 'Gonderiliyor...' : 'Sifre Sifirlama Iste'}
            </button>
          </form>
        ) : step === 1 ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              handleIdentifierSubmit()
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {t('auth.emailOrUsername')}
              </span>
              <input
                type="text"
                autoFocus
                value={formState.emailOrUsername}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    emailOrUsername: event.target.value,
                  }))
                }
                className={authInputClassName}
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!formState.emailOrUsername.trim() || isCheckingIdentifier}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary dark:hover:bg-zinc-200"
            >
              {isCheckingIdentifier ? 'Kontrol ediliyor...' : t('auth.next')}
            </button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              handleLogin()
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {t('auth.password')}
              </span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  value={formState.password}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      password: event.target.value,
                    }))
                  }
                  className={`${authInputClassName} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                  aria-label={showPassword ? 'Sifreyi gizle' : 'Sifreyi goster'}
                >
                  <AuthEyeIcon open={showPassword} />
                </button>
              </div>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3  px-4 py-0 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formState.rememberMe}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      rememberMe: event.target.checked,
                    }))
                  }
                  className="size-4 rounded-lg border-zinc-300"
                />
                <span>{t('auth.rememberMe')}</span>
              </label>

              <button
                type="button"
                onClick={handleOpenForgotPassword}
                className="text-sm font-medium text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || status === 'loading'}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
            >
              {isSubmitting ? 'Giris yapiliyor...' : t('common.login')}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-4 w-full rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          {t('auth.google')}
        </button>
      </AuthShell>

      <ActionToast
        toast={toast}
        onClose={() =>
          setToast({
            message: '',
            tone: 'success',
          })
        }
      />
    </>
  )
}

export default LoginPage
