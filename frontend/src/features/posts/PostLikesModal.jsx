import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getPostLikes } from '../../services/postsService.js'
import { toggleFollowByUsername } from '../../services/usersService.js'
import { resolveMediaUrl } from '../../utils/media.js'
import { getAvatarLabel, getFullName } from '../../utils/social.js'
import VerifiedBadge from '../../components/common/VerifiedBadge.jsx'
import { useAuth } from '../../store/AuthContext.jsx'

function SearchIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      className={`size-4 shrink-0 ${className}`}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function HeartIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      width="20"
      height="20"
      className={`size-5 shrink-0 ${className}`}
    >
      <path d="m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function CloseIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      className={`size-4 shrink-0 ${className}`}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function LikesSkeleton() {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="size-11 rounded-full bg-secondary shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-3.5 w-28 rounded bg-secondary" />
              <div className="h-3 w-20 rounded bg-secondary" />
            </div>
          </div>
          <div className="h-8 w-20 rounded-xl bg-secondary shrink-0" />
        </div>
      ))}
    </div>
  )
}

export default function PostLikesModal({
  open,
  onClose,
  postId,
  initialCount = 0,
  isMobile = false,
  lang = 'tr',
}) {
  const { t } = useTranslation()
  const { user: currentUser, isAuthenticated } = useAuth()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pendingFollowUsername, setPendingFollowUsername] = useState('')
  const [error, setError] = useState('')
  const searchTimeoutRef = useRef(null)

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 280)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [search])

  const fetchLikes = useCallback(
    async (targetPage = 1, searchQuery = '', isLoadMore = false) => {
      if (!postId) return

      if (isLoadMore) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
        setError('')
      }

      try {
        const data = await getPostLikes(postId, {
          page: targetPage,
          limit: 20,
          q: searchQuery,
        })

        if (isLoadMore) {
          setItems((prev) => [...prev, ...(data.users || [])])
        } else {
          setItems(data.users || [])
        }

        setTotalCount(data.totalLikes ?? data.pagination?.totalItems ?? 0)
        setHasMore(Boolean(data.pagination?.hasMore))
        setPage(targetPage)
      } catch (err) {
        setError(err.message || t('common.loadFailed', { defaultValue: 'Yüklenemedi.' }))
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [postId, t],
  )

  useEffect(() => {
    if (open) {
      setSearch('')
      setDebouncedSearch('')
      fetchLikes(1, '', false)
    }
  }, [open, fetchLikes])

  useEffect(() => {
    if (open) {
      fetchLikes(1, debouncedSearch, false)
    }
  }, [debouncedSearch, open, fetchLikes])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  async function handleToggleFollow(targetUser, currentIsFollowing) {
    if (!isAuthenticated || !targetUser?.username || pendingFollowUsername) return

    setPendingFollowUsername(targetUser.username)
    const optimisticFollowing = !currentIsFollowing

    // Optimistic UI update
    setItems((prev) =>
      prev.map((item) => {
        if (item.user?._id === targetUser._id || item.user?.username === targetUser.username) {
          return {
            ...item,
            viewerState: {
              ...item.viewerState,
              isFollowing: optimisticFollowing,
            },
          }
        }
        return item
      }),
    )

    try {
      await toggleFollowByUsername(targetUser.username)
    } catch {
      // Revert if failed
      setItems((prev) =>
        prev.map((item) => {
          if (item.user?._id === targetUser._id || item.user?.username === targetUser.username) {
            return {
              ...item,
              viewerState: {
                ...item.viewerState,
                isFollowing: currentIsFollowing,
              },
            }
          }
          return item
        }),
      )
    } finally {
      setPendingFollowUsername('')
    }
  }

  const showSearchBar = Boolean(totalCount >= 6 || search.length > 0)

  function renderContent() {
    if (isLoading) {
      return <LikesSkeleton />
    }

    if (error) {
      return (
        <div className="py-12 px-4 text-center">
          <p className="text-sm text-rose-500 font-medium">{error}</p>
          <button
            type="button"
            onClick={() => fetchLikes(1, debouncedSearch, false)}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            {t('common.tryAgain', { defaultValue: 'Tekrar dene' })}
          </button>
        </div>
      )
    }

    if (!items.length) {
      return (
        <div className="py-12 px-4 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted mb-3">
            <HeartIcon className="size-6 opacity-60" />
          </div>
          <p className="text-sm font-semibold text-text">
            {debouncedSearch
              ? t('common.noResults', { defaultValue: 'Kullanıcı bulunamadı.' })
              : t('postDetail.noLikesYet', { defaultValue: 'Henüz beğeni yok.' })}
          </p>
          <p className="mt-1 text-xs text-muted">
            {debouncedSearch
              ? t('common.tryDifferentSearch', { defaultValue: 'Farklı bir arama terimi deneyin.' })
              : t('postDetail.beFirstToLike', { defaultValue: 'Bu gönderiyi ilk beğenen siz olun!' })}
          </p>
        </div>
      )
    }

    return (
      <div className="divide-y divide-border/40 overflow-y-auto px-4 py-2">
        {items.map((item) => {
          const u = item.user || {}
          const viewerState = item.viewerState || {}
          const isOwnAccount = currentUser && (currentUser.id === u.id || currentUser.username === u.username)
          const resolvedAvatar = resolveMediaUrl(u.avatarUrl)
          const isFollowing = Boolean(viewerState.isFollowing)
          const followsViewer = Boolean(viewerState.followsViewer)
          const isPending = pendingFollowUsername === u.username

          return (
            <div
              key={u.id || u._id}
              className="flex items-center justify-between gap-3 py-3 transition hover:bg-secondary/30 rounded-xl px-2"
            >
              <Link
                to={`/${lang}/u/${u.username}`}
                onClick={onClose}
                className="flex items-center gap-3 min-w-0 flex-1 group"
              >
                <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-primary text-sm font-semibold text-inverse">
                  {resolvedAvatar ? (
                    <img
                      src={resolvedAvatar}
                      alt={getFullName(u)}
                      className="size-full object-cover transition duration-200 group-hover:scale-105"
                    />
                  ) : (
                    getAvatarLabel(u)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-text group-hover:underline">
                      {getFullName(u)}
                    </span>
                    <VerifiedBadge user={u} size="xs" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="truncate">@{u.username}</span>
                    {followsViewer ? (
                      <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {t('profile.followsYou', { defaultValue: 'Seni takip ediyor' })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>

              {/* Follow / Unfollow Action */}
              {isAuthenticated && !isOwnAccount ? (
                <button
                  type="button"
                  onClick={() => handleToggleFollow(u, isFollowing)}
                  disabled={isPending}
                  className={`inline-flex h-8 min-w-[90px] items-center justify-center rounded-xl px-3 text-xs font-bold transition duration-200 active:scale-95 disabled:opacity-60 cursor-pointer ${
                    isFollowing
                      ? 'border border-border bg-card text-text hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300'
                      : 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                  }`}
                >
                  {isPending
                    ? '…'
                    : isFollowing
                      ? t('profile.following', { defaultValue: 'Takipte' })
                      : t('profile.follow', { defaultValue: 'Takip Et' })}
                </button>
              ) : null}
            </div>
          )
        })}

        {hasMore ? (
          <div className="py-3 text-center">
            <button
              type="button"
              onClick={() => fetchLikes(page + 1, debouncedSearch, true)}
              disabled={isLoadingMore}
              className="rounded-xl border border-border bg-secondary/70 px-4 py-2 text-xs font-semibold text-text transition hover:bg-secondary disabled:opacity-60"
            >
              {isLoadingMore
                ? t('common.loading', { defaultValue: 'Yükleniyor...' })
                : t('common.loadMore', { defaultValue: 'Daha fazla yükle' })}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  // --- MOBILE BOTTOM SHEET ---
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-likes-title"
      >
        <div
          className="flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-[28px] border-t border-border bg-card shadow-[0_-20px_50px_rgba(0,0,0,0.35)] transition-transform duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Grabber */}
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border-strong shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-rose-500">
                <HeartIcon className="size-5" />
              </span>
              <h2 id="post-likes-title" className="text-base font-bold text-text">
                {t('common.likes', { defaultValue: 'Beğenmeler' })}
              </h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted">
                {totalCount.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full bg-secondary text-muted hover:text-text cursor-pointer"
              aria-label={t('common.close')}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Search Bar */}
          {showSearchBar ? (
            <div className="px-5 pt-3 pb-2 shrink-0">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/80 px-3 py-2 text-sm text-text focus-within:border-primary">
                <SearchIcon className="text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('postDetail.searchLikes', { defaultValue: 'Beğenenlerde ara...' })}
                  className="w-full bg-transparent text-xs text-text outline-none placeholder:text-muted"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="text-xs text-muted hover:text-text cursor-pointer"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* User List */}
          <div className="flex-1 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    )
  }

  // --- DESKTOP CENTERED DIALOG ---
  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-likes-title"
    >
      <div
        className="flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-[scaleIn_160ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-rose-500">
              <HeartIcon className="size-5" />
            </span>
            <h2 id="post-likes-title" className="text-base font-bold text-text">
              {t('common.likes', { defaultValue: 'Beğenmeler' })}
            </h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted">
              {totalCount.toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full bg-secondary text-muted transition hover:text-text cursor-pointer"
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Search Bar */}
        {showSearchBar ? (
          <div className="border-b border-border/40 px-5 py-3 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/80 px-3 py-2 text-sm text-text focus-within:border-primary">
              <SearchIcon className="text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('postDetail.searchLikes', { defaultValue: 'Beğenenlerde ara...' })}
                className="w-full bg-transparent text-xs text-text outline-none placeholder:text-muted"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-xs text-muted hover:text-text cursor-pointer"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* User List */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
