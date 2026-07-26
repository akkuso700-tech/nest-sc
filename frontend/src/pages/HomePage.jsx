import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import PostCard from '../features/posts/PostCard.jsx'
import StoryRail from '../features/stories/StoryRail.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import { createPost, getFeed, getTrendingTopics } from '../services/postsService.js'
import { createStory, getStoryRails, registerStoryView } from '../services/storiesService.js'
import {
  getDiscoverySuggestions,
  toggleFollowByUsername,
  updateDiscoveryLocation,
} from '../services/usersService.js'
import { connectSocketClient, disconnectSocketClient } from '../services/socketClient.js'
import { getFullName } from '../utils/social.js'
import { buildTagLabelFromSlug, buildTagSlug } from '../utils/hashtag.js'
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from '../hooks/useMediaQuery.js'

const PostComposer = lazy(() => import('../features/posts/PostComposer.jsx'))
const StoryViewerModal = lazy(() => import('../features/stories/StoryViewerModal.jsx'))

const FEED_LIMIT = 12
const HOME_LOOP_PREVIEW_LIMIT = 4

function isStoryPost(post) {
  const normalizedType = `${post?.contentType || post?.type || post?.publication?.contentType || ''}`
    .trim()
    .toLowerCase()
  return normalizedType === 'story'
}

function isLoopPost(post) {
  const normalizedType = `${post?.contentType || post?.type || post?.publication?.contentType || ''}`
    .trim()
    .toLowerCase()

  if (normalizedType === 'loop' || normalizedType === 'loopvideo' || normalizedType === 'loop_video') {
    return true
  }

  return Boolean((post?.media || []).some((item) => item?.type === 'video' && item?.hlsUrl))
}

function getPostIdentifier(post) {
  return `${post?.id || post?._id || ''}`.trim()
}

function filterOutStoryPosts(posts = []) {
  return posts.filter((post) => !isStoryPost(post))
}

function mergeExplorePostsWithLoopPreviewPosts(explorePosts = [], loopPosts = []) {
  const basePosts = filterOutStoryPosts(explorePosts)
  const loopCandidates = filterOutStoryPosts(loopPosts).filter((post) => isLoopPost(post))

  if (!loopCandidates.length) {
    return basePosts
  }

  const seenPostIds = new Set()
  const uniqueBasePosts = []

  basePosts.forEach((post) => {
    const postId = getPostIdentifier(post)
    if (postId && seenPostIds.has(postId)) {
      return
    }

    if (postId) {
      seenPostIds.add(postId)
    }
    uniqueBasePosts.push(post)
  })

  const uniqueLoopPosts = []

  loopCandidates.forEach((post) => {
    if (uniqueLoopPosts.length >= HOME_LOOP_PREVIEW_LIMIT) {
      return
    }

    const postId = getPostIdentifier(post)
    if (postId && seenPostIds.has(postId)) {
      return
    }

    if (postId) {
      seenPostIds.add(postId)
    }
    uniqueLoopPosts.push(post)
  })

  if (!uniqueLoopPosts.length) {
    return uniqueBasePosts
  }

  const mergedPosts = []
  let loopPostIndex = 0

  uniqueBasePosts.forEach((post, index) => {
    if (
      loopPostIndex < uniqueLoopPosts.length &&
      (index === 1 || (index > 1 && (index - 1) % 4 === 0))
    ) {
      mergedPosts.push(uniqueLoopPosts[loopPostIndex])
      loopPostIndex += 1
    }

    mergedPosts.push(post)
  })

  while (loopPostIndex < uniqueLoopPosts.length) {
    mergedPosts.push(uniqueLoopPosts[loopPostIndex])
    loopPostIndex += 1
  }

  return mergedPosts
}

