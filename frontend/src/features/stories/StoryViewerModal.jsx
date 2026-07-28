import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../../components/common/UserAvatar.jsx'
import VerifiedBadge from '../../components/common/VerifiedBadge.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { resolveMediaUrl } from '../../utils/media.js'
import { formatRelativeTime } from '../../utils/social.js'
import {
  buildPostSharePayload,
  copyTextToClipboard,
  shareWithNative,
} from '../../utils/postShare.js'
import {
  createStoryReply,
  getStoryDetail,
  toggleStoryLike,
  toggleStoryShare,
} from '../../services/storiesService.js'
import { deleteComment as deleteStoryReplyComment } from '../../services/postsService.js'

const IMAGE_STORY_DURATION_MS = 5000

function HeartIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="size-8">
      <path d="M12 20s-6.8-4.5-8.7-8.2A5.1 5.1 0 0 1 12 5.6a5.1 5.1 0 0 1 8.7 6.2C18.8 15.5 12 20 12 20Z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5.5">
      <path d="M4 12 20 4l-6 16-2.8-6.2L4 12Z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-8">
      <path d="m15 6 4-1-1 4" />
      <path d="M10 14 19 5" />
      <path d="M19 13.5V18a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2H11" />
    </svg>
  )
}

function normalizeStoryMeta(storyMeta) {
  if (!storyMeta || typeof storyMeta !== 'object') {
    return null
  }

  const musicTitle = `${storyMeta.music?.title || ''}`.trim()
  const musicArtist = `${storyMeta.music?.artist || ''}`.trim()
  const stickers = (Array.isArray(storyMeta.stickers) ? storyMeta.stickers : [])
    .map((item) => `${item}`.trim())
    .filter(Boolean)
  const mentions = (Array.isArray(storyMeta.mentions) ? storyMeta.mentions : [])
    .map((item) => `${item}`.replace(/^@/, '').trim())
    .filter(Boolean)
  const linkUrl = `${storyMeta.link?.url || ''}`.trim()
  const linkLabel = `${storyMeta.link?.label || ''}`.trim()

  if (!musicTitle && !musicArtist && !stickers.length && !mentions.length && !linkUrl) {
    return null
  }

  return {
    musicTitle,
    musicArtist,
    stickers,
    mentions,
    linkUrl,
    linkLabel,
  }
}

