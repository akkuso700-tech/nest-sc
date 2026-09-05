import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ActionToast from '../components/feedback/ActionToast.jsx'
import Seo from '../components/seo/Seo.jsx'
import SocialLayout from '../layouts/SocialLayout.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import {
  checkUsernameAvailability,
  changeMyPassword,
  deleteMyAccount,
  getMyProfile,
  updateMyProfile,
} from '../services/usersService.js'
import { findLocationSuggestions } from '../app/locationSuggestions.js'

function buildInitialForm(profile) {
  return {
    firstName: profile?.user?.firstName || '',
    lastName: profile?.user?.lastName || '',
    email: profile?.user?.email || '',
    username: profile?.user?.username || '',
    birthDate: profile?.user?.birthDate
      ? new Date(profile.user.birthDate).toISOString().split('T')[0]
      : '',
    bio: profile?.user?.bio || '',
    avatarUrl: profile?.user?.avatarUrl || '',
    coverUrl: profile?.user?.coverUrl || '',
    isPrivate: Boolean(profile?.user?.isPrivate),
    location: {
      city: profile?.user?.location?.city || '',
      country: profile?.user?.location?.country || '',
    },
    voiceCallEnabled: profile?.user?.preferences?.calling?.voiceCallEnabled !== false,
    videoCallEnabled: profile?.user?.preferences?.calling?.videoCallEnabled !== false,
  }
}

function formatEditableLocation(location) {
  const parts = [location?.city, location?.country].filter(Boolean)
  return parts.join(', ')
}

function parseLocationInput(value, previousLocation) {
  const parts = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return {
      city: parts[0],
      country: parts.slice(1).join(', '),
    }
  }

  if (parts.length === 1) {
    return {
      city: parts[0],
      country: previousLocation.country || '',
    }
  }

  return {
    city: '',
    country: '',
  }
}

