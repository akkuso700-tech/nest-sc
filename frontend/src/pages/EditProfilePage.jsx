import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
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
  const voiceEnabled = profile?.user?.preferences?.calling?.voiceCallEnabled !== false
  const videoEnabled = profile?.user?.preferences?.calling?.videoCallEnabled !== false
  const emailMsgEnabled = profile?.user?.preferences?.emailNotifications?.messages !== false
  const shadowInApp = Boolean(profile?.user?.preferences?.inAppNotifications?.shadowMessages)
  const shadowEmail = Boolean(profile?.user?.preferences?.emailNotifications?.shadowMessages)

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
    emailMessagesEnabled: emailMsgEnabled,
    callPermissionsEnabled: voiceEnabled && videoEnabled,
    voiceCallEnabled: voiceEnabled,
    videoCallEnabled: videoEnabled,
    shadowInAppEnabled: shadowInApp,
    shadowEmailEnabled: shadowEmail,
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

function UserTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5 md:size-4 shrink-0">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function CommunicationTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5 md:size-4 shrink-0">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SecurityTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5 md:size-4 shrink-0">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function AlertTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5 text-rose-600 dark:text-rose-400 shrink-0">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5 shrink-0">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

function InputField({ label, children, helperText = '' }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
      {children}
      {helperText ? (
        <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{helperText}</span>
      ) : null}
    </label>
  )
}

