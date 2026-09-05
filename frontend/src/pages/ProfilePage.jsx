import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ProfileImageCropModal from '../components/media/ProfileImageCropModal.jsx'
import ProfileImageLightbox from '../components/media/ProfileImageLightbox.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import VerificationModal from '../components/profile/VerificationModal.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import PostComposer from '../features/posts/PostComposer.jsx'
import PostCard from '../features/posts/PostCard.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import {
  getMyProfile,
  getProfileByUsername,
  getDiscoverySuggestions,
  toggleFollowByUsername,
  updateMyProfile,
} from '../services/usersService.js'
import { createPost, getTrendingTopics } from '../services/postsService.js'
import { formatLocation, getAvatarLabel, getFullName } from '../utils/social.js'
import { resolveMediaUrl } from '../utils/media.js'

function logUploadPerf(payload) {
  try {
    console.info('[upload-perf]', JSON.stringify(payload))
  } catch {
    console.info('[upload-perf]', payload)
  }
}

function EmptyTabState({ message }) {
  return (
    <div className="rounded-[28px] border border-dashed border-border bg-card px-5 py-6 text-sm text-muted shadow-sm">
      {message}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="overflow-hidden rounded-lg mt-2 border border-border bg-card shadow-sm">
        <div className="h-48 bg-secondary md:h-64" />
        <div className="px-4 pb-6 pt-5 md:px-7">
          <div className="flex items-end gap-4 md:gap-5">
            <div className="-mt-16 size-24 rounded-full border-4 border-card bg-secondary-hover md:-mt-20 md:size-30" />
            <div className="flex-1 space-y-3">
              <div className="h-7 w-48 rounded-full bg-secondary-hover" />
              <div className="h-4 w-28 rounded-full bg-secondary-hover" />
              <div className="h-4 w-full max-w-2xl rounded-full bg-secondary-hover" />
              <div className="h-4 w-2/3 rounded-full bg-secondary-hover" />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-9 w-24 rounded-full bg-secondary-hover" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <div className="h-5 w-40 rounded-full bg-secondary-hover" />
        <div className="mt-4 h-4 w-full rounded-full bg-secondary-hover" />
        <div className="mt-3 h-4 w-5/6 rounded-full bg-secondary-hover" />
      </div>
    </div>
  )
}

