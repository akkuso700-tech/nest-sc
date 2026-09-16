import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ActionToast from '../components/feedback/ActionToast.jsx'
import Seo from '../components/seo/Seo.jsx'
import SocialLayout from '../layouts/SocialLayout.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import VerificationModal, { categories, CheckIcon, ChevronDownIcon } from '../components/profile/VerificationModal.jsx'
import {
  checkUsernameAvailability,
  changeMyPassword,
  deleteMyAccount,
  getMyProfile,
  updateMyProfile,
  getMyVerificationRequest,
  changeMySubscriptionPlan,
  cancelMySubscription,
  withdrawMyVerificationRequest,
} from '../services/usersService.js'
import { findLocationSuggestions } from '../app/locationSuggestions.js'
import { getLocationsAutocomplete } from '../services/locationsService.js'

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
    category: profile?.user?.verification?.category || 'individual',
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

function SubscriptionTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5 md:size-4 shrink-0">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
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

function HighlightMatch({ text = '', query = '' }) {
  if (!query || !query.trim() || !text) {
    return <span>{text}</span>
  }

  const tokens = query.trim().split(/\s+/).filter(Boolean)
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

  if (!escaped) {
    return <span>{text}</span>
  }

  let parts = null
  let regex = null
  try {
    regex = new RegExp(`(${escaped})`, 'gi')
    parts = text.split(regex)
  } catch {
    return <span>{text}</span>
  }

  return (
    <span>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <span key={index} className="font-semibold text-primary">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
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
  category: 'Hesap türü',
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
    category: form.category || 'individual',
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
  if (
    'category' in payload &&
    !['individual', 'creator', 'business', 'organization', 'public_figure'].includes(payload.category)
  ) {
    return 'Lütfen geçerli bir hesap türü seçin.'
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
  if (cleaned === 'abonelik-yonetimi' || cleaned === 'abonelik' || cleaned === 'subscription') {
    return 'abonelik-yonetimi'
  }
  return 'genel-bilgiler'
}

function EditProfilePage() {
  const { lang } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
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
  const [locationOptions, setLocationOptions] = useState([])
  const [isLocationLoading, setIsLocationLoading] = useState(false)
  const [highlightedLocationIndex, setHighlightedLocationIndex] = useState(-1)
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false)
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
  const categoryMenuRef = useRef(null)
  const initialSnapshotRef = useRef('')

  const selectedCategoryObj = useMemo(
    () => categories.find(([val]) => val === formState.category) || categories[0],
    [formState.category],
  )

  // Subscription management states
  const [verificationState, setVerificationState] = useState({
    isLoading: false,
    request: null,
    canApply: true,
    error: '',
  })
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  const [subscriptionActionState, setSubscriptionActionState] = useState({
    isSubmitting: false,
    confirmModal: null,
    targetPlan: null,
    error: '',
  })

  const loadVerificationData = useCallback(async () => {
    setVerificationState((prev) => ({ ...prev, isLoading: true, error: '' }))
    try {
      const res = await getMyVerificationRequest()
      setVerificationState({
        isLoading: false,
        request: res.request || null,
        canApply: Boolean(res.canApply),
        error: '',
      })
    } catch (err) {
      setVerificationState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Abonelik bilgileri yüklenemedi.',
      }))
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'abonelik-yonetimi') {
      loadVerificationData()
    }
  }, [activeTab, loadVerificationData])

  async function confirmPlanChange() {
    const targetPlan = subscriptionActionState.targetPlan
    if (!targetPlan) return
    setSubscriptionActionState((prev) => ({ ...prev, isSubmitting: true, error: '' }))
    try {
      const res = await changeMySubscriptionPlan({ plan: targetPlan })
      setToast({ message: res.message, tone: 'success' })
      if (res.user) setUser(res.user)
      await loadVerificationData()
      setSubscriptionActionState({ isSubmitting: false, confirmModal: null, targetPlan: null, error: '' })
    } catch (err) {
      setSubscriptionActionState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Plan güncellenemedi.',
      }))
      setToast({ message: err.message || 'Plan güncellenemedi.', tone: 'error' })
    }
  }

  async function confirmCancelSubscription() {
    setSubscriptionActionState((prev) => ({ ...prev, isSubmitting: true, error: '' }))
    try {
      const res = await cancelMySubscription()
      setToast({ message: res.message, tone: 'success' })
      if (res.user) setUser(res.user)
      await loadVerificationData()
      setSubscriptionActionState({ isSubmitting: false, confirmModal: null, targetPlan: null, error: '' })
    } catch (err) {
      setSubscriptionActionState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Abonelik iptal edilemedi.',
      }))
      setToast({ message: err.message || 'Abonelik iptal edilemedi.', tone: 'error' })
    }
  }

  async function handleWithdrawPending() {
    const ok = window.confirm('Bekleyen başvurunuzu ve aylık abonelik talebinizi geri çekmek istediğinizden emin misiniz?')
    if (!ok) return
    setSubscriptionActionState((prev) => ({ ...prev, isSubmitting: true, error: '' }))
    try {
      const res = await withdrawMyVerificationRequest()
      setToast({ message: res.message, tone: 'success' })
      await loadVerificationData()
      setSubscriptionActionState({ isSubmitting: false, confirmModal: null, targetPlan: null, error: '' })
    } catch (err) {
      setToast({ message: err.message || 'Başvuru geri çekilemedi.', tone: 'error' })
      setSubscriptionActionState((prev) => ({ ...prev, isSubmitting: false, error: err.message }))
    }
  }

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
      if (!categoryMenuRef.current?.contains(event.target)) {
        setIsCategoryMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    const trimmed = locationInput.trim()
    if (trimmed.length < 2) {
      setLocationOptions([])
      setHighlightedLocationIndex(-1)
      setIsLocationLoading(false)
      return
    }

    let isMounted = true
    const controller = new AbortController()

    const activeLang = (lang || i18n.language || 'tr').toLowerCase().split('-')[0]
    const timer = setTimeout(async () => {
      setIsLocationLoading(true)
      try {
        const response = await getLocationsAutocomplete(
          { q: trimmed, limit: 8, lang: activeLang },
          { signal: controller.signal }
        )
        if (!isMounted) return

        if (response?.suggestions && Array.isArray(response.suggestions)) {
          setLocationOptions(response.suggestions)
        } else {
          setLocationOptions(findLocationSuggestions(trimmed))
        }
      } catch (error) {
        if (!isMounted) return
        if (error.name !== 'AbortError') {
          setLocationOptions(findLocationSuggestions(trimmed))
        }
      } finally {
        if (isMounted) {
          setIsLocationLoading(false)
        }
      }
    }, 220)

    return () => {
      isMounted = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [locationInput, lang, i18n.language])

  const selectLocationOption = useCallback((option) => {
    const label = option.label || (option.city ? `${option.city}, ${option.country}` : option.country)
    setLocationInput(label)
    setFormState((currentState) => ({
      ...currentState,
      location: {
        city: option.city || '',
        country: option.country || '',
      },
    }))
    setIsLocationMenuOpen(false)
    setHighlightedLocationIndex(-1)
  }, [])

  const handleLocationKeyDown = useCallback(
    (event) => {
      if (!isLocationMenuOpen || !locationOptions.length) {
        if (event.key === 'ArrowDown' && locationInput.trim().length >= 2) {
          setIsLocationMenuOpen(true)
        }
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightedLocationIndex((prev) => (prev + 1 < locationOptions.length ? prev + 1 : 0))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightedLocationIndex((prev) => (prev > 0 ? prev - 1 : locationOptions.length - 1))
      } else if (event.key === 'Enter') {
        if (highlightedLocationIndex >= 0 && locationOptions[highlightedLocationIndex]) {
          event.preventDefault()
          selectLocationOption(locationOptions[highlightedLocationIndex])
        }
      } else if (event.key === 'Escape') {
        setIsLocationMenuOpen(false)
        setHighlightedLocationIndex(-1)
      }
    },
    [isLocationMenuOpen, locationOptions, highlightedLocationIndex, locationInput, selectLocationOption]
  )

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
        category: updatedForm.category,
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
          category: updatedForm.category,
          bio: updatedForm.bio,
          isPrivate: updatedForm.isPrivate,
          location: updatedForm.location,
        },
        locationInput: updatedLoc,
      })

      setIsLocationMenuOpen(false)
      setIsCategoryMenuOpen(false)
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
    {
      id: 'abonelik-yonetimi',
      label: t('profile.edit.tabsSubscription', 'Abonelik Yönetimi'),
      icon: <SubscriptionTabIcon />,
      hasBadge: false,
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

                      {/* Hesap Türü (Account Type) */}
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                              Hesap Türü
                            </label>
                            <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              Profil Kimliği
                            </span>
                          </div>
                        </div>

                        <div ref={categoryMenuRef} className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCategoryMenuOpen((prev) => !prev)
                              setIsLocationMenuOpen(false)
                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-secondary hover:border-zinc-400 dark:hover:border-zinc-600 px-4 py-3 text-sm font-medium text-text transition cursor-pointer shadow-sm"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-base">
                                {selectedCategoryObj[2]}
                              </span>
                              <div className="text-left min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-text block truncate">
                                    {selectedCategoryObj[1]}
                                  </span>
                                  {selectedCategoryObj[0] === 'creator' && (
                                    <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5">
                                      Üretici
                                    </span>
                                  )}
                                  {selectedCategoryObj[0] === 'business' && (
                                    <span className="rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5">
                                      Ticari
                                    </span>
                                  )}
                                  {selectedCategoryObj[0] === 'organization' && (
                                    <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5">
                                      Kurum / STK
                                    </span>
                                  )}
                                  {selectedCategoryObj[0] === 'public_figure' && (
                                    <span className="rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold px-1.5 py-0.5">
                                      Kamu Figürü
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted block truncate mt-0.5">
                                  {selectedCategoryObj[3]}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="hidden sm:inline-block text-xs font-medium text-muted">
                                Değiştir
                              </span>
                              <ChevronDownIcon
                                className={`size-4 shrink-0 transition-transform duration-200 ${
                                  isCategoryMenuOpen ? 'rotate-180 text-primary' : 'text-muted'
                                }`}
                              />
                            </div>
                          </button>

                          {isCategoryMenuOpen && (
                            <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150">
                              {categories.map(([value, label, icon, desc]) => {
                                const isSelected = (formState.category || 'individual') === value
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => {
                                      setFormState((currentState) => ({
                                        ...currentState,
                                        category: value,
                                      }))
                                      setIsCategoryMenuOpen(false)
                                    }}
                                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm transition cursor-pointer mb-0.5 last:mb-0 ${
                                      isSelected
                                        ? 'bg-primary/10 text-primary font-semibold'
                                        : 'text-text hover:bg-secondary hover:text-text'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-base">
                                        {icon}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="font-semibold text-sm">{label}</p>
                                        <p className="text-xs text-muted truncate">{desc}</p>
                                      </div>
                                    </div>
                                    {isSelected && <CheckIcon className="size-4 text-primary shrink-0" />}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div ref={locationWrapperRef} className="relative md:col-span-2">
                        <InputField
                          label={t('profile.edit.locationLabel')}
                          helperText={t('profile.edit.locationHelper')}
                        >
                          <div className="relative">
                            <input
                              role="combobox"
                              aria-autocomplete="list"
                              aria-expanded={isLocationMenuOpen}
                              aria-controls="location-options-list"
                              aria-activedescendant={
                                highlightedLocationIndex >= 0
                                  ? `location-option-${highlightedLocationIndex}`
                                  : undefined
                              }
                              value={locationInput}
                              onFocus={() => setIsLocationMenuOpen(locationOptions.length > 0)}
                              onKeyDown={handleLocationKeyDown}
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
                              className={`${inputClassName} ${isLocationLoading ? 'pr-9' : ''}`}
                            />
                            {isLocationLoading ? (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                              </div>
                            ) : null}
                          </div>
                        </InputField>

                        {isLocationMenuOpen && locationOptions.length ? (
                          <div
                            id="location-options-list"
                            role="listbox"
                            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-md"
                          >
                            {locationOptions.map((option, index) => {
                              const label = option.label || (option.city ? `${option.city}, ${option.country}` : option.country)
                              const isHighlighted = highlightedLocationIndex === index

                              return (
                                <button
                                  key={`${label}-${index}`}
                                  id={`location-option-${index}`}
                                  role="option"
                                  aria-selected={isHighlighted}
                                  type="button"
                                  onClick={() => selectLocationOption(option)}
                                  onMouseEnter={() => setHighlightedLocationIndex(index)}
                                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                                    isHighlighted
                                      ? 'bg-secondary text-foreground ring-1 ring-primary/30'
                                      : 'text-zinc-700 hover:bg-secondary/60 dark:text-zinc-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-base shrink-0 select-none">
                                      {option.flag || '📍'}
                                    </span>
                                    <span className="truncate">
                                      <HighlightMatch text={label} query={locationInput} />
                                    </span>
                                  </div>
                                  {option.kind ? (
                                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted bg-secondary/80 border border-border/50">
                                      {option.kind === 'city'
                                        ? t('profile.edit.locationKindCity')
                                        : option.kind === 'district'
                                        ? t('profile.edit.locationKindDistrict')
                                        : t('profile.edit.locationKindCountry')}
                                    </span>
                                  ) : null}
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

              {/* TAB 4: ABONELİK YÖNETİMİ */}
              {activeTab === 'abonelik-yonetimi' && (
                <section
                  id="tabpanel-abonelik-yonetimi"
                  role="tabpanel"
                  aria-labelledby="tab-abonelik-yonetimi"
                  className="space-y-6 animate-in fade-in duration-150"
                >
                  <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-base font-bold text-text">
                            {t('profile.edit.subscriptionTitle', 'Abonelik & Doğrulanmış Profil Yönetimi')}
                          </h2>
                          {Boolean(user?.verification?.isVerified || user?.verification?.status === 'approved' || verificationState.request?.status === 'approved') && (
                            <VerifiedBadge user={{ verification: { isVerified: true } }} size="sm" />
                          )}
                        </div>
                        <p className="text-xs text-soft mt-1">
                          {t('profile.edit.subscriptionSubtitle', 'Mavi doğrulama rozetinizi, keşfet ve gösterim ayrıcalıklarınızı ve aylık aboneliğinizi bu panelden yönetebilirsiniz.')}
                        </p>
                      </div>

                      {verificationState.isLoading && (
                        <span className="text-xs text-muted">Bilgiler yükleniyor...</span>
                      )}
                    </div>

                    {/* Durum 1: Aktif ve Onaylı Abonelik */}
                    {(user?.verification?.isVerified || user?.verification?.status === 'approved' || verificationState.request?.status === 'approved') ? (
                      (() => {
                        const currentPlanId = user?.verification?.subscriptionPlan && user.verification.subscriptionPlan !== 'none'
                          ? user.verification.subscriptionPlan
                          : verificationState.request?.payment?.plan || 'plus'
                        const currentPlanName = currentPlanId === 'pro' ? 'Nest Pro' : 'Nest Plus'
                        const currentPlanPrice = currentPlanId === 'pro' ? 249 : 99
                        const currentMultiplier = currentPlanId === 'pro' ? '5X Gösterim Desteği' : '2X Gösterim Desteği'
                        const otherPlanId = currentPlanId === 'pro' ? 'plus' : 'pro'
                        const otherPlanName = otherPlanId === 'pro' ? 'Nest Pro' : 'Nest Plus'
                        const otherPlanPrice = otherPlanId === 'pro' ? 249 : 99

                        const currentCategory = user?.verification?.category || verificationState.request?.category || formState.category || 'individual'
                        const currentCategoryObj = categories.find(([val]) => val === currentCategory) || categories[0]

                        return (
                          <div className="space-y-5">
                            {/* Aktif Plan Özeti Kartı */}
                            <div className="rounded-xl border border-primary/30 bg-primary/[0.03] dark:bg-primary/[0.06] p-4 sm:p-5">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex items-center gap-3.5">
                                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-black text-base">
                                    {currentPlanId === 'pro' ? 'Pro' : 'Plus'}
                                  </div>
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-base font-bold text-text">
                                        {currentPlanName}
                                      </span>
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Aktif Abonelik
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-text">
                                        <span>{currentCategoryObj[2]}</span>
                                        <span>{currentCategoryObj[1]}</span>
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted mt-0.5">
                                      ₺{currentPlanPrice} / ay · {currentMultiplier}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="rounded-md bg-secondary border border-border px-2.5 py-1 text-xs font-semibold text-text">
                                    Ödeme: **** 1111 (Test Kartı)
                                  </span>
                                </div>
                              </div>

                              <div className="my-4 border-t border-border/50" />

                              {/* Ayrıcalık Maddeleri */}
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                                <div className="flex items-center gap-2 rounded-lg bg-card/70 p-2.5 border border-border/60">
                                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary font-bold text-xs">
                                    ✓
                                  </span>
                                  <div>
                                    <p className="font-semibold text-text">{currentMultiplier}</p>
                                    <p className="text-[11px] text-muted">Akış ve aramalarda üst sıralama</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 rounded-lg bg-card/70 p-2.5 border border-border/60">
                                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary font-bold text-xs">
                                    ✓
                                  </span>
                                  <div>
                                    <p className="font-semibold text-text">Mavi Rozet Aktif</p>
                                    <p className="text-[11px] text-muted">Resmi onaylı profil rozeti</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 rounded-lg bg-card/70 p-2.5 border border-border/60">
                                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary font-bold text-xs">
                                    ✓
                                  </span>
                                  <div>
                                    <p className="font-semibold text-text">{currentPlanId === 'pro' ? '300' : '100'} Hediye Jetonu</p>
                                    <p className="text-[11px] text-muted">Aylık bahşiş bakiyesi</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Plan Değiştirme / Yükseltme Kartı */}
                            <div className="rounded-xl border border-border bg-secondary/40 p-4 sm:p-5">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                  <h3 className="text-sm font-bold text-text">
                                    {currentPlanId === 'plus'
                                      ? "Daha Fazla Güç: Nest Pro'ya Yükselt"
                                      : "Nest Plus Planına Geç"}
                                  </h3>
                                  <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                                    {currentPlanId === 'plus'
                                      ? "Gösterim desteğinizi 2X'ten 5X seviyesine çıkarın, VIP arama önceliği ve aylık 300 hediye jeton kazanın."
                                      : "Abonelik planınızı aylık ₺99 tutarındaki Nest Plus (2X Gösterim, 100 jeton) seviyesine geçirebilirsiniz."}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSubscriptionActionState({
                                      confirmModal: 'change',
                                      targetPlan: otherPlanId,
                                      error: '',
                                      isSubmitting: false,
                                    })
                                  }
                                  className={`shrink-0 rounded-lg px-4 py-2.5 text-xs font-bold transition cursor-pointer shadow-xs ${
                                    currentPlanId === 'plus'
                                      ? 'bg-primary text-inverse hover:bg-primary-hover'
                                      : 'border border-border bg-card hover:bg-secondary text-text'
                                  }`}
                                >
                                  {currentPlanId === 'plus'
                                    ? "Nest Pro'ya Yükselt (₺249 / ay)"
                                    : "Nest Plus'a Geç (₺99 / ay)"}
                                </button>
                              </div>
                            </div>

                            {/* Abonelik İptal Kartı */}
                            <div className="rounded-xl border border-rose-200/60 bg-rose-50/30 dark:border-rose-900/30 dark:bg-rose-950/10 p-4 sm:p-5">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                  <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                                    Aboneliği İptal Et
                                  </h3>
                                  <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                                    Aboneliğinizi iptal ettiğinizde profilinizdeki onaylı mavi rozet kaldırılır ve gösterim ayrıcalıklarınız sonlandırılır. Dilediğiniz zaman tekrar abone olabilirsiniz.
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSubscriptionActionState({
                                      confirmModal: 'cancel',
                                      targetPlan: null,
                                      error: '',
                                      isSubmitting: false,
                                    })
                                  }
                                  className="shrink-0 rounded-lg border border-rose-200 bg-card px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-card dark:hover:bg-rose-950/40 transition cursor-pointer"
                                >
                                  Aboneliği İptal Et
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })()
                    ) : verificationState.request?.status === 'pending' || verificationState.request?.status === 'in_review' ? (
                      /* Durum 2: Başvuru & Abonelik Beklemede / İnceleniyor */
                      <div className="space-y-4">
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                                  Başvuru İnceleniyor
                                </span>
                                <span className="text-xs font-semibold text-text">
                                  {verificationState.request.payment?.plan === 'pro' ? 'Nest Pro (₺249/ay)' : 'Nest Plus (₺99/ay)'}
                                </span>
                              </div>
                              <h3 className="mt-2 text-base font-bold text-text">
                                Abonelik ve Profil Doğrulama Talebiniz Alındı
                              </h3>
                              <p className="mt-1 text-xs text-muted leading-relaxed">
                                Aylık test ödemeniz başarıyla alındı. Yönetim ekibi hesap bilgilerinizi inceledikten sonra mavi onay rozetiniz ve avantajlarınız aktifleşecektir.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handleWithdrawPending}
                              disabled={subscriptionActionState.isSubmitting}
                              className="rounded-lg border border-rose-200 bg-card px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                            >
                              {subscriptionActionState.isSubmitting ? 'Geri çekiliyor...' : 'Başvuruyu Geri Çek'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : verificationState.request?.status === 'needs_info' ? (
                      /* Durum 3: Ek Bilgi Bekleniyor */
                      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                              Ek Bilgi Gerekiyor
                            </span>
                            <h3 className="mt-2 text-base font-bold text-text">Yönetim Ekibinden Not Var</h3>
                            <p className="mt-1 text-xs text-muted">
                              {verificationState.request.requestedInformation || 'Lütfen istenen ek bilgileri tamamlayınız.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsVerificationModalOpen(true)}
                            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-inverse hover:bg-primary-hover transition cursor-pointer"
                          >
                            Bilgileri Tamamla
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Durum 4: Henüz Abone Değil / Yeni Başvuru Yapabilir */
                      <div className="space-y-5">
                        <div className="rounded-xl border border-border bg-secondary/40 p-5 sm:p-6 text-center sm:text-left">
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                                <VerifiedBadge user={{ verification: { isVerified: true } }} size="md" />
                              </span>
                              <div>
                                <h3 className="text-base font-bold text-text">Henüz Aktif Bir Aboneliğiniz Yok</h3>
                                <p className="text-xs text-muted mt-0.5">
                                  Resmi mavi rozet kazanın, etkileşiminizi 2X veya 5X katlayın ve Üretici Stüdyosu ayrıcalıklarına erişin.
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsVerificationModalOpen(true)}
                              className="shrink-0 rounded-lg bg-primary px-5 py-3 text-xs font-bold text-inverse hover:bg-primary-hover transition cursor-pointer shadow-xs"
                            >
                              Abonelik Başlat ve Mavi Rozet Al
                            </button>
                          </div>
                        </div>

                        {/* Planlar Karşılaştırma Vitrini */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-border bg-card p-5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-base text-text">Nest Plus</span>
                              <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-text">Popüler</span>
                            </div>
                            <p className="mt-2 text-2xl font-extrabold text-text">₺99 <span className="text-xs font-normal text-muted">/ ay</span></p>
                            <div className="my-3 border-t border-border/50" />
                            <ul className="space-y-2 text-xs text-muted">
                              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> 2X Daha Fazla Gösterim Desteği</li>
                              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Profilde Resmi Mavi Onay Rozeti</li>
                              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Üretici Stüdyosu Temel Erişim</li>
                              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> 100 Hediye Jetonu</li>
                            </ul>
                          </div>

                          <div className="rounded-xl border border-primary/25 bg-primary/[0.02] p-5 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-base text-text">Nest Pro</span>
                              <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">Maksimum Güç</span>
                            </div>
                            <p className="mt-2 text-2xl font-extrabold text-text">₺249 <span className="text-xs font-normal text-muted">/ ay</span></p>
                            <div className="my-3 border-t border-border/50" />
                            <ul className="space-y-2 text-xs text-muted">
                              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> 5X Daha Fazla Gösterim Desteği (Maksimum Keşfet)</li>
                              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Mavi Rozet & VIP Öncelikli Destek</li>
                              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Üretici Stüdyosu Gelişmiş Gelir Analitiği</li>
                              <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> 300 Hediye Jetonu</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </div>
      </SocialLayout>

      {/* Plan Değiştirme ve İptal Onay Modalı */}
      {subscriptionActionState.confirmModal && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {subscriptionActionState.confirmModal === 'change' ? (
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <VerifiedBadge user={{ verification: { isVerified: true } }} size="md" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-text">
                      {subscriptionActionState.targetPlan === 'pro'
                        ? "Nest Pro Planına Yükselt"
                        : "Nest Plus Planına Geç"}
                    </h3>
                    <p className="text-xs text-muted">
                      {subscriptionActionState.targetPlan === 'pro'
                        ? 'Aylık ₺249 · 5X Gösterim Desteği & VIP Avantajlar'
                        : 'Aylık ₺99 · 2X Gösterim Desteği'}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-muted">
                  {subscriptionActionState.targetPlan === 'pro'
                    ? 'Aboneliğinizi Nest Pro seviyesine yükseltmek üzeresiniz. Gösterim desteğiniz 5X seviyesine çıkarılacak, akışta ve aramalarda en üst sırada listeleneceksiniz.'
                    : 'Aboneliğinizi Nest Plus seviyesine düşürmek üzeresiniz. Bir sonraki yenilenme döneminizde aylık ₺99 tahsil edilecektir.'}
                </p>

                {subscriptionActionState.error ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                    {subscriptionActionState.error}
                  </div>
                ) : null}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={subscriptionActionState.isSubmitting}
                    onClick={() =>
                      setSubscriptionActionState({
                        confirmModal: null,
                        targetPlan: null,
                        error: '',
                        isSubmitting: false,
                      })
                    }
                    className="rounded-lg border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-text hover:bg-secondary-hover transition cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={subscriptionActionState.isSubmitting}
                    onClick={confirmPlanChange}
                    className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-inverse hover:bg-primary-hover transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {subscriptionActionState.isSubmitting ? 'İşleniyor...' : 'Onayla ve Değiştir'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <AlertTriangleIcon />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
                      Aboneliği İptal Et
                    </h3>
                    <p className="text-xs text-muted">Mavi rozet ve gösterim avantajları sonlandırılacaktır</p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Aboneliğinizi iptal ettiğinizde profilinizdeki mavi doğrulama rozeti ve 2X/5X keşfet desteği kaldırılacaktır. Dilediğiniz zaman tekrar abone olabilirsiniz.
                </p>

                {subscriptionActionState.error ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                    {subscriptionActionState.error}
                  </div>
                ) : null}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={subscriptionActionState.isSubmitting}
                    onClick={() =>
                      setSubscriptionActionState({
                        confirmModal: null,
                        targetPlan: null,
                        error: '',
                        isSubmitting: false,
                      })
                    }
                    className="rounded-lg border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-text hover:bg-secondary-hover transition cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={subscriptionActionState.isSubmitting}
                    onClick={confirmCancelSubscription}
                    className="rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {subscriptionActionState.isSubmitting ? 'İptal Ediliyor...' : 'Evet, Aboneliği İptal Et'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Doğrulama & Abonelik Başlatma Modalı */}
      <VerificationModal
        open={isVerificationModalOpen}
        user={user}
        onClose={() => {
          setIsVerificationModalOpen(false)
          loadVerificationData()
        }}
      />

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
