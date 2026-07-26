import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import Seo from '../components/seo/Seo.jsx'
import AuthShell from '../components/auth/AuthShell.jsx'
import { AuthChevronIcon, AuthEyeIcon } from '../components/auth/AuthIcons.jsx'
import { authInputClassName } from '../components/auth/authStyles.js'
import { apiRequest } from '../lib/apiClient.js'
import { useAuth } from '../store/AuthContext.jsx'

const NAME_MAX_LENGTH = 15
const SIGNUP_CONSENT_VERSION = '2026-04-16'

function getAdultMaxDate() {
  const now = new Date()
  now.setFullYear(now.getFullYear() - 18)
  return now
}

function PasswordStrength({ value, label, labels, helper }) {
  const analysis = useMemo(() => {
    if (!value) {
      return { level: 0, tone: 'bg-zinc-300 dark:bg-zinc-700', label: labels.empty }
    }

    let score = 0

    if (value.length >= 8) score += 25
    if (value.length >= 12) score += 15
    if (/[A-Z]/.test(value)) score += 15
    if (/[a-z]/.test(value)) score += 10
    if (/\d/.test(value)) score += 15
    if (/[^A-Za-z0-9]/.test(value)) score += 20

    const level = Math.min(score, 100)

    if (level >= 85) {
      return { level, tone: 'bg-emerald-500', label: labels.veryStrong }
    }

    if (level >= 65) {
      return { level, tone: 'bg-sky-500', label: labels.strong }
    }

    if (level >= 40) {
      return { level, tone: 'bg-amber-500', label: labels.medium }
    }

    return { level, tone: 'bg-rose-500', label: labels.weak }
  }, [labels.empty, labels.medium, labels.strong, labels.veryStrong, labels.weak, value])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{label}</span>
        <span>{analysis.label}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${analysis.tone}`}
          style={{ width: `${analysis.level}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {helper}
      </p>
    </div>
  )
}