function StoryViewerModal({
  rail,
  lang = 'tr',
  onClose,
  onTrackView,
  onRailComplete,
  onRequestRailShift,
}) {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const stories = useMemo(() => rail?.items || [], [rail])
  const [activeIndex, setActiveIndex] = useState(() => {
    const firstUnseen = stories.findIndex((item) => !item.viewedByViewer)
    return firstUnseen >= 0 ? firstUnseen : 0
  })
  const [imageProgress, setImageProgress] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [detailState, setDetailState] = useState({
    post: null,
    comments: [],
    isLoading: false,
    error: '',
  })
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [isReplyInputFocused, setIsReplyInputFocused] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [lockedViewportHeight, setLockedViewportHeight] = useState(null)
  const imageAnimationFrameRef = useRef(null)
  const imageProgressRef = useRef(0)
  const imageProgressStartRef = useRef(0)
  const imageProgressStartedAtRef = useRef(0)
  const videoRef = useRef(null)
  const commentsScrollerRef = useRef(null)
  const holdActiveRef = useRef(false)
  const swipeGestureRef = useRef({
    startX: 0,
    startY: 0,
    active: false,
  })
  const activeStory = stories[activeIndex] || null
  const activeStoryId = activeStory?._id || activeStory?.id || null
  const mediaItem = activeStory?.media?.[0] || null
  const isVideo = mediaItem?.type === 'video'
  const activePost = detailState.post || activeStory
  const activeStoryMeta = useMemo(
    () => normalizeStoryMeta(activePost?.storyMeta || activeStory?.storyMeta),
    [activePost?.storyMeta, activeStory?.storyMeta],
  )
  const publishedAtLabel = useMemo(
    () => formatRelativeTime(activePost?.createdAt || activeStory?.createdAt || null),
    [activePost?.createdAt, activeStory?.createdAt],
  )
  const shouldPauseForReply = useMemo(
    () => isSubmittingReply || isReplyInputFocused || Boolean(replyDraft.trim()),
    [isSubmittingReply, isReplyInputFocused, replyDraft],
  )
  const hasReplies = (detailState.comments?.length || 0) > 0
  const labels = {
    openReplies: t('common.storyViewer.openReplies', { defaultValue: 'Yanitlari Goster' }),
    hideReplies: t('common.storyViewer.hideReplies', { defaultValue: 'Yanitlari Gizle' }),
    deleteReply: t('common.storyViewer.deleteReply', { defaultValue: 'Yaniti Sil' }),
    deleting: t('common.storyViewer.deleting', { defaultValue: 'Siliniyor...' }),
    deleteReplySuccess: t('common.storyViewer.deleteReplySuccess', { defaultValue: 'Yanit silindi.' }),
    deleteReplyFailed: t('common.storyViewer.deleteReplyFailed', { defaultValue: 'Yanit silinemedi.' }),
    openSound: t('common.storyViewer.openSound', { defaultValue: 'Sesi Ac' }),
    muteSound: t('common.storyViewer.muteSound', { defaultValue: 'Sesi Kapat' }),
    close: t('common.storyViewer.close', { defaultValue: 'Kapat' }),
    previous: t('common.storyViewer.previous', { defaultValue: 'Onceki hikaye' }),
    next: t('common.storyViewer.next', { defaultValue: 'Sonraki hikaye' }),
    mediaAlt: t('common.storyViewer.mediaAlt', { defaultValue: 'Hikaye medyasi' }),
    like: t('common.like', { defaultValue: 'Begen' }),
    share: t('common.share', { defaultValue: 'Paylas' }),
    unknownUser: t('common.unknownUser', { defaultValue: 'Kullanici' }),
    noComments: t('common.storyViewer.noComments', { defaultValue: 'Henuz yanit yok.' }),
    writeReply: t('common.storyViewer.writeReply', { defaultValue: 'Hikayeye yanit yaz...' }),
    sendReply: t('common.storyViewer.sendReply', { defaultValue: 'Yanit gonder' }),
    authRequired: t('common.storyViewer.authRequired', {
      defaultValue: 'Bu islem icin giris yapmalisin.',
    }),
    shareCopied: t('common.shareActions.linkCopied', { defaultValue: 'Link kopyalandi.' }),
    shareFailed: t('common.shareActions.copyFailed', { defaultValue: 'Link kopyalanamadi.' }),
    shareDone: t('common.shareActions.shared', { defaultValue: 'Paylasim tamamlandi.' }),
    replySuccess: t('common.storyViewer.replySuccess', { defaultValue: 'Yanitin paylasildi.' }),
    replyFailed: t('common.storyViewer.replyFailed', { defaultValue: 'Yanit gonderilemedi.' }),
    loadFailed: t('common.storyViewer.loadFailed', { defaultValue: 'Hikaye detaylari yuklenemedi.' }),
  }

  const progressValues = useMemo(
    () =>
      stories.map((_, index) => {
        if (index < activeIndex) {
          return 100
        }
        if (index === activeIndex) {
          return Math.max(0, Math.min(100, imageProgress))
        }

        return 0
      }),
    [activeIndex, imageProgress, stories],
  )

  const handleStorySequenceEnd = useCallback(() => {
    const shouldKeepOpen = onRailComplete?.(rail)

    if (shouldKeepOpen) {
      return
    }

    onClose?.()
  }, [onClose, onRailComplete, rail])

  const goNextStory = useCallback(() => {
    setActiveIndex((current) => {
      if (current >= stories.length - 1) {
        handleStorySequenceEnd()
        return current
      }

      return current + 1
    })
  }, [handleStorySequenceEnd, stories.length])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setNotice(''), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  useEffect(() => {
    if (!activeStoryId) {
      return
    }

    onTrackView?.(activeStoryId)
  }, [activeStoryId, onTrackView])

  useEffect(() => {
    imageProgressRef.current = imageProgress
  }, [imageProgress])

  useEffect(() => {
    const firstUnseen = stories.findIndex((item) => !item.viewedByViewer)
    setActiveIndex(firstUnseen >= 0 ? firstUnseen : 0)
  }, [stories])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (lockedViewportHeight) {
      return
    }

    const visualViewportHeight = Number(window.visualViewport?.height || 0)
    const viewportHeight = Math.max(
      Number(window.innerHeight || 0),
      visualViewportHeight,
    )
    setLockedViewportHeight(viewportHeight || null)
  }, [lockedViewportHeight])

  useEffect(() => {
    setImageProgress(0)
    imageProgressRef.current = 0
    imageProgressStartRef.current = 0
    imageProgressStartedAtRef.current = 0
    setIsPaused(false)
    setIsCommentsOpen(false)
    setReplyDraft('')
    setIsReplyInputFocused(false)
  }, [activeStoryId])

  useEffect(() => {
    if (!activeStoryId) {
      setDetailState({
        post: null,
        comments: [],
        isLoading: false,
        error: '',
      })
      return
    }

    let cancelled = false

    async function loadStoryDetail() {
      setDetailState((current) => ({
        ...current,
        isLoading: true,
        error: '',
      }))

      try {
        const payload = await getStoryDetail(activeStoryId)
        if (cancelled) {
          return
        }
        setDetailState({
          post: payload?.post || null,
          comments: payload?.comments || [],
          isLoading: false,
          error: '',
        })
      } catch (error) {
        if (cancelled) {
          return
        }
        setDetailState((current) => ({
          ...current,
          isLoading: false,
          error: error.message || labels.loadFailed,
        }))
      }
    }

    loadStoryDetail()

    return () => {
      cancelled = true
    }
  }, [activeStoryId, labels.loadFailed])

  useEffect(() => {
    if (isVideo || isPaused || !activeStory) {
      return undefined
    }

    imageProgressStartRef.current = imageProgressRef.current
    imageProgressStartedAtRef.current = performance.now()

    function tick(now) {
      const elapsed = now - imageProgressStartedAtRef.current
      const nextProgress =
        imageProgressStartRef.current + (elapsed / IMAGE_STORY_DURATION_MS) * 100
      setImageProgress(Math.max(0, Math.min(100, nextProgress)))

      if (nextProgress >= 100) {
        if (imageAnimationFrameRef.current) {
          window.cancelAnimationFrame(imageAnimationFrameRef.current)
        }
        goNextStory()
        return
      }

      imageAnimationFrameRef.current = window.requestAnimationFrame(tick)
    }

    imageAnimationFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (imageAnimationFrameRef.current) {
        window.cancelAnimationFrame(imageAnimationFrameRef.current)
      }
    }
  }, [activeStory, goNextStory, isPaused, isVideo])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.()
        return
      }

      if (event.key === 'ArrowRight') {
        goNextStory()
        return
      }

      if (event.key === 'ArrowLeft') {
        setActiveIndex((current) => Math.max(current - 1, 0))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNextStory, onClose])

  useEffect(() => {
    if (!isVideo || !videoRef.current) {
      return
    }

    videoRef.current.muted = isMuted
  }, [isMuted, isVideo])

  useEffect(() => {
    if (!isVideo || !videoRef.current) {
      return
    }

    if (isPaused) {
      if (!videoRef.current.paused) {
        videoRef.current.pause()
      }
      return
    }

    videoRef.current.play().catch(() => {})
  }, [isPaused, isVideo, activeStoryId])

  function isInteractiveTarget(target) {
    if (!(target instanceof Element)) {
      return false
    }

    return Boolean(target.closest('button,input,textarea,a,form,[data-story-no-hold]'))
  }

  function handleMediaPressStart(event) {
    if (isInteractiveTarget(event.target)) {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }

    holdActiveRef.current = true
    setIsPaused(true)
  }

  function handleMediaPressEnd() {
    if (!holdActiveRef.current) {
      return
    }

    holdActiveRef.current = false
    if (!isCommentsOpen && !isSubmittingReply) {
      setIsPaused(false)
    }
  }

  function handleMediaContextMenu(event) {
    event.preventDefault()
  }

  function handleSwipeStart(event) {
    if (isInteractiveTarget(event.target)) {
      swipeGestureRef.current.active = false
      return
    }

    const touch = event.touches?.[0]
    if (!touch) {
      swipeGestureRef.current.active = false
      return
    }

    swipeGestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      active: true,
    }
  }

  function handleSwipeEnd(event) {
    if (!swipeGestureRef.current.active) {
      return
    }

    const touch = event.changedTouches?.[0]
    if (!touch) {
      swipeGestureRef.current.active = false
      return
    }

    const deltaX = touch.clientX - swipeGestureRef.current.startX
    const deltaY = touch.clientY - swipeGestureRef.current.startY
    swipeGestureRef.current.active = false

    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return
    }

    const direction = deltaX < 0 ? 'next' : 'previous'
    const shifted = onRequestRailShift?.(direction)

    if (shifted) {
      holdActiveRef.current = false
      setIsPaused(false)
    }
  }

  useEffect(() => {
    if (shouldPauseForReply) {
      setIsPaused(true)
      return
    }

    if (!holdActiveRef.current && !isCommentsOpen) {
      setIsPaused(false)
    }
  }, [shouldPauseForReply, isCommentsOpen])

  useEffect(() => {
    if (!isCommentsOpen) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const scroller = commentsScrollerRef.current
      if (!scroller) {
        return
      }

      scroller.scrollTop = scroller.scrollHeight
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isCommentsOpen, detailState.comments?.length])

  const ensureAuthenticated = () => {
    if (isAuthenticated) {
      return true
    }

    setNotice(labels.authRequired)
    return false
  }

  const applyUpdatedPost = (postPayload) => {
    if (!postPayload) {
      return
    }
    setDetailState((current) => ({
      ...current,
      post: postPayload,
    }))
  }

  const handleToggleLike = async () => {
    if (!activeStoryId || isActionPending || !ensureAuthenticated()) {
      return
    }
    setIsActionPending(true)
    try {
      const payload = await toggleStoryLike(activeStoryId)
      applyUpdatedPost(payload?.post)
    } catch (error) {
      setNotice(error.message || labels.loadFailed)
    } finally {
      setIsActionPending(false)
    }
  }

  const handleShare = async () => {
    if (!activeStoryId) {
      return
    }

    const sharePayload = buildPostSharePayload({
      post: activePost || activeStory,
      postId: activeStoryId,
      lang,
    })
    const nativeResult = await shareWithNative(sharePayload)

    if (nativeResult.status === 'shared') {
      setNotice(labels.shareDone)
      if (isAuthenticated) {
        try {
          const response = await toggleStoryShare(activeStoryId)
          applyUpdatedPost(response?.post)
        } catch {
          // keep UX smooth for share flow
        }
      }
      return
    }

    if (nativeResult.status === 'cancelled') {
      return
    }

    try {
      await copyTextToClipboard(sharePayload.url)
      setNotice(labels.shareCopied)
      if (isAuthenticated) {
        try {
          const response = await toggleStoryShare(activeStoryId)
          applyUpdatedPost(response?.post)
        } catch {
          // keep UX smooth for share flow
        }
      }
    } catch {
      setNotice(labels.shareFailed)
    }
  }

  const handleSubmitReply = async (event) => {
    event.preventDefault()

    if (!activeStoryId || isSubmittingReply) {
      return
    }

    if (!ensureAuthenticated()) {
      return
    }

    const nextText = replyDraft.trim()
    if (!nextText) {
      return
    }

    setIsSubmittingReply(true)
    try {
      const payload = await createStoryReply(activeStoryId, { text: nextText })
      setReplyDraft('')
      setDetailState((current) => ({
        ...current,
        comments: [...(current.comments || []), payload.comment].sort(
          (left, right) => new Date(left.createdAt) - new Date(right.createdAt),
        ),
        post: current.post
          ? {
              ...current.post,
              stats: {
                ...(current.post.stats || {}),
                comments: Number(payload?.postStats?.comments || current.post?.stats?.comments || 0),
              },
            }
          : current.post,
      }))
      setIsCommentsOpen(true)
      setIsPaused(true)
      setNotice(labels.replySuccess)
    } catch (error) {
      setNotice(error.message || labels.replyFailed)
    } finally {
      setIsSubmittingReply(false)
    }
  }

  const handleDeleteReply = async (comment) => {
    const commentId = comment?.id || comment?._id
    if (!commentId || isActionPending || !ensureAuthenticated()) {
      return
    }

    setIsActionPending(true)
    try {
      const payload = await deleteStoryReplyComment(commentId)
      const deletedCommentId = `${payload?.deletedCommentId || commentId}`
      setDetailState((current) => ({
        ...current,
        comments: (current.comments || []).filter(
          (item) => `${item?.id || item?._id || ''}` !== deletedCommentId,
        ),
        post: current.post
          ? {
              ...current.post,
              stats: {
                ...(current.post.stats || {}),
                comments: Number(
                  payload?.postStats?.comments ??
                    current.post?.stats?.comments ??
                    0,
                ),
              },
            }
          : current.post,
      }))
      setNotice(labels.deleteReplySuccess)
    } catch (error) {
      setNotice(error.message || labels.deleteReplyFailed)
    } finally {
      setIsActionPending(false)
    }
  }

  if (!activeStory || !mediaItem) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black">
      <div
        className="mx-auto w-full max-w-3xl"
        style={{ height: lockedViewportHeight ? `${lockedViewportHeight}px` : '100vh' }}
      >
        <div
          className="relative h-full w-full overflow-hidden bg-black"
          onContextMenu={handleMediaContextMenu}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              src={resolveMediaUrl(mediaItem.url)}
              className="h-full w-full object-cover"
              style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                WebkitUserDrag: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                userSelect: 'none',
                touchAction: 'none',
              }}
              autoPlay
              playsInline
              loop={false}
              muted={isMuted}
              draggable={false}
              onContextMenu={handleMediaContextMenu}
              onDragStart={handleMediaContextMenu}
              onPointerDown={handleMediaPressStart}
              onPointerUp={handleMediaPressEnd}
              onPointerCancel={handleMediaPressEnd}
              onPointerLeave={handleMediaPressEnd}
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
              onTimeUpdate={(event) => {
                const currentTarget = event.currentTarget
                if (!Number.isFinite(currentTarget.duration) || currentTarget.duration <= 0) {
                  setImageProgress(0)
                  return
                }

                setImageProgress((currentTarget.currentTime / currentTarget.duration) * 100)
              }}
              onEnded={() => {
                goNextStory()
              }}
            />
          ) : (
            <img
              src={resolveMediaUrl(mediaItem.url)}
              alt={labels.mediaAlt}
              className="h-full w-full object-cover"
              style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                WebkitUserDrag: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                userSelect: 'none',
                touchAction: 'none',
              }}
              draggable={false}
              onContextMenu={handleMediaContextMenu}
              onDragStart={handleMediaContextMenu}
              onPointerDown={handleMediaPressStart}
              onPointerUp={handleMediaPressEnd}
              onPointerCancel={handleMediaPressEnd}
              onPointerLeave={handleMediaPressEnd}
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
            />
          )}

          <div className="absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4">
            <div className="mb-3 flex items-center gap-1.5">
              {progressValues.map((value, index) => (
                <div key={`${stories[index]?._id || index}-progress`} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${value}%` }} />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Link to={`/${lang}/u/${rail.author?.username}`} className="flex min-w-0 items-center gap-2">
                <UserAvatar user={rail.author} className="size-9 text-xs font-semibold" textClassName="text-xs font-semibold" />
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1 text-sm font-semibold text-white"><span className="truncate">{`${rail.author?.firstName || ''} ${rail.author?.lastName || ''}`.trim()}</span><VerifiedBadge user={rail.author} size="xs" /></p>
                  <p className="truncate text-xs text-white/70">@{rail.author?.username} · {publishedAtLabel}</p>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                {isVideo ? (
                  <button
                    type="button"
                    onClick={() => setIsMuted((current) => !current)}
                    className="rounded-full border border-white/30 bg-black/35 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black/50"
                  >
                    {isMuted ? labels.openSound : labels.muteSound}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="grid size-9 place-items-center cursor-pointer rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-black/50"
                  aria-label={labels.close}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-4">
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {activeStory.text || activeStoryMeta ? (
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-28 pt-20 text-sm leading-6 text-white">
              {activeStory.text ? <p className="max-w-[88%]">{activeStory.text}</p> : null}
              {activeStoryMeta ? (
                <div className="mt-2.5 max-w-[90%] space-y-1.5 text-xs">
                  {activeStoryMeta.musicTitle || activeStoryMeta.musicArtist ? (
                    <p className="rounded-full bg-black/35 px-3 py-1.5 text-white/95">
                      {`♪ ${activeStoryMeta.musicTitle || 'Music'}${activeStoryMeta.musicArtist ? ` - ${activeStoryMeta.musicArtist}` : ''}`}
                    </p>
                  ) : null}
                  {activeStoryMeta.stickers.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeStoryMeta.stickers.slice(0, 6).map((sticker) => (
                        <span
                          key={`story-sticker-${sticker}`}
                          className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white/95"
                        >
                          #{sticker}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {activeStoryMeta.mentions.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeStoryMeta.mentions.slice(0, 6).map((mention) => (
                        <Link
                          key={`story-mention-${mention}`}
                          to={`/${lang}/u/${mention}`}
                          className="pointer-events-auto rounded-full bg-primary/80 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-primary"
                        >
                          @{mention}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {activeStoryMeta.linkUrl ? (
                    <a
                      href={activeStoryMeta.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-zinc-900 transition hover:bg-white"
                    >
                      <span className="truncate">
                        {activeStoryMeta.linkLabel || activeStoryMeta.linkUrl}
                      </span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-3 z-20 px-0">
            <div className="p-3">
              {hasReplies ? (
                <div className=" flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsCommentsOpen((current) => !current)}
                    className=" px-3 rounded-lg cursor-pointer py-1.5 text-xs bg-white/10 border border-white/15 mx-26 font-normal text-white/95 transition"
                    data-story-no-hold
                  >
                    {isCommentsOpen ? labels.hideReplies : labels.openReplies}
                  </button>
                </div>
              ) : null}
              <form onSubmit={handleSubmitReply} className="mt-2.5 flex items-center gap-1 justify-between">
                <div className="flex w-full">
                <input
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  onFocus={() => setIsReplyInputFocused(true)}
                  onBlur={() => setIsReplyInputFocused(false)}
                  placeholder={labels.writeReply}
                  className="h-10 w-full rounded-s-lg border border-white/15 bg-black/55 px-3 text-sm text-white outline-none placeholder:text-white/60 focus:border-white/45"
                  data-story-no-hold
                />
                <button
                  type="submit"
                  disabled={!replyDraft.trim() || isSubmittingReply}
                  className="grid h-10 w-10 shrink-0 place-items-center cursor-pointer rounded-e-lg bg-white/90 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={labels.sendReply}
                  data-story-no-hold
                >
                  <SendIcon />
                </button>
                </div>

                <button
                  type="button"
                  onClick={handleToggleLike}
                  disabled={isActionPending}
                  className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-1.5 text-xs font-semibold transition ${activePost?.likedByViewer ? 'text-pink-300' : 'text-white/95'} hover:bg-white/10`}
                  aria-label={labels.like}
                >
                  <HeartIcon filled={Boolean(activePost?.likedByViewer)} />
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-1.5 text-xs font-semibold text-white/95 transition hover:bg-white/10"
                  aria-label={labels.share}
                >
                  <ShareIcon />
                </button>
              </form>
            </div>
          </div>

          {isCommentsOpen ? (
            <div className="absolute inset-x-3 bottom-26 z-30 max-h-[42%] overflow-hidden rounded-lg  bg-black/35 shadow-2xl backdrop-blur">
              <div ref={commentsScrollerRef} className="subtle-scrollbar max-h-[42vh] overflow-y-auto p-3">
                {detailState.isLoading ? (
                  <p className="py-3 text-xs text-white/70">{t('search.loading', { defaultValue: 'Yukleniyor...' })}</p>
                ) : detailState.comments?.length ? (
                  detailState.comments.map((comment) => {
                    const commentId = comment.id || comment._id
                    const authorId = `${comment?.author?._id || comment?.author?.id || ''}`
                    const viewerId = `${user?._id || user?.id || ''}`
                    const canDeleteReply = Boolean(
                      viewerId && authorId && viewerId === authorId,
                    )
                    return (
                      <div key={`story-comment-${commentId}`} className="mb-2.5 rounded-xl bg-white/10 p-2.5 last:mb-0">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <UserAvatar user={comment.author} className="size-6 text-[10px] font-semibold" textClassName="text-[10px] font-semibold" />
                            <span className="truncate text-xs font-semibold text-white">
                              {comment.author?.username || labels.unknownUser}
                            </span>
                          </div>
                          {canDeleteReply ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteReply(comment)}
                              disabled={isActionPending}
                              className="shrink-0 rounded-full border border-rose-300/30 cursor-pointer bg-rose-500/20 px-2 py-1 text-[10px] font-normal text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                              data-story-no-hold
                            >
                              {isActionPending ? labels.deleting : labels.deleteReply}
                            </button>
                          ) : null}
                        </div>
                        <p className="text-xs leading-5 text-white/95">{comment.text || ''}</p>
                      </div>
                    )
                  })
                ) : (
                  <p className="py-3 text-xs text-white/70">{labels.noComments}</p>
                )}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setActiveIndex((current) => Math.max(current - 1, 0))}
            className="absolute inset-y-0 left-0 z-[5] w-1/4"
            aria-label={labels.previous}
          />
          <button
            type="button"
            onClick={() => {
              goNextStory()
            }}
            className="absolute inset-y-0 right-0 z-[5] w-1/4"
            aria-label={labels.next}
          />
        </div>

        {notice ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[130] mx-auto w-fit max-w-[90vw] rounded-full bg-black/80 px-4 py-2 text-xs font-medium text-white shadow-xl">
            {notice}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default StoryViewerModal
