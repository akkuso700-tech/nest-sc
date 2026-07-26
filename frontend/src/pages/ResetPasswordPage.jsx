import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Seo from '../components/seo/Seo.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import AuthShell from '../components/auth/AuthShell.jsx'
import { AuthEyeIcon } from '../components/auth/AuthIcons.jsx'
import { authInputClassName } from '../components/auth/authStyles.js'
import { apiRequest } from '../lib/apiClient.js'

function ResetPasswordPage() {
  const { lang } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [formState, setFormState] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState({
    message: '',
    tone: 'success',
  })

  function closePage() {
    navigate(`/${lang}/login`, { replace: true })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!token) {
      setError('Sifre sifirlama baglantisi eksik veya gecersiz.')
      return
    }

    if (!formState.newPassword || !formState.confirmPassword) {
      setError('Lutfen yeni sifreni iki alana da gir.')
      return
    }

    if (formState.newPassword !== formState.confirmPassword) {
      setError('Sifre alanlari birbiriyle ayni olmali.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = await apiRequest(
        '/auth/password-reset/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            newPassword: formState.newPassword,
          }),
        },
        { skipRefreshRetry: true },
      )

      setToast({
        message: payload.message,
        tone: 'success',
      })

      window.setTimeout(() => {
        navigate(`/${lang}/login`, { replace: true })
      }, 1200)
    } catch (requestError) {
      setError(requestError.message || 'Sifre sifirlama islemi basarisiz oldu.')
      setToast({
        message: requestError.message || 'Sifre sifirlama islemi basarisiz oldu.',
        tone: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Seo
        title="My Social 1 - Reset Password"
        description="Sifre sifirlama tokeni ile yeni sifreni belirle."
      />

      <AuthShell
        title="Yeni Sifreni Belirle"
        subtitle="Bu baglanti gecerliyse yeni sifreni kaydedip tekrar giris yapabilirsin."
        onClose={closePage}
        footer={
          <Link className="font-semibold text-zinc-950 dark:text-white" to={`/${lang}/login`}>
            Giris sayfasina don
          </Link>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Yeni Sifre
            </span>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                autoFocus
                value={formState.newPassword}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    newPassword: event.target.value,
                  }))
                }
                className={`${authInputClassName} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                aria-label={showNewPassword ? 'Sifreyi gizle' : 'Sifreyi goster'}
              >
                <AuthEyeIcon open={showNewPassword} />
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Yeni Sifre Tekrar
            </span>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formState.confirmPassword}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    confirmPassword: event.target.value,
                  }))
                }
                className={`${authInputClassName} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                aria-label={showConfirmPassword ? 'Sifreyi gizle' : 'Sifreyi goster'}
              >
                <AuthEyeIcon open={showConfirmPassword} />
              </button>
            </div>
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
          >
            {isSubmitting ? 'Sifirlanıyor...' : 'Sifreyi Sifirla'}
          </button>
        </form>
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

export default ResetPasswordPage