function SelectDropdown({ label, value, placeholder, open, onToggle, onSelect, options }) {
  return (
    <div className="relative">
      <span className="mb-1 block text-sm font-medium text-text">
        {label}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-12 w-full items-center cursor-pointer justify-between rounded-lg border px-4 text-left transition ${
          open
            ? 'border-blue-400/60 bg-secondary-hover text-text '
            : 'border-border bg-secondary text-text hover:bg-secondary-hover'
        }`}
      >
        <span>{value || placeholder}</span>
        <AuthChevronIcon open={open} />
      </button>

      {open ? (
        <div className="dropdown-pop absolute bottom-[calc(100%+10px)] left-0 z-20 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`flex w-full items-center justify-between rounded-lg px-3 cursor-pointer py-2.5 text-left text-sm transition ${
                value === option.label
                  ? 'bg-secondary text-text '
                  : 'text-text hover:bg-secondary '
              }`}
            >
              <span>{option.label}</span>
              {value === option.label ? <span className="text-xs font-semibold"></span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SignUpPage() {
  const { lang } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { isAuthenticated, register } = useAuth()
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [openConsentDialog, setOpenConsentDialog] = useState('')
  const [signupContractsState, setSignupContractsState] = useState({
    consentText: '',
    dialogs: null,
  })
  const [openDateMenu, setOpenDateMenu] = useState('')
  const [emailState, setEmailState] = useState({
    isChecking: false,
    available: null,
    message: '',
  })
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    email: '',
    birthDate: '',
    verificationCode: ['', '', '', '', '', ''],
    password: '',
  })
  const [birthParts, setBirthParts] = useState({
    day: '',
    month: '',
    year: '',
  })
  const dateRef = useRef(null)
  const verificationInputRefs = useRef([])
  const adultMaxDate = getAdultMaxDate()
  const enteredVerificationCode = formState.verificationCode.join('')
  const consentDialogs = useMemo(
    () => {
      const remoteDialogs = signupContractsState.dialogs || {}

      return {
        terms: {
          title: remoteDialogs.terms?.title || t('auth.consentDialogs.terms.title'),
          body: remoteDialogs.terms?.body || t('auth.consentDialogs.terms.body'),
        },
        cookies: {
          title: remoteDialogs.cookies?.title || t('auth.consentDialogs.cookies.title'),
          body: remoteDialogs.cookies?.body || t('auth.consentDialogs.cookies.body'),
        },
        privacy: {
          title: remoteDialogs.privacy?.title || t('auth.consentDialogs.privacy.title'),
          body: remoteDialogs.privacy?.body || t('auth.consentDialogs.privacy.body'),
        },
      }
    },
    [signupContractsState.dialogs, t],
  )
  const activeConsentDialog = consentDialogs[openConsentDialog] || null
  const shouldBypassEmailVerification = import.meta.env.DEV
  const signUpStepItems = useMemo(
    () => [
      { id: 1, label: t('auth.signupSteps.info') },
      { id: 2, label: t('auth.signupSteps.verification') },
      { id: 3, label: t('auth.signupSteps.security') },
    ],
    [t],
  )
  const visibleSignUpStepItems = shouldBypassEmailVerification
    ? signUpStepItems.filter((item) => item.id !== 2)
    : signUpStepItems

  useEffect(() => {
    let cancelled = false
    const requestedLanguage = String(i18n.resolvedLanguage || i18n.language || lang || 'tr')
      .trim()
      .toLowerCase()
      .slice(0, 5)

    apiRequest(`/auth/signup-contracts?lang=${encodeURIComponent(requestedLanguage)}`, {}, {
      skipRefreshRetry: true,
    })
      .then((payload) => {
        if (cancelled) {
          return
        }

        setSignupContractsState({
          consentText: String(payload?.consentText || '').trim(),
          dialogs: payload?.dialogs || null,
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setSignupContractsState({
          consentText: '',
          dialogs: null,
        })
      })

    return () => {
      cancelled = true
    }
  }, [i18n.language, i18n.resolvedLanguage, lang])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!dateRef.current?.contains(event.target)) {
        setOpenDateMenu('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    if (!openConsentDialog) {
      return undefined
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpenConsentDialog('')
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [openConsentDialog])

  useEffect(() => {
    const normalizedEmail = formState.email.trim().toLowerCase()

    if (!normalizedEmail) {
      setEmailState({
        isChecking: false,
        available: null,
        message: '',
      })
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(normalizedEmail)) {
      setEmailState({
        isChecking: false,
        available: null,
        message: t('auth.errors.invalidEmail'),
      })
      return
    }

    setEmailState({
      isChecking: true,
      available: null,
      message: t('auth.checkingEmail'),
    })

    const timeoutId = window.setTimeout(async () => {
      try {
        const payload = await apiRequest(
          '/auth/register/check-email',
          {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail }),
          },
          { skipRefreshRetry: true },
        )

        setEmailState({
          isChecking: false,
          available: payload.available,
          message: payload.message,
        })
      } catch (requestError) {
        setEmailState({
          isChecking: false,
          available: null,
          message: requestError.message || t('auth.errors.emailCheckFailed'),
        })
      }
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [formState.email, t])

  useEffect(() => {
    if (!birthParts.day || !birthParts.month || !birthParts.year) {
      setFormState((currentState) => ({
        ...currentState,
        birthDate: '',
      }))
      return
    }

    const birthDateValue = `${birthParts.year}-${birthParts.month.padStart(2, '0')}-${birthParts.day.padStart(2, '0')}`
    setFormState((currentState) => ({
      ...currentState,
      birthDate: birthDateValue,
    }))
  }, [birthParts])

  const yearOptions = useMemo(() => {
    const latestYear = adultMaxDate.getFullYear()
    const earliestYear = latestYear - 100
    return Array.from({ length: latestYear - earliestYear + 1 }, (_, index) => {
      const year = String(latestYear - index)
      return { value: year, label: year }
    })
  }, [adultMaxDate])

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = String(index + 1)
        return { value: month, label: month.padStart(2, '0') }
      }),
    [],
  )

  const dayOptions = useMemo(() => {
    const year = Number(birthParts.year || adultMaxDate.getFullYear())
    const month = Number(birthParts.month || 1)
    const lastDayOfMonth = new Date(year, month, 0).getDate()

    return Array.from({ length: lastDayOfMonth }, (_, index) => {
      const day = String(index + 1)
      return { value: day, label: day.padStart(2, '0') }
    })
  }, [adultMaxDate, birthParts.month, birthParts.year])

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

  function goBackStep() {
    setError('')
    if (shouldBypassEmailVerification && step === 3) {
      setStep(1)
      return
    }

    setStep((current) => Math.max(1, current - 1))
  }

  function isAdultBirthDate(dateValue) {
    if (!dateValue) {
      return false
    }

    const birthDate = new Date(dateValue)
    return birthDate <= adultMaxDate
  }

  async function handleSubmit() {
    const firstName = formState.firstName.trim()
    const lastName = formState.lastName.trim()
    if (!firstName || !lastName || !formState.email || !formState.birthDate || !formState.password) {
      setError(t('auth.errors.requiredFields'))
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await register({
        firstName,
        lastName,
        email: formState.email.trim().toLowerCase(),
        password: formState.password,
        birthDate: formState.birthDate,
        location: {
          country: 'Unknown',
          city: '',
        },
        locale: i18n.language || lang || 'tr',
        signupConsentVersion: SIGNUP_CONSENT_VERSION,
      })

      navigate(`/${lang}/`, { replace: true })
    } catch (submitError) {
      setError(submitError.message || t('auth.errors.registerFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleNextStep() {
    if (isSubmitting) {
      return
    }

    setError('')

    if (step === 1) {
      if (!formState.firstName.trim() || !formState.lastName.trim() || !formState.email.trim() || !formState.birthDate) {
        setError(t('auth.errors.requiredFields'))
        return
      }

      if (emailState.available === false) {
        setError(t('auth.errors.emailInUse'))
        return
      }

      if (!isAdultBirthDate(formState.birthDate)) {
        setError(t('auth.errors.ageRequired'))
        return
      }

      setIsSubmitting(true)
      setError('')

      apiRequest(
        '/auth/register/request-code',
        {
          method: 'POST',
          body: JSON.stringify({
            email: formState.email.trim().toLowerCase(),
          }),
        },
        { skipRefreshRetry: true },
      )
        .then((payload) => {
          setStep(shouldBypassEmailVerification || payload?.skipVerification ? 3 : 2)
        })
        .catch((submitError) => {
          setError(submitError.message || t('auth.errors.requestCodeFailed'))
        })
        .finally(() => {
          setIsSubmitting(false)
        })

      return
    }

    if (step === 2) {
      if (enteredVerificationCode.length < 4) {
        setError(t('auth.errors.codeRequired'))
        return
      }

      setIsSubmitting(true)
      setError('')

      apiRequest(
        '/auth/register/verify-code',
        {
          method: 'POST',
          body: JSON.stringify({
            email: formState.email.trim().toLowerCase(),
            code: enteredVerificationCode,
          }),
        },
        { skipRefreshRetry: true },
      )
        .then(() => {
          setStep(3)
        })
        .catch((submitError) => {
          setError(submitError.message || t('auth.errors.verificationFailed'))
        })
        .finally(() => {
          setIsSubmitting(false)
        })

      return
    }

    handleSubmit()
  }

  function handleVerificationChange(index, nextValue) {
    const sanitizedValue = nextValue.replace(/\D/g, '').slice(-1)
    const nextDigits = [...formState.verificationCode]
    nextDigits[index] = sanitizedValue

    setFormState((currentState) => ({
      ...currentState,
      verificationCode: nextDigits,
    }))

    if (sanitizedValue && index < verificationInputRefs.current.length - 1) {
      verificationInputRefs.current[index + 1]?.focus()
    }
  }

  function handleVerificationKeyDown(event, index) {
    if (event.key === 'Backspace' && !formState.verificationCode[index] && index > 0) {
      verificationInputRefs.current[index - 1]?.focus()
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      handleNextStep()
    }
  }

  function handleVerificationPaste(event) {
    const pastedValue = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)

    if (!pastedValue) {
      return
    }

    event.preventDefault()

    const nextDigits = Array.from({ length: 6 }, (_, index) => pastedValue[index] || '')
    setFormState((currentState) => ({
      ...currentState,
      verificationCode: nextDigits,
    }))

    const nextFocusIndex = Math.min(pastedValue.length, 5)
    verificationInputRefs.current[nextFocusIndex]?.focus()
  }

  return (
    <>
      <Seo
        title={t('auth.signupSeoTitle')}
        description={t('auth.signupSeoDescription')}
      />

      <AuthShell
        step={step}
        stepItems={visibleSignUpStepItems}
        title={t('auth.signupTitle')}
        subtitle={t('auth.signupSubtitle')}
        onClose={closePage}
        onBack={step > 1 ? goBackStep : null}
        stepLabel={t('auth.stepLabel')}
        backAriaLabel={t('auth.backAria')}
        footer={
          <>
            {t('auth.haveAccount')}{' '}
            <Link className="font-semibold text-zinc-950 dark:text-white" to={`/${lang}/login`}>
              {t('auth.signInLink')}
            </Link>
          </>
        }
      >
        {step === 1 ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              handleNextStep()
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-text">
                {t('auth.firstName')}
              </span>
              <input
                autoFocus
                maxLength={NAME_MAX_LENGTH}
                value={formState.firstName}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    firstName: event.target.value.slice(0, NAME_MAX_LENGTH),
                  }))
                }
                className={authInputClassName}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {t('auth.lastName')}
              </span>
              <input
                maxLength={NAME_MAX_LENGTH}
                value={formState.lastName}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    lastName: event.target.value.slice(0, NAME_MAX_LENGTH),
                  }))
                }
                className={authInputClassName}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {t('auth.email')}
              </span>
              <input
                type="email"
                value={formState.email}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    email: event.target.value,
                  }))
                }
                className={authInputClassName}
              />
              {emailState.message ? (
                <span
                  className={`mt-2 block text-xs ${
                    emailState.available === false
                      ? 'text-rose-600 dark:text-rose-300'
                      : emailState.available
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {emailState.message}
                </span>
              ) : null}
            </label>

            <div ref={dateRef} className="grid gap-4 grid-cols-3">
              <SelectDropdown
                label={t('auth.day')}
                value={birthParts.day ? birthParts.day.padStart(2, '0') : ''}
                placeholder={t('auth.day')}
                open={openDateMenu === 'day'}
                onToggle={() => setOpenDateMenu((current) => (current === 'day' ? '' : 'day'))}
                onSelect={(value) => {
                  setBirthParts((currentState) => ({
                    ...currentState,
                    day: value,
                  }))
                  setOpenDateMenu('')
                }}
                options={dayOptions}
              />

              <SelectDropdown
                label={t('auth.month')}
                value={birthParts.month ? birthParts.month.padStart(2, '0') : ''}
                placeholder={t('auth.month')}
                open={openDateMenu === 'month'}
                onToggle={() => setOpenDateMenu((current) => (current === 'month' ? '' : 'month'))}
                onSelect={(value) => {
                  setBirthParts((currentState) => ({
                    ...currentState,
                    month: value,
                  }))
                  setOpenDateMenu('')
                }}
                options={monthOptions}
              />

              <SelectDropdown
                label={t('auth.year')}
                value={birthParts.year}
                placeholder={t('auth.year')}
                open={openDateMenu === 'year'}
                onToggle={() => setOpenDateMenu((current) => (current === 'year' ? '' : 'year'))}
                onSelect={(value) => {
                  setBirthParts((currentState) => ({
                    ...currentState,
                    year: value,
                  }))
                  setOpenDateMenu('')
                }}
                options={yearOptions}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || emailState.isChecking || emailState.available === false}
              className="w-full cursor-pointer rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-inverse transition hover:bg-primary-hover "
            >
              {isSubmitting ? t('auth.continuing') : t('auth.next')}
            </button>
          </form>
        ) : null}

        {step === 2 ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              handleNextStep()
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {t('auth.verificationCode')}
              </span>
              <div className="grid grid-cols-6 gap-2">
                {formState.verificationCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      verificationInputRefs.current[index] = element
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onPaste={handleVerificationPaste}
                    onKeyDown={(event) => handleVerificationKeyDown(event, index)}
                    onChange={(event) => handleVerificationChange(index, event.target.value)}
                    className="aspect-square rounded-lg border border-border bg-secondary text-center text-lg font-semibold text-text outline-none transition focus:border-blue-400/60"
                  />
                ))}
              </div>
            </label>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('auth.verificationEmailHint')}
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full cursor-pointer rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-inverse transition hover:bg-primary-hover "
            >
              {isSubmitting ? t('auth.verifying') : t('auth.next')}
            </button>
          </form>
        ) : null}

        {step === 3 ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              handleNextStep()
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {t('auth.password')}
              </span>
              <div className="flex h-12 items-center rounded-lg border border-border bg-secondary px-4 text-text transition focus-within:border-blue-400/60">
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
                  className="w-full bg-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  <AuthEyeIcon open={showPassword} />
                </button>
              </div>
            </label>

            <PasswordStrength
              value={formState.password}
              label={t('auth.passwordStrength')}
              labels={{
                empty: t('auth.passwordStrengthLevels.empty'),
                weak: t('auth.passwordStrengthLevels.weak'),
                medium: t('auth.passwordStrengthLevels.medium'),
                strong: t('auth.passwordStrengthLevels.strong'),
                veryStrong: t('auth.passwordStrengthLevels.veryStrong'),
              }}
              helper={t('auth.passwordHelper')}
            />

            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              <Trans
                i18nKey="auth.signupConsentRich"
                components={{
                  signup: <span className="font-semibold text-text" />,
                  terms: (
                    <button
                      type="button"
                      onClick={() => setOpenConsentDialog('terms')}
                      className="cursor-pointer font-semibold text-primary underline underline-offset-2 transition hover:text-primary-hover"
                    />
                  ),
                  cookies: (
                    <button
                      type="button"
                      onClick={() => setOpenConsentDialog('cookies')}
                      className="cursor-pointer font-semibold text-primary underline underline-offset-2 transition hover:text-primary-hover"
                    />
                  ),
                  privacy: (
                    <button
                      type="button"
                      onClick={() => setOpenConsentDialog('privacy')}
                      className="cursor-pointer font-semibold text-primary underline underline-offset-2 transition hover:text-primary-hover"
                    />
                  ),
                }}
              />
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full cursor-pointer rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-inverse transition hover:bg-primary-hover "
            >
              {isSubmitting ? t('auth.creatingAccount') : t('common.signup')}
            </button>
          </form>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        ) : null}
      </AuthShell>

      {activeConsentDialog ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-[2px]"
          onClick={() => setOpenConsentDialog('')}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-border bg-card p-5 shadow-[0_30px_80px_rgba(15,23,42,0.25)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-text">
                {activeConsentDialog.title}
              </h3>
              <button
                type="button"
                onClick={() => setOpenConsentDialog('')}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-secondary hover:text-text"
              >
                {t('common.close')}
              </button>
            </div>
            <p className="whitespace-pre-line text-sm leading-6 text-muted">
              {activeConsentDialog.body}
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default SignUpPage
