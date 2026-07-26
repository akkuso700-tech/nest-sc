import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import { getSearchResults } from '../services/searchService.js'
import { toggleFollowByUsername } from '../services/usersService.js'
import { useAuth } from '../store/AuthContext.jsx'
import { resolveMediaUrl } from '../utils/media.js'
import { formatLocation, getFullName } from '../utils/social.js'

function PeopleCard({
  item,
  lang,
  t,
  currentUsername,
  isAuthenticated,
  onToggleFollow,
  isFollowLoading = false,
}) {
  const canShowFollow =
    Boolean(isAuthenticated) &&
    typeof onToggleFollow === 'function' &&
    Boolean(item?.user?.username) &&
    item.user.username !== currentUsername
  const isFollowing = Boolean(item?.viewerState?.isFollowing)

  return (
    <Link
      to={`/${lang}/u/${item.user.username}`}
      className="flex items-center gap-3 rounded-lg hover:bg-secondary bg-card px-1 py-1"
    >
      <UserAvatar user={item.user} className="size-12" textClassName="text-sm font-semibold" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{getFullName(item.user)}</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">@{item.user.username}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {item.reason ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                {item.reason}
              </span>
            ) : null}
            {canShowFollow ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onToggleFollow(item.user.username, isFollowing)
                }}
                disabled={isFollowLoading}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  isFollowing
                    ? 'border border-border bg-secondary text-text hover:bg-secondary-hover'
                    : 'bg-primary text-inverse hover:bg-primary-hover'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isFollowLoading
                  ? '...'
                  : isFollowing
                    ? t('search.people.unfollow')
                    : t('search.people.follow')}
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {formatLocation(item.user.location)}
          {item.mutualConnectionCount
            ? ` · ${t('search.people.mutualConnections', { count: item.mutualConnectionCount })}`
            : ''}
        </p>
      </div>
    </Link>
  )
}

function SearchTabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-sm px-2 py-2 text-sm font-medium transition ${
        active
          ? 'border-b-3 border-primary text-primary hover:bg-secondary'
          : 'text-muted hover:bg-secondary hover:text-text'
      }`}
    >
      {label}
    </button>
  )
}

function isLoopPost(post) {
  const contentType = `${post?.contentType || post?.type || post?.publication?.contentType || ''}`
    .trim()
    .toLowerCase()
  if (contentType === 'loop' || contentType === 'loopvideo' || contentType === 'loop_video') {
    return true
  }
  return Boolean((post?.media || []).some((item) => item?.type === 'video' || item?.kind === 'video'))
}

function PostGridCard({ post, lang, navigationState }) {
  const author = post?.author || {}
  const media = (post?.media || [])[0] || null
  const posterUrl = resolveMediaUrl(
    media?.posterUrl || media?.thumbnailUrl || media?.previewUrl || media?.coverImageUrl || '',
  )
  const imageUrl = resolveMediaUrl(media?.type === 'image' ? media?.url || '' : '')
  const postId = post?._id || post?.id
  const isVideoMedia = `${media?.type || ''}`.toLowerCase() === 'video'

  return (
    <Link
      to={postId ? `/${lang}/posts/${postId}` : '#'}
      state={postId ? navigationState : undefined}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <UserAvatar user={author} className="size-8" textClassName="text-xs font-semibold" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-text">{getFullName(author)}</p>
          <p className="truncate text-[11px] text-muted">@{author?.username || ''}</p>
        </div>
      </div>
      <p className="truncate px-2 pb-1 text-xs text-text">{post?.text || ''}</p>
      {isVideoMedia && posterUrl ? (
        <div className="aspect-[16/10] w-full bg-secondary">
          <img src={posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : imageUrl ? (
        <div className="aspect-[16/10] w-full bg-secondary">
          <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : isVideoMedia ? (
        <div className="relative grid aspect-[16/10] w-full place-items-center bg-zinc-950 text-white">
          <span className="grid size-11 place-items-center rounded-full bg-white/15" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
              <path d="m9 7 8 5-8 5V7Z" />
            </svg>
          </span>
        </div>
      ) : (
        <div className="aspect-[16/10] w-full bg-secondary" />
      )}
    </Link>
  )
}

function SearchPage() {
  const { lang = 'tr' } = useParams()
  const location = useLocation()
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, user } = useAuth()
  const query = searchParams.get('q') || ''
  const tab = searchParams.get('tab') || 'all'

  const [state, setState] = useState({
    isLoading: true,
    error: '',
    results: { posts: [], people: [], nearby: [], groups: [] },
    meta: { locationEnabled: false },
  })
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const [followLoadingMap, setFollowLoadingMap] = useState({})

  const tabs = useMemo(
    () => [
      { key: 'all', label: 'Tümü' },
      { key: 'loop', label: 'Loop' },
      { key: 'posts', label: 'Gönderi' },
      { key: 'people', label: 'Kisiler' },
      { key: 'groups', label: 'Grup' },
    ],
    [],
  )

  const requestTab = useMemo(() => {
    if (tab === 'people') return 'people'
    if (tab === 'posts') return 'posts'
    if (tab === 'groups') return 'groups'
    return 'all'
  }, [tab])

  useEffect(() => {
    if (!toast.message) return undefined
    const timeoutId = window.setTimeout(() => setToast({ message: '', tone: 'success' }), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  useEffect(() => {
    let cancelled = false

    async function loadResults() {
      setState((currentState) => ({ ...currentState, isLoading: true, error: '' }))

      try {
        const payload = await getSearchResults({
          q: query,
          tab: requestTab,
          sort: 'popular',
          limit: requestTab === 'all' ? 8 : 12,
        })

        if (!cancelled) {
          setState({
            isLoading: false,
            error: '',
            results: payload.results,
            meta: payload.meta || { locationEnabled: false },
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            isLoading: false,
            error: error.message || t('search.errors.load'),
            results: { posts: [], people: [], nearby: [], groups: [] },
            meta: { locationEnabled: false },
          })
        }
      }
    }

    loadResults()

    return () => {
      cancelled = true
    }
  }, [query, requestTab, t])

  function updateParams(nextParams) {
    const merged = new URLSearchParams(searchParams)
    Object.entries(nextParams).forEach(([key, value]) => {
      if (value === null || value === '') {
        merged.delete(key)
      } else {
        merged.set(key, value)
      }
    })
    setSearchParams(merged)
  }

  function handleTabChange(nextTab) {
    updateParams({ tab: nextTab, sort: null })
  }

  function updateFollowStateInResults(username, nextIsFollowing) {
    setState((currentState) => {
      const mapItem = (item) =>
        item.user?.username === username
          ? {
              ...item,
              viewerState: {
                ...(item.viewerState || {}),
                isFollowing: nextIsFollowing,
              },
            }
          : item

      return {
        ...currentState,
        results: {
          ...currentState.results,
          people: (currentState.results.people || []).map(mapItem),
          nearby: (currentState.results.nearby || []).map(mapItem),
        },
      }
    })
  }

  async function handleToggleFollow(username, wasFollowing) {
    if (!isAuthenticated || !username) {
      setToast({ message: t('search.people.followSignInRequired'), tone: 'error' })
      return
    }

    setFollowLoadingMap((current) => ({ ...current, [username]: true }))
    updateFollowStateInResults(username, !wasFollowing)

    try {
      const payload = await toggleFollowByUsername(username)
      const nextIsFollowing =
        typeof payload?.viewerState?.isFollowing === 'boolean'
          ? payload.viewerState.isFollowing
          : !wasFollowing
      updateFollowStateInResults(username, nextIsFollowing)
      setToast({
        message: nextIsFollowing ? t('search.people.followed') : t('search.people.unfollowed'),
        tone: 'success',
      })
    } catch (error) {
      updateFollowStateInResults(username, wasFollowing)
      setToast({ message: error.message || t('search.people.followFailed'), tone: 'error' })
    } finally {
      setFollowLoadingMap((current) => ({ ...current, [username]: false }))
    }
  }

  const { posts, people, groups } = state.results
  const loopPosts = (posts || []).filter(isLoopPost)
  const isAllTab = tab === 'all'
  const allPeopleToRender = people.slice(0, 2)
  const allPostsToRender = posts.slice(0, 6)
  const navigationState = useMemo(
    () => ({
      backgroundLocation: location,
    }),
    [location],
  )

  return (
    <>
      <Seo
        title={query ? t('search.seo.titleWithQuery', { query }) : t('search.seo.title')}
        description={t('search.seo.description')}
      />
      <SocialLayout
        pageTitle={t('search.pageTitle')}
        activeKey=""
        showDesktopPageHeader={false}
        initialSidebarOpen={false}
      >
        <div className="content-area space-y-2">
          <section className="md:rounded-lg border border-border bg-card px-3 py-1 shadow-sm">
            <div>
              <h1 className="text-base font-bold text-text">{t('search.heading')}</h1>
              <p className="mt-1 text-sm text-muted">
                {query
                  ? t('search.subheadingWithQuery', { query })
                  : t('search.subheadingDefault')}
              </p>
            </div>

            <div className="no-scrollbar mt-2 flex gap-0 overflow-x-auto pb-1">
              {tabs.map((item) => (
                <SearchTabButton
                  key={item.key}
                  active={tab === item.key}
                  label={item.label}
                  onClick={() => handleTabChange(item.key)}
                />
              ))}
            </div>
          </section>

          {state.error ? (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {state.error}
            </div>
          ) : null}

          {state.isLoading ? (
            <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-8 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              {t('search.loading')}
            </div>
          ) : null}

          {isAllTab && allPeopleToRender.length ? (
            <section className="space-y-2 md:rounded-lg border border-border bg-card px-3 py-3 text-sm text-text shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-text">Kisiler</h2>
                <button
                  type="button"
                  onClick={() => handleTabChange('people')}
                  className="text-sm text-primary"
                >
                  Tüm Kisiler
                </button>
              </div>
              {allPeopleToRender.map((item) => (
                <PeopleCard
                  key={item.user.id || item.user.username}
                  item={item}
                  lang={lang}
                  t={t}
                  currentUsername={user?.username || ''}
                  isAuthenticated={isAuthenticated}
                  onToggleFollow={handleToggleFollow}
                  isFollowLoading={Boolean(followLoadingMap[item.user.username])}
                />
              ))}
            </section>
          ) : null}

          {isAllTab ? (
            <section className="space-y-2 md:rounded-lg border border-border bg-card px-3 py-3 text-sm text-text">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-text">Gönderiler</h2>
                <button
                  type="button"
                  onClick={() => handleTabChange('posts')}
                  className="text-sm text-primary"
                >
                  Tüm Gönderiler
                </button>
              </div>
              {allPostsToRender.length ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {allPostsToRender.map((post) => (
                    <PostGridCard
                      key={post._id || post.id}
                      post={post}
                      lang={lang}
                      navigationState={navigationState}
                    />
                  ))}
                </div>
              ) : (
                <div>{t('search.posts.empty')}</div>
              )}
            </section>
          ) : null}

          {tab === 'people' ? (
            <section className="space-y-2 md:rounded-lg border border-border bg-card px-3 py-3 text-sm text-text shadow-sm">
              <h2 className="text-base font-bold text-text">Kisiler</h2>
              {people.length ? people.map((item) => (
                <PeopleCard
                  key={item.user.id || item.user.username}
                  item={item}
                  lang={lang}
                  t={t}
                  currentUsername={user?.username || ''}
                  isAuthenticated={isAuthenticated}
                  onToggleFollow={handleToggleFollow}
                  isFollowLoading={Boolean(followLoadingMap[item.user.username])}
                />
              )) : <div>{t('search.people.empty')}</div>}
            </section>
          ) : null}

          {tab === 'posts' ? (
            <section className="space-y-2 md:rounded-lg border border-border bg-card px-3 py-3 text-sm text-text">
              <h2 className="text-base font-bold text-text">Gönderiler</h2>
              {posts.length ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {posts.map((post) => (
                    <PostGridCard
                      key={post._id || post.id}
                      post={post}
                      lang={lang}
                      navigationState={navigationState}
                    />
                  ))}
                </div>
              ) : <div>{t('search.posts.empty')}</div>}
            </section>
          ) : null}

          {tab === 'loop' ? (
            <section className="space-y-2 md:rounded-lg border border-border bg-card px-3 py-3 text-sm text-text">
              <h2 className="text-base font-bold text-text">Loop</h2>
              {loopPosts.length ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {loopPosts.map((post) => (
                    <PostGridCard
                      key={post._id || post.id}
                      post={post}
                      lang={lang}
                      navigationState={navigationState}
                    />
                  ))}
                </div>
              ) : <div>Loop sonucu bulunamadi.</div>}
            </section>
          ) : null}

          {tab === 'groups' ? (
            <section className="space-y-2 md:rounded-lg border border-border bg-card px-3 py-3 text-sm text-text">
              <h2 className="text-base font-bold text-text">Grup</h2>
              {groups.length ? (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <Link
                      key={group.id}
                      to={`/${lang}/groups`}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-3"
                    >
                      <p className="truncate text-sm font-semibold text-text">{group.name}</p>
                      <span className="ml-3 shrink-0 text-xs text-muted">{group.memberCount} uye</span>
                    </Link>
                  ))}
                </div>
              ) : <div>Grup sonucu bulunamadi.</div>}
            </section>
          ) : null}
        </div>
      </SocialLayout>

      <ActionToast toast={toast} onClose={() => setToast({ message: '', tone: 'success' })} />
    </>
  )
}

export default SearchPage
