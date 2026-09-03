import { Suspense, lazy, memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ActionToast from '../../components/feedback/ActionToast.jsx'
import UserAvatar from '../../components/common/UserAvatar.jsx'
import HashtagText from '../../components/common/HashtagText.jsx'
import VerifiedBadge from '../../components/common/VerifiedBadge.jsx'
import {
  createComment,
  deleteComment,
  deletePost,
  getPostDetail,
  markPostNotInterested,
  recordLoopPlaybackTelemetry,
  registerPostView,
  toggleCommentLike,
  togglePostArchive,
  togglePostLike,
  togglePostSave,
  togglePostShare,
  updateComment,
  updatePost,
} from '../../services/postsService.js'
import { toggleFollowByUsername } from '../../services/usersService.js'
import { useAuth } from '../../store/AuthContext.jsx'
import { resolveMediaUrl } from '../../utils/media.js'
import { useReducedDataMode } from '../../hooks/useReducedDataMode.js'
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from '../../hooks/useMediaQuery.js'
import { useAdaptiveVideoSource } from '../../hooks/useAdaptiveVideoSource.js'
import { prefetchHlsVideo } from '../../utils/hlsPreload.js'
import {
  buildPostSharePayload,
  buildShareTargets,
  copyTextToClipboard,
} from '../../utils/postShare.js'
import ShareMenuPopover from './ShareMenuPopover.jsx'
import PostLikesModal from './PostLikesModal.jsx'
import PostInsightsModal from './PostInsightsModal.jsx'
import {
  formatRelativeTime,
  getFullName,
} from '../../utils/social.js'
import {
  BookmarkIcon,
  CloseIcon,
  CommentIcon,
  ExpandIcon,
  EyeIcon,
  HeartIcon,
  MoreIcon,
  ShareIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from './PostCardIcons.jsx'
import { PhotoIcon, VideoIcon } from './PostComposerIcons.jsx'

const ReportDialog = lazy(() => import('../../components/feedback/ReportDialog.jsx'))
const ConfirmActionDialog = lazy(() => import('../../components/feedback/ConfirmActionDialog.jsx'))
const ReplyComposer = lazy(() => import('./ReplyComposer.jsx'))
const MediaGallery = lazy(() => import('./MediaGallery.jsx'))
const PostEditModal = lazy(() => import('./PostEditModal.jsx'))

function getSafeRecommendationContext(recommendation) {
  if (
    !recommendation?.sessionId ||
    !Number.isInteger(recommendation.rank) ||
    !recommendation.algorithm ||
    !recommendation.view ||
    !recommendation.experiment?.id ||
    !recommendation.experiment?.variant
  ) {
    return null
  }

  return {
    sessionId: recommendation.sessionId,
    rank: recommendation.rank,
    algorithm: recommendation.algorithm,
    view: recommendation.view,
    loopMode: recommendation.loopMode || null,
    experiment: {
      id: recommendation.experiment.id,
      variant: recommendation.experiment.variant,
    },
  }
}

function InlineActionButton({
  icon,
  count,
  label,
  onClick,
  onCountClick,
  active = false,
  disabled = false,
}) {
  const shouldRenderCount = count !== null && typeof count !== 'undefined' && `${count}`.length > 0
  const canClickCount = typeof onCountClick === 'function' && shouldRenderCount && Number(count) > 0

  if (canClickCount) {
    return (
      <div
        className={`inline-flex min-h-11 items-center rounded-lg transition ${
          active
            ? 'bg-nav-active text-primary'
            : 'text-text hover:bg-secondary hover:text-text'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          title={label}
          className="inline-flex min-h-11 min-w-8 items-center justify-center p-2.5 cursor-pointer disabled:cursor-not-allowed"
        >
          {icon}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCountClick()
          }}
          className="py-2.5 pr-2.5 -ml-1 text-xs font-semibold hover:underline cursor-pointer focus:outline-none"
        >
          {count}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex min-h-11 min-w-11 items-center cursor-pointer justify-center gap-2 rounded-lg px-3 text-sm transition ${
        active
          ? 'bg-nav-active text-primary'
          : 'text-text hover:bg-secondary hover:text-text'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {icon}
      {shouldRenderCount ? <span className="text-xs font-semibold">{count}</span> : null}
    </button>
  )
}

function LoopVerticalActionButton({
  icon,
  count,
  label,
  onClick,
  onCountClick,
  disabled = false,
  active = false,
  isDesktop = false,
}) {
  const shouldRenderCount = count !== null && typeof count !== 'undefined' && `${count}`.length > 0
  const canClickCount = typeof onCountClick === 'function' && shouldRenderCount && Number(count) > 0

  if (isDesktop) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={`grid size-11 place-items-center rounded-full border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
            active
              ? 'bg-primary/20 border-primary/40 text-primary'
              : 'bg-card/90 border-border text-text hover:bg-secondary hover:text-primary'
          }`}
        >
          {icon}
        </button>
        {shouldRenderCount ? (
          canClickCount ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCountClick()
              }}
              className="text-xs font-bold leading-tight text-text/90 hover:text-primary hover:underline cursor-pointer py-0.5"
              title="Beğenenleri gör"
            >
              {count}
            </button>
          ) : (
            <span className="text-xs font-bold leading-tight text-text/90 select-none">{count}</span>
          )
        ) : null}
      </div>
    )
  }

  return (
    <div className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-white">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="grid size-8 place-items-center cursor-pointer transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {icon}
      </button>
      {shouldRenderCount ? (
        canClickCount ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCountClick()
            }}
            className="text-[10px] font-semibold leading-none text-white/90 hover:text-white hover:underline cursor-pointer py-0.5"
            title="Beğenenleri gör"
          >
            {count}
          </button>
        ) : (
          <span className="text-[10px] font-semibold leading-none select-none">{count}</span>
        )
      ) : null}
    </div>
  )
}

function Lightbox({ items, activeIndex, onClose, onChange }) {
  const item = items[activeIndex]

  if (!item) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/92 p-4" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white"
      >
        X
      </button>

      {activeIndex > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onChange(activeIndex - 1)
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-white"
        >
          {'<'}
        </button>
      ) : null}

      <div className="max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
        {item.type === 'video' ? (
          <video
            src={resolveMediaUrl(item.url)}
            controls
            playsInline
            autoPlay
            className="max-h-[85vh] max-w-full rounded-[24px]"
          />
        ) : (
          <img
            src={resolveMediaUrl(item.url)}
            alt="Expanded post media"
            className="max-h-[85vh] max-w-full rounded-[24px] object-contain"
          />
        )}
      </div>

      {activeIndex < items.length - 1 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onChange(activeIndex + 1)
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-white"
        >
          {'>'}
        </button>
      ) : null}
    </div>
  )
}

function findCommentById(comments, commentId) {
  for (const comment of comments) {
    if ((comment.id || comment._id) === commentId) {
      return comment
    }

    const nestedComment = findCommentById(comment.replies || [], commentId)

    if (nestedComment) {
      return nestedComment
    }
  }

  return null
}

function appendReplyToTree(comments, parentId, nextComment) {
  return comments.map((comment) => {
    const commentId = comment.id || comment._id

    if (commentId === parentId) {
      return {
        ...comment,
        replies: [nextComment, ...(comment.replies || [])],
      }
    }

    return comment.replies?.length
      ? {
          ...comment,
          replies: appendReplyToTree(comment.replies, parentId, nextComment),
        }
      : comment
  })
}

function updateCommentInTree(comments, nextComment) {
  return comments.map((comment) => {
    if ((comment.id || comment._id) === (nextComment.id || nextComment._id)) {
      const currentReplies = comment.replies || []
      const incomingReplies = Array.isArray(nextComment?.replies) ? nextComment.replies : null
      const resolvedReplies =
        incomingReplies === null
          ? currentReplies
          : incomingReplies.length === 0 && currentReplies.length > 0
            ? currentReplies
            : incomingReplies

      return {
        ...comment,
        ...nextComment,
        replies: resolvedReplies,
      }
    }

    return comment.replies?.length
      ? {
          ...comment,
          replies: updateCommentInTree(comment.replies, nextComment),
        }
      : comment
  })
}

const MOBILE_CONTENT_COLLAPSE_LIMIT = 92
const MORE_LABEL_RESERVED_CHARS = 16
const VIEW_TRACK_THRESHOLD = 0.6
const VIEW_TRACK_DELAY_MS = 1000
const LOOP_VIEW_METRIC_MIN_VISIBLE_MS = 250
const LOOP_BUFFER_STALL_TIMEOUT_MS = 10000
const LOOP_TELEMETRY_MIN_INTERVAL_MS = 4000
const LOOP_DROPPED_FRAMES_SAMPLE_INTERVAL_MS = 5000
const MOBILE_UA_PATTERN = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i
const LOOP_MUTE_EVENT = 'loop:mute-change'
let loopGlobalMuted = true
const trackedPostViews = new Set()
const pendingPostViews = new Set()

function getCollapsedInlineText(content, limit) {
  if (!content || content.length <= limit) {
    return content
  }

  let sliced = content.slice(0, limit)

  if (content[limit] && !/\s/.test(content[limit])) {
    const lastSpaceIndex = sliced.lastIndexOf(' ')
    if (lastSpaceIndex > 0) {
      sliced = sliced.slice(0, lastSpaceIndex)
    }
  }

  return `${sliced.trim()} ...`
}

function formatViewCount(value, locale = 'tr-TR') {
  const numericValue = Number(value || 0)

  if (numericValue < 1000) {
    return numericValue.toLocaleString(locale)
  }

  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(numericValue)
}

function isLoopContent(post) {
  const normalizedType = `${post?.contentType || post?.type || post?.publication?.contentType || ''}`
    .trim()
    .toLowerCase()

  if (normalizedType === 'loop' || normalizedType === 'loopvideo' || normalizedType === 'loop_video') {
    return true
  }

  return Boolean((post?.media || []).some((item) => item?.type === 'video' && item?.hlsUrl))
}

function getCommentLikeCount(comment) {
  return Number(comment?.stats?.likes ?? comment?.likes ?? 0)
}

function getCommentCreatedAt(comment) {
  const timestamp = comment?.createdAt ? Date.parse(comment.createdAt) : NaN
  return Number.isFinite(timestamp) ? timestamp : 0
}

function sortCommentsByMode(comments, mode) {
  const sorted = [...comments]

  if (mode === 'popular') {
    sorted.sort((a, b) => {
      const likeDiff = getCommentLikeCount(b) - getCommentLikeCount(a)
      if (likeDiff !== 0) {
        return likeDiff
      }
      return getCommentCreatedAt(b) - getCommentCreatedAt(a)
    })
    return sorted
  }

  sorted.sort((a, b) => getCommentCreatedAt(b) - getCommentCreatedAt(a))
  return sorted
}

function removeCommentFromTree(comments, commentId) {
  return comments
    .filter((comment) => (comment.id || comment._id) !== commentId)
    .map((comment) => ({
      ...comment,
      replies: removeCommentFromTree(comment.replies || [], commentId),
    }))
}

function createPreviewItem(file) {
  return {
    id: `${file.name}-${file.lastModified}`,
    url: URL.createObjectURL(file),
    type: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
  }
}

const QuickCommentsPanel = lazy(() => import('./QuickCommentsPanel.jsx'))

function PostCard({
  post,
  variant = 'default',
  hasAuthorStory = false,
  onOpenAuthorStory,
  onPostHidden,
  loopPlaybackState = null,
  followActionLabel = '',
  unfollowActionLabel = '',
  groupName = '',
  groupCoverImageUrl = '',
  prioritizeMedia = false,
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { lang } = useParams()
  const { isAuthenticated, user } = useAuth()
  const reducedDataMode = useReducedDataMode()
  const [localPost, setLocalPost] = useState(post)
  const [pendingAction, setPendingAction] = useState('')
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoopOptionsMenuOpen, setIsLoopOptionsMenuOpen] = useState(false)
  const [isExpandedText, setIsExpandedText] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentFile, setCommentFile] = useState(null)
  const [commentPreview, setCommentPreview] = useState(null)
  const [commentSubmitError, setCommentSubmitError] = useState('')
  const [activeCommentMenuId, setActiveCommentMenuId] = useState(null)
  const [pendingDeleteComment, setPendingDeleteComment] = useState(null)
  const [reportTarget, setReportTarget] = useState({ kind: 'post', id: null })
  const [isCommentsLoading, setIsCommentsLoading] = useState(false)
  const [quickComments, setQuickComments] = useState([])
  const [replyTargetId, setReplyTargetId] = useState(null)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [commentSort, setCommentSort] = useState('popular')
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const [isLikesModalOpen, setIsLikesModalOpen] = useState(false)
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false)
  const isShareProcessing = pendingAction === 'share'
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [editMediaItems, setEditMediaItems] = useState([])
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)
  const [isLoopMuted, setIsLoopMuted] = useState(loopGlobalMuted)
  const [isLoopInViewport, setIsLoopInViewport] = useState(false)
  const [isLoopPlaying, setIsLoopPlaying] = useState(false)
  const [loopProgressRatio, setLoopProgressRatio] = useState(0)
  const [isLoopMuteHintVisible, setIsLoopMuteHintVisible] = useState(false)
  const [isLoopPressPaused, setIsLoopPressPaused] = useState(false)
  const [loopPlaybackError, setLoopPlaybackError] = useState('')
  const [isFollowProcessing, setIsFollowProcessing] = useState(false)
  const [isLoopCaptionExpanded, setIsLoopCaptionExpanded] = useState(false)
  const [heartBursts, setHeartBursts] = useState([])
  const [isLoopManuallyPaused, setIsLoopManuallyPaused] = useState(false)
  const isMobileViewport = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const quickCommentTextareaRef = useRef(null)
  const commentMediaInputRef = useRef(null)
  const menuRef = useRef(null)
  const shareMenuRef = useRef(null)
  const loopOptionsMenuRef = useRef(null)
  const articleRef = useRef(null)
  const viewTimerRef = useRef(null)
  const hasTrackedViewRef = useRef(false)
  const loopVideoRef = useRef(null)
  const loopMuteHintTimerRef = useRef(null)
  const loopPressTimerRef = useRef(null)
  const loopTapTimerRef = useRef(null)
  const loopLastTapTimeRef = useRef(0)
  const loopHoldActiveRef = useRef(false)
  const suppressLoopTapMuteRef = useRef(false)
  const loopReplayCountRef = useRef(0)
  const loopMaxWatchRatioRef = useRef(0)
  const loopVisibilitySnapshotRef = useRef({
    startedAtMs: null,
    startedAtTop: null,
    startedAtEventTime: null,
  })
  const loopLastSentMetricsRef = useRef({
    watchRatio: 0,
    replayCount: 0,
    visibleMs: 0,
  })
  const loopRecoveryTimerRef = useRef(null)
  const loopRecoveryAttemptRef = useRef(0)
  const loopTelemetrySentAtRef = useRef({})
  const loopTimeGapSnapshotRef = useRef({
    wallTimeMs: null,
    mediaTimeSec: null,
  })
  const loopDroppedFramesSnapshotRef = useRef({
    sentAtMs: 0,
    droppedFrames: 0,
  })

  useEffect(() => {
    setLocalPost(post)
  }, [post])

  useEffect(() => {
    if (variant === 'loop') {
      setIsLoopMuted(loopGlobalMuted)
      setIsLoopCaptionExpanded(false)
    }
  }, [post, variant])

  useEffect(() => {
    if (variant !== 'loop' || typeof window === 'undefined') {
      return undefined
    }

    function handleLoopMuteSync(event) {
      setIsLoopMuted(Boolean(event?.detail?.muted))
    }

    window.addEventListener(LOOP_MUTE_EVENT, handleLoopMuteSync)
    return () => window.removeEventListener(LOOP_MUTE_EVENT, handleLoopMuteSync)
  }, [variant])

  useEffect(() => {
    if (!isMenuOpen && !isShareMenuOpen && !isLoopOptionsMenuOpen && !activeCommentMenuId) {
      return undefined
    }

    function handlePointerDown(event) {
      const target = event.target

      if (!menuRef.current?.contains(target)) {
        setIsMenuOpen(false)
      }

      const isInsideShareMenu = Boolean(
        target?.closest?.('[data-share-menu]') || shareMenuRef.current?.contains(target)
      )
      if (!isInsideShareMenu) {
        setIsShareMenuOpen(false)
      }

      const isInsideLoopOptions = Boolean(
        target?.closest?.('[data-loop-options-menu]') || loopOptionsMenuRef.current?.contains(target)
      )
      if (!isInsideLoopOptions) {
        setIsLoopOptionsMenuOpen(false)
      }

      const clickedCommentMenu = target?.closest?.('[data-comment-menu]')
      const clickedCommentMenuTrigger = target?.closest?.('[data-comment-menu-trigger]')
      if (!clickedCommentMenu && !clickedCommentMenuTrigger) {
        setActiveCommentMenuId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [activeCommentMenuId, isLoopOptionsMenuOpen, isMenuOpen, isShareMenuOpen])

  useEffect(() => {
    if (!toast.message) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setToast({ message: '', tone: 'success' })
    }, 2400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  useEffect(() => {
    return () => {
      if (commentPreview?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(commentPreview.url)
      }
    }
  }, [commentPreview])

  useEffect(() => {
    return () => {
      if (loopMuteHintTimerRef.current) {
        window.clearTimeout(loopMuteHintTimerRef.current)
        loopMuteHintTimerRef.current = null
      }

      if (loopRecoveryTimerRef.current) {
        window.clearTimeout(loopRecoveryTimerRef.current)
        loopRecoveryTimerRef.current = null
      }

      if (loopPressTimerRef.current) {
        window.clearTimeout(loopPressTimerRef.current)
        loopPressTimerRef.current = null
      }

      if (loopTapTimerRef.current) {
        window.clearTimeout(loopTapTimerRef.current)
        loopTapTimerRef.current = null
      }
    }
  }, [])

  const postId = localPost.id || localPost._id
  const author = localPost.author || {}
  const groupHeaderName = `${groupName || ''}`.trim()
  const groupHeaderCoverUrl = resolveMediaUrl(groupCoverImageUrl || '')
  const content = localPost.content || localPost.text || ''
  const mediaItems = localPost.media || []
  const isLoopFeedContent = isLoopContent(localPost)
  const isLoopVariant = variant === 'loop'
  const isLoopCardActive = !isLoopVariant || loopPlaybackState?.isActive !== false
  const loopPreloadMode = loopPlaybackState?.preloadMode || 'other'
  const isLoopMobileVariant = isLoopVariant && isMobileViewport
  const isLoopDesktopVariant = isLoopVariant && !isMobileViewport
  const loopVideoItem = mediaItems.find((item) => item?.type === 'video') || null
  const loopFallbackUrl = resolveMediaUrl(loopVideoItem?.url || '')
  const loopHlsUrl = resolveMediaUrl(loopVideoItem?.hlsUrl || '')
  const loopProcessingState = `${loopVideoItem?.processing || 'raw'}`
  const isLoopProcessing = ['queued', 'processing'].includes(loopProcessingState)
  const loopVideoSourceUrl = useAdaptiveVideoSource({
    videoRef: loopVideoRef,
    hlsUrl: loopHlsUrl,
    fallbackUrl: loopFallbackUrl,
    enabled: Boolean(
      loopVideoItem &&
      !isLoopProcessing &&
      (!isLoopVariant || isLoopInViewport || ['active', 'next'].includes(loopPreloadMode)),
    ),
  })
  const loopPosterUrl = resolveMediaUrl(loopVideoItem?.posterUrl || '')

  useEffect(() => {
    if (!postId || !isLoopProcessing) return undefined
    let cancelled = false
    const refresh = async () => {
      try {
        const payload = await getPostDetail(postId)
        if (!cancelled && payload?.post) setLocalPost(payload.post)
      } catch {
        // Keep the current processing card; the next poll can recover.
      }
    }
    const intervalId = window.setInterval(refresh, 5000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [isLoopProcessing, postId])

  useEffect(() => {
    if (
      !isLoopVariant ||
      reducedDataMode ||
      loopPreloadMode !== 'next' ||
      isLoopProcessing
    ) {
      return
    }

    if (loopHlsUrl || loopFallbackUrl) {
      void prefetchHlsVideo(loopHlsUrl, loopFallbackUrl)
    }
  }, [isLoopProcessing, isLoopVariant, loopFallbackUrl, loopHlsUrl, loopPreloadMode, reducedDataMode])
  const likes = localPost.likes ?? localPost.stats?.likes ?? 0
  const comments = localPost.comments ?? localPost.stats?.comments ?? 0
  const saves = localPost.saves ?? localPost.stats?.saves ?? 0
  const shares = localPost.shares ?? localPost.stats?.shares ?? 0
  const views = localPost.views ?? localPost.stats?.views ?? 0
  const isOwnPost = Boolean(user && author && user.username === author.username)
  const canViewInsights = Boolean(isOwnPost || user?.role === 'admin')
  const shouldCollapseInline = content.length > MOBILE_CONTENT_COLLAPSE_LIMIT
  const collapsedInlineContent = useMemo(
    () =>
      getCollapsedInlineText(
        content,
        Math.max(24, MOBILE_CONTENT_COLLAPSE_LIMIT - MORE_LABEL_RESERVED_CHARS),
      ),
    [content],
  )
  const replyTarget = useMemo(
    () => (replyTargetId ? findCommentById(quickComments, replyTargetId) : null),
    [quickComments, replyTargetId],
  )
  const canSubmitComment = editingCommentId ? Boolean(commentDraft.trim()) : (Boolean(commentDraft.trim()) || Boolean(commentFile))
  const isMobileCommentsPanel = isMobileViewport
  const panelComments = quickComments
  const sortedPanelComments = useMemo(
    () => sortCommentsByMode(panelComments, commentSort),
    [panelComments, commentSort],
  )
  const sharePayload = useMemo(
    () =>
      buildPostSharePayload({
        post: localPost,
        postId,
        lang,
        isLoop: variant === 'loop',
      }),
    [lang, localPost, postId, variant],
  )
  const shareTargets = useMemo(
    () => buildShareTargets({ url: sharePayload.url, text: sharePayload.text }),
    [sharePayload.text, sharePayload.url],
  )
  const loopCaptionNeedsTruncate = content.length > 88
  const loopCaptionPreview = useMemo(() => getCollapsedInlineText(content, 88), [content])
  const isAuthorFollowed = Boolean(
    author?.viewerState?.isFollowing ??
      author?.isFollowing ??
      author?.followedByViewer ??
      author?.isFollowedByViewer,
  )
  const canFollowAuthor = Boolean(
    author?.username &&
      (!user?.username || author.username.toLowerCase() !== user.username.toLowerCase()),
  )
  const followLabelText = followActionLabel || t('profile.follow')
  const unfollowLabelText = unfollowActionLabel || t('search.people.unfollow')
  const canOpenAuthorStory = Boolean(
    hasAuthorStory && typeof onOpenAuthorStory === 'function' && author?.username,
  )

  function canSendLoopTelemetry(eventType) {
    if (!postId || !isLoopVariant || !eventType) {
      return false
    }

    const nowMs = Date.now()
    const lastSentAtMs = Number(loopTelemetrySentAtRef.current[eventType] || 0)

    if (nowMs - lastSentAtMs < LOOP_TELEMETRY_MIN_INTERVAL_MS) {
      return false
    }

    loopTelemetrySentAtRef.current[eventType] = nowMs
    return true
  }

  function handleCommentMediaChange(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    const [file] = files
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setCommentSubmitError('Yorumlara sadece gorsel veya video ekleyebilirsin.')
      return
    }
    if (commentPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(commentPreview.url)
    setCommentSubmitError('')
    setCommentFile(file)
    setCommentPreview(createPreviewItem(file))
  }

  function clearCommentMedia() {
    if (commentPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(commentPreview.url)
    setCommentFile(null)
    setCommentPreview(null)
  }

  async function sendLoopTelemetry(eventType, extras = {}) {
    if (!canSendLoopTelemetry(eventType)) {
      return
    }

    const video = loopVideoRef.current
    const connection = typeof navigator !== 'undefined' ? navigator.connection || null : null
    const quality =
      video && typeof video.getVideoPlaybackQuality === 'function'
        ? video.getVideoPlaybackQuality()
        : null

    try {
      await recordLoopPlaybackTelemetry(postId, {
        eventId:
          typeof globalThis.crypto?.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        eventType,
        mediaUrl: loopVideoSourceUrl || loopVideoItem?.url || '',
        currentTimeSec:
          typeof extras.currentTimeSec === 'number'
            ? extras.currentTimeSec
            : Number(video?.currentTime || 0),
        timeGapMs:
          Number.isInteger(extras.timeGapMs) && extras.timeGapMs >= 0
            ? extras.timeGapMs
            : undefined,
        droppedFrames:
          Number.isInteger(extras.droppedFrames) && extras.droppedFrames >= 0
            ? extras.droppedFrames
            : Number.isInteger(quality?.droppedVideoFrames)
              ? quality.droppedVideoFrames
              : undefined,
        totalFrames:
          Number.isInteger(extras.totalFrames) && extras.totalFrames >= 0
            ? extras.totalFrames
            : Number.isInteger(quality?.totalVideoFrames)
              ? quality.totalVideoFrames
              : undefined,
        network: {
          effectiveType: connection?.effectiveType || '',
          downlinkMbps:
            typeof connection?.downlink === 'number' && Number.isFinite(connection.downlink)
              ? connection.downlink
              : undefined,
          rttMs: Number.isInteger(connection?.rtt) ? connection.rtt : undefined,
          saveData: Boolean(connection?.saveData),
        },
        device: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
          platform: typeof navigator !== 'undefined' ? navigator.platform || '' : '',
          viewport: {
            width: typeof window !== 'undefined' ? window.innerWidth || 0 : 0,
            height: typeof window !== 'undefined' ? window.innerHeight || 0 : 0,
          },
          deviceMemoryGb:
            typeof navigator !== 'undefined' &&
            typeof navigator.deviceMemory === 'number' &&
            Number.isFinite(navigator.deviceMemory)
              ? navigator.deviceMemory
              : undefined,
          hardwareConcurrency:
            typeof navigator !== 'undefined' &&
            Number.isInteger(navigator.hardwareConcurrency)
              ? navigator.hardwareConcurrency
              : undefined,
        },
      })
    } catch {
      // Telemetry should not block playback.
    }
  }

  function captureLoopWatchRatio() {
    const video = loopVideoRef.current

    if (!video) {
      return loopMaxWatchRatioRef.current
    }

    const duration = Number(video.duration || 0)
    const currentTime = Number(video.currentTime || 0)

    if (duration > 0) {
      loopMaxWatchRatioRef.current = Math.max(
        loopMaxWatchRatioRef.current,
        Math.min(Math.max(currentTime / duration, 0), 1),
      )
    }

    return loopMaxWatchRatioRef.current
  }

  function handleLoopVideoTimeUpdate() {
    captureLoopWatchRatio()
    const video = loopVideoRef.current

    if (!video) {
      return
    }

    const duration = Number(video.duration || 0)
    const currentTime = Number(video.currentTime || 0)

    if (duration > 0) {
      setLoopProgressRatio(Math.min(Math.max(currentTime / duration, 0), 1))
    }

    setLoopPlaybackError('')
    loopRecoveryAttemptRef.current = 0
    if (loopRecoveryTimerRef.current) {
      window.clearTimeout(loopRecoveryTimerRef.current)
      loopRecoveryTimerRef.current = null
    }

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const previousWallTimeMs = loopTimeGapSnapshotRef.current.wallTimeMs
    const previousMediaTimeSec = loopTimeGapSnapshotRef.current.mediaTimeSec

    if (
      typeof previousWallTimeMs === 'number' &&
      typeof previousMediaTimeSec === 'number'
    ) {
      const wallDeltaMs = Math.max(0, nowMs - previousWallTimeMs)
      const mediaDeltaSec = Math.max(0, currentTime - previousMediaTimeSec)
      if (wallDeltaMs > 1400 && mediaDeltaSec < 0.03) {
        void sendLoopTelemetry('time-gap', {
          timeGapMs: Math.round(wallDeltaMs),
          currentTimeSec: currentTime,
        })
      }
    }

    loopTimeGapSnapshotRef.current = {
      wallTimeMs: nowMs,
      mediaTimeSec: currentTime,
    }

    if (typeof video.getVideoPlaybackQuality === 'function') {
      const quality = video.getVideoPlaybackQuality()
      const droppedFrames = Number(quality?.droppedVideoFrames || 0)
      const totalFrames = Number(quality?.totalVideoFrames || 0)
      const timeSinceLastDroppedSample =
        nowMs - Number(loopDroppedFramesSnapshotRef.current.sentAtMs || 0)
      const previousDroppedFrames = Number(loopDroppedFramesSnapshotRef.current.droppedFrames || 0)

      if (
        droppedFrames > previousDroppedFrames &&
        timeSinceLastDroppedSample >= LOOP_DROPPED_FRAMES_SAMPLE_INTERVAL_MS
      ) {
        loopDroppedFramesSnapshotRef.current = {
          sentAtMs: nowMs,
          droppedFrames,
        }
        void sendLoopTelemetry('dropped-frames', {
          droppedFrames,
          totalFrames: Number.isFinite(totalFrames) ? totalFrames : 0,
          currentTimeSec: currentTime,
        })
      }
    }
  }

  function handleLoopVideoWaiting(event) {
    if (!isLoopVariant) {
      return
    }

    const video = event?.currentTarget || loopVideoRef.current
    void sendLoopTelemetry('waiting', {
      currentTimeSec: Number(video?.currentTime || 0),
    })

    // Normal buffering must NEVER forcibly reload the video element or increment failure counters.
    // We only set a fallback timer (10s) if the playback completely freezes without any forward progress.
    if (
      !loopRecoveryTimerRef.current &&
      isLoopInViewport &&
      isLoopCardActive &&
      document.visibilityState === 'visible'
    ) {
      loopRecoveryTimerRef.current = window.setTimeout(() => {
        const currentVideo = loopVideoRef.current
        if (currentVideo && currentVideo.paused && isLoopCardActive && isLoopInViewport) {
          setLoopPlaybackError('Video baglantisi yavas. Tekrar dene.')
          void sendLoopTelemetry('recover-failed', {
            currentTimeSec: Number(currentVideo.currentTime || 0),
          })
        }
      }, LOOP_BUFFER_STALL_TIMEOUT_MS)
    }
  }

  function handleLoopVideoStalled(event) {
    if (!isLoopVariant) {
      return
    }

    const video = event?.currentTarget || loopVideoRef.current
    void sendLoopTelemetry('stalled', {
      currentTimeSec: Number(video?.currentTime || 0),
    })
  }

  function handleLoopVideoError(event) {
    if (!isLoopVariant) {
      return
    }

    const video = event?.currentTarget || loopVideoRef.current
    void sendLoopTelemetry('error', {
      currentTimeSec: Number(video?.currentTime || 0),
    })

    if (!video || !isLoopInViewport || !isLoopCardActive) {
      return
    }

    if (loopRecoveryAttemptRef.current >= 2) {
      setLoopPlaybackError('Video baglantisi yavas. Tekrar dene.')
      void sendLoopTelemetry('recover-failed', {
        currentTimeSec: Number(video.currentTime || 0),
      })
      return
    }

    loopRecoveryAttemptRef.current += 1
    if (loopRecoveryTimerRef.current) {
      window.clearTimeout(loopRecoveryTimerRef.current)
    }

    loopRecoveryTimerRef.current = window.setTimeout(() => {
      try {
        video.load()
        if (isLoopInViewport && isLoopCardActive && document.visibilityState === 'visible') {
          video.play().catch(() => {})
        }
      } catch {
        // Recovery should stay best-effort
      }
    }, 1000)
  }

  function handleLoopVideoPlaying() {
    setIsLoopPlaying(true)
    setLoopPlaybackError('')
    loopRecoveryAttemptRef.current = 0
    if (loopRecoveryTimerRef.current) {
      window.clearTimeout(loopRecoveryTimerRef.current)
      loopRecoveryTimerRef.current = null
    }
  }

  function handleLoopVideoEnded(event) {
    setIsLoopPlaying(false)
    loopReplayCountRef.current += 1
    loopMaxWatchRatioRef.current = Math.max(loopMaxWatchRatioRef.current, 1)
    setLoopProgressRatio(1)

    const target = event.currentTarget
    if (target && typeof target.play === 'function') {
      target.currentTime = 0
      if (
        !reducedDataMode &&
        isLoopInViewport &&
        isLoopCardActive &&
        document.visibilityState === 'visible'
      ) {
        target.play().catch(() => {})
      }
    }
  }

  function handleLoopMuteToggle(event) {
    event?.stopPropagation?.()
    const nextMuted = !isLoopMuted
    loopGlobalMuted = nextMuted
    setIsLoopMuted(nextMuted)
    if (isLoopMobileVariant) {
      setIsLoopMuteHintVisible(true)
      if (loopMuteHintTimerRef.current) {
        window.clearTimeout(loopMuteHintTimerRef.current)
      }
      loopMuteHintTimerRef.current = window.setTimeout(() => {
        setIsLoopMuteHintVisible(false)
      }, 1200)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(LOOP_MUTE_EVENT, {
          detail: { muted: nextMuted },
        }),
      )
    }
  }

  function triggerHeartBurst(x = null, y = null) {
    const burstId = Date.now() + Math.random()
    setHeartBursts((current) => [...current, { id: burstId, x, y }])
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(45)
      } catch {
        // Ignore vibration errors
      }
    }
    window.setTimeout(() => {
      setHeartBursts((current) => current.filter((item) => item.id !== burstId))
    }, 850)
  }

  function handleLoopVideoClick(event) {
    event?.stopPropagation?.()
    if (suppressLoopTapMuteRef.current) {
      suppressLoopTapMuteRef.current = false
      return
    }

    const now = Date.now()
    const timeSinceLastTap = now - Number(loopLastTapTimeRef.current || 0)
    const rect = event.currentTarget.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top

    if (timeSinceLastTap < 300) {
      // DOUBLE TAP: LIKE & HEART BURST
      if (loopTapTimerRef.current) {
        window.clearTimeout(loopTapTimerRef.current)
        loopTapTimerRef.current = null
      }
      loopLastTapTimeRef.current = 0

      triggerHeartBurst(clickX, clickY)

      if (!localPost.likedByViewer && isAuthenticated) {
        void runPostAction('like', togglePostLike)
      }
      return
    }

    loopLastTapTimeRef.current = now

    if (loopTapTimerRef.current) {
      window.clearTimeout(loopTapTimerRef.current)
    }

    loopTapTimerRef.current = window.setTimeout(() => {
      loopTapTimerRef.current = null
      // SINGLE TAP: TOGGLE MUTE / UNMUTE
      handleLoopMuteToggle(event)
    }, 260)
  }

  function handleLoopProgressInput(event) {
    event?.stopPropagation?.()
    const rawValue = Number(event.target.value)
    const safeRatio = Math.min(Math.max(rawValue / 100, 0), 1)
    const video = loopVideoRef.current

    setLoopProgressRatio(safeRatio)

    if (!video) {
      return
    }

    const duration = Number(video.duration || 0)
    if (duration > 0) {
      video.currentTime = safeRatio * duration
    }
  }

  function handleLoopManualRetry(event) {
    event?.stopPropagation?.()
    const video = loopVideoRef.current
    if (!video) {
      return
    }

    setLoopPlaybackError('')
    loopRecoveryAttemptRef.current = 0
    if (loopRecoveryTimerRef.current) {
      window.clearTimeout(loopRecoveryTimerRef.current)
      loopRecoveryTimerRef.current = null
    }

    try {
      video.load()
      if (isLoopCardActive && isLoopInViewport && document.visibilityState === 'visible') {
        video.play().catch(() => {})
      }
    } catch {
      // Manual retry should stay best-effort.
    }
  }

  function handleLoopPressStart() {
    if (!isLoopVariant) {
      return
    }

    suppressLoopTapMuteRef.current = false
    if (loopPressTimerRef.current) {
      window.clearTimeout(loopPressTimerRef.current)
    }

    loopPressTimerRef.current = window.setTimeout(() => {
      loopHoldActiveRef.current = true
      suppressLoopTapMuteRef.current = true
      setIsLoopPressPaused(true)
      const video = loopVideoRef.current
      if (video && !video.paused) {
        video.pause()
      }
      loopPressTimerRef.current = null
    }, 180)
  }

  function handleLoopPressEnd() {
    if (loopPressTimerRef.current) {
      window.clearTimeout(loopPressTimerRef.current)
      loopPressTimerRef.current = null
    }

    if (!loopHoldActiveRef.current) {
      return
    }

    loopHoldActiveRef.current = false
    setIsLoopPressPaused(false)
    const video = loopVideoRef.current
    if (video && video.paused && isLoopCardActive && isLoopInViewport && document.visibilityState === 'visible') {
      video.play().catch(() => {})
    }
  }

  function handleLoopVideoContextMenu(event) {
    event.preventDefault()
  }

  async function handleLoopFollowToggle(event) {
    event?.stopPropagation?.()

    if (!author?.username) {
      return
    }

    if (!isAuthenticated) {
      navigate(`/${lang}/login`)
      return
    }

    if (!canFollowAuthor || isFollowProcessing) {
      return
    }

    setIsFollowProcessing(true)
    const optimisticFollowing = !isAuthorFollowed
    setLocalPost((current) => ({
      ...current,
      author: {
        ...(current.author || {}),
        viewerState: {
          ...(current.author?.viewerState || {}),
          isFollowing: optimisticFollowing,
        },
        isFollowing: optimisticFollowing,
        followedByViewer: optimisticFollowing,
        isFollowedByViewer: optimisticFollowing,
      },
    }))

    try {
      const payload = await toggleFollowByUsername(author.username)
      const payloadFollowing =
        typeof payload?.viewerState?.isFollowing === 'boolean'
          ? payload.viewerState.isFollowing
          : optimisticFollowing

      setLocalPost((current) => ({
        ...current,
        author: {
          ...(current.author || {}),
          viewerState: {
            ...(current.author?.viewerState || {}),
            isFollowing: payloadFollowing,
          },
          isFollowing: payloadFollowing,
          followedByViewer: payloadFollowing,
          isFollowedByViewer: payloadFollowing,
        },
      }))
    } catch {
      setLocalPost((current) => ({
        ...current,
        author: {
          ...(current.author || {}),
          viewerState: {
            ...(current.author?.viewerState || {}),
            isFollowing: !optimisticFollowing,
          },
          isFollowing: !optimisticFollowing,
          followedByViewer: !optimisticFollowing,
          isFollowedByViewer: !optimisticFollowing,
        },
      }))
    } finally {
      setIsFollowProcessing(false)
    }
  }

  useEffect(() => {
    hasTrackedViewRef.current = trackedPostViews.has(postId)
    loopReplayCountRef.current = 0
    loopMaxWatchRatioRef.current = 0
    loopTelemetrySentAtRef.current = {}
    loopTimeGapSnapshotRef.current = {
      wallTimeMs: null,
      mediaTimeSec: null,
    }
    loopDroppedFramesSnapshotRef.current = {
      sentAtMs: 0,
      droppedFrames: 0,
    }
    loopRecoveryAttemptRef.current = 0
    if (loopRecoveryTimerRef.current) {
      window.clearTimeout(loopRecoveryTimerRef.current)
      loopRecoveryTimerRef.current = null
    }
    setIsLoopInViewport(false)
    setIsLoopPressPaused(false)
    setLoopProgressRatio(0)
    setLoopPlaybackError('')
    loopHoldActiveRef.current = false
    suppressLoopTapMuteRef.current = false
    loopVisibilitySnapshotRef.current = {
      startedAtMs: null,
      startedAtTop: null,
      startedAtEventTime: null,
    }
    loopLastSentMetricsRef.current = {
      watchRatio: 0,
      replayCount: 0,
      visibleMs: 0,
    }
  }, [isLoopVariant, postId])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return undefined
    }

    if (!postId || !articleRef.current || (!isLoopVariant && hasTrackedViewRef.current)) {
      return undefined
    }

    function clearViewTimer() {
      if (viewTimerRef.current) {
        window.clearTimeout(viewTimerRef.current)
        viewTimerRef.current = null
      }
    }

    async function sendViewEvent(options = {}) {
      const { force = false, metrics = null, keepalive = false } = options
      if (!postId || ((!isLoopVariant || !force) && hasTrackedViewRef.current) || pendingPostViews.has(postId)) {
        return
      }

      const safeMetrics =
        isLoopVariant && metrics
          ? {
              watchRatio:
                typeof metrics.watchRatio === 'number' && Number.isFinite(metrics.watchRatio)
                  ? Math.min(Math.max(metrics.watchRatio, 0), 1)
                  : undefined,
              replayCount:
                Number.isInteger(metrics.replayCount) && metrics.replayCount >= 0
                  ? metrics.replayCount
                  : undefined,
              swipeVelocity:
                typeof metrics.swipeVelocity === 'number' && Number.isFinite(metrics.swipeVelocity)
                  ? Math.max(metrics.swipeVelocity, 0)
                  : undefined,
              visibleMs:
                Number.isInteger(metrics.visibleMs) && metrics.visibleMs >= 0
                  ? metrics.visibleMs
                  : undefined,
            }
          : null

      const hasSafeMetrics =
        isLoopVariant &&
        safeMetrics &&
        Object.values(safeMetrics).some((value) => typeof value === 'number' && Number.isFinite(value))
      const safeRecommendation = getSafeRecommendationContext(post?._recommendation)

      if (hasSafeMetrics) {
        const lastMetrics = loopLastSentMetricsRef.current
        const replayCount = safeMetrics.replayCount ?? 0
        const watchRatio = safeMetrics.watchRatio ?? 0
        const visibleMs = safeMetrics.visibleMs ?? 0
        const hasProgressed =
          replayCount > lastMetrics.replayCount ||
          watchRatio > lastMetrics.watchRatio + 0.005 ||
          visibleMs > lastMetrics.visibleMs + 250

        if (!hasProgressed) {
          return
        }
      } else if (isLoopVariant && force) {
        return
      }

      pendingPostViews.add(postId)

      try {
        const requestPayload = {
          ...(hasSafeMetrics ? safeMetrics : {}),
          ...(safeRecommendation ? { recommendation: safeRecommendation } : {}),
        }
        const payload = await registerPostView(postId, requestPayload, { keepalive })

        hasTrackedViewRef.current = true
        trackedPostViews.add(postId)

        if (hasSafeMetrics) {
          loopLastSentMetricsRef.current = {
            watchRatio: safeMetrics.watchRatio ?? loopLastSentMetricsRef.current.watchRatio,
            replayCount: safeMetrics.replayCount ?? loopLastSentMetricsRef.current.replayCount,
            visibleMs: safeMetrics.visibleMs ?? loopLastSentMetricsRef.current.visibleMs,
          }
        }

        if (typeof payload?.stats?.views === 'number') {
          setLocalPost((current) => ({
            ...current,
            stats: {
              ...current.stats,
              views: payload.stats.views,
            },
          }))
        }
      } catch {
        // View tracking should never block core post interactions.
      } finally {
        pendingPostViews.delete(postId)
      }
    }

    function flushLoopViewMetrics({ keepalive = false } = {}) {
      if (!isLoopVariant) {
        return
      }

      const snapshot = loopVisibilitySnapshotRef.current
      if (typeof snapshot.startedAtMs !== 'number') {
        return
      }

      const visibleMs = Math.max(0, Math.round(performance.now() - snapshot.startedAtMs))
      if (visibleMs >= LOOP_VIEW_METRIC_MIN_VISIBLE_MS) {
        void sendViewEvent({
          force: true,
          keepalive,
          metrics: {
            watchRatio: captureLoopWatchRatio(),
            replayCount: loopReplayCountRef.current,
            visibleMs,
          },
        })
      }

      loopVisibilitySnapshotRef.current = {
        startedAtMs: null,
        startedAtTop: null,
        startedAtEventTime: null,
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return
        }

        const visibleEnough = entry.isIntersecting && entry.intersectionRatio >= VIEW_TRACK_THRESHOLD
        const pageVisible = document.visibilityState === 'visible'

        if (visibleEnough && pageVisible) {
          if (isLoopVariant) {
            setIsLoopInViewport(true)
          }

          if (isLoopVariant) {
            loopVisibilitySnapshotRef.current = {
              startedAtMs: performance.now(),
              startedAtTop: entry.boundingClientRect.top,
              startedAtEventTime: entry.time,
            }
          }

          if (!viewTimerRef.current) {
            viewTimerRef.current = window.setTimeout(() => {
              clearViewTimer()
              void sendViewEvent()
            }, VIEW_TRACK_DELAY_MS)
          }
          return
        }

        if (isLoopVariant) {
          setIsLoopInViewport(false)
          const snapshot = loopVisibilitySnapshotRef.current
          const startedAtMs = snapshot.startedAtMs
          const startedAtTop = snapshot.startedAtTop
          const startedAtEventTime = snapshot.startedAtEventTime

          if (
            typeof startedAtMs === 'number' &&
            typeof startedAtTop === 'number' &&
            typeof startedAtEventTime === 'number'
          ) {
            const nowMs = performance.now()
            const visibleMs = Math.max(0, Math.round(nowMs - startedAtMs))
            const deltaTop = Math.abs(entry.boundingClientRect.top - startedAtTop)
            const deltaEventTime = Math.max(1, entry.time - startedAtEventTime)
            const swipeVelocity = Number(
              ((deltaTop / deltaEventTime) * 1000).toFixed(2),
            )
            const watchRatio = captureLoopWatchRatio()
            const replayCount = loopReplayCountRef.current

            if (visibleMs >= LOOP_VIEW_METRIC_MIN_VISIBLE_MS) {
              void sendViewEvent({
                force: true,
                metrics: {
                  watchRatio,
                  replayCount,
                  swipeVelocity,
                  visibleMs,
                },
              })
            }
          }

          loopVisibilitySnapshotRef.current = {
            startedAtMs: null,
            startedAtTop: null,
            startedAtEventTime: null,
          }
        }

        clearViewTimer()
      },
      {
        threshold: [0, VIEW_TRACK_THRESHOLD],
      },
    )

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') {
        clearViewTimer()
        flushLoopViewMetrics({ keepalive: true })
      }
    }

    function handlePageHide() {
      clearViewTimer()
      flushLoopViewMetrics({ keepalive: true })
    }

    observer.observe(articleRef.current)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      clearViewTimer()
      flushLoopViewMetrics({ keepalive: true })
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [isLoopVariant, postId, post?._recommendation])

  useEffect(() => {
    if (!isLoopInViewport || !isLoopCardActive) {
      setIsLoopManuallyPaused(false)
    }
  }, [isLoopInViewport, isLoopCardActive])

  useEffect(() => {
    if (!isLoopVariant) {
      return undefined
    }

    const video = loopVideoRef.current
    if (!video) {
      return undefined
    }

    const shouldPlay =
      !reducedDataMode &&
      isLoopInViewport &&
      isLoopCardActive &&
      document.visibilityState === 'visible' &&
      !isLoopPressPaused &&
      !isLoopManuallyPaused
    video.muted = isLoopMuted || !isLoopInViewport

    if (!shouldPlay) {
      if (!video.paused) {
        video.pause()
      }
      return undefined
    }

    video.play().catch(() => {})
    return undefined
  }, [isLoopCardActive, isLoopInViewport, isLoopManuallyPaused, isLoopMuted, isLoopPressPaused, isLoopVariant, postId, reducedDataMode])

  useEffect(() => {
    if (!isLoopVariant || typeof document === 'undefined') {
      return undefined
    }

    const video = loopVideoRef.current
    if (!video) {
      return undefined
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState === 'visible' &&
        !reducedDataMode &&
        isLoopInViewport &&
        isLoopCardActive &&
        !isLoopPressPaused
      ) {
        video.play().catch(() => {})
        return
      }

      if (!video.paused) {
        video.pause()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isLoopCardActive, isLoopInViewport, isLoopPressPaused, isLoopVariant, postId, reducedDataMode])

  async function runPostAction(actionName, action) {
    if (!isAuthenticated || pendingAction) {
      return
    }

    setPendingAction(actionName)

    try {
      const payload = await action(postId, getSafeRecommendationContext(post?._recommendation))
      setLocalPost(payload.post)
    } finally {
      setPendingAction('')
    }
  }

  async function trackShareIfPossible() {
    if (!isAuthenticated || localPost.sharedByViewer || pendingAction === 'share') {
      return
    }

    try {
      await runPostAction('share', togglePostShare)
    } catch {
      // Share analytics should not block user-facing share flow.
    }
  }

  async function handleShareCopyLink() {
    try {
      await copyTextToClipboard(sharePayload.url)
      setToast({ message: t('common.shareActions.linkCopied'), tone: 'success' })
      setIsShareMenuOpen(false)
      void trackShareIfPossible()
    } catch {
      setToast({ message: t('common.shareActions.copyFailed'), tone: 'error' })
    }
  }

  function handleShareToPlatform(platformKey) {
    const targetUrl = shareTargets[platformKey]

    if (!targetUrl) {
      return
    }

    if (typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    }

    setToast({ message: t('common.shareActions.platformOpened'), tone: 'success' })
    setIsShareMenuOpen(false)
    void trackShareIfPossible()
  }

  function handleShareButtonClick() {
    if (!sharePayload.url || isShareProcessing) {
      return
    }

    setIsShareMenuOpen((currentState) => !currentState)
  }

  function focusQuickCommentInput() {
    quickCommentTextareaRef.current?.focus()
  }

  async function openQuickComments() {
    setIsCommentsOpen(true)

    if (quickComments.length) {
      return
    }

    setIsCommentsLoading(true)

    try {
      const payload = await getPostDetail(postId)
      setQuickComments(payload.comments || [])
      setLocalPost(payload.post || localPost)
    } finally {
      setIsCommentsLoading(false)
    }
  }

  useEffect(() => {
    if (!isCommentsOpen || typeof window === 'undefined') {
      return undefined
    }

    function handleEscape(event) {
      if (event.key !== 'Escape') {
        return
      }

      setIsCommentsOpen(false)
      setReplyTargetId(null)
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isCommentsOpen])

  async function handleSubmitComment() {
    if (!isAuthenticated) {
      return
    }

    if (editingCommentId && !commentDraft.trim()) {
      return
    }

    if (!editingCommentId && (!commentDraft.trim() && !commentFile)) {
      return
    }

    setIsCommentSubmitting(true)
    setCommentSubmitError('')

    try {
      if (editingCommentId) {
        const payload = await updateComment(editingCommentId, { text: commentDraft.trim() })
        setQuickComments((current) => updateCommentInTree(current, payload.comment))
      } else {
        let body = {
          text: commentDraft.trim(),
          ...(replyTargetId ? { parentCommentId: replyTargetId } : {}),
        }
        if (commentFile) {
          const formData = new FormData()
          formData.set('text', commentDraft.trim())
          if (replyTargetId) formData.set('parentCommentId', replyTargetId)
          formData.append('media', commentFile)
          body = formData
        }
        const payload = await createComment(postId, body)

        setQuickComments((current) =>
          replyTargetId
            ? appendReplyToTree(current, replyTargetId, payload.comment)
            : [payload.comment, ...current],
        )
        setLocalPost((current) => ({
          ...current,
          stats: {
            ...current.stats,
            comments: payload.postStats.comments,
          },
        }))
      }
      setCommentDraft('')
      clearCommentMedia()
      setReplyTargetId(null)
      setEditingCommentId(null)
      setCommentSubmitError('')
    } catch (error) {
      setCommentSubmitError(error?.message || t('postDetail.submitCommentError'))
    } finally {
      setIsCommentSubmitting(false)
    }
  }

  async function handleCommentLike(targetComment) {
    if (!isAuthenticated) {
      return
    }

    const payload = await toggleCommentLike(targetComment.id || targetComment._id)
    setQuickComments((current) => updateCommentInTree(current, payload.comment))
  }

  function handleRequestDeleteComment(comment) {
    setPendingDeleteComment(comment)
    setActiveCommentMenuId(null)
  }

  async function handleConfirmDeleteComment() {
    const targetCommentId = pendingDeleteComment?.id || pendingDeleteComment?._id
    if (!targetCommentId) {
      setPendingDeleteComment(null)
      return
    }

    try {
      const payload = await deleteComment(targetCommentId)
      setQuickComments((current) => removeCommentFromTree(current, targetCommentId))
      setLocalPost((current) => ({
        ...current,
        stats: {
          ...current?.stats,
          comments: payload?.postStats?.comments ?? Math.max(0, Number(current?.stats?.comments ?? 0) - 1),
        },
      }))
    } catch (error) {
      setToast({ message: error?.message || t('postDetail.submitCommentError'), tone: 'error' })
    } finally {
      setPendingDeleteComment(null)
    }
  }

  function handleOpenCommentReport(comment) {
    const targetCommentId = comment?.id || comment?._id
    if (!targetCommentId) {
      return
    }

    setActiveCommentMenuId(null)
    setReportTarget({ kind: 'comment', id: targetCommentId })
    setIsReportOpen(true)
  }

  async function handleEditPost() {
    setIsMenuOpen(false)
    setEditDraft(content || '')
    setEditMediaItems(Array.isArray(mediaItems) ? mediaItems : [])
    setIsEditModalOpen(true)
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(new Error('Dosya okunamadi.'))
      reader.readAsDataURL(file)
    })
  }

  async function handleEditImageSelection(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    if (editMediaItems.some((item) => item?.type === 'video')) {
      setToast({ message: 'Video bulunan gonderiye foto eklemek icin once videoyu kaldirin.', tone: 'error' })
      return
    }

    const availableSlots = Math.max(0, 4 - editMediaItems.length)
    const nextFiles = files.slice(0, availableSlots)
    if (!nextFiles.length) {
      setToast({ message: 'En fazla 4 gorsel ekleyebilirsiniz.', tone: 'error' })
      return
    }

    try {
      const nextItems = await Promise.all(
        nextFiles.map(async (file) => ({
          type: 'image',
          url: await readFileAsDataUrl(file),
          name: file.name,
        })),
      )
      setEditMediaItems((current) => [...current, ...nextItems])
    } catch (error) {
      setToast({ message: error?.message || 'Gorsel eklenemedi.', tone: 'error' })
    }
  }

  async function handleEditVideoSelection(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (editMediaItems.length > 0) {
      setToast({ message: 'Video eklemek icin mevcut medyalari kaldirin.', tone: 'error' })
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setEditMediaItems([{ type: 'video', url: dataUrl, name: file.name }])
    } catch (error) {
      setToast({ message: error?.message || 'Video eklenemedi.', tone: 'error' })
    }
  }

  async function handleSaveEditedPost() {
    const nextText = `${editDraft || ''}`.trim()

    if (!nextText || nextText === content.trim()) {
      setIsEditModalOpen(false)
      return
    }

    setIsEditSubmitting(true)
    try {
      const payload = await updatePost(postId, {
        text: nextText,
        media: editMediaItems,
      })
      setLocalPost(payload.post)
      setIsEditModalOpen(false)
    } finally {
      setIsEditSubmitting(false)
    }
  }

  async function handleArchivePost() {
    setIsMenuOpen(false)
    const payload = await togglePostArchive(postId)
    setLocalPost(payload.post)
  }

  async function handleDeletePost() {
    setIsMenuOpen(false)
    const shouldDelete = window.confirm('Bu gonderiyi silmek istiyor musun?')

    if (!shouldDelete) {
      return
    }

    await deletePost(postId)
    setLocalPost((current) => ({
      ...current,
      deleted: true,
    }))
  }

  async function handleMarkNotInterested() {
    if (!isAuthenticated || !postId) {
      setToast({
        message: t('common.loginRequired', { defaultValue: 'Bu islem icin giris yapmalisin.' }),
        tone: 'warning',
      })
      return
    }

    try {
      setPendingAction('not-interested')
      setIsMenuOpen(false)
      setIsLoopOptionsMenuOpen(false)
      await markPostNotInterested(postId, getSafeRecommendationContext(post?._recommendation))
      if (typeof onPostHidden === 'function') {
        onPostHidden(postId, {
          message: t('postDetail.notInterestedSuccess', { defaultValue: 'Bu tur icerikleri size daha az gosterecegiz.' }),
          tone: 'success',
        })
      }
    } catch (error) {
      setToast({
        message: error.message || t('postDetail.notInterestedFailed', { defaultValue: 'Tercih guncellenemedi.' }),
        tone: 'error',
      })
    } finally {
      setPendingAction('')
    }
  }

  function openPostDetail(initialMediaIndex = 0) {
    const safeMediaIndex = Number.isFinite(initialMediaIndex) && initialMediaIndex >= 0 ? initialMediaIndex : 0

    if (isLoopFeedContent) {
      navigate(`/${lang}/loop?post=${encodeURIComponent(postId)}`)
      return
    }

    const currentPath = `${location.pathname || ''}`.trim()
    const isHomePath = currentPath === `/${lang}` || currentPath === `/${lang}/`
    const isProfilePath =
      currentPath === `/${lang}/profile` ||
      currentPath.startsWith(`/${lang}/u/`)
    const detailState = { mediaIndex: safeMediaIndex }

    if (isHomePath || isProfilePath) {
      detailState.backgroundLocation = location
      detailState.openedFromFeed = true
    }

    const safeSlug = `${localPost?.slug || ''}`.trim()
    const detailPath = safeSlug
      ? `/${lang}/posts/${postId}/${encodeURIComponent(safeSlug)}`
      : `/${lang}/posts/${postId}`

    navigate(`${detailPath}?media=${safeMediaIndex + 1}`, {
      state: detailState,
    })
  }

  function handleOpenPostDetailFromComments(_, index) {
    setIsCommentsOpen(false)
    setReplyTargetId(null)
    openPostDetail(index)
  }

  function handleTopicNavigate(topic) {
    navigate(`/${lang}?topic=${encodeURIComponent(topic)}`)
  }

  function handleMentionNavigate(mention) {
    navigate(`/${lang}/u/${mention.replace(/^@/, '')}`)
  }

  function handleAuthorAvatarClick(event) {
    if (!canOpenAuthorStory) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onOpenAuthorStory(author.username)
  }

  function renderLoopActionButtons(isDesktop) {
    return (
      <>
        <LoopVerticalActionButton
          icon={<HeartIcon filled={Boolean(localPost.likedByViewer)} />}
          count={likes}
          label={t('common.like')}
          onClick={() => runPostAction('like', togglePostLike)}
          onCountClick={() => setIsLikesModalOpen(true)}
          active={Boolean(localPost.likedByViewer)}
          disabled={!isAuthenticated || pendingAction === 'like'}
          isDesktop={isDesktop}
        />
        <LoopVerticalActionButton
          icon={<CommentIcon />}
          count={comments}
          label={t('common.comment')}
          onClick={openQuickComments}
          isDesktop={isDesktop}
        />
        <LoopVerticalActionButton
          icon={<BookmarkIcon filled={Boolean(localPost.savedByViewer)} />}
          count={saves}
          label={t('common.save')}
          onClick={() => runPostAction('save', togglePostSave)}
          active={Boolean(localPost.savedByViewer)}
          disabled={!isAuthenticated || pendingAction === 'save'}
          isDesktop={isDesktop}
        />
        <div ref={shareMenuRef} data-share-menu="true" className="relative">
          <LoopVerticalActionButton
            icon={<ShareIcon />}
            count={shares}
            label={t('common.share')}
            onClick={handleShareButtonClick}
            active={Boolean(localPost.sharedByViewer)}
            disabled={isShareProcessing || pendingAction === 'share'}
            isDesktop={isDesktop}
          />
          <ShareMenuPopover
            open={isShareMenuOpen}
            onClose={() => setIsShareMenuOpen(false)}
            sharePayload={sharePayload}
            shareTargets={shareTargets}
            isMobile={isMobileViewport}
            variant="loop"
            onTrackShare={trackShareIfPossible}
            onShowToast={setToast}
          />
        </div>
        <div ref={loopOptionsMenuRef} data-loop-options-menu="true" className="relative">
          <LoopVerticalActionButton
            icon={<MoreIcon />}
            count=""
            label={t('postDetail.postOptions', { defaultValue: 'Icerik secenekleri' })}
            onClick={() => setIsLoopOptionsMenuOpen((current) => !current)}
            disabled={!isAuthenticated}
            isDesktop={isDesktop}
          />
          {isLoopOptionsMenuOpen ? (
            <div
              className={`absolute bottom-0 z-30 w-56 rounded-2xl border border-border bg-card/95 p-2 shadow-[0_20px_45px_rgba(15,23,42,0.22)] backdrop-blur-md ${
                isDesktop ? 'left-full ml-2.5' : 'right-full mr-2'
              }`}
            >
              {canViewInsights ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsLoopOptionsMenuOpen(false)
                    setIsInsightsModalOpen(true)
                  }}
                  className="mb-1 flex w-full items-center gap-2 rounded-xl cursor-pointer px-3 py-2 text-left text-sm font-semibold text-text transition hover:bg-secondary"
                >
                  <span className="text-base leading-none">📊</span>
                  <span>{t('insights.viewInsights', { defaultValue: 'İstatistikleri Gör' })}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleMarkNotInterested}
                disabled={!isAuthenticated || pendingAction === 'not-interested'}
                className="flex w-full items-center justify-between rounded-xl cursor-pointer px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary disabled:opacity-60"
              >
                <span>{t('postDetail.notInterested', { defaultValue: 'Ilgilenmiyorum' })}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLoopOptionsMenuOpen(false)
                  setIsReportOpen(true)
                }}
                className="mt-1 flex w-full items-center justify-between rounded-xl cursor-pointer px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
              >
                <span>{t('postDetail.reportContent')}</span>
              </button>
            </div>
          ) : null}
        </div>
        {canViewInsights ? (
          isDesktop ? (
            <button
              type="button"
              onClick={() => setIsInsightsModalOpen(true)}
              className="grid size-11 place-items-center rounded-full border border-border bg-card/90 text-text shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer hover:bg-secondary hover:text-primary"
              aria-label={t('insights.viewInsights', { defaultValue: 'İstatistikleri Gör' })}
              title={t('insights.viewInsights', { defaultValue: 'İstatistikleri Gör' })}
            >
              <EyeIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsInsightsModalOpen(true)}
              className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-white hover:text-primary transition cursor-pointer group"
              aria-label={t('insights.viewInsights', { defaultValue: 'İstatistikleri Gör' })}
              title={t('insights.viewInsights', { defaultValue: 'İstatistikleri Gör' })}
            >
              <EyeIcon />
              <span className="text-[10px] font-semibold leading-none group-hover:underline">
                {formatViewCount(views, lang === 'tr' ? 'tr-TR' : 'en-US')}
              </span>
            </button>
          )
        ) : !isDesktop ? (
          <div
            className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-white/70"
            aria-label={t('postDetail.viewCountLabel')}
            title={t('postDetail.viewCountLabel')}
          >
            <EyeIcon />
            <span className="text-[10px] font-semibold leading-none">
              {formatViewCount(views, lang === 'tr' ? 'tr-TR' : 'en-US')}
            </span>
          </div>
        ) : null}
      </>
    )
  }

  if (localPost.deleted) {
    return null
  }

  return (
    <>
      <article
        ref={articleRef}
        className={`rounded-0 border border-border bg-card shadow-sm transition hover:shadow-md ${
          isLoopMobileVariant
            ? 'overflow-hidden border-0 bg-black shadow-none hover:shadow-none'
            : isLoopDesktopVariant
              ? 'overflow-visible border-0 bg-transparent shadow-none hover:shadow-none'
              : 'feed-post-render-boundary md:rounded-lg'
        }`}
      >
        <div className="flex-row items-start gap-3">
          

          <div className="min-w-0 flex-1 ">
            <div className={`flex items-start justify-between gap-3 px-4 ${isLoopVariant ? 'hidden' : 'pt-4'}`}>
              <div className="flex items-start justify-between gap-3">
              <Link
                to={`/${lang}/u/${author.username || ''}`}
                className="shrink-0 transition hover:scale-[1.02]"
                onClick={handleAuthorAvatarClick}
              >
                {groupHeaderName && groupHeaderCoverUrl ? (
                  <div className="relative h-14 w-20">
                    <img
                      src={groupHeaderCoverUrl}
                      alt={groupHeaderName}
                      className="h-14 w-20 rounded-lg object-cover"
                    />
                    <div className={`absolute -bottom-2 -right-2 rounded-full p-[2px] ${hasAuthorStory ? 'bg-gradient-to-br from-pink-500 via-amber-400 to-violet-500' : 'bg-card'}`}>
                      <UserAvatar
                        user={author}
                        className="size-8 border border-card text-[11px] font-semibold"
                        textClassName="text-[11px] font-semibold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-full p-[2px] ${hasAuthorStory ? 'bg-gradient-to-br from-pink-500 via-amber-400 to-violet-500' : 'bg-transparent'}`}>
                    <UserAvatar
                      user={author}
                      className="size-11 border-2 border-card text-sm font-semibold"
                      textClassName="text-sm font-semibold"
                    />
                  </div>
                )}
              </Link>
              <div className="min-w-0 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    {groupHeaderName ? (
                      <p className="truncate text-sm font-semibold text-text">{groupHeaderName}</p>
                    ) : null}
                    <Link
                      to={`/${lang}/u/${author.username || ''}`}
                      className="min-w-0"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 font-semibold text-base">
                        <span className="truncate">{author.name || getFullName(author)}</span>
                        <VerifiedBadge user={author} />
                      </span>
                    </Link>
                  </div>
                  {canFollowAuthor ? (
                    <button
                      type="button"
                      onClick={handleLoopFollowToggle}
                      disabled={isFollowProcessing}
                      className={`shrink-0 rounded-lg cursor-pointer  border px-2.5 py-1 text-[11px] font-semibold transition ${
                        isAuthorFollowed
                          ? 'border-border bg-secondary text-text hover:bg-secondary-hover'
                          : 'border-primary/45 bg-primary/10 text-primary hover:bg-primary/15'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {isFollowProcessing
                        ? '...'
                        : isAuthorFollowed
                          ? unfollowLabelText
                          : followLabelText}
                    </button>
                  ) : null}
                </div>
                <div>
                  <span className="text-sm text-muted">@{author.username}</span>
                  <span className="text-sm text-muted">
                    {' '}
                    - {formatRelativeTime(localPost.createdAt)}
                  </span>
                </div>
              </div>
              </div>
              

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((current) => !current)}
                  className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
                  aria-label={t('postDetail.postOptions')}
                >
                  <MoreIcon />
                </button>

                {isMenuOpen ? (
                  <div className="dropdown-pop absolute right-0 top-[calc(100%+8px)] z-20 w-48 rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                    {isOwnPost ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false)
                            setIsInsightsModalOpen(true)
                          }}
                          className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-text transition hover:bg-secondary cursor-pointer"
                        >
                          <span className="text-base leading-none">📊</span>
                          <span>{t('insights.viewInsights', { defaultValue: 'İstatistikleri Gör' })}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleEditPost}
                          className="flex w-full rounded-2xl px-3 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                        >
                          {t('postDetail.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={handleArchivePost}
                          className="flex w-full rounded-2xl px-3 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                        >
                          Arsive kaldir
                        </button>
                        <button
                          type="button"
                          onClick={handleDeletePost}
                          className="flex w-full rounded-2xl px-3 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:hover:bg-zinc-900"
                        >
                          {t('postDetail.delete')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleMarkNotInterested}
                          disabled={!isAuthenticated || pendingAction === 'not-interested'}
                          className="flex w-full rounded-lg cursor-pointer px-3 py-2.5 text-left text-sm text-text transition hover:bg-secondary disabled:opacity-60"
                        >
                          {t('postDetail.notInterested', { defaultValue: 'İlgilenmiyorum' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false)
                            setIsReportOpen(true)
                          }}
                          className="mt-1 flex w-full rounded-lg cursor-pointer px-3 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                        >
                          {t('postDetail.reportContent')}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {(groupHeaderName && localPost?.title) ? (
              <div className={`mt-1 px-4 ${isLoopVariant ? 'hidden' : ''}`}>
                <p className="text-sm font-semibold tracking-tight text-text">{localPost.title}</p>
              </div>
            ) : null}

            {content ? (
              <div className={`mt-1 px-4 ${isLoopVariant ? 'hidden' : ''}`}>
                {isExpandedText ? (
                  <>
                    <p className="w-full text-left text-[15px] leading-7 font-normal text-text whitespace-pre-line break-words">
                      <HashtagText
                        text={content}
                        onHashtagClick={handleTopicNavigate}
                        onMentionClick={handleMentionNavigate}
                      />
                    </p>
                    {shouldCollapseInline ? (
                      <p
                        type="button"
                        onClick={() => setIsExpandedText(false)}
                        className="mt-1 text-base font-normal text-primary cursor-pointer"
                      >
                        {t('postDetail.less')}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div>
                    <p className="w-full text-left text-[15px] leading-7 text-text font-normal whitespace-pre-line break-words">
                      <span className={shouldCollapseInline ? 'line-clamp-2' : ''}>
                        <HashtagText
                          text={shouldCollapseInline ? collapsedInlineContent : content}
                          onHashtagClick={handleTopicNavigate}
                          onMentionClick={handleMentionNavigate}
                        />
                        {shouldCollapseInline ? ' ' : null}
                        {shouldCollapseInline ? (
                          <button
                            type="button"
                            onClick={() => setIsExpandedText(true)}
                            className="inline text-sm font-medium text-primary cursor-pointer decoration-transparent underline-offset-2"
                          >
                            {t('postDetail.more')}
                          </button>
                        ) : null}
                      </span>{' '}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {mediaItems.length ? (
              <div className="relative">
                {isLoopVariant && loopVideoItem ? (
                  <div
                    className={`relative w-full ${
                      isLoopDesktopVariant
                        ? 'mx-auto my-1 flex items-center justify-center'
                        : 'h-[calc(100dvh-56px)] bg-black'
                    }`}
                  >
                    <div className="relative">
                      {/* 9:16 Video Frame */}
                      <div
                        className={`group relative overflow-hidden bg-black ${
                          isLoopDesktopVariant
                            ? 'h-[min(760px,calc(100vh-175px))] aspect-[9/16] w-auto max-w-[440px] rounded-[28px] border border-white/10 shadow-[0_28px_65px_rgba(0,0,0,0.45)]'
                            : 'h-[calc(100dvh-56px)] w-full'
                        }`}
                      >
                        {/* Ambient Blurred Background Glow */}
                        {loopPosterUrl ? (
                          <div
                            className="pointer-events-none absolute inset-0 size-full overflow-hidden"
                            aria-hidden="true"
                          >
                            <img
                              src={loopPosterUrl}
                              alt=""
                              className="size-full object-cover opacity-35 blur-2xl scale-125"
                            />
                          </div>
                        ) : null}

                        {isLoopProcessing ? (
                          <div className="relative grid size-full place-items-center bg-black/70 text-white overflow-hidden">
                            <div className="relative z-10 px-6 text-center">
                              <span className="mx-auto block size-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                              <p className="mt-4 text-sm font-semibold">Video işleniyor</p>
                              <p className="mt-1 text-xs text-white/65">
                                %{Math.max(0, Math.min(99, Number(loopVideoItem.processingProgress || 0)))} tamamlandı
                              </p>
                            </div>
                          </div>
                        ) : (
                          <video
                            ref={loopVideoRef}
                            src={loopVideoSourceUrl || undefined}
                            poster={loopPosterUrl || undefined}
                            className="relative size-full object-cover"
                            muted={isLoopMuted || !isLoopInViewport}
                            draggable={false}
                            onContextMenu={handleLoopVideoContextMenu}
                            onDragStart={handleLoopVideoContextMenu}
                            playsInline
                            style={{
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              WebkitUserDrag: 'none',
                              userSelect: 'none',
                              touchAction: 'pan-y',
                            }}
                            preload={
                              reducedDataMode
                                ? 'none'
                                : isLoopInViewport || loopPreloadMode === 'active' || loopPreloadMode === 'next'
                                ? 'auto'
                                : 'none'
                            }
                            onClick={handleLoopVideoClick}
                            onPointerDown={handleLoopPressStart}
                            onPointerUp={handleLoopPressEnd}
                            onPointerCancel={handleLoopPressEnd}
                            onPointerLeave={handleLoopPressEnd}
                            onTimeUpdate={handleLoopVideoTimeUpdate}
                            onPlaying={handleLoopVideoPlaying}
                            onPause={() => setIsLoopPlaying(false)}
                            onWaiting={handleLoopVideoWaiting}
                            onStalled={handleLoopVideoStalled}
                            onError={handleLoopVideoError}
                            onEnded={handleLoopVideoEnded}
                          />
                        )}

                        {heartBursts.map((burst) => (
                          <div
                            key={burst.id}
                            className="pointer-events-none absolute z-40 text-rose-500 drop-shadow-[0_8px_25px_rgba(244,63,94,0.85)] loop-heart-burst"
                            style={{
                              left: burst.x != null ? `${burst.x}px` : '50%',
                              top: burst.y != null ? `${burst.y}px` : '50%',
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="size-24" aria-hidden="true">
                              <path d="m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
                            </svg>
                          </div>
                        ))}

                        {isLoopMuteHintVisible ? (
                          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-2xl backdrop-blur-sm transition-all duration-300">
                            {isLoopMuted ? (
                              <VolumeOffIcon className="size-9" />
                            ) : (
                              <VolumeOnIcon className="size-9" />
                            )}
                          </div>
                        ) : null}

                        {!isLoopProcessing && reducedDataMode && !isLoopPlaying && !loopPlaybackError ? (
                          <button
                            type="button"
                            onClick={handleLoopVideoClick}
                            className="absolute left-1/2 top-1/2 z-30 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/60 text-white shadow-xl backdrop-blur transition hover:bg-black/75"
                            aria-label="Videoyu oynat"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="size-8" aria-hidden="true">
                              <path d="m9 7 8 5-8 5V7Z" />
                            </svg>
                          </button>
                        ) : null}

                        {loopPlaybackError ? (
                          <div className="absolute inset-x-3 bottom-24 z-30 rounded-xl border border-white/20 bg-black/65 px-3 py-2.5 text-xs text-white backdrop-blur">
                            <p>{loopPlaybackError}</p>
                            <button
                              type="button"
                              onClick={handleLoopManualRetry}
                              className="mt-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-zinc-900 transition hover:bg-white"
                            >
                              Tekrar dene
                            </button>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={handleLoopMuteToggle}
                          className={`absolute z-20 inline-flex min-h-10 min-w-10 items-center gap-2 rounded-full px-3 text-xs font-semibold border border-white/15 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 ${
                            isLoopMobileVariant
                              ? `left-3 top-14 ${isLoopMuteHintVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`
                              : 'left-4 top-4'
                          }`}
                          aria-label={isLoopMuted ? 'Sesi aç' : 'Sesi kapat'}
                        >
                          {isLoopMuted ? <VolumeOffIcon className="size-4" /> : <VolumeOnIcon className="size-4" />}
                        </button>

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/90 to-transparent" />
                        <div
                          className={`absolute left-0 right-0 z-20 pb-2 pt-3 ${
                            isLoopMobileVariant ? 'bottom-[20px] pl-4 pr-16' : 'bottom-[18px] pl-5 pr-5'
                          } ${
                            isLoopCaptionExpanded ? 'bg-black/75 backdrop-blur-sm' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              to={`/${lang}/u/${author.username || ''}`}
                              className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-md text-sm font-semibold text-white transition hover:text-white/80"
                              onClick={handleAuthorAvatarClick}
                            >
                              <div className={`rounded-full p-[2px] ${hasAuthorStory ? 'bg-gradient-to-br from-pink-500 via-amber-400 to-violet-500' : 'bg-transparent'}`}>
                                <UserAvatar
                                  user={author}
                                  className="size-8 shrink-0 border-2 border-black text-[11px] font-semibold"
                                  textClassName="text-[11px] font-semibold"
                                />
                              </div>
                              <span className="flex min-w-0 items-center gap-1 text-white/90">
                                <span className="truncate">{author.name || getFullName(author)}</span>
                                <VerifiedBadge user={author} size="xs" />
                              </span>
                            </Link>
                            {canFollowAuthor ? (
                              <button
                                type="button"
                                onClick={handleLoopFollowToggle}
                                disabled={isFollowProcessing}
                                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                                  isAuthorFollowed
                                    ? 'border-white/25 bg-white/15 text-white hover:bg-white/20'
                                    : 'border-white/45 bg-white text-black hover:bg-white/90'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                {isFollowProcessing
                                  ? '...'
                                  : isAuthorFollowed
                                    ? unfollowLabelText
                                    : followLabelText}
                              </button>
                            ) : null}
                          </div>
                          {isLoopCaptionExpanded ? (
                            <div
                              className="mt-1 text-base leading-7 font-normal text-white/90 whitespace-pre-line break-words max-h-84 overflow-y-auto pr-1"
                            >
                              {localPost?.title ? (
                                <p className="mb-1 text-sm font-semibold tracking-tight text-white">{localPost.title}</p>
                              ) : null}
                              <span>{content}</span>
                              {loopCaptionNeedsTruncate ? (
                                <button
                                  type="button"
                                  onClick={() => setIsLoopCaptionExpanded(false)}
                                  className="ml-1 inline font-semibold text-white underline decoration-transparent underline-offset-2 transition hover:text-white/75"
                                >
                                  {t('postDetail.less')}
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <div className="mt-1 flex items-center gap-1 text-base leading-5 text-white/90">
                              <span className="min-w-0 flex-1 truncate">{loopCaptionPreview}</span>
                              {loopCaptionNeedsTruncate ? (
                                <button
                                  type="button"
                                  onClick={() => setIsLoopCaptionExpanded(true)}
                                  className="shrink-0 font-semibold text-white underline decoration-transparent underline-offset-2 transition hover:text-white/75"
                                >
                                  {t('postDetail.more')}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </div>

                        {/* Mobile Action Buttons (inside video frame) */}
                        {isLoopMobileVariant ? (
                          <div className="absolute bottom-[55px] right-2 z-20 flex flex-col items-center gap-1">
                            {renderLoopActionButtons(false)}
                          </div>
                        ) : null}

                        {/* Loop Progress Bar */}
                        <div className="absolute bottom-[10px] left-3 right-3 z-20 h-1 md:hidden">
                          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-white/15">
                            <div
                              className="h-1 rounded-full bg-white/40 transition-[width] duration-150 ease-linear"
                              style={{ width: `${Math.round(loopProgressRatio * 100)}%` }}
                            />
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={Math.round(loopProgressRatio * 1000) / 10}
                            onInput={handleLoopProgressInput}
                            onChange={handleLoopProgressInput}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent opacity-0"
                            aria-label={t('postDetail.viewCountLabel')}
                          />
                        </div>
                      </div>

                      {/* Desktop Side Rail Action Buttons (outside video frame, on the right) */}
                      {isLoopDesktopVariant ? (
                        <div className="absolute bottom-4 left-[calc(100%+14px)] z-20 flex flex-col items-center gap-3">
                          {renderLoopActionButtons(true)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <Suspense fallback={null}>
                    <MediaGallery
                      items={mediaItems}
                      interactive
                      hoverPlayVideos
                      autoplayOnVisible
                      feedLayout
                      priority={prioritizeMedia}
                      className="w-full"
                      onItemClick={(_, index) => openPostDetail(index)}
                    />
                  </Suspense>
                )}
               
              </div>
            ) : null}

            {!isLoopVariant ? (
              <div className="flex items-center justify-between gap-3 py-1 px-4">
                <div className="flex flex-wrap items-center gap-1">
                  <InlineActionButton
                    icon={<HeartIcon filled={Boolean(localPost.likedByViewer)} />}
                    count={likes}
                    label={t('common.like')}
                    onClick={() => runPostAction('like', togglePostLike)}
                    onCountClick={() => setIsLikesModalOpen(true)}
                    active={Boolean(localPost.likedByViewer)}
                    disabled={!isAuthenticated || pendingAction === 'like'}
                  />
                  <InlineActionButton
                    icon={<CommentIcon />}
                    count={comments}
                    label={t('common.comment')}
                    onClick={openQuickComments}
                  />
                  <InlineActionButton
                    icon={<BookmarkIcon filled={Boolean(localPost.savedByViewer)} />}
                    count={saves}
                    label={t('common.save')}
                    onClick={() => runPostAction('save', togglePostSave)}
                    active={Boolean(localPost.savedByViewer)}
                    disabled={!isAuthenticated || pendingAction === 'save'}
                  />
                  <div ref={shareMenuRef} data-share-menu="true" className="relative">
                    <InlineActionButton
                      icon={<ShareIcon />}
                      count={shares}
                      label={t('common.share')}
                      onClick={handleShareButtonClick}
                      active={Boolean(localPost.sharedByViewer)}
                      disabled={isShareProcessing || pendingAction === 'share'}
                    />

                    <ShareMenuPopover
                      open={isShareMenuOpen}
                      onClose={() => setIsShareMenuOpen(false)}
                      sharePayload={sharePayload}
                      shareTargets={shareTargets}
                      isMobile={isMobileViewport}
                      variant="feed"
                      onTrackShare={trackShareIfPossible}
                      onShowToast={setToast}
                    />
                  </div>
                </div>

                {canViewInsights ? (
                  <button
                    type="button"
                    onClick={() => setIsInsightsModalOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition hover:underline cursor-pointer group"
                    aria-label={t('insights.viewInsights', { defaultValue: 'İstatistikleri Gör' })}
                    title={t('insights.viewInsights', { defaultValue: 'İstatistikleri Gör' })}
                  >
                    <EyeIcon />
                    <span>{formatViewCount(views, lang === 'tr' ? 'tr-TR' : 'en-US')}</span>
                    <span className="hidden sm:inline text-[10px] bg-secondary px-1.5 py-0.5 rounded font-medium text-muted group-hover:bg-primary/10 group-hover:text-primary transition">
                      {t('insights.viewInsights', { defaultValue: 'İstatistik' })}
                    </span>
                  </button>
                ) : (
                  <div
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted"
                    aria-label={t('postDetail.viewCountLabel')}
                    title={t('postDetail.viewCountLabel')}
                  >
                    <EyeIcon />
                    <span>{formatViewCount(views, lang === 'tr' ? 'tr-TR' : 'en-US')}</span>
                  </div>
                )}
              </div>
            ) : null}

            <QuickCommentsPanel
              open={isCommentsOpen}
              isMobile={isMobileCommentsPanel}
              lang={lang}
              t={t}
              author={author}
              postText={content}
              mediaItems={mediaItems}
              onTopicClick={handleTopicNavigate}
              onMentionClick={handleMentionNavigate}
              onMediaClick={handleOpenPostDetailFromComments}
              commentSort={commentSort}
              onSortChange={setCommentSort}
              likeCount={likes}
              commentCount={comments}
              saveCount={saves}
              shareCount={shares}
              viewCount={views}
              likedByViewer={Boolean(localPost.likedByViewer)}
              savedByViewer={Boolean(localPost.savedByViewer)}
              sharedByViewer={Boolean(localPost.sharedByViewer)}
              onLikePost={() => runPostAction('like', togglePostLike)}
              onLikeCountClick={() => setIsLikesModalOpen(true)}
              onCommentAction={focusQuickCommentInput}
              onSavePost={() => runPostAction('save', togglePostSave)}
              onShareAction={handleShareButtonClick}
              shareMenuOpen={isShareMenuOpen}
              shareMenuRef={shareMenuRef}
              shareProcessing={isShareProcessing}
              onShareCopyLink={handleShareCopyLink}
              onShareToPlatform={handleShareToPlatform}
              sharePayload={sharePayload}
              shareTargets={shareTargets}
              onShareClose={() => setIsShareMenuOpen(false)}
              onTrackShare={trackShareIfPossible}
              onShowToast={setToast}
              likeDisabled={!isAuthenticated || pendingAction === 'like'}
              saveDisabled={!isAuthenticated || pendingAction === 'save'}
              shareDisabled={pendingAction === 'share'}
              comments={sortedPanelComments}
              draft={commentDraft}
              onDraftChange={setCommentDraft}
              onSubmit={handleSubmitComment}
              onReply={(targetComment) => {
                setReplyTargetId(targetComment.id || targetComment._id)
                setEditingCommentId(null)
                setCommentSubmitError('')
              }}
              onEdit={(targetComment) => {
                setEditingCommentId(targetComment.id || targetComment._id)
                setReplyTargetId(null)
                setCommentDraft(targetComment.text || '')
                clearCommentMedia()
                setCommentSubmitError('')
              }}
              onLike={handleCommentLike}
              replyTarget={replyTarget}
              editingCommentId={editingCommentId}
              onCancelReply={() => {
                setReplyTargetId(null)
                setEditingCommentId(null)
                setCommentSubmitError('')
              }}
              onOpenMediaPicker={() => commentMediaInputRef.current?.click()}
              commentPreview={commentPreview}
              onClearMedia={clearCommentMedia}
              submitError={commentSubmitError}
              activeCommentMenuId={activeCommentMenuId}
              onToggleCommentMenu={setActiveCommentMenuId}
              onRequestDelete={handleRequestDeleteComment}
              onReportComment={handleOpenCommentReport}
              isSubmitting={isCommentSubmitting}
              canSubmit={canSubmitComment}
              disabled={!isAuthenticated}
              isLoading={isCommentsLoading}
              commentInputRef={quickCommentTextareaRef}
              onClose={() => {
                setIsCommentsOpen(false)
                setReplyTargetId(null)
                setEditingCommentId(null)
                setCommentSubmitError('')
                setActiveCommentMenuId(null)
              }}
            />
          </div>
        </div>
      </article>

      {isEditModalOpen ? (
        <Suspense fallback={null}>
          <PostEditModal
            open={isEditModalOpen}
            author={author}
            t={t}
            isSubmitting={isEditSubmitting}
            draft={editDraft}
            onDraftChange={setEditDraft}
            mediaItems={editMediaItems}
            onRemoveMediaItem={(index) =>
              setEditMediaItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
            onSelectImages={handleEditImageSelection}
            onSelectVideo={handleEditVideoSelection}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleSaveEditedPost}
          />
        </Suspense>
      ) : null}

      {isReportOpen ? (
        <Suspense fallback={null}>
          <ReportDialog
            open={isReportOpen}
            targetKind={reportTarget.kind}
            targetId={reportTarget.id || postId}
            title={reportTarget.kind === 'comment' ? 'Report comment' : 'Report post'}
            onClose={() => {
              setIsReportOpen(false)
              setReportTarget({ kind: 'post', id: null })
            }}
          />
        </Suspense>
      ) : null}

      {pendingDeleteComment ? (
        <Suspense fallback={null}>
          <ConfirmActionDialog
            open={Boolean(pendingDeleteComment)}
            mode="delete"
            title={t('postDetail.deleteCommentTitle')}
            description={t('postDetail.deleteCommentConfirm')}
            confirmLabel={t('postDetail.delete')}
            cancelLabel={t('postDetail.cancel')}
            showReasonField={false}
            onConfirm={handleConfirmDeleteComment}
            onClose={() => setPendingDeleteComment(null)}
          />
        </Suspense>
      ) : null}

      <Lightbox
        items={mediaItems}
        activeIndex={lightboxIndex}
        onChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />

      {isLikesModalOpen ? (
        <PostLikesModal
          open={isLikesModalOpen}
          onClose={() => setIsLikesModalOpen(false)}
          postId={postId}
          initialCount={likes}
          isMobile={isMobileViewport}
          lang={lang}
        />
      ) : null}

      {isInsightsModalOpen ? (
        <PostInsightsModal
          open={isInsightsModalOpen}
          onClose={() => setIsInsightsModalOpen(false)}
          postId={postId}
          isMobile={isMobileViewport}
          lang={lang}
        />
      ) : null}

      <ActionToast
        toast={toast}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
      <input
        ref={commentMediaInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleCommentMediaChange}
        className="hidden"
      />
    </>
  )
}

export default memo(PostCard)
