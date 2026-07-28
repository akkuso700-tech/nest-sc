import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Seo from '../components/seo/Seo.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import SocialLayout from '../layouts/SocialLayout.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import {
  getMyConnections,
  getProfileConnections,
  toggleFollowByUsername,
} from '../services/usersService.js'
import { formatLocation, getAvatarLabel, getFullName } from '../utils/social.js'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import { resolveMediaUrl } from '../utils/media.js'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  )
}

function ConnectionsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-2/3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="h-10 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ConnectionCard({ item, lang, isAuthenticated, onToggleFollow, pendingUsername }) {
  const profileUser = item.user
  const viewerState = item.viewerState || {}
  const isPending = pendingUsername === profileUser.username
  const resolvedAvatarUrl = resolveMediaUrl(profileUser.avatarUrl)

  return (
    <article className="md:rounded-lg border border-border bg-card p-5 md:shadow-sm ">
      <div className="flex items-start gap-4">
        <Link
          to={`/${lang}/u/${profileUser.username}`}
          className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-950 text-base font-semibold text-white dark:bg-white dark:text-zinc-950"
        >
          {resolvedAvatarUrl ? (
            <img
              src={resolvedAvatarUrl}
              alt={getFullName(profileUser)}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            getAvatarLabel(profileUser)
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link to={`/${lang}/u/${profileUser.username}`} className="block transition hover:opacity-80">
            <h2 className="truncate text-base font-semibold text-zinc-950 dark:text-white">
              <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{getFullName(profileUser)}</span><VerifiedBadge user={profileUser} /></span>
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              @{profileUser.username}
            </p>
          </Link>

        

          <div className="mt-1 md:mt-3 flex flex-wrap items-center gap-1 md:gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{formatLocation(profileUser.location)}</span>
            
            {item.mutualConnectionCount ? (
              <span>{item.mutualConnectionCount} ortak baglanti</span>
            ) : null}
            {viewerState.followsViewer ? <span>Seni takip ediyor</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <Link
            to={`/${lang}/messages?recipientId=${encodeURIComponent(profileUser.id)}&username=${encodeURIComponent(profileUser.username)}&name=${encodeURIComponent(getFullName(profileUser))}&avatarUrl=${encodeURIComponent(resolvedAvatarUrl || '')}`}
            className="rounded-lg border border-blue-600 px-2 py-1.5 text-center text-sm font-regular text-blue-500 transition"
          >
            Mesaj
          </Link>

          {viewerState.canFollow ? (
            <button
              type="button"
              onClick={() => onToggleFollow(profileUser.username)}
              disabled={!isAuthenticated || isPending}
              className={`rounded-lg px-4 py-2.5 text-sm cursor-pointer font-regular transition ${
                viewerState.isFollowing
                  ? 'bg-primary text-inverse hover:bg-primary-hover'
                  : 'bg-primary text-inverse hover:bg-primary-hover'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isPending ? '...' : viewerState.isFollowing ? 'Takibi Birak' : 'Takip Et'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function ConnectionsPage({ connectionType }) {
  const { lang, username } = useParams()
  const { isAuthenticated, status } = useAuth()
  const [pageState, setPageState] = useState({
    data: null,
    isLoading: true,
    error: '',
  })
  const [followState, setFollowState] = useState({
    username: '',
    error: '',
  })
  const [searchValue, setSearchValue] = useState('')
  const [filterMode, setFilterMode] = useState('all')
  const [toast, setToast] = useState({
    message: '',
    tone: 'success',
  })

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
    if (!username && !isAuthenticated && status !== 'loading') {
      setPageState({
        data: null,
        isLoading: false,
        error: '',
      })
      return
    }

    if (status === 'loading') {
      return
    }

    let cancelled = false

    async function loadConnections() {
      setPageState((current) => ({
        ...current,
        isLoading: true,
        error: '',
      }))

      try {
        const payload = username
          ? await getProfileConnections(username, connectionType)
          : await getMyConnections(connectionType)

        if (cancelled) {
          return
        }

        setPageState({
          data: payload,
          isLoading: false,
          error: '',
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setPageState({
          data: null,
          isLoading: false,
          error: error.message || 'Baglanti listesi yuklenemedi.',
        })
      }
    }

    loadConnections()

    return () => {
      cancelled = true
    }
  }, [connectionType, isAuthenticated, status, username])

  const pageTitle = connectionType === 'followers' ? 'Takipciler' : 'Takip Edilenler'
  const profileUser = pageState.data?.user
  const connectionItems = useMemo(() => pageState.data?.items || [], [pageState.data?.items])
  const filteredItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    return connectionItems.filter((item) => {
      const fullName = getFullName(item.user).toLowerCase()
      const usernameValue = item.user.username.toLowerCase()
      const matchesSearch =
        !normalizedSearch ||
        fullName.includes(normalizedSearch) ||
        usernameValue.includes(normalizedSearch)

      if (!matchesSearch) {
        return false
      }

      if (filterMode === 'following') {
        return Boolean(item.viewerState?.isFollowing)
      }

      if (filterMode === 'not-following') {
        return Boolean(item.viewerState?.canFollow) && !item.viewerState?.isFollowing
      }

      if (filterMode === 'follows-you') {
        return Boolean(item.viewerState?.followsViewer)
      }

      return true
    })
  }, [connectionItems, filterMode, searchValue])

  const description = useMemo(() => {
    const ownerLabel = profileUser ? getFullName(profileUser) : 'Profil'
    return `${ownerLabel} icin ${pageTitle.toLowerCase()} listesi.`
  }, [pageTitle, profileUser])

  if (!username && status !== 'loading' && !isAuthenticated) {
    return <Navigate to={`/${lang}/login`} replace />
  }

  async function handleToggleFollow(targetUsername) {
    if (!isAuthenticated || !targetUsername || followState.username) {
      return
    }

    setFollowState({
      username: targetUsername,
      error: '',
    })

    const previousData = pageState.data
    const optimisticFollowing = !pageState.data?.items.find((item) => item.user.username === targetUsername)?.viewerState?.isFollowing

    setPageState((current) => ({
      ...current,
      data: current.data
        ? {
            ...current.data,
            items: current.data.items.map((item) =>
              item.user.username === targetUsername
                ? {
                    ...item,
                    viewerState: {
                      ...item.viewerState,
                      isFollowing: optimisticFollowing,
                    },
                  }
                : item,
            ),
          }
        : current.data,
    }))

    try {
      const payload = await toggleFollowByUsername(targetUsername)

      setPageState((current) => ({
        ...current,
        data: current.data
          ? {
              ...current.data,
              items: current.data.items.map((item) =>
                item.user.username === targetUsername
                  ? {
                      ...item,
                      viewerState: {
                        ...item.viewerState,
                        isFollowing: !item.viewerState?.isFollowing,
                      },
                    }
                  : item,
              ),
            }
          : current.data,
      }))

      setFollowState({
        username: '',
        error: '',
      })
      setToast({
        message: payload.viewerState?.isFollowing ? 'Kullanici takip edildi.' : 'Kullanici takibi birakildi.',
        tone: 'success',
      })
    } catch (error) {
      setPageState((current) => ({
        ...current,
        data: previousData || current.data,
      }))
      setToast({
        message: error.message || 'Takip islemi tamamlanamadi.',
        tone: 'error',
      })
      setFollowState({
        username: '',
        error: error.message || 'Takip islemi tamamlanamadi.',
      })
    }
  }

  return (
    <>
      <Seo title={`${pageTitle} - Nest Social`} description={description} />

      <SocialLayout pageTitle={pageTitle} activeKey="profile" showDesktopPageHeader={false} initialSidebarOpen={false}>
        <div className="md:space-y-2">
          <div className="md:rounded-lg md:border border-border bg-card p-3 md:p-5 md:shadow-sm  ">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
               
                <h1 className="mt-1 text-md font-bold tracking-tight text-text">
                  {pageTitle}
                </h1>
              </div>
              <Link
                to={username ? `/${lang}/u/${username}` : `/${lang}/profile`}
                className="rounded-lg border border-border px-3 py-2 text-sm font-regular text-muted "
              >
                Profile Dön
              </Link>
            </div>

            <div className="mt-1 md:mt-4 grid-col gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
              <label className="flex h-9 px-2 items-center gap-3 rounded-lg border border-border bg-bg  ">
                <span className="text-zinc-400">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Isim veya kullanici adi ara"
                  className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
                />
              </label>

              <div className="no-scrollbar md:mt-3 flex overflow-x-auto">
                {[
                  { key: 'all', label: 'Tum' },
                  { key: 'following', label: 'Takip Edilen' },
                  { key: 'follows-you', label: 'Takipçi' },
                  { key: 'not-following', label: 'Takip Etmediklerim' },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setFilterMode(filter.key)}
                    className={`shrink-0 rounded-sm px-2 py-2 text-sm cursor-pointer font-medium transition ${
                      filterMode === filter.key
                        ? 'border-b-3 border-primary text-primary hover:bg-secondary'
                        : 'text-muted hover:bg-secondary hover:text-text'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {pageState.error ? (
            <div className="rounded-[32px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {pageState.error}
            </div>
          ) : null}

          {followState.error ? (
            <div className="rounded-[32px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {followState.error}
            </div>
          ) : null}

          {pageState.isLoading ? (
            <ConnectionsSkeleton />
          ) : null}

          {!pageState.isLoading && !filteredItems.length ? (
            <div className="rounded-[32px] border border-dashed border-zinc-200 bg-white px-5 py-8 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Aramana veya filtrene uygun kullanici bulunamadi.
            </div>
          ) : null}

          <div className="md:space-y-2">
            {filteredItems.map((item) => (
              <ConnectionCard
                key={item.user.id || item.user.username}
                item={item}
                lang={lang}
                isAuthenticated={isAuthenticated}
                onToggleFollow={handleToggleFollow}
                pendingUsername={followState.username}
              />
            ))}
          </div>
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

export default ConnectionsPage