function CameraIcon({ className = 'size-4.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4.5 8.5h15v10h-15z" />
      <path d="m9 8.5 1.2-2h3.6l1.2 2" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" className="size-5">
      <path d="m4 20 3.5-.7L18 8.8 15.2 6 4.7 16.5 4 20Z" />
      <path d="m13.8 7.4 2.8 2.8" />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.9L3 21l1.7-4.6A8.4 8.4 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.5 8.4 8.4 0 0 1 9 8.5Z" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
      <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.4" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

function ChevronDownIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CheckIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function ProfilePanel({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-border bg-card shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h2 className="text-sm font-bold text-text">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function ProfileDiscoveryRail({
  lang,
  t,
  suggestions,
  trends,
  error,
  isAuthenticated,
  suggestionPending,
  onFollow,
}) {
  return (
    <div className="space-y-4">
      <ProfilePanel
        title={t('home.suggestions')}
        action={
          <Link to={`/${lang}/search`} className="text-xs font-semibold text-primary hover:underline">
            {t('home.suggestionsShowAll')}
          </Link>
        }
      >
        <div className="space-y-4">
          {suggestions.slice(0, 3).map((item) => {
            const suggestedUser = item.user || item
            return (
              <div key={suggestedUser.id || suggestedUser.username} className="flex items-center gap-3">
                <Link to={`/${lang}/u/${suggestedUser.username}`} className="shrink-0">
                  <UserAvatar user={suggestedUser} className="size-10" textClassName="text-xs font-bold" />
                </Link>
                <Link to={`/${lang}/u/${suggestedUser.username}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-semibold text-text">
                    <span className="truncate">{getFullName(suggestedUser)}</span>
                    <VerifiedBadge user={suggestedUser} size="xs" />
                  </p>
                  <p className="truncate text-xs text-muted">@{suggestedUser.username}</p>
                </Link>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => onFollow(suggestedUser)}
                    disabled={suggestionPending === suggestedUser.username}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-inverse transition hover:bg-primary-hover disabled:opacity-60"
                  >
                    {suggestionPending === suggestedUser.username ? '…' : t('profile.follow')}
                  </button>
                ) : null}
              </div>
            )
          })}
          {!suggestions.length ? (
            <p className="text-sm leading-6 text-muted">{error || t('home.suggestionsEmpty')}</p>
          ) : null}
        </div>
      </ProfilePanel>

      <ProfilePanel title={t('home.trends')}>
        <ol className="space-y-4">
          {trends.map((trend, index) => (
            <li key={trend.slug || trend.label || index} className="flex gap-3">
              <span className="w-4 shrink-0 text-xs font-semibold text-soft">{index + 1}</span>
              <Link
                to={`/${lang}/?topic=${encodeURIComponent(trend.slug || trend.label || '')}`}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-semibold text-text">{trend.label}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {t('home.trendMeta', {
                    postCount: trend.postCount || 0,
                    authorCount: trend.uniqueAuthorCount || 0,
                  })}
                </p>
              </Link>
            </li>
          ))}
          {!trends.length ? (
            <li className="text-sm leading-6 text-muted">{error || t('home.trendsEmpty')}</li>
          ) : null}
        </ol>
      </ProfilePanel>
    </div>
  )
}

function UploadButton({ label, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg cursor-pointer border border-border bg-[rgb(var(--color-card)/0.38)] px-1 md:px-1 py-2 md:py-2 text-xs font-medium text-muted shadow-lg backdrop-blur transition hover:bg-[rgb(var(--color-secondary)/0.92)] ${
        compact ? 'min-h-8 min-w-8 justify-center !p-0 md:min-h-10 md:min-w-10' : ''
      }`}
    >
      <CameraIcon className={compact ? 'size-3.5 md:size-4.5' : 'size-4.5'} />
      {!compact ? <span>{label}</span> : null}
    </button>
  )
}

function PhotoActionMenu({ onChange, onDelete, onClose, t }) {
  return (
    <div className="w-52 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <button
        type="button"
        onClick={onChange}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
      >
        <span>{t('profile.photoActions.change')}</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/30"
      >
        <span>{t('profile.photoActions.delete')}</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        className="flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-left text-xs font-medium text-muted transition hover:bg-secondary"
      >
        <span>{t('profile.photoActions.cancel')}</span>
      </button>
    </div>
  )
}

function ConfirmDeleteDialog({ open, target, onConfirm, onClose, t }) {
  if (!open) {
    return null
  }

  const isAvatar = target === 'avatar'

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-text">
          {isAvatar ? t('profile.photoActions.deleteAvatarTitle') : t('profile.photoActions.deleteCoverTitle')}
        </h3>
        <p className="mt-2 text-sm text-muted">
          {isAvatar ? t('profile.photoActions.deleteAvatarMessage') : t('profile.photoActions.deleteCoverMessage')}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text transition hover:bg-secondary"
          >
            {t('profile.photoActions.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            {t('profile.photoActions.confirmDelete')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfilePage() {
  const { username, lang } = useParams()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const { isAuthenticated, status, user, setUser } = useAuth()
  const [activeTab, setActiveTab] = useState('posts')
  const [profileState, setProfileState] = useState({
    profile: null,
    isLoading: true,
    error: '',
  })
  const [uploadState, setUploadState] = useState({
    target: '',
    error: '',
  })
  const [followState, setFollowState] = useState({
    isSubmitting: false,
    error: '',
  })
  const [isPublishing, setIsPublishing] = useState(false)
  const [suggestionPending, setSuggestionPending] = useState('')
  const [discoveryState, setDiscoveryState] = useState({ suggestions: [], trends: [], error: '' })
  const [cropState, setCropState] = useState({
    open: false,
    file: null,
    target: 'avatar',
  })
  const [lightboxState, setLightboxState] = useState({
    open: false,
    imageUrl: '',
    title: '',
  })
  const [photoMenuState, setPhotoMenuState] = useState({
    open: false,
    target: 'avatar',
    top: 0,
    left: 0,
  })
  const [deleteDialogState, setDeleteDialogState] = useState({
    open: false,
    target: 'avatar',
  })
  const [verificationModalOpen, setVerificationModalOpen] = useState(false)
  const [toast, setToast] = useState({
    message: '',
    tone: 'success',
  })
  const avatarInputRef = useRef(null)
  const coverInputRef = useRef(null)
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false)
  const [repliesMenuOpen, setRepliesMenuOpen] = useState(false)
  const mediaMenuRef = useRef(null)
  const repliesMenuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (mediaMenuRef.current && !mediaMenuRef.current.contains(event.target)) {
        setMediaMenuOpen(false)
      }
      if (repliesMenuRef.current && !repliesMenuRef.current.contains(event.target)) {
        setRepliesMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMediaMenuOpen(false)
        setRepliesMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

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

  const authUserId = user?._id || user?.id || ''

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    if (!username && !isAuthenticated) {
      setProfileState({
        profile: null,
        isLoading: false,
        error: '',
      })
      return
    }

    let cancelled = false

    async function loadProfile() {
      setProfileState({
        profile: null,
        isLoading: true,
        error: '',
      })

      try {
        const payload = username
          ? await getProfileByUsername(username)
          : await getMyProfile()

        if (cancelled) {
          return
        }

        setProfileState({
          profile: payload,
          isLoading: false,
          error: '',
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setProfileState({
          profile: null,
          isLoading: false,
          error: error.message || t('profile.loadFailed'),
        })
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [authUserId, isAuthenticated, status, t, username])

  useEffect(() => {
    let cancelled = false

    async function loadDiscoveryPanels() {
      try {
        const [suggestionsPayload, trendsPayload] = await Promise.all([
          getDiscoverySuggestions({ mode: 'for-you', limit: 4 }),
          getTrendingTopics({ limit: 5 }),
        ])

        if (!cancelled) {
          setDiscoveryState({
            suggestions: suggestionsPayload?.items || [],
            trends: trendsPayload?.topics || [],
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setDiscoveryState((currentState) => ({
            ...currentState,
            error: error.message || t('home.trendsLoadFailed'),
          }))
        }
      }
    }

    loadDiscoveryPanels()

    return () => {
      cancelled = true
    }
  }, [authUserId, isAuthenticated, t])

  const profilePayload = profileState.profile
  const profileUser = profilePayload?.user
  const stats = profilePayload?.stats || {
    followers: 0,
    following: 0,
    posts: 0,
    media: 0,
    likes: 0,
    saved: 0,
  }
  const currentUserId = user?._id || user?.id || ''
  const profileUserId = profileUser?._id || profileUser?.id || ''
  const isMatchingAuthUser = Boolean(
    user &&
      profileUser &&
      ((currentUserId && profileUserId && String(currentUserId) === String(profileUserId)) ||
        (user.username &&
          profileUser.username &&
          user.username.toLowerCase() === profileUser.username.toLowerCase())),
  )
  const isOwnProfile = Boolean(
    isMatchingAuthUser || (profilePayload?.isOwnProfile && isMatchingAuthUser),
  )

  const resolvedCoverUrl = resolveMediaUrl(profileUser?.coverUrl || '')
  const resolvedAvatarUrl = resolveMediaUrl(profileUser?.avatarUrl || '')

  const mediaGroupTabs = useMemo(
    () => [
      { key: 'posts', label: t('common.posts') },
      { key: 'media', label: t('profile.media') },
      { key: 'loops', label: t('nav.loop') },
    ],
    [t],
  )

  const repliesGroupTabs = useMemo(
    () => [
      { key: 'replies', label: t('profile.replies') },
      ...(isOwnProfile ? [{ key: 'likes', label: t('profile.likes') }] : []),
      ...(isOwnProfile ? [{ key: 'saved', label: t('profile.saved') }] : []),
    ],
    [isOwnProfile, t],
  )

  const tabs = useMemo(
    () => [...mediaGroupTabs, ...repliesGroupTabs],
    [mediaGroupTabs, repliesGroupTabs],
  )
  const availableTabKeys = useMemo(() => new Set(tabs.map((tab) => tab.key)), [tabs])

  const isMediaGroupActive = useMemo(
    () => ['posts', 'media', 'loops'].includes(activeTab),
    [activeTab],
  )
  const isRepliesGroupActive = useMemo(
    () => ['replies', 'likes', 'saved'].includes(activeTab),
    [activeTab],
  )

  const activeMediaTab = useMemo(
    () => mediaGroupTabs.find((tab) => tab.key === activeTab),
    [mediaGroupTabs, activeTab],
  )
  const activeRepliesTab = useMemo(
    () => repliesGroupTabs.find((tab) => tab.key === activeTab),
    [repliesGroupTabs, activeTab],
  )

  const mediaButtonLabel = activeMediaTab ? activeMediaTab.label : t('profile.media')
  const repliesButtonLabel = activeRepliesTab ? activeRepliesTab.label : t('profile.replies')

  const normalizeContentType = (post) =>
    `${post?.contentType || post?.type || post?.publication?.contentType || ''}`
      .trim()
      .toLowerCase()

  const isStoryPost = (post) => {
    const normalizedType = normalizeContentType(post)
    return normalizedType === 'story'
  }

  const isLoopPost = (post) => {
    const normalizedType = normalizeContentType(post)
    if (normalizedType === 'loop' || normalizedType === 'loopvideo' || normalizedType === 'loop_video') {
      return true
    }

    return Boolean((post?.media || []).some((item) => item?.type === 'video' && item?.hlsUrl))
  }

  const isStandardPost = (post) => {
    const normalizedType = `${post?.contentType || post?.type || post?.publication?.contentType || ''}`
      .trim()
      .toLowerCase()
    return normalizedType === 'post' || (!normalizedType && !isLoopPost(post))
  }

  const filterOutStoryPosts = (posts = []) => posts.filter((post) => !isStoryPost(post))

  const recentPosts = filterOutStoryPosts(profilePayload?.recentPosts || [])
  const profilePosts = recentPosts.filter((post) => isStandardPost(post) && !isLoopPost(post))
  const loopPosts = recentPosts.filter((post) => isLoopPost(post))
  const mediaPosts = recentPosts.filter((post) => Array.isArray(post?.media) && post.media.length > 0)
  const likedPosts = filterOutStoryPosts(profilePayload?.likedPosts || [])
  const repliedPosts = filterOutStoryPosts(profilePayload?.repliedPosts || []).filter(
    (post) => isStandardPost(post) || isLoopPost(post),
  )
  const savedPosts = filterOutStoryPosts(profilePayload?.savedPosts || [])

  useEffect(() => {
    const requestedTab = `${searchParams.get('tab') || ''}`.trim().toLowerCase()
    if (!requestedTab) {
      return
    }

    if (availableTabKeys.has(requestedTab)) {
      setActiveTab(requestedTab)
      return
    }

    setActiveTab('posts')
  }, [availableTabKeys, searchParams])

  useEffect(() => {
    if (availableTabKeys.has(activeTab)) {
      return
    }

    setActiveTab('posts')
  }, [activeTab, availableTabKeys])

  if (status !== 'loading' && !username && !isAuthenticated) {
    return <Navigate to={`/${lang}/login`} replace />
  }

  function handleProfileImageSelection(target, file) {
    if (!profileUser || !file) {
      return
    }

    setCropState({
      open: true,
      file,
      target,
    })
  }

  function closePhotoMenu() {
    setPhotoMenuState({
      open: false,
      target: 'avatar',
      top: 0,
      left: 0,
    })
  }

  function handlePhotoActionTrigger({ target, hasImage, openPicker, triggerElement }) {
    if (!hasImage) {
      openPicker()
      return
    }

    const triggerRect = triggerElement?.getBoundingClientRect?.()
    const menuWidth = 208
    const menuHeight = 126
    const viewportWidth = window.innerWidth || 0
    const viewportHeight = window.innerHeight || 0
    const fallbackTop = 16
    const fallbackLeft = 16

    const nextLeft = triggerRect
      ? Math.max(
          12,
          Math.min(
            triggerRect.left,
            Math.max(12, viewportWidth - menuWidth - 12),
          ),
        )
      : fallbackLeft

    const nextTop = triggerRect
      ? (() => {
          const preferredTop = triggerRect.bottom + 8
          if (preferredTop + menuHeight <= viewportHeight - 12) {
            return preferredTop
          }
          return Math.max(12, triggerRect.top - menuHeight - 8)
        })()
      : fallbackTop

    setPhotoMenuState((currentState) => {
      if (currentState.open && currentState.target === target) {
        return {
          open: false,
          target: 'avatar',
          top: 0,
          left: 0,
        }
      }

      return {
        open: true,
        target,
        top: nextTop,
        left: nextLeft,
      }
    })
  }

  async function handleProfileImageUpload(target, optimizedImage) {
    const uploadStartMs = Date.now()
    setUploadState({
      target,
      error: '',
    })

    try {
      const payload = await updateMyProfile({
        ...(target === 'avatar' ? { avatarUrl: optimizedImage } : {}),
        ...(target === 'cover' ? { coverUrl: optimizedImage } : {}),
      })

      setProfileState((currentState) => ({
        ...currentState,
        profile: payload,
      }))

      setUser(payload.user)
      setUploadState({
        target: '',
        error: '',
      })
      setToast({
        message:
          target === 'avatar'
            ? t('profile.photoActions.avatarUpdated')
            : t('profile.photoActions.coverUpdated'),
        tone: 'success',
      })
      setCropState({
        open: false,
        file: null,
        target: 'avatar',
      })
      logUploadPerf({
        flow: 'update_profile_image',
        target,
        ok: true,
        durationMs: Date.now() - uploadStartMs,
        payloadBytes: typeof optimizedImage === 'string' ? optimizedImage.length : 0,
      })
    } catch (error) {
      setUploadState({
        target: '',
        error: error.message || t('profile.photoActions.updateFailed'),
      })
      setToast({
        message: error.message || t('profile.photoActions.updateFailed'),
        tone: 'error',
      })
      logUploadPerf({
        flow: 'update_profile_image',
        target,
        ok: false,
        durationMs: Date.now() - uploadStartMs,
        errorMessage: error.message || t('profile.photoActions.updateFailed'),
      })
    }
  }

  async function handleProfileImageDelete(target) {
    if (!profileUser) {
      return
    }

    setDeleteDialogState({
      open: false,
      target: 'avatar',
    })
    closePhotoMenu()
    setUploadState({
      target,
      error: '',
    })
    const deleteStartMs = Date.now()

    try {
      const payload = await updateMyProfile({
        ...(target === 'avatar' ? { avatarUrl: '' } : {}),
        ...(target === 'cover' ? { coverUrl: '' } : {}),
      })

      setProfileState((currentState) => ({
        ...currentState,
        profile: payload,
      }))
      setUser(payload.user)
      setUploadState({
        target: '',
        error: '',
      })
      setToast({
        message:
          target === 'avatar'
            ? t('profile.photoActions.avatarDeleted')
            : t('profile.photoActions.coverDeleted'),
        tone: 'success',
      })
      logUploadPerf({
        flow: 'delete_profile_image',
        target,
        ok: true,
        durationMs: Date.now() - deleteStartMs,
      })
    } catch (error) {
      setUploadState({
        target: '',
        error: error.message || t('profile.photoActions.deleteFailed'),
      })
      setToast({
        message: error.message || t('profile.photoActions.deleteFailed'),
        tone: 'error',
      })
      logUploadPerf({
        flow: 'delete_profile_image',
        target,
        ok: false,
        durationMs: Date.now() - deleteStartMs,
        errorMessage: error.message || t('profile.photoActions.deleteFailed'),
      })
    }
  }

  function renderTabContent() {
    if (activeTab === 'posts') {
      return profilePosts.length ? (
        profilePosts.map((post) => <PostCard key={post._id || post.id} post={post} />)
      ) : (
        <EmptyTabState message={t('profile.emptyPosts')} />
      )
    }

    if (activeTab === 'loops') {
      return loopPosts.length ? (
        loopPosts.map((post) => <PostCard key={post._id || post.id} post={post} />)
      ) : (
        <EmptyTabState message={t('profile.emptyLoops')} />
      )
    }

    if (activeTab === 'media') {
      return mediaPosts.length ? (
        mediaPosts.map((post) => <PostCard key={post._id || post.id} post={post} />)
      ) : (
        <EmptyTabState message={t('profile.emptyMedia', { defaultValue: 'Bu profilde henüz medya paylaşımı yok.' })} />
      )
    }

    if (activeTab === 'likes') {
      if (!isOwnProfile) {
        return <EmptyTabState message={t('profile.emptyPosts')} />
      }
      return likedPosts.length ? (
        likedPosts.map((post) => <PostCard key={post._id || post.id} post={post} />)
      ) : (
        <EmptyTabState message={t('profile.emptyLikes', { defaultValue: 'Beğenilen içerikler burada listelenecek.' })} />
      )
    }

    if (activeTab === 'replies') {
      return repliedPosts.length ? (
        repliedPosts.map((post) => <PostCard key={post._id || post.id} post={post} />)
      ) : (
        <EmptyTabState message={t('profile.emptyReplies')} />
      )
    }

    if (!isOwnProfile) {
      return <EmptyTabState message={t('profile.emptyPosts')} />
    }

    return savedPosts.length ? (
      savedPosts.map((post) => <PostCard key={post._id || post.id} post={post} />)
    ) : (
      <EmptyTabState message={t('profile.emptySaved')} />
    )
  }

  async function handleCreateProfilePost(payload, options = {}) {
    setIsPublishing(true)

    try {
      const response = await createPost(payload)
      if (!response?.meta?.scheduled && response?.post) {
        setProfileState((currentState) => ({
          ...currentState,
          profile: currentState.profile
            ? {
                ...currentState.profile,
                recentPosts: [response.post, ...(currentState.profile.recentPosts || [])],
                stats: {
                  ...currentState.profile.stats,
                  posts: Number(currentState.profile.stats?.posts || 0) + 1,
                  media:
                    Number(currentState.profile.stats?.media || 0) +
                    (response.post?.media?.length ? 1 : 0),
                },
              }
            : currentState.profile,
        }))
        setActiveTab(isLoopPost(response.post) ? 'loops' : 'posts')
      }
      if (!options.background) {
        setToast({
          message: response?.meta?.scheduled
            ? t('home.postScheduled', { defaultValue: 'Gönderi planlandı.' })
            : t('home.postPublished', { defaultValue: 'Gönderi paylaşıldı.' }),
          tone: 'success',
        })
      }
      return response
    } catch (error) {
      if (!options.background) {
        setToast({
          message: error.message || t('home.postPublishFailed', { defaultValue: 'Gönderi yayınlanamadı.' }),
          tone: 'error',
        })
      }
      throw error
    } finally {
      setIsPublishing(false)
    }
  }

  async function handleSuggestionFollow(suggestedUser) {
    if (!isAuthenticated || !suggestedUser?.username || suggestionPending) {
      return
    }

    setSuggestionPending(suggestedUser.username)
    try {
      await toggleFollowByUsername(suggestedUser.username)
      setDiscoveryState((currentState) => ({
        ...currentState,
        suggestions: currentState.suggestions.filter(
          (item) => (item.user || item)?.username !== suggestedUser.username,
        ),
      }))
      setToast({ message: t('profile.followed'), tone: 'success' })
    } catch (error) {
      setToast({ message: error.message || t('profile.followFailed'), tone: 'error' })
    } finally {
      setSuggestionPending('')
    }
  }

  const joinedAtLabel = profileUser?.createdAt
    ? new Intl.DateTimeFormat(lang || 'tr', { month: 'long', year: 'numeric' }).format(
        new Date(profileUser.createdAt),
      )
    : ''
  const visibleSuggestions = discoveryState.suggestions.filter(
    (item) => (item.user || item)?.username !== profileUser?.username,
  )
  const highlightItems = mediaPosts.slice(0, 4).map((post, index) => {
    const media = post?.media?.[0] || {}
    return {
      id: post.id || post._id,
      label: `${t('profile.media')} ${index + 1}`,
      imageUrl: resolveMediaUrl(media.thumbnailUrl || media.posterUrl || media.url || ''),
    }
  })

  return (
    <>
      <Seo
        title={
          profileUser
            ? t('profile.seoTitleWithName', { name: getFullName(profileUser) })
            : t('profile.seoTitle')
        }
        description={
          profileUser?.bio ||
          t('profile.seoDescription')
        }
      />

      <SocialLayout
        pageTitle={profileUser ? getFullName(profileUser) : t('nav.profile')}
        activeKey="profile"
        showDesktopPageHeader={false}
        initialSidebarOpen={false}
      >
        <div className="space-y-4 md:space-y-5">
          {profileState.error ? (
            <div className="rounded-[32px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {profileState.error}
            </div>
          ) : null}

          {uploadState.error ? (
            <div className="rounded-[32px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {uploadState.error}
            </div>
          ) : null}

          {followState.error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {followState.error}
            </div>
          ) : null}

          {profileState.isLoading ? (
            <ProfileSkeleton />
          ) : null}

          {!profileState.isLoading && profileUser ? (
            <>
              <section className="relative z-20 bg-card shadow-sm md:mt-2 md:rounded-lg md:border md:border-border">
                <div className="relative h-32 overflow-hidden bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_48%,#fde68a_100%)] sm:h-48 md:h-60 md:rounded-t-lg">
                  {profileUser.coverUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxState({
                          open: true,
                          imageUrl: resolvedCoverUrl,
                          title: `${getFullName(profileUser)} cover`,
                        })
                      }
                      className="h-full w-full"
                    >
                      <img
                        src={resolvedCoverUrl}
                        alt={`${getFullName(profileUser)} cover`}
                        className="h-full w-full object-cover transition duration-300 hover:scale-[1.01]"
                      />
                    </button>
                  ) : null}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.45),transparent_45%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_45%)]" />

                  {isOwnProfile ? (
                    <>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleProfileImageSelection('cover', event.target.files?.[0])}
                      />
                      <div className="absolute bottom-4 right-4">
                        <UploadButton
                          label={
                            uploadState.target === 'cover'
                              ? t('profile.photoActions.uploading')
                              : t('profile.photoActions.updateCover')
                          }
                          onClick={(event) =>
                            handlePhotoActionTrigger({
                              target: 'cover',
                              hasImage: Boolean(profileUser.coverUrl),
                              openPicker: () => coverInputRef.current?.click(),
                              triggerElement: event.currentTarget,
                            })
                          }
                        />
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="relative px-4 pb-3 pt-1 md:px-7 md:pb-4">
                  <div className="md:hidden">
                    <div className="flex items-start gap-2">
                      <div className="-mt-7 shrink-0">
                        <div className="relative">
                          <div className="grid size-24 place-items-center overflow-hidden rounded-full border-4 border-card bg-primary text-2xl font-semibold text-inverse shadow-lg">
                            {profileUser.avatarUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setLightboxState({
                                    open: true,
                                    imageUrl: resolvedAvatarUrl,
                                    title: getFullName(profileUser),
                                  })
                                }
                                className="h-full w-full"
                              >
                                <img
                                  src={resolvedAvatarUrl}
                                  alt={getFullName(profileUser)}
                                  className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                                />
                              </button>
                            ) : (
                              getAvatarLabel(profileUser)
                            )}
                          </div>

                          {isOwnProfile ? (
                            <>
                              <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => handleProfileImageSelection('avatar', event.target.files?.[0])}
                              />
                              <div className="absolute -bottom-1 -right-1">
                                <UploadButton
                                  compact
                                  label={
                                    uploadState.target === 'avatar'
                                      ? t('profile.photoActions.uploading')
                                      : t('profile.photoActions.updateAvatar')
                                  }
                                  onClick={(event) =>
                                    handlePhotoActionTrigger({
                                      target: 'avatar',
                                      hasImage: Boolean(profileUser.avatarUrl),
                                      openPicker: () => avatarInputRef.current?.click(),
                                      triggerElement: event.currentTarget,
                                    })
                                  }
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 pt-2">
                        <h1 className="flex min-w-0 items-center gap-1.5 text-base font-bold tracking-tight text-text">
                          <span className="truncate">{getFullName(profileUser)}</span>
                          <VerifiedBadge user={profileUser} />
                        </h1>
                        <div className=" flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-sm text-muted">
                            @{profileUser.username}
                          </p>

                          <div className="shrink-0">
                            {isOwnProfile ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setVerificationModalOpen(true)}
                                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-xs font-semibold text-text shadow-sm transition hover:bg-secondary-hover"
                                >
                                  <VerifiedBadge user={{ verification: { isVerified: true } }} size="xs" />
                                  Mavi Tik
                                </button>
                                <Link
                                  to={`/${lang}/profile/edit`}
                                  className="inline-flex size-9 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary-hover"
                                  aria-label={t('profile.editProfile')}
                                  title={t('profile.editProfile')}
                                >
                                  <EditIcon />
                                </Link>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`/${lang}/messages?recipientId=${encodeURIComponent(profileUser.id)}&username=${encodeURIComponent(profileUser.username)}&name=${encodeURIComponent(getFullName(profileUser))}&avatarUrl=${encodeURIComponent(resolvedAvatarUrl || '')}`}
                                  className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border border-border-strong bg-card text-text shadow-sm transition duration-200 hover:border-primary hover:text-primary active:scale-95"
                                  aria-label={t('profile.sendMessage')}
                                  title={t('profile.sendMessage')}
                                >
                                  <MessageIcon />
                                </Link>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!profileUser?.username || followState.isSubmitting) {
                                      return
                                    }

                                    setFollowState({
                                      isSubmitting: true,
                                      error: '',
                                    })

                                    const previousProfile = profilePayload
                                    const nextFollowingState = !profilePayload?.viewerState?.isFollowing

                                    setProfileState((currentState) => ({
                                      ...currentState,
                                      profile: currentState.profile
                                        ? {
                                            ...currentState.profile,
                                            stats: {
                                              ...currentState.profile.stats,
                                              followers: Math.max(
                                                0,
                                                (currentState.profile.stats?.followers || 0) + (nextFollowingState ? 1 : -1),
                                              ),
                                            },
                                            viewerState: {
                                              ...currentState.profile.viewerState,
                                              isFollowing: nextFollowingState,
                                            },
                                          }
                                        : currentState.profile,
                                    }))

                                    try {
                                      const payload = await toggleFollowByUsername(profileUser.username)
                                      setProfileState((currentState) => ({
                                        ...currentState,
                                        profile: payload,
                                      }))
                                      setToast({
                                        message: payload.viewerState?.isFollowing
                                          ? t('profile.followed')
                                          : t('profile.unfollowed'),
                                        tone: 'success',
                                      })
                                      setFollowState({
                                        isSubmitting: false,
                                        error: '',
                                      })
                                    } catch (error) {
                                      setProfileState((currentState) => ({
                                        ...currentState,
                                        profile: previousProfile || currentState.profile,
                                      }))
                                      setToast({
                                        message: error.message || t('profile.followFailed'),
                                        tone: 'error',
                                      })
                                      setFollowState({
                                        isSubmitting: false,
                                        error: error.message || t('profile.followFailed'),
                                      })
                                    }
                                  }}
                                  disabled={!isAuthenticated || followState.isSubmitting}
                                  className={`inline-flex h-10 min-w-[88px] cursor-pointer items-center justify-center rounded-lg border px-3 text-xs font-semibold shadow-sm transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${
                                    profilePayload?.viewerState?.isFollowing
                                      ? 'border-primary bg-[rgb(var(--color-primary)/0.12)] text-primary'
                                      : 'border-primary bg-primary text-white hover:bg-primary-hover'
                                  }`}
                                  aria-label={
                                    !isAuthenticated
                                        ? t('common.login')
                                        : profilePayload?.viewerState?.isFollowing
                                          ? t('profile.unfollow')
                                          : t('profile.follow')
                                  }
                                  title={
                                    !isAuthenticated
                                        ? t('common.login')
                                        : profilePayload?.viewerState?.isFollowing
                                          ? t('profile.unfollow')
                                          : t('profile.follow')
                                  }
                                >
                                  {!isAuthenticated
                                    ? t('common.login')
                                    : followState.isSubmitting
                                      ? '...'
                                      : profilePayload?.viewerState?.isFollowing
                                        ? t('profile.unfollow')
                                        : t('profile.follow')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 space-y-3">
                      <p className="text-sm leading-6 text-muted">
                        {profileUser.bio || t('profile.emptyBio')}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                        <span>{formatLocation(profileUser.location)}</span>
                        <Link
                          to={isOwnProfile ? `/${lang}/profile/followers` : `/${lang}/u/${profileUser.username}/followers`}
                          className="transition hover:text-text"
                        >
                          {stats.followers.toLocaleString()} {t('common.followers')}
                        </Link>
                        <Link
                          to={isOwnProfile ? `/${lang}/profile/following` : `/${lang}/u/${profileUser.username}/following`}
                          className="transition hover:text-text"
                        >
                          {stats.following.toLocaleString()} {t('common.following')}
                        </Link>
                       
                      </div>
                    </div>
                  </div>

                  <div className="hidden items-end gap-4 md:flex md:gap-5">
                    <div className="-mt-16 shrink-0 md:-mt-20">
                      <div className="relative">
                        <div className="grid size-24 place-items-center overflow-hidden rounded-full border-4 border-card bg-primary text-2xl font-semibold text-inverse shadow-lg ring-1 ring-border md:size-32 md:text-3xl">
                          {profileUser.avatarUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxState({
                                  open: true,
                                  imageUrl: resolvedAvatarUrl,
                                  title: getFullName(profileUser),
                                })
                              }
                              className="h-full w-full"
                            >
                              <img
                                src={resolvedAvatarUrl}
                                alt={getFullName(profileUser)}
                                className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                              />
                            </button>
                          ) : (
                            getAvatarLabel(profileUser)
                          )}
                        </div>

                        {isOwnProfile ? (
                          <>
                            <input
                              ref={avatarInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => handleProfileImageSelection('avatar', event.target.files?.[0])}
                            />
                            <div className="absolute bottom-1 right-1">
                              <UploadButton
                                compact
                                label={
                                  uploadState.target === 'avatar'
                                    ? t('profile.photoActions.uploading')
                                    : t('profile.photoActions.updateAvatar')
                                }
                                onClick={(event) =>
                                  handlePhotoActionTrigger({
                                    target: 'avatar',
                                    hasImage: Boolean(profileUser.avatarUrl),
                                    openPicker: () => avatarInputRef.current?.click(),
                                    triggerElement: event.currentTarget,
                                  })
                                }
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                        <div className="min-w-0 space-y-3">
                          <div>
                            <h1 className="flex min-w-0 items-center gap-1.5 text-xl font-bold tracking-tight text-text md:text-2xl">
                              <span className="truncate">{getFullName(profileUser)}</span>
                              <VerifiedBadge user={profileUser} />
                            </h1>
                            <p className=" text-sm text-muted">
                              @{profileUser.username}
                            </p>
                          </div>

                          <p className="max-w-2xl text-sm leading-6 text-text">
                            {profileUser.bio || t('profile.emptyBio')}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                            <span className="inline-flex items-center gap-1.5"><LocationIcon />{formatLocation(profileUser.location)}</span>
                            {joinedAtLabel ? (
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarIcon />
                                {t('profile.joinedAt', { defaultValue: '{{date}} tarihinde katıldı', date: joinedAtLabel })}
                              </span>
                            ) : null}
                            <Link
                              to={isOwnProfile ? `/${lang}/profile/followers` : `/${lang}/u/${profileUser.username}/followers`}
                              className="transition hover:text-text"
                            >
                              {stats.followers.toLocaleString()} {t('common.followers')}
                            </Link>
                            <Link
                              to={isOwnProfile ? `/${lang}/profile/following` : `/${lang}/u/${profileUser.username}/following`}
                              className="transition hover:text-text"
                            >
                              {stats.following.toLocaleString()} {t('common.following')}
                            </Link>
                            
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 md:justify-end">
                          {isOwnProfile ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setVerificationModalOpen(true)}
                                className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-semibold text-text shadow-sm transition hover:bg-secondary-hover"
                              >
                                <VerifiedBadge user={{ verification: { isVerified: true } }} size="xs" />
                                Mavi Tik
                              </button>
                              <Link
                                to={`/${lang}/profile/edit`}
                                className="mt-2 cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-sm font-medium !text-white transition hover:bg-primary-hover hover:!text-white"
                              >
                                {t('profile.editProfile')}
                              </Link>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!profileUser?.username || followState.isSubmitting) {
                                    return
                                  }

                                    setFollowState({
                                      isSubmitting: true,
                                      error: '',
                                    })

                                    const previousProfile = profilePayload
                                    const nextFollowingState = !profilePayload?.viewerState?.isFollowing

                                    setProfileState((currentState) => ({
                                      ...currentState,
                                      profile: currentState.profile
                                        ? {
                                            ...currentState.profile,
                                            stats: {
                                              ...currentState.profile.stats,
                                              followers: Math.max(
                                                0,
                                                (currentState.profile.stats?.followers || 0) + (nextFollowingState ? 1 : -1),
                                              ),
                                            },
                                            viewerState: {
                                              ...currentState.profile.viewerState,
                                              isFollowing: nextFollowingState,
                                            },
                                          }
                                        : currentState.profile,
                                    }))

                                    try {
                                      const payload = await toggleFollowByUsername(profileUser.username)
                                      setProfileState((currentState) => ({
                                        ...currentState,
                                      profile: payload,
                                    }))
                                    setToast({
                                      message: payload.viewerState?.isFollowing
                                        ? t('profile.followed')
                                        : t('profile.unfollowed'),
                                      tone: 'success',
                                    })
                                    setFollowState({
                                      isSubmitting: false,
                                      error: '',
                                      })
                                    } catch (error) {
                                      setProfileState((currentState) => ({
                                        ...currentState,
                                        profile: previousProfile || currentState.profile,
                                      }))
                                      setToast({
                                        message: error.message || t('profile.followFailed'),
                                        tone: 'error',
                                    })
                                    setFollowState({
                                      isSubmitting: false,
                                      error: error.message || t('profile.followFailed'),
                                    })
                                  }
                                }}
                                disabled={!isAuthenticated || followState.isSubmitting}
                                className="rounded-lg cursor-pointer bg-primary px-3 py-2 text-sm font-semibold text-inverse transition hover:bg-primary-hover"
                              >
                                {!isAuthenticated
                                  ? t('common.login')
                                  : followState.isSubmitting
                                    ? '...'
                                    : profilePayload?.viewerState?.isFollowing
                                      ? t('profile.unfollow')
                                      : t('profile.follow')}
                              </button>
                              <Link
                                to={`/${lang}/messages?recipientId=${encodeURIComponent(profileUser.id)}&username=${encodeURIComponent(profileUser.username)}&name=${encodeURIComponent(getFullName(profileUser))}&avatarUrl=${encodeURIComponent(resolvedAvatarUrl || '')}`}
                                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text transition hover:bg-secondary"
                              >
                                {t('profile.sendMessage')}
                              </Link>
                              <button
                                type="button"
                                className="grid size-10 place-items-center rounded-lg border border-border text-muted transition hover:bg-secondary hover:text-text"
                                aria-label={t('common.more', { defaultValue: 'Daha fazla' })}
                              >
                                <MoreIcon />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-30 mt-1 pt-1">
                    <div className="flex items-center gap-2 border-t border-border-soft pt-2">
                      {/* Medya Pop-up Tab */}
                      <div ref={mediaMenuRef} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setMediaMenuOpen((prev) => !prev)
                            setRepliesMenuOpen(false)
                          }}
                          className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-semibold transition cursor-pointer select-none ${
                            isMediaGroupActive
                              ? 'border-b-3 border-primary text-primary hover:bg-secondary'
                              : 'text-muted hover:bg-secondary hover:text-text'
                          }`}
                        >
                          <span>{mediaButtonLabel}</span>
                          <ChevronDownIcon
                            className={`size-3.5 transition-transform duration-200 ${
                              mediaMenuOpen ? 'rotate-180 text-primary' : 'text-muted'
                            }`}
                          />
                        </button>

                        {mediaMenuOpen && (
                          <div className="dropdown-pop absolute left-0 top-[calc(100%+6px)] z-50 min-w-[200px] rounded-xl border border-border bg-card p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.22)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150">
                            {mediaGroupTabs.map((tab) => {
                              const isSelected = activeTab === tab.key
                              return (
                                <button
                                  key={tab.key}
                                  type="button"
                                  onClick={() => {
                                    setActiveTab(tab.key)
                                    setMediaMenuOpen(false)
                                  }}
                                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-primary/10 text-primary font-semibold'
                                      : 'text-text hover:bg-secondary hover:text-text'
                                  }`}
                                >
                                  <span>{tab.label}</span>
                                  {isSelected && <CheckIcon className="size-4 text-primary" />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Yanıtlar Tab */}
                      {isOwnProfile ? (
                        <div ref={repliesMenuRef} className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setRepliesMenuOpen((prev) => !prev)
                              setMediaMenuOpen(false)
                            }}
                            className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-semibold transition cursor-pointer select-none ${
                              isRepliesGroupActive
                                ? 'border-b-3 border-primary text-primary hover:bg-secondary'
                                : 'text-muted hover:bg-secondary hover:text-text'
                            }`}
                          >
                            <span>{repliesButtonLabel}</span>
                            <ChevronDownIcon
                              className={`size-3.5 transition-transform duration-200 ${
                                repliesMenuOpen ? 'rotate-180 text-primary' : 'text-muted'
                              }`}
                            />
                          </button>

                          {repliesMenuOpen && (
                            <div className="dropdown-pop absolute left-0 top-[calc(100%+6px)] z-50 min-w-[200px] rounded-xl border border-border bg-card p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.22)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150">
                              {repliesGroupTabs.map((tab) => {
                                const isSelected = activeTab === tab.key
                                return (
                                  <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => {
                                      setActiveTab(tab.key)
                                      setRepliesMenuOpen(false)
                                    }}
                                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-primary/10 text-primary font-semibold'
                                        : 'text-text hover:bg-secondary hover:text-text'
                                    }`}
                                  >
                                    <span>{tab.label}</span>
                                    {isSelected && <CheckIcon className="size-4 text-primary" />}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('replies')
                            setMediaMenuOpen(false)
                          }}
                          className={`flex items-center rounded-t-lg px-4 py-2 text-sm font-semibold transition cursor-pointer select-none ${
                            activeTab === 'replies'
                              ? 'border-b-3 border-primary text-primary hover:bg-secondary'
                              : 'text-muted hover:bg-secondary hover:text-text'
                          }`}
                        >
                          <span>{t('profile.replies')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <div className="relative z-10 grid items-start gap-4 xl:grid-cols-[250px_minmax(0,1fr)_310px]">
                <aside className="hidden space-y-4 xl:block">
                  <ProfilePanel title={t('profile.aboutTitle', { defaultValue: 'Hakkında' })}>
                    <p className="text-sm leading-6 text-muted">
                      {profileUser.bio || t('profile.emptyBio')}
                    </p>
                    <div className="mt-4 space-y-3 border-t border-border-soft pt-4 text-sm text-muted">
                      <p className="flex items-center gap-2">
                        <LocationIcon />
                        <span>{formatLocation(profileUser.location)}</span>
                      </p>
                      {joinedAtLabel ? (
                        <p className="flex items-start gap-2">
                          <span className="mt-0.5"><CalendarIcon /></span>
                          <span>{t('profile.joinedAt', { defaultValue: '{{date}} tarihinde katıldı', date: joinedAtLabel })}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-soft pt-4 text-center">
                      <div>
                        <strong className="block text-sm text-text">{stats.posts.toLocaleString()}</strong>
                        <span className="text-[11px] text-muted">{t('common.posts')}</span>
                      </div>
                      <Link to={isOwnProfile ? `/${lang}/profile/following` : `/${lang}/u/${profileUser.username}/following`}>
                        <strong className="block text-sm text-text">{stats.following.toLocaleString()}</strong>
                        <span className="text-[11px] text-muted">{t('common.following')}</span>
                      </Link>
                      <Link to={isOwnProfile ? `/${lang}/profile/followers` : `/${lang}/u/${profileUser.username}/followers`}>
                        <strong className="block text-sm text-text">{stats.followers.toLocaleString()}</strong>
                        <span className="text-[11px] text-muted">{t('common.followers')}</span>
                      </Link>
                    </div>
                  </ProfilePanel>

                  <ProfilePanel title={t('profile.highlights', { defaultValue: 'Öne Çıkanlar' })}>
                    {highlightItems.length ? (
                      <div className="grid grid-cols-4 gap-2">
                        {highlightItems.map((item) => (
                          <div key={item.id} className="min-w-0 text-center">
                            <div className="mx-auto grid aspect-square w-full place-items-center overflow-hidden rounded-full border-2 border-border bg-secondary">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-primary">{item.label?.slice(0, 1)}</span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-[10px] text-muted">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-muted">
                        {t('profile.emptyMedia', { defaultValue: 'Henüz öne çıkarılacak medya yok.' })}
                      </p>
                    )}
                  </ProfilePanel>
                </aside>

                <div className="min-w-0 space-y-3">
                  {isOwnProfile ? (
                    <PostComposer
                      user={user}
                      onSubmit={handleCreateProfilePost}
                      isSubmitting={isPublishing}
                      allowStoryOption={false}
                    />
                  ) : null}
                  <div className="flex flex-col gap-3">{renderTabContent()}</div>
                </div>

                <aside className="hidden xl:block">
                  <ProfileDiscoveryRail
                    lang={lang}
                    t={t}
                    suggestions={visibleSuggestions}
                    trends={discoveryState.trends}
                    error={discoveryState.error}
                    isAuthenticated={isAuthenticated}
                    suggestionPending={suggestionPending}
                    onFollow={handleSuggestionFollow}
                  />
                </aside>
              </div>
            </>
          ) : null}
        </div>
      </SocialLayout>

      <ProfileImageCropModal
        open={cropState.open}
        file={cropState.file}
        target={cropState.target}
        onClose={() =>
          setCropState({
            open: false,
            file: null,
            target: 'avatar',
          })
        }
        onConfirm={(result) => handleProfileImageUpload(cropState.target, result)}
      />

      <VerificationModal
        open={verificationModalOpen}
        user={profileUser}
        onClose={() => setVerificationModalOpen(false)}
      />

      <ProfileImageLightbox
        open={lightboxState.open}
        imageUrl={lightboxState.imageUrl}
        title={lightboxState.title}
        onClose={() =>
          setLightboxState({
            open: false,
            imageUrl: '',
            title: '',
          })
        }
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

      {photoMenuState.open ? (
        <div className="fixed inset-0 z-[120]" onClick={closePhotoMenu}>
          <div
            className="fixed"
            style={{
              top: `${photoMenuState.top}px`,
              left: `${photoMenuState.left}px`,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <PhotoActionMenu
              t={t}
              onClose={closePhotoMenu}
              onChange={() => {
                const target = photoMenuState.target
                closePhotoMenu()
                if (target === 'avatar') {
                  avatarInputRef.current?.click()
                  return
                }
                coverInputRef.current?.click()
              }}
              onDelete={() => {
                setDeleteDialogState({
                  open: true,
                  target: photoMenuState.target,
                })
                closePhotoMenu()
              }}
            />
          </div>
        </div>
      ) : null}

      <ConfirmDeleteDialog
        open={deleteDialogState.open}
        target={deleteDialogState.target}
        t={t}
        onClose={() =>
          setDeleteDialogState({
            open: false,
            target: 'avatar',
          })
        }
        onConfirm={() => handleProfileImageDelete(deleteDialogState.target)}
      />
    </>
  )
}

export default ProfilePage