function ToggleSwitch({ checked, onChange, disabled = false, ariaLabel = '' }) {
  return (
    <label className={`relative inline-flex items-center shrink-0 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="sr-only peer"
      />
      <div className="h-6 w-11 rounded-full bg-zinc-300 peer-focus:outline-none dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-300 after:bg-white after:transition-all dark:border-zinc-600 peer-checked:bg-primary"></div>
    </label>
  )
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle,
  showLabel,
  hideLabel,
  placeholder = '',
}) {
  return (
    <InputField label={label}>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
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

const inputClassName =
  'h-12 w-full rounded-lg text-base border border-border bg-secondary px-4 text-text outline-none transition placeholder:text-zinc-400 focus:border-blue-400/60 dark:placeholder:text-zinc-500'
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

function buildGeneralPayload(form, locationInputValue, initialForm) {
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
        ? String(initialForm?.[field] || '').trim().toLowerCase()
        : field === 'isPrivate'
          ? Boolean(initialForm?.[field])
          : String(initialForm?.[field] || '').trim()

    if (value !== initialValue) payload[field] = value
  })

  const nextLocation = parseLocationInput(locationInputValue, form.location)
  const initialLocation = initialForm?.location || { city: '', country: '' }
  if (
    nextLocation.city !== (initialLocation.city || '') ||
    nextLocation.country !== (initialLocation.country || '')
  ) {
    payload.location = nextLocation
  }

  return payload
}

function buildCommunicationPayload(form, initialForm) {
  const payload = {}
  const hasEmailMsgChanged = Boolean(form.emailMessagesEnabled) !== Boolean(initialForm?.emailMessagesEnabled)
  const hasVoiceChanged = Boolean(form.voiceCallEnabled) !== Boolean(initialForm?.voiceCallEnabled)
  const hasVideoChanged = Boolean(form.videoCallEnabled) !== Boolean(initialForm?.videoCallEnabled)
  const hasShadowInAppChanged = Boolean(form.shadowInAppEnabled) !== Boolean(initialForm?.shadowInAppEnabled)
  const hasShadowEmailChanged = Boolean(form.shadowEmailEnabled) !== Boolean(initialForm?.shadowEmailEnabled)

  if (hasEmailMsgChanged || hasVoiceChanged || hasVideoChanged || hasShadowInAppChanged || hasShadowEmailChanged) {
    payload.preferences = {}

    if (hasVoiceChanged || hasVideoChanged) {
      payload.preferences.calling = {
        voiceCallEnabled: Boolean(form.voiceCallEnabled),
        videoCallEnabled: Boolean(form.videoCallEnabled),
      }
    }

    if (hasEmailMsgChanged || hasShadowEmailChanged) {
      payload.preferences.emailNotifications = {}
      if (hasEmailMsgChanged) {
        payload.preferences.emailNotifications.messages = Boolean(form.emailMessagesEnabled)
      }
      if (hasShadowEmailChanged) {
        payload.preferences.emailNotifications.shadowMessages = Boolean(form.shadowEmailEnabled)
      }
    }

    if (hasShadowInAppChanged) {
      payload.preferences.inAppNotifications = {
        shadowMessages: Boolean(form.shadowInAppEnabled),
      }
    }
  }

  return payload
}

function validateGeneralPayload(payload) {
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

function normalizeTabHash(rawHash) {
  const cleaned = (rawHash || '').replace(/^#/, '').trim().toLowerCase()
  if (cleaned === 'iletisim-tercihleri' || cleaned === 'iletisim' || cleaned === 'communication') {
    return 'iletisim-tercihleri'
  }
  if (cleaned === 'hesap-guvenlik' || cleaned === 'hesap' || cleaned === 'guvenlik' || cleaned === 'security') {
    return 'hesap-guvenlik'
  }
  return 'genel-bilgiler'
}

function EditProfilePage() {
  const { lang } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { status, isAuthenticated, user, setUser } = useAuth()
  const authUserId = user?._id || user?.id || ''

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return normalizeTabHash(window.location.hash)
    }
    return 'genel-bilgiler'
  })

  const [profileState, setProfileState] = useState({
    isLoading: true,
    error: '',
  })
  const [formState, setFormState] = useState(buildInitialForm(null))
  const [locationInput, setLocationInput] = useState('')

  // Independent save states
  const [generalSaveState, setGeneralSaveState] = useState({
    isSubmitting: false,
    error: '',
    success: '',
  })
  const [commSaveState, setCommSaveState] = useState({
    isSubmitting: false,
    error: '',
    success: '',
  })
  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    isSubmitting: false,
    error: '',
  })
  const [deleteState, setDeleteState] = useState({
    currentPassword: '',
    isSubmitting: false,
    error: '',
  })

  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
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

  const [showGeneralSavedState, setShowGeneralSavedState] = useState(false)
  const [showCommSavedState, setShowCommSavedState] = useState(false)

  const locationWrapperRef = useRef(null)
  const initialSnapshotRef = useRef('')

  // URL Hash synchronization
  useEffect(() => {
    function handleHashChange() {
      const nextTab = normalizeTabHash(window.location.hash)
      setActiveTab(nextTab)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const tabRefs = useRef({})

  useEffect(() => {
    const activeEl = tabRefs.current[activeTab]
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [activeTab])

  function handleTabClick(tabId) {
    setActiveTab(tabId)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tabId}`)
    }
  }

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
    if (!showGeneralSavedState) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowGeneralSavedState(false)
    }, 1800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [showGeneralSavedState])

  useEffect(() => {
    if (!showCommSavedState) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowCommSavedState(false)
    }, 1800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [showCommSavedState])

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

        const initialForm = buildInitialForm(payload)
        const initialLoc = formatEditableLocation(payload.user.location)

        setFormState(initialForm)
        setLocationInput(initialLoc)
        initialSnapshotRef.current = JSON.stringify({
          form: initialForm,
          locationInput: initialLoc,
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

  const hasGeneralChanges = useMemo(() => {
    if (profileState.isLoading || !initialSnapshotRef.current) return false
    try {
      const initial = JSON.parse(initialSnapshotRef.current)
      const payload = buildGeneralPayload(formState, locationInput, initial.form)
      return Object.keys(payload).length > 0
    } catch {
      return false
    }
  }, [profileState.isLoading, formState, locationInput])

  const hasCommunicationChanges = useMemo(() => {
    if (profileState.isLoading || !initialSnapshotRef.current) return false
    try {
      const initial = JSON.parse(initialSnapshotRef.current)
      const payload = buildCommunicationPayload(formState, initial.form)
      return Object.keys(payload).length > 0
    } catch {
      return false
    }
  }, [profileState.isLoading, formState])

  const hasSecurityDraft = Boolean(
    passwordState.currentPassword ||
    passwordState.newPassword ||
    passwordState.confirmNewPassword ||
    deleteState.currentPassword
  )

  const hasUnsavedChanges = hasGeneralChanges || hasCommunicationChanges || hasSecurityDraft

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

  // General Info save handler
  async function handleSaveGeneralInfo() {
    const initialSnapshot = initialSnapshotRef.current ? JSON.parse(initialSnapshotRef.current) : null
    const updatePayload = buildGeneralPayload(formState, locationInput, initialSnapshot?.form)

    if (!Object.keys(updatePayload).length) return

    const localValidationError = validateGeneralPayload(updatePayload)
    if (localValidationError) {
      setGeneralSaveState({ isSubmitting: false, error: localValidationError, success: '' })
      setToast({ message: localValidationError, tone: 'error' })
      return
    }

    setGeneralSaveState({
      isSubmitting: true,
      error: '',
      success: '',
    })

    try {
      const payload = await updateMyProfile(updatePayload)
      const updatedForm = buildInitialForm(payload)
      const updatedLoc = formatEditableLocation(payload.user.location)

      setFormState((prev) => ({
        ...prev,
        firstName: updatedForm.firstName,
        lastName: updatedForm.lastName,
        email: updatedForm.email,
        username: updatedForm.username,
        bio: updatedForm.bio,
        isPrivate: updatedForm.isPrivate,
        location: updatedForm.location,
      }))
      setLocationInput(updatedLoc)
      setUser(payload.user)

      // update initial snapshot keeping existing preferences
      const existingSnapshot = initialSnapshotRef.current ? JSON.parse(initialSnapshotRef.current) : {}
      initialSnapshotRef.current = JSON.stringify({
        form: {
          ...(existingSnapshot.form || {}),
          firstName: updatedForm.firstName,
          lastName: updatedForm.lastName,
          email: updatedForm.email,
          username: updatedForm.username,
          bio: updatedForm.bio,
          isPrivate: updatedForm.isPrivate,
          location: updatedForm.location,
        },
        locationInput: updatedLoc,
      })

      setIsLocationMenuOpen(false)
      setGeneralSaveState({
        isSubmitting: false,
        error: '',
        success: t('profile.edit.saveSuccess'),
      })
      setShowGeneralSavedState(true)
      setToast({
        message: t('profile.edit.saveSuccess'),
        tone: 'success',
      })
    } catch (error) {
      const errorMessage = getProfileSaveError(error, t('profile.edit.saveFailed'))
      setGeneralSaveState({
        isSubmitting: false,
        error: errorMessage,
        success: '',
      })
      setShowGeneralSavedState(false)
      setToast({
        message: errorMessage,
        tone: 'error',
      })
    }
  }

  // Communication Preferences save handler
  async function handleSaveCommunicationPreferences() {
    const initialSnapshot = initialSnapshotRef.current ? JSON.parse(initialSnapshotRef.current) : null
    const updatePayload = buildCommunicationPayload(formState, initialSnapshot?.form)

    if (!Object.keys(updatePayload).length) return

    setCommSaveState({
      isSubmitting: true,
      error: '',
      success: '',
    })

    try {
      const payload = await updateMyProfile(updatePayload)
      const updatedForm = buildInitialForm(payload)

      setFormState((prev) => ({
        ...prev,
        emailMessagesEnabled: updatedForm.emailMessagesEnabled,
        callPermissionsEnabled: updatedForm.callPermissionsEnabled,
        voiceCallEnabled: updatedForm.voiceCallEnabled,
        videoCallEnabled: updatedForm.videoCallEnabled,
        shadowInAppEnabled: updatedForm.shadowInAppEnabled,
        shadowEmailEnabled: updatedForm.shadowEmailEnabled,
      }))
      setUser(payload.user)

      // update initial snapshot keeping existing general info
      const existingSnapshot = initialSnapshotRef.current ? JSON.parse(initialSnapshotRef.current) : {}
      initialSnapshotRef.current = JSON.stringify({
        form: {
          ...(existingSnapshot.form || {}),
          emailMessagesEnabled: updatedForm.emailMessagesEnabled,
          callPermissionsEnabled: updatedForm.callPermissionsEnabled,
          voiceCallEnabled: updatedForm.voiceCallEnabled,
          videoCallEnabled: updatedForm.videoCallEnabled,
          shadowInAppEnabled: updatedForm.shadowInAppEnabled,
          shadowEmailEnabled: updatedForm.shadowEmailEnabled,
        },
        locationInput: existingSnapshot.locationInput || locationInput,
      })

      setCommSaveState({
        isSubmitting: false,
        error: '',
        success: t('profile.edit.saveSuccess'),
      })
      setShowCommSavedState(true)
      setToast({
        message: t('profile.edit.saveSuccess'),
        tone: 'success',
      })
    } catch (error) {
      const errorMessage = getProfileSaveError(error, t('profile.edit.saveFailed'))
      setCommSaveState({
        isSubmitting: false,
        error: errorMessage,
        success: '',
      })
      setShowCommSavedState(false)
      setToast({
        message: errorMessage,
        tone: 'error',
      })
    }
  }

  async function handleChangePassword() {
    if (!passwordState.currentPassword) {
      setPasswordState((currentState) => ({
        ...currentState,
        error: t('profile.edit.currentPasswordRequired', 'Mevcut şifrenizi girmelisiniz.'),
      }))
      return
    }

    if (!passwordState.newPassword) {
      setPasswordState((currentState) => ({
        ...currentState,
        error: t('profile.edit.newPasswordRequired', 'Yeni şifrenizi girmelisiniz.'),
      }))
      return
    }

    if (passwordState.newPassword.length < 8) {
      setPasswordState((currentState) => ({
        ...currentState,
        error: t('profile.edit.passwordTooShort', 'Yeni şifre en az 8 karakter olmalıdır.'),
      }))
      return
    }

    if (passwordState.newPassword !== passwordState.confirmNewPassword) {
      setPasswordState((currentState) => ({
        ...currentState,
        error: t('profile.edit.passwordMismatch', 'Yeni şifre ve yeni şifre tekrarı birbiriyle eşleşmiyor.'),
      }))
      return
    }

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
    if (!deleteState.currentPassword) {
      setDeleteState((currentState) => ({
        ...currentState,
        error: t('profile.edit.deletePasswordRequired', 'Hesabı silmek için mevcut şifrenizi girmelisiniz.'),
      }))
      return
    }

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

  const tabs = [
    {
      id: 'genel-bilgiler',
      label: t('profile.edit.tabsGeneral', 'Genel Bilgiler'),
      icon: <UserTabIcon />,
      hasBadge: hasGeneralChanges,
    },
    {
      id: 'iletisim-tercihleri',
      label: t('profile.edit.tabsCommunication', 'İletişim Tercihleri'),
      icon: <CommunicationTabIcon />,
      hasBadge: hasCommunicationChanges,
    },
    {
      id: 'hesap-guvenlik',
      label: t('profile.edit.tabsSecurity', 'Hesap & Güvenlik'),
      icon: <SecurityTabIcon />,
      hasBadge: hasSecurityDraft,
    },
  ]

  if (status === 'loading') {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${lang}/login`} replace state={{ from: location.pathname }} />
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
        <div className="mx-auto max-w-[980px]">
          {hasUnsavedChanges ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-700 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {t('profile.edit.unsavedWarning')}
            </div>
          ) : null}

          {/* Tab Navigation Bar - with horizontal scroll on mobile */}
          <div className="flex items-center justify-between rounded-t-xl border border-b border-border bg-card px-2.5 sm:px-4 md:px-6">
            <nav
              className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto whitespace-nowrap scroll-smooth scrollbar-none py-1.5 sm:py-2 md:py-2.5 min-w-0"
              style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}
              aria-label="Profil Sekmeleri"
              role="tablist"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el
                    }}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-controls={`tabpanel-${tab.id}`}
                    aria-selected={isActive}
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center gap-1.5 sm:gap-2 rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-medium transition shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted hover:text-text hover:bg-secondary'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.hasBadge ? (
                      <span
                        className={`size-1.5 sm:size-2 rounded-full ${
                          isActive ? 'bg-white' : 'bg-amber-500'
                        }`}
                        title="Değişiklik var"
                      />
                    ) : null}
                  </button>
                )
              })}
            </nav>

            <Link
              to={`/${lang}/profile`}
              onClick={handleBackToProfile}
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-text transition hover:bg-secondary shrink-0 ml-3"
            >
              <ArrowLeftIcon />
              <span>{t('profile.edit.backToProfile')}</span>
            </Link>
          </div>

          {profileState.error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {profileState.error}
            </div>
          ) : null}

          {profileState.isLoading ? (
            <div className="rounded-b-xl border border-border bg-card px-5 py-12 text-center text-sm text-zinc-500 shadow-sm dark:text-zinc-400">
              {t('profile.edit.loading')}
            </div>
          ) : null}

          {!profileState.isLoading ? (
            <div className="rounded-b-xl border border-t-0 border-border bg-card p-5 md:p-6 mb-8 shadow-sm">
              {/* TAB 1: GENEL BİLGİLER */}
              {activeTab === 'genel-bilgiler' && (
                <section
                  id="tabpanel-genel-bilgiler"
                  role="tabpanel"
                  aria-labelledby="tab-genel-bilgiler"
                >
                  <div className="mb-5">
                    <h2 className="text-base font-semibold text-text">
                      {t('profile.edit.profileSectionTitle')}
                    </h2>
                    <p className="text-xs text-soft mt-1">
                      {t('profile.edit.profileSectionDescription')}
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSaveGeneralInfo()
                    }}
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

                      <InputField
                        label={t('profile.edit.usernameLabel')}
                        helperText={t('profile.edit.usernameHelper')}
                      >
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
                            className={`mt-1.5 block text-xs ${
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
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
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
                                  className="block w-full rounded-lg px-4 py-2.5 text-left text-sm text-zinc-700 transition hover:bg-secondary dark:text-zinc-200"
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className="md:col-span-2">
                        <InputField
                          label={t('profile.edit.bioLabel')}
                          helperText={`${formState.bio.length}/${BIO_MAX_LENGTH}`}
                        >
                          <textarea
                            rows={4}
                            maxLength={BIO_MAX_LENGTH}
                            value={formState.bio}
                            onChange={(event) =>
                              setFormState((currentState) => ({
                                ...currentState,
                                bio: event.target.value.slice(0, BIO_MAX_LENGTH),
                              }))
                            }
                            className="h-24 w-full text-base rounded-lg border border-border bg-secondary py-2.5 px-4 text-text outline-none transition placeholder:text-zinc-400 focus:border-blue-400/60 dark:placeholder:text-zinc-500"
                          />
                        </InputField>
                      </div>

                      <label className="flex items-center gap-3 text-sm text-text md:col-span-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formState.isPrivate}
                          onChange={(event) =>
                            setFormState((currentState) => ({
                              ...currentState,
                              isPrivate: event.target.checked,
                            }))
                          }
                          className="size-4 rounded border-zinc-300 accent-primary"
                        />
                        <span>{t('profile.hideProfileToggle')}</span>
                      </label>
                    </div>

                    {generalSaveState.error ? (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                        {generalSaveState.error}
                      </div>
                    ) : null}

                    {generalSaveState.success ? (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                        {generalSaveState.success}
                      </div>
                    ) : null}

                    <div className="mt-6 flex justify-end">
                      <button
                        type="submit"
                        disabled={
                          !hasGeneralChanges ||
                          generalSaveState.isSubmitting ||
                          usernameState.available === false ||
                          usernameState.isChecking
                        }
                        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover cursor-pointer disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 shadow-sm"
                      >
                        {generalSaveState.isSubmitting
                          ? t('profile.edit.saving')
                          : showGeneralSavedState
                            ? t('profile.edit.saved')
                            : t('profile.edit.saveProfile')}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* TAB 2: İLETİŞİM TERCİHLERİ */}
              {activeTab === 'iletisim-tercihleri' && (
                <section
                  id="tabpanel-iletisim-tercihleri"
                  role="tabpanel"
                  aria-labelledby="tab-iletisim-tercihleri"
                  className="space-y-6"
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSaveCommunicationPreferences()
                    }}
                    className="space-y-6"
                  >
                    {/* Kart 1: Mesaj Bildirimleri */}
                    <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
                      <div className="mb-4">
                        <h2 className="text-base font-semibold text-text">
                          {t('profile.edit.messageNotificationsTitle', 'Mesaj Bildirimleri')}
                        </h2>
                        <p className="text-xs text-soft mt-1">
                          {t(
                            'profile.edit.messageNotificationsDesc',
                            'Mesajlar ve arama izinleri ile ilgili bildirim ayarlarınızı düzenleyin.'
                          )}
                        </p>
                      </div>

                      <div className="space-y-4">
                        {/* Mesaj e-posta bildirimi */}
                        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4 transition hover:bg-secondary/60">
                          <div className="pr-4">
                            <p className="text-sm font-medium text-text">
                              {t('profile.edit.emailMessagesNotification', 'Mesaj e-posta bildirimi')}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {t(
                                'profile.edit.emailMessagesNotificationDesc',
                                'Yeni bir direkt mesaj aldığınızda e-posta ile bildirim alın.'
                              )}
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={formState.emailMessagesEnabled}
                            onChange={(checked) =>
                              setFormState((prev) => ({
                                ...prev,
                                emailMessagesEnabled: checked,
                              }))
                            }
                            ariaLabel="Mesaj e-posta bildirimi"
                          />
                        </div>

                        {/* Sesli ve Görüntülü arama izinleri */}
                        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4 transition hover:bg-secondary/60">
                          <div className="pr-4">
                            <p className="text-sm font-medium text-text">
                              {t('profile.edit.callingAndVideoPermissions', 'Sesli ve Görüntülü arama izinleri')}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {t(
                                'profile.edit.callingAndVideoPermissionsDesc',
                                'Diğer kullanıcıların sizinle sesli veya görüntülü arama başlatabilmesine izin verin.'
                              )}
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={formState.callPermissionsEnabled}
                            onChange={(checked) =>
                              setFormState((prev) => ({
                                ...prev,
                                callPermissionsEnabled: checked,
                                voiceCallEnabled: checked,
                                videoCallEnabled: checked,
                              }))
                            }
                            ariaLabel="Sesli ve Görüntülü arama izinleri"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Kart 2: Gölge Modu */}
                    <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
                      <div className="mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-text">
                            {t('profile.edit.shadowModeTitle', 'Gölge Modu')}
                          </h2>
                          <span className="text-xs text-soft font-normal">
                            ({t('profile.edit.shadowModeNote', 'Anonim mesajlaşma ve gölge modu bildirim tercihleri')})
                          </span>
                        </div>
                        <p className="text-xs text-soft mt-1">
                          {t(
                            'profile.edit.shadowModeSubtitle',
                            'Gölge Modu mesajlaşma sistemi için geçerli olan bildirimleri yapılandırın.'
                          )}
                        </p>
                      </div>

                      <div className="space-y-4">
                        {/* Gölge modunda gelen mesajların normal site içerisinde anlık bildirilmesi */}
                        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4 transition hover:bg-secondary/60">
                          <div className="pr-4">
                            <p className="text-sm font-medium text-text">
                              {t(
                                'profile.edit.shadowInAppLabel',
                                'Gölge modunda gelen mesajların normal site içerisinde anlık bildirilmesi'
                              )}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {t(
                                'profile.edit.allowShadowInAppNotificationsDescription',
                                'Gölge Modunda yeni bir mesaj geldiğinde site içinde anlık bildirim gösterilsin.'
                              )}
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={formState.shadowInAppEnabled}
                            onChange={(checked) =>
                              setFormState((prev) => ({
                                ...prev,
                                shadowInAppEnabled: checked,
                              }))
                            }
                            ariaLabel="Gölge modunda gelen mesajların anlık bildirilmesi"
                          />
                        </div>

                        {/* Gölge modu e-posta bildirimleri */}
                        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4 transition hover:bg-secondary/60">
                          <div className="pr-4">
                            <p className="text-sm font-medium text-text">
                              {t('profile.edit.shadowEmailLabel', 'Gölge modu e-posta bildirimleri')}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {t(
                                'profile.edit.allowShadowEmailNotificationsDescription',
                                'Gölge Modunda çevrimdışıyken gelen mesajlar için e-posta bildirimi gönderilsin.'
                              )}
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={formState.shadowEmailEnabled}
                            onChange={(checked) =>
                              setFormState((prev) => ({
                                ...prev,
                                shadowEmailEnabled: checked,
                              }))
                            }
                            ariaLabel="Gölge modu e-posta bildirimleri"
                          />
                        </div>
                      </div>
                    </div>

                    {commSaveState.error ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                        {commSaveState.error}
                      </div>
                    ) : null}

                    {commSaveState.success ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                        {commSaveState.success}
                      </div>
                    ) : null}

                    {/* Bağımsız Kaydet Butonu */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={!hasCommunicationChanges || commSaveState.isSubmitting}
                        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover cursor-pointer disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 shadow-sm"
                      >
                        {commSaveState.isSubmitting
                          ? t('profile.edit.saving')
                          : showCommSavedState
                            ? t('profile.edit.saved')
                            : t('profile.edit.savePreferences', 'Tercihleri Kaydet')}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* TAB 3: HESAP & GÜVENLİK */}
              {activeTab === 'hesap-guvenlik' && (
                <section
                  id="tabpanel-hesap-guvenlik"
                  role="tabpanel"
                  aria-labelledby="tab-hesap-guvenlik"
                  className="space-y-6"
                >
                  {/* Kart 1: Şifre Değiştir */}
                  <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-base font-semibold text-text">
                        {t('profile.edit.passwordSectionTitle', 'Şifre Değiştir')}
                      </h2>
                      <p className="text-xs text-soft mt-1">
                        {t(
                          'profile.edit.passwordSectionDescription',
                          'Mevcut şifrenizi ve yeni şifrenizi girerek hesap şifrenizi güncelleyebilirsiniz.'
                        )}
                      </p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleChangePassword()
                      }}
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        <PasswordInput
                          label={t('profile.edit.currentPassword', 'Mevcut Şifre')}
                          value={passwordState.currentPassword}
                          visible={showCurrentPassword}
                          onToggle={() => setShowCurrentPassword((current) => !current)}
                          showLabel={t('auth.showPassword')}
                          hideLabel={t('auth.hidePassword')}
                          placeholder="••••••••"
                          onChange={(event) =>
                            setPasswordState((currentState) => ({
                              ...currentState,
                              currentPassword: event.target.value,
                              error: '',
                            }))
                          }
                        />

                        <PasswordInput
                          label={t('profile.edit.newPassword', 'Yeni Şifre')}
                          value={passwordState.newPassword}
                          visible={showNewPassword}
                          onToggle={() => setShowNewPassword((current) => !current)}
                          showLabel={t('auth.showPassword')}
                          hideLabel={t('auth.hidePassword')}
                          placeholder="••••••••"
                          onChange={(event) =>
                            setPasswordState((currentState) => ({
                              ...currentState,
                              newPassword: event.target.value,
                              error: '',
                            }))
                          }
                        />

                        <PasswordInput
                          label={t('profile.edit.confirmNewPassword', 'Yeni Şifre (Tekrar)')}
                          value={passwordState.confirmNewPassword}
                          visible={showConfirmNewPassword}
                          onToggle={() => setShowConfirmNewPassword((current) => !current)}
                          showLabel={t('auth.showPassword')}
                          hideLabel={t('auth.hidePassword')}
                          placeholder="••••••••"
                          onChange={(event) =>
                            setPasswordState((currentState) => ({
                              ...currentState,
                              confirmNewPassword: event.target.value,
                              error: '',
                            }))
                          }
                        />
                      </div>

                      {passwordState.error ? (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                          {passwordState.error}
                        </div>
                      ) : null}

                      <div className="mt-5 flex justify-end">
                        <button
                          type="submit"
                          disabled={
                            passwordState.isSubmitting ||
                            !passwordState.currentPassword ||
                            !passwordState.newPassword ||
                            !passwordState.confirmNewPassword
                          }
                          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 shadow-sm cursor-pointer"
                        >
                          {passwordState.isSubmitting
                            ? t('profile.edit.updating')
                            : t('profile.edit.changePassword')}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Kart 2: Hesabı Sil (Tehlikeli Alan) */}
                  <div className="rounded-xl border-2 border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 p-5 md:p-6 shadow-sm">
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangleIcon />
                        <h2 className="text-base font-bold text-rose-600 dark:text-rose-400">
                          {t('profile.edit.deleteSectionTitle', 'Hesabı Sil')}
                        </h2>
                        <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
                          {t('profile.edit.dangerZone', 'Tehlikeli Alan')}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-rose-800/80 dark:text-rose-200/80">
                        {t(
                          'profile.edit.deleteAccountWarning',
                          'Dikkat: Hesabınızı sildiğinizde profiliniz, tüm paylaşımlarınız, mesajlarınız ve verileriniz kalıcı olarak silinir. Bu işlem kesinlikle geri alınamaz.'
                        )}
                      </p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleDeleteAccount()
                      }}
                      className="mt-4 max-w-md space-y-4"
                    >
                      <PasswordInput
                        label={t('profile.edit.deleteConfirmPasswordLabel', 'Onaylamak için mevcut şifrenizi girin')}
                        value={deleteState.currentPassword}
                        visible={showDeletePassword}
                        onToggle={() => setShowDeletePassword((current) => !current)}
                        showLabel={t('auth.showPassword')}
                        hideLabel={t('auth.hidePassword')}
                        placeholder="••••••••"
                        onChange={(event) =>
                          setDeleteState((currentState) => ({
                            ...currentState,
                            currentPassword: event.target.value,
                            error: '',
                          }))
                        }
                      />

                      {deleteState.error ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                          {deleteState.error}
                        </div>
                      ) : null}

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={deleteState.isSubmitting || !deleteState.currentPassword}
                          className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300 dark:disabled:bg-rose-900/50 shadow-sm cursor-pointer"
                        >
                          <TrashIcon />
                          <span>
                            {deleteState.isSubmitting
                              ? t('profile.edit.deleting')
                              : t('profile.edit.deleteAccount', 'Hesabı Kalıcı Olarak Sil')}
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>
                </section>
              )}
            </div>
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
