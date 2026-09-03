import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import PostCard from '../features/posts/PostCard.jsx'
import { getFeed, getPostDetail } from '../services/postsService.js'
import { getStoryRails, registerStoryView } from '../services/storiesService.js'
import { useAuth } from '../store/AuthContext.jsx'
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from '../hooks/useMediaQuery.js'

const StoryViewerModal = lazy(() => import('../features/stories/StoryViewerModal.jsx'))

const LOOP_LIMIT = 10
const LOOP_RENDER_RADIUS = 1

function isLoopContent(post) {
  const normalizedType = `${post?.contentType || post?.type || post?.publication?.contentType || ''}`
    .trim()
    .toLowerCase()

  if (normalizedType === 'loop' || normalizedType === 'loopvideo' || normalizedType === 'loop_video') {
    return true
  }

  return Boolean((post?.media || []).some((item) => item?.type === 'video' && item?.hlsUrl))
}

function getPostId(post) {
  return `${post?.id || post?._id || ''}`.trim()
}

function resolveLoopMode(tab) {
  return tab === 'forYou' ? 'for-you' : tab
}

function mergeUniqueLoopPosts(currentPosts = [], incomingPosts = []) {
  const seenIds = new Set()

  return [...currentPosts, ...incomingPosts].filter((post) => {
    const postId = getPostId(post)
    if (!postId || seenIds.has(postId)) {
      return false
    }

    seenIds.add(postId)
    return isLoopContent(post)
  })
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

const clientLoopFeedCache = new Map()

function LoopPage() {
  const { lang = 'tr' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const sentinelRef = useRef(null)
  const mobileScrollerRef = useRef(null)
  const desktopScrollerRef = useRef(null)
  const isLoadingMoreRef = useRef(false)
  const [activeTab, setActiveTab] = useState('explore')
  const isMobileViewport = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const focusedPostId = `${searchParams.get('post') || ''}`.trim()
  const [state, setState] = useState(() => {
    const cached = !focusedPostId ? clientLoopFeedCache.get('explore') : null
    return {
      posts: cached?.posts || [],
      isLoading: !cached?.posts?.length,
      error: '',
      hasMore: Boolean(cached?.hasMore),
      nextCursor: cached?.nextCursor || null,
      nextOffset: cached?.nextOffset || 0,
    }
  })
  const [storyState, setStoryState] = useState({
    rails: [],
    isLoading: true,
    error: '',
  })
  const [activeStoryRail, setActiveStoryRail] = useState(null)
  const [activeLoopIndex, setActiveLoopIndex] = useState(0)
  const [isMobileTopBarVisible, setIsMobileTopBarVisible] = useState(true)
  const [toast, setToast] = useState({ message: '', tone: 'success' })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.scrollTo(0, 0)

    if (document?.documentElement) {
      document.documentElement.scrollTop = 0
    }

    if (document?.body) {
      document.body.scrollTop = 0
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    let cancelled = false

    async function loadLoopFeed() {
      const loopMode = resolveLoopMode(activeTab)
      const cached = !focusedPostId ? clientLoopFeedCache.get(activeTab) : null

      if (cached?.posts?.length) {
        setState((prev) => ({
          ...prev,
          posts: cached.posts,
          isLoading: false,
          hasMore: Boolean(cached.hasMore),
          nextCursor: cached.nextCursor || null,
          nextOffset: cached.nextOffset || 0,
        }))
      } else {
        setState({
          posts: [],
          isLoading: true,
          error: '',
          hasMore: false,
          nextCursor: null,
          nextOffset: null,
        })
      }

      try {
        const [feedPayload, focusedPostPayload] = await Promise.all([
          getFeed({
            limit: LOOP_LIMIT,
            view: 'loop',
            loopMode,
          }),
          focusedPostId && loopMode === 'explore'
            ? getPostDetail(focusedPostId).catch(() => null)
            : Promise.resolve(null),
        ])

        const basePosts = feedPayload.posts || []
        const focusedPost = focusedPostPayload?.post
        const hasFocusedPost = Boolean(
          focusedPostId &&
            basePosts.some((post) => getPostId(post) === focusedPostId),
        )
        const mergedPosts = mergeUniqueLoopPosts([],
          focusedPostId && focusedPost && isLoopContent(focusedPost) && !hasFocusedPost
            ? [focusedPost, ...basePosts]
            : basePosts,
        )

        if (focusedPostId && !hasFocusedPost && focusedPost && isLoopContent(focusedPost)) {
          setActiveLoopIndex(0)
        }

        if (cancelled) {
          return
        }

        const nextState = {
          posts: mergedPosts,
          isLoading: false,
          error: '',
          hasMore: Boolean(feedPayload?.pagination?.hasMore),
          nextCursor: feedPayload?.pagination?.nextCursor || null,
          nextOffset:
            typeof feedPayload?.pagination?.nextOffset === 'number'
              ? feedPayload.pagination.nextOffset
              : null,
        }

        if (!focusedPostId) {
          clientLoopFeedCache.set(activeTab, nextState)
        }

        setState(nextState)
      } catch (error) {
        if (cancelled) {
          return
        }

        setState((current) => ({
          ...current,
          isLoading: false,
          error: current.posts.length ? '' : (error.message || 'Loop videolari yuklenemedi.'),
        }))
      }
    }

    loadLoopFeed()

    return () => {
      cancelled = true
    }
  }, [activeTab, focusedPostId, isAuthenticated])

  useEffect(() => {
    if (!state.hasMore || !sentinelRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        if (
          !entries[0]?.isIntersecting ||
          isLoadingMoreRef.current ||
          (typeof state.nextOffset !== 'number' && !state.nextCursor)
        ) {
          return
        }

        isLoadingMoreRef.current = true
        try {
          const payload = await getFeed({
            limit: LOOP_LIMIT,
            ...(state.nextCursor ? { cursor: state.nextCursor } : { offset: state.nextOffset }),
            view: 'loop',
            loopMode: resolveLoopMode(activeTab),
          })

          setState((current) => ({
            ...current,
            posts: mergeUniqueLoopPosts(current.posts, payload.posts || []),
            hasMore: Boolean(payload?.pagination?.hasMore),
            nextCursor: payload?.pagination?.nextCursor || null,
            nextOffset:
              typeof payload?.pagination?.nextOffset === 'number'
                ? payload.pagination.nextOffset
                : null,
          }))
        } catch (error) {
          setState((current) => ({
            ...current,
            error: error.message || 'Daha fazla Loop videosu yüklenemedi.',
          }))
        } finally {
          isLoadingMoreRef.current = false
        }
      },
      {
        root: isMobileViewport ? mobileScrollerRef.current : desktopScrollerRef.current,
        rootMargin: '140px 0px',
        threshold: 0.01,
      },
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [activeTab, isMobileViewport, state.hasMore, state.nextCursor, state.nextOffset])

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

  const loopTabs = useMemo(
    () => [
      { key: 'explore', label: t('loop.tabs.explore', { defaultValue: 'Kesfet' }) },
      { key: 'following', label: t('loop.tabs.following', { defaultValue: 'Takipte' }) },
      { key: 'forYou', label: t('loop.tabs.forYou', { defaultValue: 'Sizin Icin' }) },
    ],
    [t],
  )

  const visiblePosts = useMemo(() => state.posts, [state.posts])

  const lastScrollTopRef = useRef(0)

  useEffect(() => {
    setActiveLoopIndex(0)
    setIsMobileTopBarVisible(true)
    const scroller = isMobileViewport ? mobileScrollerRef.current : desktopScrollerRef.current
    scroller?.scrollTo?.({ top: 0, behavior: 'auto' })
  }, [activeTab, isMobileViewport])

  useEffect(() => {
    if (!focusedPostId || !visiblePosts.length) {
      return
    }

    const targetIndex = visiblePosts.findIndex((post) => getPostId(post) === focusedPostId)

    if (targetIndex < 0) {
      return
    }

    setActiveLoopIndex(targetIndex)

    const scroller = isMobileViewport ? mobileScrollerRef.current : desktopScrollerRef.current
    if (!scroller) {
      return
    }

    const viewportHeight = Math.max(1, scroller.clientHeight || 1)
    const scrollTop = targetIndex * viewportHeight

    if (Math.abs(scroller.scrollTop - scrollTop) < 2) {
      return
    }

    scroller.scrollTo({
      top: scrollTop,
      behavior: 'auto',
    })
  }, [focusedPostId, isMobileViewport, visiblePosts])

  useEffect(() => {
    if (!visiblePosts.length) {
      setActiveLoopIndex(0)
      return
    }

    setActiveLoopIndex((currentIndex) =>
      Math.min(Math.max(currentIndex, 0), visiblePosts.length - 1),
    )
  }, [visiblePosts.length])

  useEffect(() => {
    const scroller = isMobileViewport ? mobileScrollerRef.current : desktopScrollerRef.current
    if (!scroller || !visiblePosts.length) {
      return undefined
    }

    lastScrollTopRef.current = scroller.scrollTop

    function syncActiveIndex() {
      const viewportHeight = Math.max(1, scroller.clientHeight || 1)
      const currentScrollTop = scroller.scrollTop
      const nextIndex = Math.round(currentScrollTop / viewportHeight)
      setActiveLoopIndex(Math.min(Math.max(nextIndex, 0), visiblePosts.length - 1))

      if (isMobileViewport) {
        const delta = currentScrollTop - lastScrollTopRef.current
        if (currentScrollTop <= 15 || nextIndex === 0) {
          setIsMobileTopBarVisible(true)
        } else if (delta > 20 && nextIndex >= 1) {
          setIsMobileTopBarVisible(false)
        } else if (delta < -20) {
          setIsMobileTopBarVisible(true)
        }
        lastScrollTopRef.current = currentScrollTop
      }
    }

    syncActiveIndex()
    scroller.addEventListener('scroll', syncActiveIndex, { passive: true })
    window.addEventListener('resize', syncActiveIndex)

    return () => {
      scroller.removeEventListener('scroll', syncActiveIndex)
      window.removeEventListener('resize', syncActiveIndex)
    }
  }, [isMobileViewport, visiblePosts.length])

  useEffect(() => {
    if (isMobileViewport) return undefined

    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return
      }

      const scroller = desktopScrollerRef.current
      if (!scroller || !visiblePosts.length) return

      const viewportHeight = Math.max(1, scroller.clientHeight || 1)

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        const nextIndex = Math.min(activeLoopIndex + 1, visiblePosts.length - 1)
        scroller.scrollTo({ top: nextIndex * viewportHeight, behavior: 'smooth' })
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        const prevIndex = Math.max(activeLoopIndex - 1, 0)
        scroller.scrollTo({ top: prevIndex * viewportHeight, behavior: 'smooth' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeLoopIndex, isMobileViewport, visiblePosts.length])

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

  function handleMobileCreate() {
    const currentPath = `${location.pathname}${location.search}${location.hash}`
    if (!isAuthenticated) {
      const loginParams = new URLSearchParams()
      loginParams.set('returnTo', currentPath)
      navigate(`/${lang}/login?${loginParams.toString()}`)
      return
    }

    const composeParams = new URLSearchParams()
    composeParams.set('compose', '1')
    composeParams.set('composerMedia', 'video')
    composeParams.set('composerType', 'post')
    composeParams.set('returnTo', currentPath)

    navigate(`/${lang}/?${composeParams.toString()}`)
  }

  function handleOpenAuthorStory(username) {
    const normalizedUsername = `${username || ''}`.trim().toLowerCase()
    if (!normalizedUsername) {
      return
    }

    const nextRail = storyRailsByUsername.get(normalizedUsername)
    if (!nextRail?.items?.length) {
      return
    }

    setActiveStoryRail(nextRail)
  }

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
      // keep story flow smooth if tracking fails
    }
  }

  function handleHidePostFromLoop(postId, notice = null) {
    const normalizedPostId = `${postId || ''}`.trim()
    if (!normalizedPostId) {
      return
    }

    setState((currentState) => ({
      ...currentState,
      posts: (currentState.posts || []).filter((post) => getPostId(post) !== normalizedPostId),
    }))

    if (notice?.message) {
      setToast({
        message: notice.message,
        tone: notice.tone || 'success',
      })
    }
  }

  return (
    <>
      <Seo
        title="My Social 1 - Loop"
        description="Kisa videolarin akis halinde izlendiği Loop alani."
      />

      <SocialLayout
        pageTitle={t('nav.loop')}
        activeKey="loop"
        showDesktopPageHeader={false}
        fixedViewport
        mobileBleed={isMobileViewport}
        mobileFlushTop
        hideHeaderOnMobile={isMobileViewport}
        hideMobileCreateButton={isMobileViewport}
      >
        <div className={`mx-auto ${isMobileViewport ? 'max-w-full space-y-0' : 'max-w-[920px] space-y-4'}`}>
          {state.error ? (
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {state.error}
            </div>
          ) : null}

          {state.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`loop-skeleton-${index}`}
                  className={`overflow-hidden ${isMobileViewport ? '' : 'rounded-[20px] border border-border bg-card'}`}
                >
                  <div className={`${isMobileViewport ? 'h-[calc(100dvh-56px)]' : 'h-[70vh]'} animate-pulse bg-secondary`} />
                </div>
              ))}
            </div>
          ) : null}

          {!state.isLoading && !visiblePosts.length ? (
            <div className="rounded-[20px] border border-border bg-card px-6 py-8 text-center">
              <p className="text-lg font-semibold text-text">
                {t('loop.emptyTitle', { defaultValue: 'No loop videos yet' })}
              </p>
              <p className="mt-2 text-sm text-muted">
                {t('loop.emptyDescription', {
                  defaultValue: 'When creators share short videos, they will appear here.',
                })}
              </p>
              {!isAuthenticated ? (
                <Link
                  to={`/${lang}/login`}
                  className="mt-4 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-inverse transition hover:bg-primary-hover"
                >
                  {t('common.login')}
                </Link>
              ) : null}
            </div>
          ) : null}

          {isMobileViewport ? (
            <div className="relative h-[calc(100dvh-56px)] overflow-hidden bg-black">
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-black/55 to-transparent transition-opacity duration-300 ${
                  isMobileTopBarVisible ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <div
                className={`absolute inset-x-0 top-0 z-30 flex h-12 items-center justify-between bg-transparent px-3 backdrop-blur-[1px] transition-all duration-300 ease-out ${
                  isMobileTopBarVisible
                    ? 'translate-y-0 opacity-100 pointer-events-auto'
                    : '-translate-y-full opacity-0 pointer-events-none'
                }`}
              >
                <button
                  type="button"
                  onClick={handleMobileCreate}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label={t('loop.createAria', { defaultValue: 'Loop videosu olustur' })}
                >
                  <PlusIcon />
                </button>

                <div className="mx-2 flex min-w-0 flex-1 items-center justify-center gap-1.5">
                  {loopTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-4 px-1.5 py-1.5 text-xs font-semibold  ${
                        activeTab === tab.key
                          ? ' border-b-2 border-blue-500 text-white'
                          : 'text-white/80 '
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isMobileViewport && typeof window !== 'undefined') {
                      window.dispatchEvent(new Event('social-layout:open-mobile-search'))
                      return
                    }

                    navigate(`/${lang}/search?tab=all&sort=popular`)
                  }}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label={t('loop.searchAria', { defaultValue: 'Loop icinde ara' })}
                >
                  <SearchIcon />
                </button>
              </div>

              <div
                ref={mobileScrollerRef}
                className="h-[calc(100dvh-56px)] overflow-y-auto snap-y snap-mandatory overscroll-y-contain"
              >
                {visiblePosts.map((post, index) => (
                  <div
                    key={post._id || post.id}
                    className="snap-start min-h-[calc(100dvh-56px)]"
                    style={{ scrollSnapStop: 'always' }}
                  >
                    {Math.abs(index - activeLoopIndex) <= LOOP_RENDER_RADIUS ? (
                      <PostCard
                        post={post}
                        variant="loop"
                        onPostHidden={handleHidePostFromLoop}
                        loopPlaybackState={{
                           isActive: index === activeLoopIndex,
                          preloadMode:
                            index === activeLoopIndex
                              ? 'active'
                              : index === activeLoopIndex + 1
                                ? 'next'
                                : 'other',
                        }}
                        hasAuthorStory={Boolean(`${post?.author?.username || ''}`.trim() && storyRailsByUsername.has(`${post?.author?.username || ''}`.trim().toLowerCase()))}
                        onOpenAuthorStory={handleOpenAuthorStory}
                      />
                    ) : (
                      <div className="h-[calc(100dvh-56px)] w-full bg-black" />
                    )}
                  </div>
                ))}
                {state.hasMore ? <div ref={sentinelRef} className="h-8 w-full" aria-hidden="true" /> : null}
              </div>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-20 border-b border-border bg-bg/90 px-2 backdrop-blur md:px-3">
                <div className="mx-auto flex w-full max-w-[920px] items-center justify-center gap-2 py-2">
                  {loopTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        activeTab === tab.key
                          ? 'bg-secondary text-text'
                          : 'text-muted hover:bg-secondary hover:text-text'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                ref={desktopScrollerRef}
                className="h-[calc(100vh-154px)] overflow-y-auto snap-y snap-mandatory overscroll-y-contain pr-1"
              >
                {visiblePosts.map((post, index) => (
                  <div
                    key={post._id || post.id}
                    className="snap-start min-h-[calc(100vh-154px)] flex items-center justify-center"
                    style={{ scrollSnapStop: 'always' }}
                  >
                    {Math.abs(index - activeLoopIndex) <= LOOP_RENDER_RADIUS ? (
                      <PostCard
                        post={post}
                        variant="loop"
                        onPostHidden={handleHidePostFromLoop}
                        loopPlaybackState={{
                          isActive: index === activeLoopIndex,
                          preloadMode:
                            index === activeLoopIndex
                              ? 'active'
                              : index === activeLoopIndex + 1
                                ? 'next'
                                : 'other',
                        }}
                        hasAuthorStory={Boolean(`${post?.author?.username || ''}`.trim() && storyRailsByUsername.has(`${post?.author?.username || ''}`.trim().toLowerCase()))}
                        onOpenAuthorStory={handleOpenAuthorStory}
                      />
                    ) : (
                      <div className="h-[calc(100vh-154px)] w-full rounded-[20px] bg-black" />
                    )}
                  </div>
                ))}
                {state.hasMore ? <div ref={sentinelRef} className="h-8 w-full" aria-hidden="true" /> : null}
              </div>
            </>
          )}
        </div>
      </SocialLayout>

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

      <ActionToast
        toast={toast}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </>
  )
}

export default LoopPage