function AsideCard({ title, header, children, bodyClassName = 'mt-4 space-y-3' }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      {header || <h2 className="text-base font-semibold text-text">{title}</h2>}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

function TrendList({ items, activeTopic, onSelect, renderMeta, badgeLabel }) {
  const activeTopicSlug = buildTagSlug(activeTopic)

  return (
    <div className="subtle-scrollbar max-h-[176px] space-y-3 overflow-y-auto pr-1">
      {items.map((trend) => (
        <button
          key={trend.slug || trend.key || trend.label}
          type="button"
          onClick={() => onSelect(trend)}
          className={`block w-full rounded-2xl px-4 py-3 text-left transition ${
            activeTopicSlug && activeTopicSlug === buildTagSlug(trend.slug || trend.label)
              ? 'bg-nav-active'
              : 'bg-secondary hover:bg-secondary-hover'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{trend.label}</p>
              <p className="mt-1 text-xs text-muted">{renderMeta(trend)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
              {badgeLabel}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

function MobileInjectionCard({ title, items, activeItemKey, onSelect }) {
  const activeItemSlug = buildTagSlug(activeItemKey)

  return (
    <section className="rounded-lg border border-border bg-card p-5 text-text shadow-sm xl:hidden">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="subtle-scrollbar mt-1 max-h-[160px] space-y-2 overflow-y-auto pr-1 text-sm text-muted">
        {items.map((item) => (
          <button
            key={item.slug || item.key}
            type="button"
            onClick={() => onSelect?.(item)}
            className={`block w-full rounded-lg px-3 py-2 text-left transition ${
              activeItemSlug && activeItemSlug === buildTagSlug(item.slug || item.label)
                ? 'bg-nav-active text-text'
                : 'bg-secondary text-muted hover:bg-secondary-hover hover:text-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function LocationIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  )
}

function normalizeSuggestionItems(items = [], t) {
  return items.map((item) => {
    if (item.user) {
      return item
    }

    return {
      user: item,
      mutualConnectionCount: item.mutualFriends || 0,
      reason: item.mutualFriends
        ? t('home.suggestionsMutualCount', { count: item.mutualFriends })
        : t('home.suggestionsReasonForYou'),
      viewerState: {
        canFollow: true,
        isFollowing: false,
        followsViewer: false,
      },
    }
  })
}

function SuggestionsHeader({
  title,
  modes,
  activeMode,
  onModeChange,
  onRequestNearby,
  isRequestingLocation,
  locationEnabled,
  note,
  nearbyAriaLabel,
  nearbyTitle,
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        <button
          type="button"
          onClick={onRequestNearby}
          disabled={isRequestingLocation}
          className={`inline-flex size-8 items-center cursor-pointer justify-center rounded-full border transition ${
            locationEnabled
              ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
              : 'border-border bg-secondary text-muted hover:bg-secondary-hover hover:text-text'
          } disabled:cursor-not-allowed disabled:opacity-70`}
          aria-label={nearbyAriaLabel}
          title={nearbyTitle}
        >
          <LocationIcon />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-secondary p-1">
        {modes.map((mode) => {
          const isActive = activeMode === mode.key

          return (
            <p
              key={mode.key}
              type="button"
              onClick={() => onModeChange(mode.key)}
              className={`rounded-lg text-center cursor-pointer px-3 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-card text-text shadow-sm'
                  : 'text-muted hover:bg-secondary-hover hover:text-text'
              }`}
            >
              {mode.label}
            </p>
          )
        })}
      </div>

      {note ? <p className="mt-3 text-xs text-muted">{note}</p> : null}
    </div>
  )
}

function SuggestionList({
  items,
  lang,
  pendingUsername,
  onFollow,
  isAuthenticated,
  followLabel,
  waitingLabel,
  loginLabel,
  mutualCountLabel,
}) {
  return (
    <div className="subtle-scrollbar max-h-[332px] space-y-3 overflow-y-auto pr-1">
      {items.map((suggestedUser) => (
        <div
          key={suggestedUser.user.id || suggestedUser.user.username}
          className="rounded-lg border border-border bg-secondary p-2 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link to={`/${lang}/u/${suggestedUser.user.username}`} className="shrink-0">
                <UserAvatar
                  user={suggestedUser.user}
                  className="size-11 text-sm font-semibold"
                  textClassName="text-sm font-semibold"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <Link to={`/${lang}/u/${suggestedUser.user.username}`} className="block min-w-0">
                  <p className="truncate text-sm font-semibold text-text">
                    {getFullName(suggestedUser.user)}
                  </p>
                  <p className="truncate text-xs text-muted">@{suggestedUser.user.username}</p>
                </Link>
                <p className="mt-1 text-xs text-soft">
                  {suggestedUser.reason || mutualCountLabel(suggestedUser.mutualConnectionCount || 0)}
                </p>
              </div>
            </div>

            {isAuthenticated ? (
              <p
                type="button"
                onClick={() => onFollow?.(suggestedUser.user.username)}
                disabled={pendingUsername === suggestedUser.user.username}
                className="shrink-0 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-semibold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pendingUsername === suggestedUser.user.username ? waitingLabel : followLabel}
              </p>
            ) : (
              <Link
                to={`/${lang}/login`}
                className="shrink-0 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-semibold text-inverse transition hover:bg-primary-hover"
              >
                {loginLabel}
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function SuggestionCarousel({
  items,
  lang,
  title,
  modes,
  activeMode,
  onModeChange,
  onRequestNearby,
  isRequestingLocation,
  locationEnabled,
  note,
  pendingUsername,
  onFollow,
  isAuthenticated,
  followLabel,
  waitingLabel,
  loginLabel,
  mutualCountLabel,
  nearbyAriaLabel,
  nearbyTitle,
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 text-text shadow-sm xl:hidden">
      <SuggestionsHeader
        title={title}
        modes={modes}
        activeMode={activeMode}
        onModeChange={onModeChange}
        onRequestNearby={onRequestNearby}
        isRequestingLocation={isRequestingLocation}
        locationEnabled={locationEnabled}
        note={note}
        nearbyAriaLabel={nearbyAriaLabel}
        nearbyTitle={nearbyTitle}
      />
      <div className="subtle-scrollbar -mx-1 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {items.map((suggestedUser) => (
          <div
            key={suggestedUser.user.id || suggestedUser.user.username}
            className="w-[57%] min-w-[57%] snap-start rounded-lg border border-border bg-secondary px-4 py-4"
          >
            <Link to={`/${lang}/u/${suggestedUser.user.username}`} className="block">
              <UserAvatar
                user={suggestedUser.user}
                className="mx-auto size-14 text-sm font-semibold"
                textClassName="text-sm font-semibold"
              />
              <div className="mt-3 text-center">
                <p className="truncate text-sm font-semibold text-text">
                  {getFullName(suggestedUser.user)}
                </p>
                <p className="mt-1 truncate text-xs text-muted">@{suggestedUser.user.username}</p>
                <p className="mt-1 text-[11px] text-soft">
                  {suggestedUser.reason || mutualCountLabel(suggestedUser.mutualConnectionCount || 0)}
                </p>
              </div>
            </Link>

            {isAuthenticated ? (
              <p
                type="button"
                onClick={() => onFollow?.(suggestedUser.user.username)}
                disabled={pendingUsername === suggestedUser.user.username}
                className="mt-4 w-full text-center rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pendingUsername === suggestedUser.user.username ? waitingLabel : followLabel}
              </p>
            ) : (
              <Link
                to={`/${lang}/login`}
                className="mt-4 block w-full rounded-lg bg-primary px-3 py-2.5 text-center text-xs font-semibold !text-inverse transition hover:bg-primary-hover"
              >
                {loginLabel}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function FeedTabBar({ tabs, activeTab, onChange }) {
  return (
    <div className="content-area mb-5">
      <div className="flex items-center gap-2 overflow-x-auto p-1 justify-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key

          return (
            <p
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative rounded-[20px] cursor-pointer px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'text-text'
                  : 'text-muted hover:bg-nav-hover hover:text-text'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`absolute inset-x-4 bottom-1 h-0.5 rounded-full transition ${
                  isActive
                    ? 'bg-primary'
                    : 'bg-transparent'
                }`}
              />
            </p>
          )
        })}
      </div>
    </div>
  )
}

function FeedSkeletonCard() {
  return (
    <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3 animate-pulse">
        <div className="size-11 rounded-full bg-secondary-hover" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-4 w-40 rounded-full bg-secondary-hover" />
          <div className="h-4 w-full rounded-full bg-secondary" />
          <div className="h-4 w-[82%] rounded-full bg-secondary" />
          <div className="aspect-[16/10] rounded-[24px] bg-secondary" />
          <div className="flex gap-2">
            <div className="h-9 w-20 rounded-full bg-secondary" />
            <div className="h-9 w-20 rounded-full bg-secondary" />
            <div className="h-9 w-20 rounded-full bg-secondary" />
          </div>
        </div>
      </div>
    </div>
  )
}

function FeedLoadMoreSkeleton() {
  return (
    <div className="rounded-[20px] border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 animate-pulse">
        <div className="size-6 rounded-full bg-secondary-hover" />
        <div className="h-3 w-48 rounded-full bg-secondary-hover" />
      </div>
    </div>
  )
}

function ComposerFallback() {
  return (
    <div
      className="h-32 animate-pulse rounded-lg border border-border bg-card shadow-sm"
      aria-hidden="true"
    />
  )
}

function FeedEmptyState({ title, description, action }) {
  return (
    <div className="rounded-[28px] border border-dashed border-border bg-card px-5 py-8 text-center shadow-sm">
      <p className="text-lg font-semibold text-text">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

function decodeTagSlug(value = '') {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function resolveSiteUrl() {
  const envSiteUrl = `${import.meta.env.VITE_SITE_URL || ''}`.trim()
  if (envSiteUrl) {
    return envSiteUrl.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return ''
}

function HomePage() {
  const { lang = 'tr', tagSlug = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const { isAuthenticated, status, user } = useAuth()
  const selectedTagFromPath = buildTagLabelFromSlug(decodeTagSlug(tagSlug || '').trim())
  const selectedTopic = selectedTagFromPath || searchParams.get('topic') || ''
  const isTagPage = Boolean(selectedTagFromPath)
  const [activeFeedTab, setActiveFeedTab] = useState('explore')
  const [feedState, setFeedState] = useState({
    posts: [],
    isLoading: true,
    error: '',
    hasMore: false,
    nextCursor: null,
    nextOffset: null,
  })
  const [isPublishing, setIsPublishing] = useState(false)
  const [trendsState, setTrendsState] = useState({
    items: [],
    isLoading: true,
    error: '',
  })
  const [suggestionsState, setSuggestionsState] = useState({
    items: [],
    isLoading: true,
    error: '',
    mode: 'for-you',
    locationEnabled: false,
    note: '',
  })
  const [pendingFollowUsername, setPendingFollowUsername] = useState('')
  const [isRequestingNearby, setIsRequestingNearby] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const [storyState, setStoryState] = useState({
    rails: [],
    isLoading: true,
    error: '',
  })
  const [activeStoryRail, setActiveStoryRail] = useState(null)
  const loadMoreSentinelRef = useRef(null)
  const isLoadingMoreRef = useRef(false)
  const isMobileViewport = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const isMobileComposeOpen = searchParams.get('compose') === '1'
  const composeReturnTo = searchParams.get('returnTo') || ''
  const mobileComposerMediaIntent = searchParams.get('composerMedia') || ''
  const mobileComposerType = searchParams.get('composerType') || ''
  const shouldShowDesktopComposer = isAuthenticated && !isMobileViewport
  const shouldShowMobileComposer = isAuthenticated && isMobileViewport && isMobileComposeOpen
  const shouldAutoExpandDesktopComposer =
    isAuthenticated && !isMobileViewport && isMobileComposeOpen
  const selectedTopicSlug = buildTagSlug(selectedTopic)
  const structuredData = useMemo(() => {
    if (!selectedTopic || !selectedTopicSlug) {
      return null
    }

    const siteUrl = resolveSiteUrl()
    const collectionUrl = siteUrl
      ? `${siteUrl}/${lang}/tag/${encodeURIComponent(selectedTopicSlug)}`
      : undefined
    const itemListElement = (feedState.posts || [])
      .slice(0, 20)
      .map((post, index) => {
        const postId = `${post?.id || post?._id || ''}`.trim()
        if (!postId) {
          return null
        }

        const itemUrl = siteUrl
          ? `${siteUrl}/${lang}/posts/${postId}`
          : `/${lang}/posts/${postId}`

        return {
          '@type': 'ListItem',
          position: index + 1,
          url: itemUrl,
          name: `${post?.text || ''}`.trim().slice(0, 80) || `${selectedTopic} post`,
        }
      })
      .filter(Boolean)

    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${selectedTopic} - ${t('home.trends')}`,
      description: t('home.selectedTrendDescription', { topic: selectedTopic }),
      ...(collectionUrl ? { url: collectionUrl } : {}),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: itemListElement.length,
        itemListElement,
      },
    }
  }, [feedState.posts, lang, selectedTopic, selectedTopicSlug, t])

  const tabs = useMemo(
    () => [
      { key: 'explore', label: t('home.explore') },
      { key: 'following', label: t('home.following') },
      { key: 'for-you', label: t('home.forYou') },
    ],
    [t],
  )

  const suggestionModes = useMemo(
    () => [
      { key: 'for-you', label: t('home.suggestionsModeForYou') },
      { key: 'mutual', label: t('home.suggestionsModeMutual') },
      { key: 'nearby', label: t('home.suggestionsModeNearby') },
    ],
    [t],
  )

  const suggestionItems = useMemo(
    () => normalizeSuggestionItems(suggestionsState.items, t),
    [suggestionsState.items, t],
  )
  const storyRailsByUsername = useMemo(() => {
    const map = new Map()

    ;(storyState.rails || []).forEach((rail) => {
      const username = `${rail?.author?.username || ''}`.trim().toLowerCase()
      if (username) {
        map.set(username, rail)
      }
    })

    return map
  }, [storyState.rails])

  useEffect(() => {
    let cancelled = false

    async function loadStories() {
      setStoryState({
        rails: [],
        isLoading: true,
        error: '',
      })

      try {
        const payload = await getStoryRails({ limit: 30 })

        if (cancelled) {
          return
        }

        setStoryState({
          rails: payload.rails || [],
          isLoading: false,
          error: '',
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setStoryState({
          rails: [],
          isLoading: false,
          error: error.message || t('home.storiesLoadFailed', { defaultValue: 'Hikayeler yuklenemedi.' }),
        })
      }
    }

    loadStories()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    let cancelled = false

    async function loadFeed() {
      if (!isAuthenticated && activeFeedTab !== 'explore') {
        setFeedState({
          posts: [],
          isLoading: false,
          error: '',
          hasMore: false,
          nextCursor: null,
          nextOffset: null,
        })
        return
      }

      setFeedState({
        posts: [],
        isLoading: true,
        error: '',
        hasMore: false,
        nextCursor: null,
        nextOffset: null,
      })

      try {
        const shouldInjectLoopPreview = activeFeedTab === 'explore' && !selectedTopic
        let payload

        if (shouldInjectLoopPreview) {
          const [feedPayload, loopPayload] = await Promise.all([
            getFeed({
              limit: FEED_LIMIT,
              view: activeFeedTab,
            }),
            getFeed({
              limit: HOME_LOOP_PREVIEW_LIMIT,
              view: 'loop',
            }),
          ])

          payload = {
            ...feedPayload,
            posts: mergeExplorePostsWithLoopPreviewPosts(
              feedPayload.posts || [],
              loopPayload.posts || [],
            ),
          }
        } else {
          payload = await getFeed({
            limit: FEED_LIMIT,
            view: activeFeedTab,
            topic: selectedTopic || undefined,
          })
        }

        if (cancelled) {
          return
        }

        setFeedState({
          posts: filterOutStoryPosts(payload.posts || []),
          isLoading: false,
          error: '',
          hasMore: payload.pagination.hasMore,
          nextCursor: payload.pagination.nextCursor || null,
          nextOffset: payload.pagination.nextOffset,
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setFeedState({
          posts: [],
          isLoading: false,
          error: error.message || 'Feed could not be loaded.',
          hasMore: false,
          nextCursor: null,
          nextOffset: null,
        })
      }
    }

    loadFeed()

    return () => {
      cancelled = true
    }
  }, [activeFeedTab, isAuthenticated, selectedTopic])

  useEffect(() => {
    let cancelled = false

    async function loadTrends() {
      setTrendsState({
        items: [],
        isLoading: true,
        error: '',
      })

      try {
        const payload = await getTrendingTopics({ limit: 10 })

        if (cancelled) {
          return
        }

        setTrendsState({
          items: payload.topics || [],
          isLoading: false,
          error: '',
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setTrendsState({
          items: [],
          isLoading: false,
          error: error.message || t('home.trendsLoadFailed'),
        })
      }
    }

    loadTrends()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (!toast.message) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setToast({ message: '', tone: 'success' })
    }, 2600)

    return () => window.clearTimeout(timer)
  }, [toast])

  const openMobileComposer = useCallback((createType = 'post') => {
    if (!isAuthenticated) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`
      const nextSearchParams = new URLSearchParams()
      nextSearchParams.set('returnTo', currentPath)
      navigate(`/${lang}/login?${nextSearchParams.toString()}`)
      return true
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('compose', '1')
    if (createType === 'loopVideo') {
      nextSearchParams.set('composerMedia', 'video')
      nextSearchParams.set('composerType', 'post')
    } else if (createType === 'story') {
      nextSearchParams.delete('composerMedia')
      nextSearchParams.set('composerType', 'story')
    } else {
      nextSearchParams.delete('composerMedia')
      nextSearchParams.set('composerType', 'post')
    }
    nextSearchParams.delete('returnTo')
    setSearchParams(nextSearchParams)
    return true
  }, [isAuthenticated, lang, location.hash, location.pathname, location.search, navigate, searchParams, setSearchParams])

  const closeMobileComposer = useCallback(() => {
    if (!isMobileComposeOpen) {
      return
    }

    if (composeReturnTo) {
      navigate(composeReturnTo, { replace: true })
      return
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('compose')
    nextSearchParams.delete('composerMedia')
    nextSearchParams.delete('composerType')
    nextSearchParams.delete('returnTo')
    setSearchParams(nextSearchParams, { replace: true })
  }, [composeReturnTo, isMobileComposeOpen, navigate, searchParams, setSearchParams])

  useEffect(() => {
    let cancelled = false

    async function loadSuggestions() {
      setSuggestionsState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: '',
      }))

      try {
        const payload = await getDiscoverySuggestions({
          mode: suggestionsState.mode,
          limit: 8,
        })

        if (cancelled) {
          return
        }

        setSuggestionsState((currentState) => ({
          ...currentState,
          items: payload.items || [],
          isLoading: false,
          error: '',
          locationEnabled: Boolean(payload.meta?.locationEnabled),
          note:
            currentState.mode === 'nearby' && !(payload.items || []).length
              ? t('home.suggestionsNearbyEmpty')
              : '',
        }))
      } catch (error) {
        if (cancelled) {
          return
        }

        setSuggestionsState((currentState) => ({
          ...currentState,
          items: [],
          isLoading: false,
          error: error.message || t('home.suggestionsLoadFailed'),
        }))
      }
    }

    loadSuggestions()

    return () => {
      cancelled = true
    }
  }, [suggestionsState.mode, t])

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    const socket = connectSocketClient()

    function handleTrendsUpdate() {
      getTrendingTopics({ limit: 10 })
        .then((payload) => {
          setTrendsState({
            items: payload.topics || [],
            isLoading: false,
            error: '',
          })
        })
        .catch((error) => {
          setTrendsState((current) => ({
            ...current,
            isLoading: false,
            error: current.items.length ? '' : error.message || t('home.trendsLoadFailed'),
          }))
        })
    }

    socket.on('trends:update', handleTrendsUpdate)

    return () => {
      socket.off('trends:update', handleTrendsUpdate)
      disconnectSocketClient()
    }
  }, [isAuthenticated, t])

  useEffect(() => {
    if (selectedTopic && activeFeedTab !== 'explore') {
      setActiveFeedTab('explore')
    }
  }, [activeFeedTab, selectedTopic])

  const mobileFeed = useMemo(() => {
    const items = []

    feedState.posts.forEach((post, index) => {
      items.push({ type: 'post', value: post })

              if (index === 2) {
                items.push({ type: 'trends' })
              }

      if (index === 5) {
        items.push({ type: 'friends' })
      }
    })

    return items
  }, [feedState.posts])
  const firstFeedPostId = getPostIdentifier(feedState.posts[0])

  async function handleCreatePost(payload) {
    setIsPublishing(true)

    try {
      const resolveContentType = () => {
        if (payload instanceof FormData) {
          return `${payload.get('contentType') || 'post'}`.toLowerCase()
        }

        return `${payload?.contentType || 'post'}`.toLowerCase()
      }

      const contentType = resolveContentType()
      const response = contentType === 'story' ? await createStory(payload) : await createPost(payload)
      const isScheduled = Boolean(response?.meta?.scheduled)

      if (contentType === 'story' && response?.story) {
        setStoryState((currentState) => {
          const existingRails = [...(currentState.rails || [])]
          const authorUsername = response.story?.author?.username
          const existingRailIndex = existingRails.findIndex(
            (rail) => rail.author?.username === authorUsername,
          )

          if (existingRailIndex >= 0) {
            const existingRail = existingRails[existingRailIndex]
            existingRails[existingRailIndex] = {
              ...existingRail,
              hasUnseen: true,
              latestCreatedAt: response.story.createdAt,
              items: [...(existingRail.items || []), response.story],
            }
          } else {
            existingRails.unshift({
              author: response.story.author,
              hasUnseen: true,
              latestCreatedAt: response.story.createdAt,
              items: [response.story],
            })
          }

          return {
            ...currentState,
            rails: existingRails,
          }
        })
      } else if (!isScheduled && response?.post) {
      setFeedState((currentState) => ({
        ...currentState,
        posts: filterOutStoryPosts([response.post, ...currentState.posts]),
      }))
      }

      setToast({
        message:
          contentType === 'story'
            ? t('home.storyPublished', { defaultValue: 'Hikaye paylasildi.' })
            : isScheduled
              ? t('home.postScheduled', { defaultValue: 'Gonderi planlandi.' })
              : t('home.postPublished', { defaultValue: 'Gonderi paylasildi.' }),
        tone: 'success',
      })

      return response
    } catch (error) {
      setToast({
        message: error.message || t('home.postPublishFailed', { defaultValue: 'Gonderi islemi tamamlanamadi.' }),
        tone: 'error',
      })
      throw error
    } finally {
      setIsPublishing(false)
    }
  }

  const handleLoadMore = useCallback(async () => {
    const nextCursor = feedState.nextCursor
    const nextOffset = feedState.nextOffset

    if (
      isLoadingMoreRef.current ||
      feedState.isLoading ||
      !feedState.hasMore ||
      (typeof nextOffset !== 'number' && !nextCursor)
    ) {
      return
    }

    isLoadingMoreRef.current = true
    setFeedState((currentState) => ({
      ...currentState,
      isLoading: true,
    }))

    try {
      const payload = await getFeed({
        limit: FEED_LIMIT,
        ...(nextCursor ? { cursor: nextCursor } : { offset: nextOffset }),
        view: activeFeedTab,
        topic: selectedTopic || undefined,
      })

      setFeedState((currentState) => ({
        posts: filterOutStoryPosts([
          ...currentState.posts,
          ...(payload.posts || []),
        ]),
        isLoading: false,
        error: '',
        hasMore: payload.pagination.hasMore,
        nextCursor: payload.pagination.nextCursor || null,
        nextOffset: payload.pagination.nextOffset,
      }))
    } catch (error) {
      setFeedState((currentState) => ({
        ...currentState,
        isLoading: false,
        error: error.message || 'More posts could not be loaded.',
      }))
    } finally {
      isLoadingMoreRef.current = false
    }
  }, [
    activeFeedTab,
    feedState.hasMore,
    feedState.isLoading,
    feedState.nextCursor,
    feedState.nextOffset,
    selectedTopic,
  ])

  useEffect(() => {
    if (!feedState.hasMore || !feedState.posts.length || !loadMoreSentinelRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore()
        }
      },
      {
        root: null,
        rootMargin: '180px 0px',
        threshold: 0.01,
      },
    )

    observer.observe(loadMoreSentinelRef.current)

    return () => observer.disconnect()
  }, [feedState.hasMore, feedState.posts.length, handleLoadMore])

  function handleSelectTrend(trend) {
    const topicLabel = typeof trend === 'string' ? trend : trend?.label || ''
    const topicSlug = buildTagSlug(
      typeof trend === 'string' ? trend : trend?.slug || topicLabel,
    )

    if (!topicSlug) {
      return
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('topic')
    const nextQuery = nextSearchParams.toString()

    navigate(`/${lang}/tag/${encodeURIComponent(topicSlug)}${nextQuery ? `?${nextQuery}` : ''}`)
    setActiveFeedTab('explore')
  }

  function handleClearTrend() {
    if (isTagPage) {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.delete('topic')
      const nextQuery = nextSearchParams.toString()
      navigate(`/${lang}/${nextQuery ? `?${nextQuery}` : ''}`)
      return
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('topic')
    setSearchParams(nextSearchParams)
  }

  function handleSuggestionModeChange(nextMode) {
    if (nextMode === 'nearby' && !isAuthenticated) {
      setToast({ message: t('home.suggestionsSignInRequiredNearby'), tone: 'error' })
      return
    }

    if (nextMode === 'nearby' && !suggestionsState.locationEnabled && isAuthenticated) {
      handleRequestNearbySuggestions()
      return
    }

    setSuggestionsState((currentState) => ({
      ...currentState,
      mode: nextMode,
      note: '',
    }))
  }

  async function handleFollowSuggestion(username) {
    if (!isAuthenticated || !username) {
      return
    }

    setPendingFollowUsername(username)

    try {
      await toggleFollowByUsername(username)
      setSuggestionsState((currentState) => ({
        ...currentState,
        items: currentState.items.filter((item) => item.user.username !== username),
      }))
      setToast({ message: t('search.people.followed'), tone: 'success' })
    } catch (error) {
      setToast({
        message: error.message || t('search.people.followFailed'),
        tone: 'error',
      })
    } finally {
      setPendingFollowUsername('')
    }
  }

  function handleRequestNearbySuggestions() {
    if (!isAuthenticated) {
      setToast({ message: t('home.suggestionsSignInRequiredNearby'), tone: 'error' })
      return
    }

    if (!navigator?.geolocation) {
      setToast({ message: t('search.nearby.browserUnsupported'), tone: 'error' })
      return
    }

    setIsRequestingNearby(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await updateDiscoveryLocation({
            status: 'granted',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            city: user?.location?.city || '',
            country: user?.location?.country || '',
            source: 'browser-geolocation',
          })

          const payload = await getDiscoverySuggestions({
            mode: 'nearby',
            limit: 8,
            refresh: true,
          })

          setSuggestionsState((currentState) => ({
            ...currentState,
            mode: 'nearby',
            items: payload.items || [],
            isLoading: false,
            error: '',
            locationEnabled: true,
            note: payload.items?.length
              ? t('home.suggestionsNearbyShowing')
              : t('home.suggestionsNearbyEmpty'),
          }))
          setToast({ message: t('search.nearby.updated'), tone: 'success' })
        } catch (error) {
          setToast({
            message: error.message || t('home.suggestionsNearbyLoadFailed'),
            tone: 'error',
          })
        } finally {
          setIsRequestingNearby(false)
        }
      },
      async () => {
        try {
          await updateDiscoveryLocation({
            status: 'denied',
            source: 'browser-geolocation',
          })
        } catch {
          // Permission denial should not block the UI feedback.
        }

        setSuggestionsState((currentState) => ({
          ...currentState,
          note: t('home.suggestionsPermissionFallback'),
          locationEnabled: false,
        }))
        setIsRequestingNearby(false)
        setToast({ message: t('search.nearby.permissionDenied'), tone: 'error' })
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 1000 * 60 * 10,
      },
    )
  }

  function renderEmptyState() {
    if (!isAuthenticated && activeFeedTab === 'following') {
      return (
        <FeedEmptyState
          title={t('home.followingEmptyTitle')}
          description={t('home.followingGuestDescription')}
          action={
            <Link
              to={`/${lang}/login`}
              className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-inverse transition hover:bg-primary-hover"
            >
              {t('common.login')}
            </Link>
          }
        />
      )
    }

    if (!isAuthenticated && activeFeedTab === 'for-you') {
      return (
        <FeedEmptyState
          title={t('home.forYouEmptyTitle')}
          description={t('home.forYouGuestDescription')}
          action={
            <Link
              to={`/${lang}/login`}
              className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-inverse transition hover:bg-primary-hover"
            >
              {t('common.login')}
            </Link>
          }
        />
      )
    }

    if (activeFeedTab === 'following') {
      return (
        <FeedEmptyState
          title={t('home.followingEmptyTitle')}
          description={t('home.followingEmptyDescription')}
        />
      )
    }

    if (activeFeedTab === 'for-you') {
      return (
        <FeedEmptyState
          title={t('home.forYouEmptyTitle')}
          description={t('home.forYouEmptyDescription')}
        />
      )
    }

    return (
      <FeedEmptyState
        title={t('home.exploreEmptyTitle')}
        description={t('home.exploreEmptyDescription')}
      />
    )
  }

  function handleOpenStoryRail(rail) {
    if (!rail?.items?.length) {
      return
    }

    setActiveStoryRail(rail)
  }

  const handleOpenAuthorStory = useCallback((username) => {
    const normalizedUsername = `${username || ''}`.trim().toLowerCase()
    if (!normalizedUsername) {
      return
    }

    const nextRail = storyRailsByUsername.get(normalizedUsername)
    if (!nextRail?.items?.length) {
      return
    }

    setActiveStoryRail(nextRail)
  }, [storyRailsByUsername])

  function handleStoryRailComplete(currentRail) {
    const rails = storyState.rails || []
    if (!rails.length) {
      return false
    }

    const currentAuthorId = `${currentRail?.author?.id || currentRail?.author?._id || currentRail?.author?.username || ''}`
    const currentIndex = rails.findIndex((rail) => {
      const railAuthorId = `${rail?.author?.id || rail?.author?._id || rail?.author?.username || ''}`
      return railAuthorId && railAuthorId === currentAuthorId
    })

    if (currentIndex < 0 || currentIndex >= rails.length - 1) {
      return false
    }

    const nextRail = rails[currentIndex + 1]
    if (!nextRail?.items?.length) {
      return false
    }

    setActiveStoryRail(nextRail)
    return true
  }

  function handleStoryRailShift(direction = 'next') {
    const rails = storyState.rails || []
    if (!rails.length || !activeStoryRail) {
      return false
    }

    const currentAuthorId = `${activeStoryRail?.author?.id || activeStoryRail?.author?._id || activeStoryRail?.author?.username || ''}`
    const currentIndex = rails.findIndex((rail) => {
      const railAuthorId = `${rail?.author?.id || rail?.author?._id || rail?.author?.username || ''}`
      return railAuthorId && railAuthorId === currentAuthorId
    })

    if (currentIndex < 0) {
      return false
    }

    const nextIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= rails.length) {
      return false
    }

    const nextRail = rails[nextIndex]
    if (!nextRail?.items?.length) {
      return false
    }

    setActiveStoryRail(nextRail)
    return true
  }

  async function handleTrackStoryView(storyId) {
    if (!storyId) {
      return
    }

    try {
      await registerStoryView(storyId)
      setStoryState((currentState) => ({
        ...currentState,
        rails: (currentState.rails || []).map((rail) => ({
          ...rail,
          hasUnseen: (rail.items || []).some((item) => {
            const itemId = item._id || item.id
            if (`${itemId}` === `${storyId}`) {
              return false
            }
            return !item.viewedByViewer
          }),
          items: (rail.items || []).map((item) => {
            const itemId = item._id || item.id
            if (`${itemId}` === `${storyId}`) {
              return { ...item, viewedByViewer: true }
            }
            return item
          }),
        })),
      }))
    } catch {
      // Story viewer should keep flowing even if view ping fails.
    }
  }

  const handleHidePostFromFeed = useCallback((postId, notice = null) => {
    const normalizedPostId = `${postId || ''}`.trim()
    if (!normalizedPostId) {
      return
    }

    setFeedState((currentState) => ({
      ...currentState,
      posts: (currentState.posts || []).filter((post) => {
        const currentPostId = `${post?._id || post?.id || ''}`.trim()
        return currentPostId && currentPostId !== normalizedPostId
      }),
    }))

    if (notice?.message) {
      setToast({
        message: notice.message,
        tone: notice.tone || 'success',
      })
    }
  }, [])

  return (
    <>
      <Seo
        title={
          selectedTopic
            ? `${selectedTopic} - ${t('home.trends')}`
            : 'Nest Social - Home'
        }
        description={
          selectedTopic
            ? t('home.selectedTrendDescription', { topic: selectedTopic })
            : 'A content-first feed connected to the live backend with publishing, trends, and messaging-ready social flows.'
        }
        structuredData={structuredData}
      />

      <SocialLayout
        pageTitle={t('nav.home')}
        activeKey="home"
        showDesktopPageHeader={false}
        onMobileCreate={openMobileComposer}
        rightAside={
          <>
            <AsideCard title={t('home.trends')}>
              {trendsState.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`trend-skeleton-${index}`} className="rounded-2xl bg-secondary px-4 py-3">
                      <div className="h-4 w-2/3 animate-pulse rounded-full bg-secondary-hover" />
                      <div className="mt-2 h-3 w-1/3 animate-pulse rounded-full bg-secondary-hover" />
                    </div>
                  ))}
                </div>
              ) : trendsState.items.length ? (
                <TrendList
                  items={trendsState.items}
                  activeTopic={selectedTopic}
                  onSelect={handleSelectTrend}
                  renderMeta={(trend) =>
                    t('home.trendMeta', {
                      postCount: trend.postCount || 0,
                      authorCount: trend.uniqueAuthorCount || 0,
                    })
                  }
                  badgeLabel={t('home.trendBadge')}
                />
              ) : (
                <p className="text-sm text-muted">
                  {trendsState.error || t('home.trendsEmpty')}
                </p>
              )}
            </AsideCard>

            <AsideCard
              title={t('home.suggestions')}
              header={
                <SuggestionsHeader
                  title={t('home.suggestions')}
                  modes={suggestionModes}
                  activeMode={suggestionsState.mode}
                  onModeChange={handleSuggestionModeChange}
                  onRequestNearby={handleRequestNearbySuggestions}
                  isRequestingLocation={isRequestingNearby}
                  locationEnabled={suggestionsState.locationEnabled}
                  note={suggestionsState.error || suggestionsState.note}
                  nearbyAriaLabel={t('home.suggestionsNearbyAria')}
                  nearbyTitle={t('home.suggestionsNearbyTitle')}
                />
              }
              bodyClassName="mt-4"
            >
              {suggestionsState.isLoading && isAuthenticated ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`suggestion-skeleton-${index}`}
                      className="rounded-[24px] border border-border bg-secondary px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-11 animate-pulse rounded-full bg-secondary-hover" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-4 w-28 animate-pulse rounded-full bg-secondary-hover" />
                          <div className="h-3 w-20 animate-pulse rounded-full bg-secondary-hover" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : suggestionItems.length ? (
                <SuggestionList
                  items={suggestionItems}
                  lang={lang}
                  pendingUsername={pendingFollowUsername}
                  onFollow={handleFollowSuggestion}
                  isAuthenticated={isAuthenticated}
                  followLabel={t('search.people.follow')}
                  waitingLabel={t('home.suggestionsWaiting')}
                  loginLabel={t('common.login')}
                  mutualCountLabel={(count) => t('home.suggestionsMutualCount', { count })}
                />
              ) : (
                <p className="text-sm text-muted">
                  {suggestionsState.error || suggestionsState.note || t('home.suggestionsEmpty')}
                </p>
              )}
            </AsideCard>
          </>
        }
      >
        <FeedTabBar
          tabs={tabs}
          activeTab={activeFeedTab}
          onChange={setActiveFeedTab}
        />

        <div className="content-area space-y-2">
          <StoryRail
            title={t('common.storyRailTitle', { defaultValue: 'Hikayeler' })}
            yourStoryLabel={t('common.yourStory', { defaultValue: 'Senin Hikayen' })}
            rails={storyState.rails}
            isAuthenticated={isAuthenticated}
            currentUser={user}
            onCreateStory={() => openMobileComposer('story')}
            onOpenRail={handleOpenStoryRail}
          />

          {selectedTopic ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-border bg-card px-4 py-3 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-text">{t('home.selectedTrendTitle')}</p>
                <p className="mt-1 text-xs text-muted">
                  {t('home.selectedTrendDescription', { topic: selectedTopic })}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearTrend}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition hover:bg-secondary"
              >
                {t('home.clearTrend')}
              </button>
            </div>
          ) : null}

          {shouldShowDesktopComposer || shouldShowMobileComposer ? (
            <Suspense fallback={<ComposerFallback />}>
              <PostComposer
                user={user}
                onSubmit={handleCreatePost}
                isSubmitting={isPublishing}
                defaultExpanded={shouldShowMobileComposer || shouldAutoExpandDesktopComposer}
                hideCollapsed={shouldShowMobileComposer}
                initialMediaIntent={shouldShowMobileComposer ? mobileComposerMediaIntent : ''}
                initialComposerType={mobileComposerType}
                onExpandedChange={(expanded) => {
                  if (!expanded && isMobileComposeOpen) {
                    closeMobileComposer()
                  }
                }}
              />
            </Suspense>
          ) : null}

          {feedState.error ? (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {feedState.error}
            </div>
          ) : null}

          {feedState.isLoading && !feedState.posts.length ? (
            <>
              <FeedSkeletonCard />
              <FeedSkeletonCard />
              <FeedSkeletonCard />
            </>
          ) : null}

          {!feedState.isLoading && !feedState.posts.length ? renderEmptyState() : null}

          {mobileFeed.map((item, index) => {
            if (item.type === 'trends') {
              return (
                <MobileInjectionCard
                  key={`mobile-trends-${index}`}
                  title={t('home.trends')}
                  items={(trendsState.items.length ? trendsState.items : [{ label: t('home.trendsPending') }]).map(
                    (trendItem, trendIndex) => ({
                      key: trendItem.key || trendItem.label || `mobile-trend-fallback-${trendIndex}`,
                      label: trendItem.label || trendItem,
                      slug: trendItem.slug || '',
                    }),
                  )}
                  activeItemKey={selectedTopic}
                  onSelect={handleSelectTrend}
                />
              )
            }

            if (item.type === 'friends') {
              return (
                <SuggestionCarousel
                  key={`mobile-friends-${index}`}
                  lang={lang}
                  title={t('home.suggestions')}
                  items={suggestionItems}
                  modes={suggestionModes}
                  activeMode={suggestionsState.mode}
                  onModeChange={handleSuggestionModeChange}
                  onRequestNearby={handleRequestNearbySuggestions}
                  isRequestingLocation={isRequestingNearby}
                  locationEnabled={suggestionsState.locationEnabled}
                  note={suggestionsState.error || suggestionsState.note}
                  pendingUsername={pendingFollowUsername}
                  onFollow={handleFollowSuggestion}
                  isAuthenticated={isAuthenticated}
                  followLabel={t('search.people.follow')}
                  waitingLabel={t('home.suggestionsWaiting')}
                  loginLabel={t('common.login')}
                  mutualCountLabel={(count) => t('home.suggestionsMutualCount', { count })}
                  nearbyAriaLabel={t('home.suggestionsNearbyAria')}
                  nearbyTitle={t('home.suggestionsNearbyTitle')}
                />
              )
            }

            const authorUsername = `${item.value?.author?.username || ''}`.trim().toLowerCase()
            return (
              <PostCard
                key={item.value._id || item.value.id}
                post={item.value}
                prioritizeMedia={getPostIdentifier(item.value) === firstFeedPostId}
                onPostHidden={handleHidePostFromFeed}
                hasAuthorStory={Boolean(authorUsername && storyRailsByUsername.has(authorUsername))}
                onOpenAuthorStory={handleOpenAuthorStory}
              />
            )
          })}

          {feedState.hasMore ? (
            <div ref={loadMoreSentinelRef} className="h-6 w-full" aria-hidden="true" />
          ) : null}

          {feedState.isLoading && feedState.posts.length ? <FeedLoadMoreSkeleton /> : null}

          {status === 'loading' && !feedState.posts.length && !feedState.isLoading ? (
            <div className="rounded-[28px] border border-border bg-card px-5 py-6 text-sm text-muted shadow-sm">
              {t('home.checkingSession')}
            </div>
          ) : null}
        </div>
      </SocialLayout>

      <ActionToast
        toast={toast}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />

      {activeStoryRail ? (
        <Suspense fallback={null}>
          <StoryViewerModal
            rail={activeStoryRail}
            lang={lang}
            onClose={() => setActiveStoryRail(null)}
            onTrackView={handleTrackStoryView}
            onRailComplete={handleStoryRailComplete}
            onRequestRailShift={handleStoryRailShift}
          />
        </Suspense>
      ) : null}
    </>
  )
}

export default HomePage