function ChevronIcon({ open = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`size-4 cursor-pointer transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
      <path d="M15 6 9 12l6 6" />
      <path d="M9 12h10" />
    </svg>
  )
}

function EyeIcon({ open = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
      <path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z" />
      {open ? <circle cx="12" cy="12" r="2.8" /> : <path d="m4.5 4.5 15 15" />}
    </svg>
  )
}

function SectionCard({ children, danger = false }) {
  return (
    <section
      className={`rounded-b-lg border-x-1 bg-card border-border border-b-1 px-5 py-2 mb-2 transition-colors md:py-3 md:px-6 ${
        danger
          ? 'border-rose-200  dark:border-rose-900/50 '
          : 'border-zinc-200  dark:border-zinc-800 '
      }`}
    >
     
      {children}
    </section>
  )
}

function AccordionSection({ title, open, onToggle, children, danger = false }) {
  return (
    <section
      className={`overflow-hidden md:rounded-lg border shadow-sm mb-2 transition-colors ${
        danger
          ? 'border-rose-200 bg-white dark:border-rose-900/50 dark:bg-zinc-950'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full text-base bg-card items-start justify-between gap-4 px-5 py-5 text-left md:px-6"
      >
        <div>
          <h2 className={`text-base font-semibold ${danger ? 'text-rose-600 dark:text-rose-300' : 'text-zinc-950 dark:text-white'}`}>
            {title}
          </h2>
          
        </div>
        <span className={`mt-1 shrink-0 ${danger ? 'text-rose-500 dark:text-rose-300' : 'text-zinc-400 dark:text-zinc-500'}`}>
          <ChevronIcon open={open} />
        </span>
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="border-t bg-card border-zinc-200 px-5 py-5 dark:border-zinc-800 md:px-6">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

function InputField({ label, children, helperText = '' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
      {children}
      {helperText ? (
        <span className=" block text-xs text-zinc-500 dark:text-zinc-400">{helperText}</span>
      ) : null}
    </label>
  )
}

const inputClassName =
  'h-12 w-full rounded-lg text-base border border-border bg-secondary px-4 text-text outline-none transition placeholder:text-zinc-400 focus:border-blue-400/60 dark:placeholder:text-zinc-500 '
const NAME_MAX_LENGTH = 15
const BIO_MAX_LENGTH = 120

const validationFieldLabels = {
  firstName: 'Ad',
  lastName: 'Soyad',
  email: 'E-posta',
  username: 'Kullanıcı adı',
  bio: 'Biyografi',
  'location.city': 'Şehir',
  'location.country': 'Ülke',
}

function getProfileSaveError(error, fallbackMessage) {
  const issue = Array.isArray(error?.details) ? error.details[0] : null

  if (!issue) return error?.message || fallbackMessage

  const fieldPath = (issue.path || []).filter((part) => part !== 'body').join('.')
  const fieldLabel = validationFieldLabels[fieldPath] || fieldPath || 'Profil bilgisi'
  return `${fieldLabel}: ${issue.message}`
}

function buildProfileUpdatePayload(form, locationInputValue, initialSnapshot) {
  const initialForm = initialSnapshot?.form || {}
  const nextValues = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    username: form.username.trim().toLowerCase(),
    bio: form.bio.trim(),
    isPrivate: Boolean(form.isPrivate),
  }
  const payload = {}

  Object.entries(nextValues).forEach(([field, value]) => {
    const initialValue =
      field === 'email' || field === 'username'
        ? String(initialForm[field] || '').trim().toLowerCase()
        : field === 'isPrivate'
          ? Boolean(initialForm[field])
          : String(initialForm[field] || '').trim()

    if (value !== initialValue) payload[field] = value
  })

  const nextLocation = parseLocationInput(locationInputValue, form.location)
  const initialLocation = initialForm.location || { city: '', country: '' }
  if (
    nextLocation.city !== (initialLocation.city || '') ||
    nextLocation.country !== (initialLocation.country || '')
  ) {
    payload.location = nextLocation
  }

  const hasVoiceChanged = Boolean(form.voiceCallEnabled) !== Boolean(initialForm.voiceCallEnabled)
  const hasVideoChanged = Boolean(form.videoCallEnabled) !== Boolean(initialForm.videoCallEnabled)
  if (hasVoiceChanged || hasVideoChanged) {
    payload.preferences = {
      calling: {
        voiceCallEnabled: Boolean(form.voiceCallEnabled),
        videoCallEnabled: Boolean(form.videoCallEnabled),
      },
    }
  }

  return payload
}

function validateProfileUpdatePayload(payload) {
  if ('firstName' in payload && (payload.firstName.length < 2 || payload.firstName.length > NAME_MAX_LENGTH)) {
    return `Ad 2-${NAME_MAX_LENGTH} karakter arasında olmalıdır.`
  }
  if ('lastName' in payload && (payload.lastName.length < 2 || payload.lastName.length > NAME_MAX_LENGTH)) {
    return `Soyad 2-${NAME_MAX_LENGTH} karakter arasında olmalıdır.`
  }
  if ('email' in payload && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return 'Geçerli bir e-posta adresi girin.'
  }
  if (
    'username' in payload &&
    !/^[a-zA-Z0-9_]{3,30}$/.test(payload.username)
  ) {
    return 'Kullanıcı adı 3-30 karakter olmalı; yalnızca harf, rakam ve alt çizgi içermelidir.'
  }
  if ('bio' in payload && payload.bio.length > BIO_MAX_LENGTH) {
    return `Biyografi en fazla ${BIO_MAX_LENGTH} karakter olabilir.`
  }
  if (
    payload.location &&
    (payload.location.city.length > 80 || payload.location.country.length > 80)
  ) {
    return 'Şehir ve ülke alanları en fazla 80 karakter olabilir.'
  }
  return ''
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle,
  showLabel,
  hideLabel,
}) {
  return (
    <InputField label={label}>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className={`${inputClassName} pr-12`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
          aria-label={visible ? hideLabel : showLabel}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </InputField>
  )
}

function EditProfilePage() {
  const { lang } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { status, isAuthenticated, user, setUser } = useAuth()
  const authUserId = user?._id || user?.id || ''
  const [profileState, setProfileState] = useState({
    isLoading: true,
    error: '',
  })
  const [formState, setFormState] = useState(buildInitialForm(null))
  const [locationInput, setLocationInput] = useState('')
  const [saveState, setSaveState] = useState({
    isSubmitting: false,
    error: '',
    success: '',
  })
  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    isSubmitting: false,
    error: '',
  })
  const [deleteState, setDeleteState] = useState({
    currentPassword: '',
    isSubmitting: false,
    error: '',
  })
  const [isCallingOpen, setIsCallingOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showDeletePassword, setShowDeletePassword] = useState(false)
  const [toast, setToast] = useState({
    message: '',
    tone: 'success',
  })
  const [usernameState, setUsernameState] = useState({
    isChecking: false,
    available: null,
    message: '',
  })
  const [showSavedState, setShowSavedState] = useState(false)
  const locationWrapperRef = useRef(null)
  const initialSnapshotRef = useRef('')

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
    if (!showSavedState) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowSavedState(false)
    }, 1800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [showSavedState])

  useEffect(() => {
    if (!isAuthenticated) {
      setProfileState({
        isLoading: false,
        error: '',
      })
      setFormState(buildInitialForm(null))
      setLocationInput('')
      return
    }

    let cancelled = false

    async function loadProfile() {
      setProfileState({
        isLoading: true,
        error: '',
      })
      setFormState(buildInitialForm(null))
      setLocationInput('')

      try {
        const payload = await getMyProfile()

        if (cancelled) {
          return
        }

        setFormState(buildInitialForm(payload))
        setLocationInput(formatEditableLocation(payload.user.location))
        initialSnapshotRef.current = JSON.stringify({
          form: buildInitialForm(payload),
          locationInput: formatEditableLocation(payload.user.location),
        })
        setProfileState({
          isLoading: false,
          error: '',
        })
        setUsernameState({
          isChecking: false,
          available: true,
          message: t('profile.edit.usernameCurrent'),
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setProfileState({
          isLoading: false,
          error: error.message || t('profile.edit.loadFailed'),
        })
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [authUserId, isAuthenticated, t])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!locationWrapperRef.current?.contains(event.target)) {
        setIsLocationMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const locationOptions = useMemo(() => findLocationSuggestions(locationInput), [locationInput])
  const profileSnapshot = useMemo(
    () =>
      JSON.stringify({
        form: formState,
        locationInput,
      }),
    [formState, locationInput],
  )
  const hasProfileChanges =
    !profileState.isLoading &&
    Boolean(initialSnapshotRef.current) &&
    initialSnapshotRef.current !== profileSnapshot
  const hasSecurityDraft =
    Boolean(passwordState.currentPassword || passwordState.newPassword || deleteState.currentPassword)
  const hasUnsavedChanges = hasProfileChanges || hasSecurityDraft

  useEffect(() => {
    if (profileState.isLoading) {
      return
    }

    const normalizedUsername = formState.username.trim().toLowerCase()
    const initialPayload = initialSnapshotRef.current ? JSON.parse(initialSnapshotRef.current) : null
    const initialUsername = initialPayload?.form?.username?.trim().toLowerCase() || ''

    if (!normalizedUsername || normalizedUsername.length < 3) {
      setUsernameState({
        isChecking: false,
        available: null,
        message: t('profile.edit.usernameTooShort'),
      })
      return
    }

    if (normalizedUsername === initialUsername) {
      setUsernameState({
        isChecking: false,
        available: true,
        message: t('profile.edit.usernameCurrent'),
      })
      return
    }

    setUsernameState((currentState) => ({
      ...currentState,
      isChecking: true,
      message: t('profile.edit.usernameChecking'),
    }))

    const timeoutId = window.setTimeout(async () => {
      try {
        const payload = await checkUsernameAvailability(normalizedUsername)
        setUsernameState({
          isChecking: false,
          available: payload.available,
          message: payload.message,
        })
      } catch (error) {
        setUsernameState({
          isChecking: false,
          available: null,
          message: error.message || t('profile.edit.usernameCheckFailed'),
        })
      }
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [formState.username, profileState.isLoading, t])

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!hasUnsavedChanges) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  if (status === 'loading') {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${lang}/login`} replace />
  }

  async function handleSaveProfile() {
    const initialSnapshot = initialSnapshotRef.current
      ? JSON.parse(initialSnapshotRef.current)
      : null
    const updatePayload = buildProfileUpdatePayload(
      formState,
      locationInput,
      initialSnapshot,
    )

    if (!Object.keys(updatePayload).length) return

    const localValidationError = validateProfileUpdatePayload(updatePayload)
    if (localValidationError) {
      setSaveState({ isSubmitting: false, error: localValidationError, success: '' })
      setToast({ message: localValidationError, tone: 'error' })
      return
    }

    setSaveState({
      isSubmitting: true,
      error: '',
      success: '',
    })

    try {
      const payload = await updateMyProfile(updatePayload)

      setFormState(buildInitialForm(payload))
      setLocationInput(formatEditableLocation(payload.user.location))
      setUser(payload.user)
      initialSnapshotRef.current = JSON.stringify({
        form: buildInitialForm(payload),
        locationInput: formatEditableLocation(payload.user.location),
      })
      setIsLocationMenuOpen(false)
      setSaveState({
        isSubmitting: false,
        error: '',
        success: t('profile.edit.saveSuccess'),
      })
      setShowSavedState(true)
      setToast({
        message: t('profile.edit.saveSuccess'),
        tone: 'success',
      })
    } catch (error) {
      const errorMessage = getProfileSaveError(error, t('profile.edit.saveFailed'))
      setSaveState({
        isSubmitting: false,
        error: errorMessage,
        success: '',
      })
      setShowSavedState(false)
      setToast({
        message: errorMessage,
        tone: 'error',
      })
    }
  }

  async function handleChangePassword() {
    setPasswordState((currentState) => ({
      ...currentState,
      isSubmitting: true,
      error: '',
    }))

    try {
      await changeMyPassword({
        currentPassword: passwordState.currentPassword,
        newPassword: passwordState.newPassword,
      })

      setUser(null)
      navigate(`/${lang}/login`, { replace: true })
    } catch (error) {
      setPasswordState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: error.message || t('profile.edit.passwordChangeFailed'),
      }))
      setToast({
        message: error.message || t('profile.edit.passwordChangeFailed'),
        tone: 'error',
      })
    }
  }

  async function handleDeleteAccount() {
    const shouldDelete = window.confirm(t('profile.edit.deleteConfirm'))

    if (!shouldDelete) {
      return
    }

    setDeleteState((currentState) => ({
      ...currentState,
      isSubmitting: true,
      error: '',
    }))

    try {
      await deleteMyAccount({
        currentPassword: deleteState.currentPassword,
      })

      setUser(null)
      navigate(`/${lang}/signup`, { replace: true })
    } catch (error) {
      setDeleteState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: error.message || t('profile.edit.deleteFailed'),
      }))
      setToast({
        message: error.message || t('profile.edit.deleteFailed'),
        tone: 'error',
      })
    }
  }

  function handleBackToProfile(event) {
    if (!hasUnsavedChanges) {
      return
    }

    const shouldLeave = window.confirm(t('profile.edit.unsavedLeaveConfirm'))

    if (!shouldLeave) {
      event.preventDefault()
    }
  }

  return (
    <>
      <Seo
        title={t('profile.edit.seoTitle')}
        description={t('profile.edit.seoDescription')}
      />

      <SocialLayout
        pageTitle={t('profile.edit.pageTitle')}
        activeKey="profile"
        showDesktopPageHeader={false}
        desktopSidebarMode="drawer"
      >
        <div className="mx-auto max-w-[980px] ">
          {hasUnsavedChanges ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {t('profile.edit.unsavedWarning')}
            </div>
          ) : null}

          <div className="flex flex-col gap-4 rounded-t-lg border-x-1 border-border  bg-card px-5 pt-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
             
              <h1 className="mt-2 text-text font-bold tracking-tight text-md">
                {t('profile.edit.heading')}
              </h1>
              <p className=" max-w-2xl text-xs leading-6 text-soft">
                {t('profile.edit.subtitle')}
              </p>
            </div>

            <Link
              to={`/${lang}/profile`}
              onClick={handleBackToProfile}
              className=" items-center hidden md:flex justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-regular text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <ArrowLeftIcon />
              <span>{t('profile.edit.backToProfile')}</span>
            </Link>
          </div>

          {profileState.error ? (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {profileState.error}
            </div>
          ) : null}

          {profileState.isLoading ? (
            <div className="rounded-[30px] border border-zinc-200 bg-white px-5 py-10 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              {t('profile.edit.loading')}
            </div>
          ) : null}

          {!profileState.isLoading ? (
            <>
              <SectionCard
                title={t('profile.edit.profileSectionTitle')}
                description={t('profile.edit.profileSectionDescription')}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <InputField label={t('auth.firstName')}>
                    <input
                      maxLength={NAME_MAX_LENGTH}
                      value={formState.firstName}
                      onChange={(event) =>
                        setFormState((currentState) => ({
                          ...currentState,
                          firstName: event.target.value.slice(0, NAME_MAX_LENGTH),
                        }))
                      }
                      className={inputClassName}
                    />
                  </InputField>

                  <InputField label={t('auth.lastName')}>
                    <input
                      maxLength={NAME_MAX_LENGTH}
                      value={formState.lastName}
                      onChange={(event) =>
                        setFormState((currentState) => ({
                          ...currentState,
                          lastName: event.target.value.slice(0, NAME_MAX_LENGTH),
                        }))
                      }
                      className={inputClassName}
                    />
                  </InputField>

                  <InputField label={t('auth.email')}>
                    <input
                      type="email"
                      value={formState.email}
                      onChange={(event) =>
                        setFormState((currentState) => ({
                          ...currentState,
                          email: event.target.value,
                        }))
                      }
                      className={inputClassName}
                    />
                  </InputField>

                  <InputField label={t('profile.edit.usernameLabel')} helperText={t('profile.edit.usernameHelper')}>
                    <input
                      value={formState.username}
                      onChange={(event) =>
                        setFormState((currentState) => ({
                          ...currentState,
                          username: event.target.value.replace(/\s+/g, ''),
                        }))
                      }
                      className={inputClassName}
                    />
                    {usernameState.message ? (
                      <span
                        className={`mt-2 block text-xs ${
                          usernameState.available === false
                            ? 'text-rose-600 dark:text-rose-300'
                            : usernameState.available
                              ? 'text-emerald-600 dark:text-emerald-300'
                              : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {usernameState.message}
                      </span>
                    ) : null}
                  </InputField>

                  <div ref={locationWrapperRef} className="relative md:col-span-2">
                    <InputField
                      label={t('profile.edit.locationLabel')}
                      helperText={t('profile.edit.locationHelper')}
                    >
                      <input
                        value={locationInput}
                        onFocus={() => setIsLocationMenuOpen(locationOptions.length > 0)}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setLocationInput(nextValue)
                          setFormState((currentState) => ({
                            ...currentState,
                            location: parseLocationInput(nextValue, currentState.location),
                          }))
                          setIsLocationMenuOpen(nextValue.trim().length >= 2)
                        }}
                        placeholder={t('profile.edit.locationPlaceholder')}
                        className={inputClassName}
                      />
                    </InputField>

                    {isLocationMenuOpen && locationOptions.length ? (
                      <div className="absolute left-0 right-0 top-full z-20 rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ">
                        {locationOptions.map((option) => {
                          const label = option.city ? `${option.city}, ${option.country}` : option.country

                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => {
                                setLocationInput(label)
                                setFormState((currentState) => ({
                                  ...currentState,
                                  location: {
                                    city: option.city,
                                    country: option.country,
                                  },
                                }))
                                setIsLocationMenuOpen(false)
                              }}
                              className="block w-full rounded-2xl px-4 py-3 text-left text-sm text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="md:col-span-2">
                    <InputField label={t('profile.edit.bioLabel')} helperText={`${formState.bio.length}/${BIO_MAX_LENGTH}`}>
                      <textarea
                        rows={5}
                        maxLength={BIO_MAX_LENGTH}
                        value={formState.bio}
                        onChange={(event) =>
                          setFormState((currentState) => ({
                            ...currentState,
                            bio: event.target.value.slice(0, BIO_MAX_LENGTH),
                          }))
                        }
                        className="h-18 w-full text-base rounded-lg border border-border bg-secondary py-2 px-4 text-text outline-none transition placeholder:text-zinc-400 focus:border-blue-400/60 dark:placeholder:text-zinc-500 "
                      />
                    </InputField>
                  </div>

                  <label className="flex items-center gap-3  text-sm text-text md:col-span-2">
                    <input
                      type="checkbox"
                      checked={formState.isPrivate}
                      onChange={(event) =>
                        setFormState((currentState) => ({
                          ...currentState,
                          isPrivate: event.target.checked,
                        }))
                      }
                      className="size-4 rounded border-zinc-300"
                    />
                    <span>{t('profile.hideProfileToggle')}</span>
                  </label>
                </div>

                {saveState.error ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                    {saveState.error}
                  </div>
                ) : null}

                {saveState.success ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {saveState.success}
                  </div>
                ) : null}

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={!hasProfileChanges || saveState.isSubmitting || usernameState.available === false || usernameState.isChecking}
                    className="rounded-lg bg-primary px-4 py-2 text-base font-regular text-white transition hover:bg-primary-hover cursor-pointer disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                  >
                    {saveState.isSubmitting
                      ? t('profile.edit.saving')
                      : showSavedState
                        ? t('profile.edit.saved')
                        : t('profile.edit.saveProfile')}
                  </button>
                </div>
              </SectionCard>

              <AccordionSection
                title={t('profile.edit.callingSectionTitle')}
                description={t('profile.edit.callingSectionDescription')}
                open={isCallingOpen}
                onToggle={() => setIsCallingOpen((current) => !current)}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 p-4 transition">
                    <div className="pr-4">
                      <p className="text-sm font-semibold text-text">
                        {t('profile.edit.allowVoiceCalls')}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {t('profile.edit.allowVoiceCallsDescription')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.voiceCallEnabled}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, voiceCallEnabled: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/50 p-4 transition">
                    <div className="pr-4">
                      <p className="text-sm font-semibold text-text">
                        {t('profile.edit.allowVideoCalls')}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {t('profile.edit.allowVideoCallsDescription')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.videoCallEnabled}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, videoCallEnabled: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={!hasProfileChanges || saveState.isSubmitting}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover cursor-pointer disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                    >
                      {saveState.isSubmitting
                        ? t('profile.edit.saving')
                        : showSavedState
                          ? t('profile.edit.saved')
                          : t('common.save')}
                    </button>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                title={t('profile.edit.passwordSectionTitle')}
                description={t('profile.edit.passwordSectionDescription')}
                open={isPasswordOpen}
                onToggle={() => setIsPasswordOpen((current) => !current)}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <PasswordInput
                    label={t('profile.edit.currentPassword')}
                    value={passwordState.currentPassword}
                    visible={showCurrentPassword}
                    onToggle={() => setShowCurrentPassword((current) => !current)}
                    showLabel={t('auth.showPassword')}
                    hideLabel={t('auth.hidePassword')}
                    onChange={(event) =>
                      setPasswordState((currentState) => ({
                        ...currentState,
                        currentPassword: event.target.value,
                      }))
                    }
                  />

                  <PasswordInput
                    label={t('profile.edit.newPassword')}
                    value={passwordState.newPassword}
                    visible={showNewPassword}
                    onToggle={() => setShowNewPassword((current) => !current)}
                    showLabel={t('auth.showPassword')}
                    hideLabel={t('auth.hidePassword')}
                    onChange={(event) =>
                      setPasswordState((currentState) => ({
                        ...currentState,
                        newPassword: event.target.value,
                      }))
                    }
                  />
                </div>

                {passwordState.error ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                    {passwordState.error}
                  </div>
                ) : null}

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={passwordState.isSubmitting}
                    className="rounded-lg bg-primary px-4 py-2 text-base font-regular text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-white   dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                  >
                    {passwordState.isSubmitting ? t('profile.edit.updating') : t('profile.edit.changePassword')}
                  </button>
                </div>
              </AccordionSection>

              <AccordionSection
                title={t('profile.edit.deleteSectionTitle')}
                description={t('profile.edit.deleteSectionDescription')}
                open={isDeleteOpen}
                onToggle={() => setIsDeleteOpen((current) => !current)}
                danger
              >
                <PasswordInput
                  label={t('profile.edit.currentPassword')}
                  value={deleteState.currentPassword}
                  visible={showDeletePassword}
                  onToggle={() => setShowDeletePassword((current) => !current)}
                  showLabel={t('auth.showPassword')}
                  hideLabel={t('auth.hidePassword')}
                  onChange={(event) =>
                    setDeleteState((currentState) => ({
                      ...currentState,
                      currentPassword: event.target.value,
                    }))
                  }
                />

                {deleteState.error ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                    {deleteState.error}
                  </div>
                ) : null}

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleteState.isSubmitting}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-regular text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-300 dark:disabled:bg-rose-900/60"
                  >
                    {deleteState.isSubmitting ? t('profile.edit.deleting') : t('profile.edit.deleteAccount')}
                  </button>
                </div>
              </AccordionSection>
            </>
          ) : null}
        </div>
      </SocialLayout>

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

export default EditProfilePage
