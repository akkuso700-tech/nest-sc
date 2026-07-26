import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Seo from '../../components/seo/Seo.jsx'
import UserAvatar from '../../components/common/UserAvatar.jsx'
import HashtagText from '../../components/common/HashtagText.jsx'
import ActionToast from '../../components/feedback/ActionToast.jsx'
import { resolveMediaUrl, resolveMediaUrlCandidates } from '../../utils/media.js'
import {
  buildPostSharePayload,
  buildShareTargets,
  copyTextToClipboard,
  isMobileShareSupported,
  shareWithNative,
} from '../../utils/postShare.js'
import {
  createComment,
  deleteComment,
  getPostDetail,
  toggleCommentLike,
  togglePostLike,
  togglePostSave,
  togglePostShare,
  updateComment,
} from '../../services/postsService.js'
import { getConversations } from '../../services/messagesService.js'
import { getNotifications } from '../../services/notificationsService.js'
import { connectSocketClient, disconnectSocketClient } from '../../services/socketClient.js'
import { formatRelativeTime, getFullName } from '../../utils/social.js'
import { useAuth } from '../../store/AuthContext.jsx'

const ReportDialog = lazy(() => import('../../components/feedback/ReportDialog.jsx'))
const ConfirmActionDialog = lazy(() => import('../../components/feedback/ConfirmActionDialog.jsx'))

function Icon({ path, className = 'size-5', strokeWidth = 1.8, fill = 'none' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  )
}

function CloseIcon() {
  return <Icon path={<path d="m6 6 12 12M18 6 6 18" />} />
}

function PlusIcon() {
  return <Icon path={<path d="M12 5v14M5 12h14" />} />
}

function MinusIcon() {
  return <Icon path={<path d="M5 12h14" />} />
}

function ChevronIcon({ direction = 'right', className = 'size-6' }) {
  return <Icon className={className} path={<path d={direction === 'right' ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />} />
}

function HeartIcon({ filled = false, className = 'size-5' }) {
  return <Icon className={className} fill={filled ? 'currentColor' : 'none'} path={<path d="M12 20s-6.8-4.5-8.7-8.2A5.1 5.1 0 0 1 12 5.6a5.1 5.1 0 0 1 8.7 6.2C18.8 15.5 12 20 12 20Z" />} />
}

function CommentIcon({ className = 'size-5' }) {
  return <Icon className={className} path={<path d="M4 6.5h16v9H8l-4 3v-12Z" />} />
}

function BookmarkIcon({ filled = false, className = 'size-5' }) {
  return <Icon className={className} fill={filled ? 'currentColor' : 'none'} path={<path d="M7 4.5h10v15l-5-3.4L7 19.5v-15Z" />} />
}

function ShareIcon({ className = 'size-5' }) {
  return (
    <Icon
      className={className}
      path={
        <>
          <path d="m15 6 4-1-1 4" />
          <path d="M10 14 19 5" />
          <path d="M19 13.5V18a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2H11" />
        </>
      }
    />
  )
}

function MessageIcon({ className = 'size-5' }) {
  return (
    <Icon
      className={className}
      path={
        <>
          <path d="M4 6.5h16v9H8l-4 3v-12Z" />
          <path d="M7.5 10.5h9" />
          <path d="M7.5 13.5h5.5" />
        </>
      }
    />
  )
}

function BellIcon({ className = 'size-5' }) {
  return (
    <Icon
      className={className}
      path={
        <>
          <path d="M8 18h8" />
          <path d="M6 18h12l-1.6-2.2V11a4.4 4.4 0 1 0-8.8 0v4.8L6 18Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </>
      }
    />
  )
}

function SendIcon({ className = 'size-5' }) {
  return (
    <Icon
      className={className}
      path={
        <>
          <path d="M21 3 10 14" />
          <path d="m21 3-7 18-4-7-7-4 18-7Z" />
        </>
      }
    />
  )
}

function EyeIcon({ className = 'size-4.5' }) {
  return (
    <Icon className={className} path={<><path d="M2.5 12s3.8-6 9.5-6 9.5 6 9.5 6-3.8 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></>} />
  )
}

function ReportIcon({ className = 'size-5' }) {
  return (
    <Icon
      className={className}
      path={
        <>
          <path d="M6 4.5v15" />
          <path d="M6.5 5.5h9l-1.8 3L15.5 12h-9z" />
        </>
      }
    />
  )
}

function PhotoIcon({ className = 'size-4.5' }) {
  return (
    <Icon
      className={className}
      path={
        <>
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m20 15-4.5-4.5L8 18" />
        </>
      }
    />
  )
}

function DotsIcon({ className = 'size-4.5' }) {
  return (
    <Icon
      className={className}
      path={
        <>
          <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </>
      }
    />
  )
}

function findCommentById(comments, commentId) {
  for (const comment of comments) {
    if ((comment.id || comment._id) === commentId) return comment
    const nested = findCommentById(comment.replies || [], commentId)
    if (nested) return nested
  }
  return null
}

function appendReplyToTree(comments, parentId, nextComment) {
  return comments.map((comment) => {
    const id = comment.id || comment._id
    if (id === parentId) return { ...comment, replies: [nextComment, ...(comment.replies || [])] }
    return comment.replies?.length ? { ...comment, replies: appendReplyToTree(comment.replies, parentId, nextComment) } : comment
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
    return comment.replies?.length ? { ...comment, replies: updateCommentInTree(comment.replies, nextComment) } : comment
  })
}

function removeCommentFromTree(comments, commentId) {
  return comments
    .filter((comment) => (comment.id || comment._id) !== commentId)
    .map((comment) => ({ ...comment, replies: removeCommentFromTree(comment.replies || [], commentId) }))
}

function createPreviewItem(file) {
  return { id: `${file.name}-${file.lastModified}`, url: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'video' : 'image', name: file.name }
}

function sortCommentsTree(comments, mode) {
  const sorted = [...comments].sort((left, right) => {
    if (mode === 'popular') {
      const likeDelta = (right.stats?.likes ?? 0) - (left.stats?.likes ?? 0)
      if (likeDelta !== 0) return likeDelta
    }
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  })

  return sorted.map((comment) => ({
    ...comment,
    replies: sortCommentsTree(comment.replies || [], mode),
  }))
}

function ViewerIconButton({ children, onClick, label, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="grid size-10 place-items-center cursor-pointer rounded-full border border-white/10 bg-white/10 text-white backdrop-blur transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function HeaderActionLink({ to, icon, label }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
    >
      {icon}
    </Link>
  )
}

function CountBadge({ count }) {
  if (!count) {
    return null
  }

  return (
    <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function HeaderActionWithBadge({ to, icon, label, count = 0 }) {
  return (
    <div className="relative">
      <HeaderActionLink to={to} icon={icon} label={label} />
      <CountBadge count={count} />
    </div>
  )
}

function InlineActionButton({ icon, label, count = 0, active = false, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-11 min-w-11 items-center cursor-pointer justify-center gap-2 rounded-lg px-3 text-sm transition ${
        active
          ? 'bg-nav-active text-primary'
          : 'text-text hover:bg-secondary hover:text-text'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {icon}
      <span className="text-xs font-semibold">{count}</span>
    </button>
  )
}

function CommentActionText({ label, onClick, active = false, tone = 'default', disabled = false }) {
  const toneClass =
    tone === 'danger'
      ? 'text-rose-600 hover:text-rose-700'
      : active
        ? ' text-primary dark:text-primary'
        : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-xs cursor-pointer font-medium transition ${toneClass} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  )
}

function CommentComposerPreview({ preview, onRemove, removeLabel }) {
  if (!preview) return null

  return (
    <div className="relative mt-3 h-20 w-20 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
      {preview.type === 'video' ? (
        <video src={resolveMediaUrl(preview.url)} className="h-full w-full object-cover" muted playsInline />
      ) : (
        <img src={resolveMediaUrl(preview.url)} alt={preview.name} className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/72 text-white transition hover:bg-black/85"
        aria-label={removeLabel}
        title={removeLabel}
      >
        <CloseIcon />
      </button>
    </div>
  )
}

const PostDetailCommentItem = lazy(() => import('./PostDetailCommentItem.jsx'))

const MOBILE_COLLAPSED_TEXT_LIMIT = 150
const DESKTOP_COLLAPSED_TEXT_LIMIT = 210
const MOBILE_INLINE_MORE_TEXT_LIMIT = 92
const DESKTOP_INLINE_MORE_TEXT_LIMIT = 140
const MOBILE_UA_PATTERN = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i

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

function PostDetailModal() {
  const { lang, postId, slug = '' } = useParams()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, user } = useAuth()
  const commentMediaInputRef = useRef(null)
  const commentTextareaRef = useRef(null)
  const touchStartXRef = useRef(null)
  const mobileShareMenuRef = useRef(null)
  const desktopShareMenuRef = useRef(null)
  const [detailState, setDetailState] = useState({ post: null, comments: [], viewer: null, isLoading: true, error: '' })
  const [commentDraft, setCommentDraft] = useState('')
  const [replyTargetId, setReplyTargetId] = useState(null)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [commentFile, setCommentFile] = useState(null)
  const [commentPreview, setCommentPreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [postAction, setPostAction] = useState('')
  const [commentSort, setCommentSort] = useState('popular')
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isExpandedText, setIsExpandedText] = useState(false)
  const [isMobileDescriptionExpanded, setIsMobileDescriptionExpanded] = useState(false)
  const [messageUnreadCount, setMessageUnreadCount] = useState(0)
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isCurrentMediaUnavailable, setIsCurrentMediaUnavailable] = useState(false)
  const [currentMediaCandidateIndex, setCurrentMediaCandidateIndex] = useState(0)
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const [isShareProcessing, setIsShareProcessing] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const [isMobileCommentsOpen, setIsMobileCommentsOpen] = useState(false)
  const [activeCommentMenuId, setActiveCommentMenuId] = useState(null)
  const [reportTarget, setReportTarget] = useState({ kind: 'post', id: null })
  const [pendingDeleteComment, setPendingDeleteComment] = useState(null)
  const [openRepliesById, setOpenRepliesById] = useState({})

  const resolveInitialMediaIndex = useCallback((mediaCount = 0) => {
    if (!mediaCount) {
      return 0
    }

    const stateIndex =
      typeof location.state?.mediaIndex === 'number' && Number.isFinite(location.state.mediaIndex)
        ? location.state.mediaIndex
        : null
    const queryIndexRaw = Number.parseInt(searchParams.get('media') || '', 10)
    const queryIndex = Number.isNaN(queryIndexRaw) ? null : queryIndexRaw - 1
    const preferredIndex = stateIndex ?? queryIndex ?? 0

    return Math.max(0, Math.min(preferredIndex, mediaCount - 1))
  }, [location.state?.mediaIndex, searchParams])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      if (commentPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(commentPreview.url)
    }
  }, [commentPreview])

  useEffect(() => {
    if (!isMobileCommentsOpen || typeof document === 'undefined') {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileCommentsOpen])

  useEffect(() => {
    function handlePointerDown(event) {
      if (event.target.closest?.('[data-comment-menu]')) {
        return
      }
      setActiveCommentMenuId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      setDetailState((current) => ({ ...current, isLoading: true, error: '' }))
      try {
        const payload = await getPostDetail(postId)
        if (!cancelled) {
          setDetailState({ post: payload.post, comments: payload.comments, viewer: payload.viewer, isLoading: false, error: '' })
        }
      } catch (error) {
        if (!cancelled) {
          setDetailState({
            post: null,
            comments: [],
            viewer: null,
            isLoading: false,
            error: error.message || t('postDetail.loadError'),
          })
        }
      }
    }

    loadDetail()
    return () => {
      cancelled = true
    }
  }, [postId, t])

  useEffect(() => {
    if (!isAuthenticated) {
      setMessageUnreadCount(0)
      setNotificationUnreadCount(0)
      return undefined
    }

    let cancelled = false

    async function refreshCounts() {
      try {
        const [conversationsPayload, notificationsPayload] = await Promise.all([
          getConversations(100),
          getNotifications({ limit: 100 }),
        ])

        if (cancelled) {
          return
        }

        setMessageUnreadCount(
          (conversationsPayload.conversations || []).reduce(
            (sum, conversation) => sum + Number(conversation.unreadCount || 0),
            0,
          ),
        )
        setNotificationUnreadCount(
          (notificationsPayload.notifications || []).filter((item) => !item.readAt).length,
        )
      } catch {
        if (!cancelled) {
          setMessageUnreadCount((current) => current)
          setNotificationUnreadCount((current) => current)
        }
      }
    }

    const socket = connectSocketClient()

    function handleRealtimeCounts() {
      refreshCounts()
    }

    refreshCounts()
    socket.on('new_message', handleRealtimeCounts)
    socket.on('messages_read', handleRealtimeCounts)
    socket.on('notification:new', handleRealtimeCounts)
    socket.on('notification:read', handleRealtimeCounts)
    socket.on('notification:read:all', handleRealtimeCounts)

    return () => {
      cancelled = true
      socket.off('new_message', handleRealtimeCounts)
      socket.off('messages_read', handleRealtimeCounts)
      socket.off('notification:new', handleRealtimeCounts)
      socket.off('notification:read', handleRealtimeCounts)
      socket.off('notification:read:all', handleRealtimeCounts)
      disconnectSocketClient()
    }
  }, [isAuthenticated])

  useEffect(() => {
    function handlePointerDown(event) {
      const clickedMobileMenu = mobileShareMenuRef.current?.contains(event.target)
      const clickedDesktopMenu = desktopShareMenuRef.current?.contains(event.target)

      if (!clickedMobileMenu && !clickedDesktopMenu) {
        setIsShareMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

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
    if (!isMobileCommentsOpen || typeof window === 'undefined') {
      return undefined
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsMobileCommentsOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileCommentsOpen])

  useEffect(() => {
    const mediaCount = detailState.post?.media?.length || 0
    setCurrentMediaIndex(resolveInitialMediaIndex(mediaCount))
    setZoomLevel(1)
    setIsExpandedText(false)
    setIsMobileDescriptionExpanded(false)
  }, [
    detailState.post?._id,
    detailState.post?.id,
    detailState.post?.media?.length,
    location.search,
    location.state?.mediaIndex,
    postId,
    resolveInitialMediaIndex,
  ])

  useEffect(() => {
    const textarea = commentTextareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`
  }, [commentDraft, editingCommentId, replyTargetId])

  const post = detailState.post
  const author = useMemo(() => post?.author || {}, [post?.author])
  const postTitle = `${post?.title || ''}`.trim()
  const viewerUserId = user?._id?.toString?.() || user?.id?.toString?.() || ''
  const postAuthorId = author?._id?.toString?.() || author?.id?.toString?.() || ''
  const sortedComments = useMemo(() => sortCommentsTree(detailState.comments, commentSort), [detailState.comments, commentSort])
  const replyTarget = useMemo(() => (replyTargetId ? findCommentById(detailState.comments, replyTargetId) : null), [detailState.comments, replyTargetId])
  const editingComment = useMemo(() => (editingCommentId ? findCommentById(detailState.comments, editingCommentId) : null), [detailState.comments, editingCommentId])
  const mediaItems = post?.media || []
  const currentMedia = mediaItems[currentMediaIndex] || null
  const currentMediaCandidates = useMemo(() => {
    const sourceUrl = currentMedia?.url || currentMedia?.hlsUrl || ''
    return sourceUrl ? resolveMediaUrlCandidates(sourceUrl) : []
  }, [currentMedia?.hlsUrl, currentMedia?.url])
  const currentMediaUrl = currentMediaCandidates[currentMediaCandidateIndex] || ''
  const hasMultipleMedia = mediaItems.length > 1
  const canSubmitComment = editingCommentId ? Boolean(commentDraft.trim()) : Boolean(commentDraft.trim() || commentFile)
  const fullPostText = post?.text || ''
  const shouldClampMobileText = fullPostText.length > MOBILE_COLLAPSED_TEXT_LIMIT
  const shouldClampDesktopText = fullPostText.length > DESKTOP_COLLAPSED_TEXT_LIMIT
  const shouldClampText = shouldClampMobileText
  const resolvedPostId = post?.id || post?._id || postId
  const canonicalPath = `/${lang}/posts/${resolvedPostId}${post?.slug ? `/${post.slug}` : ''}`
  const collapsedMobileText = useMemo(
    () => getCollapsedInlineText(fullPostText, MOBILE_INLINE_MORE_TEXT_LIMIT),
    [fullPostText],
  )
  const collapsedDesktopText = useMemo(
    () => getCollapsedInlineText(fullPostText, DESKTOP_INLINE_MORE_TEXT_LIMIT),
    [fullPostText],
  )
  const sharePayload = useMemo(
    () => buildPostSharePayload({ post, postId: resolvedPostId, lang }),
    [lang, post, resolvedPostId],
  )
  const shareTargets = useMemo(
    () => buildShareTargets({ url: sharePayload.url, text: sharePayload.text }),
    [sharePayload.text, sharePayload.url],
  )
  const postViews = post?.stats?.views ?? 0
  const seoTitle = postTitle
    ? `${postTitle} - ${t('postDetail.seoTitle')}`
    : `${post ? getFullName(author) : t('postDetail.fallbackTitle')} - ${t('postDetail.seoTitle')}`
  const seoDescription = (fullPostText || postTitle || t('postDetail.seoDescription')).slice(0, 150)
  const seoStructuredData = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': post?.contentType === 'loop' ? 'VideoObject' : 'Article',
    headline: postTitle || getFullName(author),
    name: postTitle || getFullName(author),
    description: seoDescription,
    url: typeof window !== 'undefined' ? `${window.location.origin}${canonicalPath}` : canonicalPath,
    datePublished: post?.createdAt || undefined,
    dateModified: post?.updatedAt || undefined,
  }), [author, canonicalPath, post?.contentType, post?.createdAt, post?.updatedAt, postTitle, seoDescription])

  useEffect(() => {
    if (!post || !resolvedPostId) {
      return
    }
    const requestedSlug = `${slug || ''}`.trim()
    const currentCanonical = `${canonicalPath}${location.search || ''}`
    const currentPath = `${location.pathname}${location.search || ''}`
    if (post.slug && requestedSlug !== post.slug && currentPath !== currentCanonical) {
      navigate(currentCanonical, { replace: true, state: location.state })
    }
  }, [canonicalPath, location.pathname, location.search, location.state, navigate, post, resolvedPostId, slug])
  const changeMedia = useCallback((step) => {
    if (!hasMultipleMedia) return
    setZoomLevel(1)
    setCurrentMediaIndex((current) => {
      const nextIndex = current + step
      if (nextIndex < 0) return mediaItems.length - 1
      if (nextIndex >= mediaItems.length) return 0
      return nextIndex
    })
  }, [hasMultipleMedia, mediaItems.length])

  useEffect(() => {
    setIsCurrentMediaUnavailable(false)
    setCurrentMediaCandidateIndex(0)
  }, [currentMedia?.url, currentMediaIndex, post?._id, post?.id])

  function handleCurrentMediaLoadError() {
    if (currentMediaCandidateIndex + 1 < currentMediaCandidates.length) {
      setCurrentMediaCandidateIndex((current) => current + 1)
      return
    }

    setIsCurrentMediaUnavailable(true)
  }

  useEffect(() => {
    function handleKeyDown(event) {
      const tagName = event.target instanceof HTMLElement ? event.target.tagName : ''
      const isTypingContext =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)

      if (isTypingContext || !hasMultipleMedia) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        changeMedia(-1)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        changeMedia(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [changeMedia, hasMultipleMedia])

  function handleClose() {
    const openedFromFeed = Boolean(
      location.state?.openedFromFeed || location.state?.backgroundLocation,
    )

    if (openedFromFeed && window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(`/${lang}/`, { replace: true })
  }

  function handleTopicNavigate(topic) {
    navigate(`/${lang}?topic=${encodeURIComponent(topic)}`)
  }

  function handleMentionNavigate(mention) {
    navigate(`/${lang}/u/${mention.replace(/^@/, '')}`)
  }

  function resetComposerState() {
    if (commentPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(commentPreview.url)
    setCommentDraft('')
    setReplyTargetId(null)
    setEditingCommentId(null)
    setCommentFile(null)
    setCommentPreview(null)
    setSubmitError('')
  }

  async function runPostAction(actionName, action) {
    if (!isAuthenticated || !post || postAction) return
    setPostAction(actionName)
    try {
      const payload = await action(postId)
      setDetailState((current) => ({ ...current, post: payload.post }))
    } finally {
      setPostAction('')
    }
  }

  async function trackShareIfPossible() {
    if (!isAuthenticated || post?.sharedByViewer || postAction === 'share') {
      return
    }

    try {
      await runPostAction('share', togglePostShare)
    } catch {
      // Share analytics should never block user-facing share flow.
    }
  }

  async function handleNativeShare() {
    setIsShareProcessing(true)
    const result = await shareWithNative(sharePayload)
    setIsShareProcessing(false)
    return result
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

  async function handleShareButtonClick() {
    if (!sharePayload.url || isShareProcessing) {
      return
    }

    const viewportMobile = typeof window !== 'undefined'
      ? window.matchMedia?.('(max-width: 767px)')?.matches
      : false
    const uaMobile = typeof navigator !== 'undefined'
      ? MOBILE_UA_PATTERN.test(navigator.userAgent || '')
      : false

    if (viewportMobile || uaMobile) {
      const nativeShareResult = await handleNativeShare()

      if (nativeShareResult.status === 'shared') {
        setToast({ message: t('common.shareActions.shared'), tone: 'success' })
        setIsShareMenuOpen(false)
        void trackShareIfPossible()
        return
      }

      if (nativeShareResult.status === 'cancelled') {
        setIsShareMenuOpen(false)
        return
      }

      if (nativeShareResult.status === 'unsupported' || nativeShareResult.status === 'error') {
        if (nativeShareResult.status === 'error') {
          setToast({ message: t('common.shareActions.failed'), tone: 'error' })
        }

        try {
          await copyTextToClipboard(sharePayload.url)
          setToast({ message: t('common.shareActions.linkCopied'), tone: 'success' })
          setIsShareMenuOpen(false)
          void trackShareIfPossible()
        } catch {
          setToast({ message: t('common.shareActions.copyFailed'), tone: 'error' })
          setIsShareMenuOpen((current) => !current)
        }
        return
      }

      return
    }

    if (isMobileShareSupported()) {
      return
    }

    setIsShareMenuOpen((current) => !current)
  }

  async function updateCommentAction(comment, action) {
    const payload = await action(comment.id || comment._id)
    setDetailState((current) => ({ ...current, comments: updateCommentInTree(current.comments, payload.comment) }))
  }

  async function handleDeleteComment(targetComment) {
    const payload = await deleteComment(targetComment.id || targetComment._id)
    setDetailState((current) => ({
      ...current,
      post: { ...current.post, stats: payload.postStats },
      comments: removeCommentFromTree(current.comments, payload.deletedCommentId),
    }))
    if ((replyTargetId || editingCommentId) === (targetComment.id || targetComment._id)) {
      if (!editingCommentId && replyTargetId) {
        setCommentDraft('')
        clearCommentMedia()
        setSubmitError('')
      } else {
        resetComposerState()
      }
    }
  }

  function handleCommentMediaChange(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    const [file] = files
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setSubmitError(t('postDetail.invalidCommentMedia'))
      return
    }
    if (commentPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(commentPreview.url)
    setSubmitError('')
    setCommentFile(file)
    setCommentPreview(createPreviewItem(file))
  }

  function clearCommentMedia() {
    if (commentPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(commentPreview.url)
    setCommentFile(null)
    setCommentPreview(null)
  }

  const handleToggleReplies = useCallback((commentId, forceValue = null) => {
    setOpenRepliesById((current) => {
      const next = { ...current }
      if (forceValue === null) {
        next[commentId] = !current[commentId]
      } else {
        next[commentId] = Boolean(forceValue)
      }
      return next
    })
  }, [])

  function handleRequestDeleteComment(targetComment) {
    setPendingDeleteComment(targetComment)
  }

  async function handleConfirmDeleteComment() {
    if (!pendingDeleteComment) return
    await handleDeleteComment(pendingDeleteComment)
    setPendingDeleteComment(null)
  }

  function handleOpenCommentReport(targetComment) {
    const commentId = targetComment?.id || targetComment?._id
    if (!commentId) return
    setReportTarget({ kind: 'comment', id: commentId })
    setIsReportOpen(true)
  }

  async function handleSubmitComment() {
    const hasText = Boolean(commentDraft.trim())
    const hasMedia = Boolean(commentFile)
    if (editingCommentId && !hasText) return
    if (!editingCommentId && !hasText && !hasMedia) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      if (editingCommentId) {
        const payload = await updateComment(editingCommentId, { text: commentDraft.trim() })
        setDetailState((current) => ({ ...current, comments: updateCommentInTree(current.comments, payload.comment) }))
      } else {
        let body = { text: commentDraft.trim(), ...(replyTargetId ? { parentCommentId: replyTargetId } : {}) }
        if (commentFile) {
          const formData = new FormData()
          formData.set('text', commentDraft.trim())
          if (replyTargetId) formData.set('parentCommentId', replyTargetId)
          formData.append('media', commentFile)
          body = formData
        }
        const payload = await createComment(postId, body)
        setDetailState((current) => ({
          ...current,
          post: { ...current.post, stats: payload.postStats },
          comments: replyTargetId ? appendReplyToTree(current.comments, replyTargetId, payload.comment) : [...current.comments, payload.comment],
        }))
      }
      resetComposerState()
    } catch (error) {
      setSubmitError(error.message || t('postDetail.submitCommentError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCommentKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSubmitComment && !isSubmitting) handleSubmitComment()
    }
  }

  function handleMediaTouchStart(event) {
    if (!hasMultipleMedia || currentMedia?.type === 'video') return
    touchStartXRef.current = event.touches?.[0]?.clientX ?? null
  }

  function handleMediaTouchEnd(event) {
    if (!hasMultipleMedia || currentMedia?.type === 'video') return

    const touchStartX = touchStartXRef.current
    const touchEndX = event.changedTouches?.[0]?.clientX ?? null
    touchStartXRef.current = null

    if (touchStartX == null || touchEndX == null) return

    const deltaX = touchEndX - touchStartX
    const swipeThreshold = 50

    if (Math.abs(deltaX) < swipeThreshold) return

    if (deltaX < 0) {
      changeMedia(1)
      return
    }

    changeMedia(-1)
  }

  function changeZoom(direction) {
    setZoomLevel((current) => {
      const nextValue = direction === 'in' ? current + 0.2 : current - 0.2
      return Math.min(2.4, Math.max(1, Number(nextValue.toFixed(2))))
    })
  }

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        structuredData={seoStructuredData}
      />
      <div className="fixed inset-0 z-[80] bg-zinc-950 text-zinc-100">
        <div className="flex h-full flex-col xl:flex-row">
          <section className="relative flex min-h-[44vh] flex-1 items-center justify-center overflow-hidden bg-zinc-950 xl:min-h-0">
            {currentMediaUrl && currentMedia?.type !== 'video' ? (
              <>
                <div className="absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-3xl" style={{ backgroundImage: `url(${currentMediaUrl})` }} />
                <div className="absolute inset-0 scale-[1.25] bg-cover bg-center opacity-18 blur-[120px]" style={{ backgroundImage: `url(${currentMediaUrl})` }} />
              </>
            ) : null}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.08),transparent_48%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.24),rgba(0,0,0,0.68))]" />
            <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-white/5 blur-[120px]" />
            <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-white/5 blur-[140px]" />
            <div
              className={`absolute inset-0 bg-black/30 transition-opacity duration-200 xl:hidden ${
                isMobileDescriptionExpanded ? 'opacity-100' : 'opacity-0'
              }`}
            />

            <div className="absolute left-3 top-2 z-20 flex items-center gap-3 xl:left-5 xl:top-5">
              <div className="xl:hidden">
                <ViewerIconButton
                  onClick={() => setIsReportOpen(true)}
                  label={t('postDetail.reportContent')}
                >
                  <ReportIcon />
                </ViewerIconButton>
              </div>
              <div className="hidden xl:block">
                <ViewerIconButton onClick={handleClose} label={t('postDetail.closeDetail')}>
                  <CloseIcon />
                </ViewerIconButton>
              </div>
              <Link
                to={`/${lang}/`}
                className="hidden size-10 place-items-center rounded-full bg-white text-sm font-bold text-zinc-950 shadow-sm transition hover:scale-[1.03] xl:grid"
                aria-label={t('postDetail.goHome')}
                title={t('postDetail.goHome')}
              >
                M
              </Link>
            </div>

            <div className="absolute right-3 top-2 z-20 xl:hidden">
              <ViewerIconButton onClick={handleClose} label={t('postDetail.closeDetail')}>
                <CloseIcon />
              </ViewerIconButton>
            </div>

            <div className="absolute right-5 top-2 z-20 hidden items-center gap-2 rounded-lg border border-white/20 bg-black/30 px-2 py-2 backdrop-blur-xl xl:flex">
              <ViewerIconButton
                onClick={() => changeZoom('in')}
                label={t('postDetail.zoomIn')}
                disabled={!currentMedia || currentMedia.type === 'video'}
              >
                <PlusIcon />
              </ViewerIconButton>
              <ViewerIconButton
                onClick={() => changeZoom('out')}
                label={t('postDetail.zoomOut')}
                disabled={!currentMedia || currentMedia.type === 'video' || zoomLevel <= 1}
              >
                <MinusIcon />
              </ViewerIconButton>
            </div>

            {hasMultipleMedia ? (
              <>
                <button
                  type="button"
                  onClick={() => changeMedia(-1)}
                  className="absolute left-5 top-1/2 z-20 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/25 text-white opacity-100 backdrop-blur transition hover:bg-black/40 xl:grid"
                  aria-label={t('postDetail.previousMedia')}
                >
                  <ChevronIcon direction="left" />
                </button>
                <button
                  type="button"
                  onClick={() => changeMedia(1)}
                  className="absolute right-5 top-1/2 z-20 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/25 text-white opacity-100 backdrop-blur transition hover:bg-black/40 xl:grid"
                  aria-label={t('postDetail.nextMedia')}
                >
                  <ChevronIcon direction="right" />
                </button>
              </>
            ) : null}

            <div className="viewer-shell relative z-10 flex h-full w-full items-center justify-center px-0 py-16 xl:px-12 xl:py-24" onTouchStart={handleMediaTouchStart} onTouchEnd={handleMediaTouchEnd}>
              {detailState.isLoading ? (
                <div className="rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm text-white/75 backdrop-blur">
                  {t('postDetail.loading')}
                </div>
              ) : null}
              {detailState.error ? <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">{detailState.error}</div> : null}
              {!detailState.isLoading && !detailState.error && currentMedia && !isCurrentMediaUnavailable ? (
                currentMedia.type === 'video' ? (
                  <video
                    src={currentMediaUrl}
                    poster={resolveMediaUrl(currentMedia?.posterUrl || '') || undefined}
                    controls
                    playsInline
                    onError={handleCurrentMediaLoadError}
                    className="max-h-full max-w-full object-contain shadow-[0_30px_80px_rgba(0,0,0,0.35)] xl:rounded-[32px]"
                  />
                ) : (
                  <img
                    src={currentMediaUrl}
                    alt="Icerik gorseli"
                    onError={handleCurrentMediaLoadError}
                    className="max-h-full max-w-full object-contain shadow-[0_30px_80px_rgba(0,0,0,0.35)] transition-transform duration-200 xl:rounded-[32px]"
                    style={{ transform: `scale(${zoomLevel})` }}
                  />
                )
              ) : null}
              {!detailState.isLoading && !detailState.error && currentMedia && isCurrentMediaUnavailable ? (
                <div className="max-w-md rounded-[32px] border border-amber-500/30 bg-amber-500/10 px-6 py-8 text-center text-sm text-amber-100">
                  {t('postDetail.mediaUnavailable')}
                </div>
              ) : null}
              {!detailState.isLoading && !detailState.error && !currentMedia ? (
                <div className="max-w-md rounded-[32px] border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-white/75 backdrop-blur">
                  {t('postDetail.noMedia')}
                </div>
              ) : null}
            </div>

            {!isMobileCommentsOpen ? (
            <div className="absolute inset-x-0 bottom-0 z-20 xl:hidden">
              <div className="border-t border-white/15 bg-[linear-gradient(180deg,rgba(4,8,15,0.2),rgba(4,8,15,0.92))] pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
                <div className="">
                    <Link
              to={`/${lang}/u/${author.username || ''}`}
              className="flex items-center px-3 gap-2 shrink-0 transition hover:scale-[1.02]"
              >
                  <UserAvatar
                    user={author}
                    className="size-9 bg-white text-zinc-950"
                    textClassName="text-xs font-semibold"
                  />
                  
                  <div className="min-w-0  flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {getFullName(author)}
                    </p>
                    <p className="truncate text-xs text-white/65">
                      @{author.username} • {post?.createdAt ? formatRelativeTime(post.createdAt) : '--'}
                    </p>
                  </div>
                </Link>
                </div>

                {postTitle ? (
                  <p className="mt-1 px-3 text-sm font-semibold tracking-tight text-white/90">
                    {postTitle}
                  </p>
                ) : null}

                {post?.text ? (
                  <div className="mt-2">
                    {isMobileDescriptionExpanded ? (
                      <>
                        <p className="whitespace-pre-line px-3 text-sm leading-6 text-white/90">
                          <HashtagText
                            text={fullPostText}
                            onHashtagClick={handleTopicNavigate}
                            onMentionClick={handleMentionNavigate}
                          />
                        </p>
                        {shouldClampMobileText ? (
                          <button
                            type="button"
                            onClick={() => setIsMobileDescriptionExpanded(false)}
                            className="mt-1 px-3 flex ml-auto me-7 text-xs font-semibold text-blue-300 transition hover:text-blue-200"
                          >
                            {t('postDetail.less')}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p className="whitespace-pre-line px-3 text-sm leading-6 text-white/90">
                        <HashtagText
                          text={collapsedMobileText}
                          onHashtagClick={handleTopicNavigate}
                          onMentionClick={handleMentionNavigate}
                        />{' '}
                        {shouldClampMobileText ? (
                          <button
                            type="button"
                            onClick={() => setIsMobileDescriptionExpanded(true)}
                            className="inline whitespace-nowrap text-xs font-semibold text-blue-300 transition hover:text-blue-200"
                          >
                            {t('postDetail.more')}
                          </button>
                        ) : null}
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="mt-3 px-3 flex items-center justify-between gap-2 border-t bg-card border-white/10 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <InlineActionButton
                      icon={<HeartIcon filled={Boolean(post?.likedByViewer)} className="size-4.5" />}
                      count={post?.stats?.likes ?? 0}
                      label={t('common.like')}
                      active={Boolean(post?.likedByViewer)}
                      disabled={!isAuthenticated || postAction === 'like'}
                      onClick={() => runPostAction('like', togglePostLike)}
                    />
                    <InlineActionButton
                      icon={<CommentIcon className="size-4.5" />}
                      count={post?.stats?.comments ?? 0}
                      label={t('common.comment')}
                      onClick={() => setIsMobileCommentsOpen(true)}
                    />
                    <InlineActionButton
                      icon={<BookmarkIcon filled={Boolean(post?.savedByViewer)} className="size-4.5" />}
                      count={post?.stats?.saves ?? 0}
                      label={t('common.save')}
                      active={Boolean(post?.savedByViewer)}
                      disabled={!isAuthenticated || postAction === 'save'}
                      onClick={() => runPostAction('save', togglePostSave)}
                    />
                    <div ref={mobileShareMenuRef} className="relative">
                      <InlineActionButton
                        icon={<ShareIcon className="size-4.5" />}
                        count={post?.stats?.shares ?? 0}
                        label={t('common.share')}
                        active={Boolean(post?.sharedByViewer)}
                        disabled={isShareProcessing || postAction === 'share'}
                        onClick={handleShareButtonClick}
                      />
                    {isShareMenuOpen ? (
                      <div className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-2xl border border-white/20 bg-zinc-900/96 p-2 shadow-[0_20px_45px_rgba(0,0,0,0.4)]">
                        <button
                          type="button"
                          onClick={handleShareCopyLink}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-white/10"
                        >
                          <span>{t('common.shareActions.copyLink')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareToPlatform('whatsapp')}
                          className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-white/10"
                        >
                          <span>{t('common.shareActions.whatsapp')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareToPlatform('x')}
                          className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-white/10"
                        >
                          <span>{t('common.shareActions.x')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareToPlatform('facebook')}
                          className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-white/10"
                        >
                          <span>{t('common.shareActions.facebook')}</span>
                        </button>
                      </div>
                    ) : null}
                    </div>
                  </div>
                  <div
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted"
                    aria-label={t('postDetail.viewCountLabel')}
                    title={t('postDetail.viewCountLabel')}
                  >
                    <EyeIcon />
                    <span>{formatViewCount(postViews, lang === 'tr' ? 'tr-TR' : 'en-US')}</span>
                  </div>
                </div>
              </div>
            </div>
            ) : null}
          </section>

          <aside className="hidden h-full w-[450px] max-w-none flex-col border-l border-zinc-200 bg-white text-zinc-900 shadow-none xl:flex dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="hidden items-center justify-end gap-2 border-b border-border px-5 py-2 xl:flex">
              <HeaderActionWithBadge to={`/${lang}/messages`} icon={<MessageIcon />} label={t('nav.messages')} count={messageUnreadCount} />
              <HeaderActionWithBadge to={`/${lang}/notifications`} icon={<BellIcon />} label={t('nav.notifications')} count={notificationUnreadCount} />
              <HeaderActionLink to={`/${lang}/profile`} icon={<UserAvatar user={user} className="size-7 bg-transparent text-current dark:bg-transparent dark:text-current" textClassName="text-xs font-semibold" />} label={t('nav.profile')} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="border-b border-white/10 px-4 py-4 xl:border-border xl:px-4 xl:py-2 dark:xl:border-zinc-800">
                <div className="flex items-start gap-3">
                  <Link to={`/${lang}/u/${author.username || ''}`} className="shrink-0">
                    <UserAvatar user={author} className="size-10 bg-white text-zinc-950 xl:size-12 xl:bg-zinc-950 xl:text-white dark:xl:bg-white dark:xl:text-zinc-950" textClassName="text-sm font-semibold" />
                  </Link>
                  <div className="min-w-0  flex-1">
                    <Link to={`/${lang}/u/${author.username || ''}`} className="block transition hover:opacity-80">
                      <p className="truncate text-sm font-semibold text-white xl:text-zinc-950 dark:xl:text-white">{getFullName(author)}</p>
                      <p className="mt-0.5 truncate text-xs text-white/60 xl:text-zinc-500 dark:xl:text-zinc-400">@{author.username} • {post?.createdAt ? formatRelativeTime(post.createdAt) : '--'}</p>
                    </Link>

                    {postTitle ? (
                      <p className="mt-1 text-sm font-semibold tracking-tight text-white/90 xl:text-zinc-800 dark:xl:text-zinc-100">
                        {postTitle}
                      </p>
                    ) : null}

                    {post?.text ? (
                      <div className="mt-1">
                        {isExpandedText ? (
                          <>
                            <p className="w-full whitespace-pre-line text-left text-[15px] leading-7 text-zinc-200 transition hover:text-white xl:text-zinc-700 xl:hover:text-zinc-950 dark:xl:text-zinc-200 dark:xl:hover:text-white">
                              <HashtagText
                                text={fullPostText}
                                onHashtagClick={handleTopicNavigate}
                                onMentionClick={handleMentionNavigate}
                              />
                            </p>
                            {shouldClampText ? (
                              <button
                                type="button"
                                onClick={() => setIsExpandedText(false)}
                                className="mt-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                {t('postDetail.less')}
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <div>
                            <p className="w-full whitespace-pre-line text-left text-[15px] leading-7 text-zinc-200 transition hover:text-white xl:text-zinc-700 xl:hover:text-zinc-950 dark:xl:text-zinc-200 dark:xl:hover:text-white">
                              <span className="xl:hidden">
                                <HashtagText
                                  text={collapsedMobileText}
                                  onHashtagClick={handleTopicNavigate}
                                  onMentionClick={handleMentionNavigate}
                                />
                              </span>
                              <span className="hidden xl:inline">
                                <HashtagText
                                  text={collapsedDesktopText}
                                  onHashtagClick={handleTopicNavigate}
                                  onMentionClick={handleMentionNavigate}
                                />
                              </span>{' '}
                              {shouldClampMobileText ? (
                                <button
                                  type="button"
                                  onClick={() => setIsExpandedText(true)}
                                  className="inline text-sm font-semibold text-blue-400 decoration-transparent underline-offset-2 transition hover:text-blue-300 hover:decoration-current xl:hidden"
                                >
                                  {t('postDetail.more')}
                                </button>
                              ) : null}
                              {shouldClampDesktopText ? (
                                <button
                                  type="button"
                                  onClick={() => setIsExpandedText(true)}
                                  className="hidden text-sm font-semibold text-blue-600 decoration-transparent underline-offset-2 transition hover:text-blue-700 hover:decoration-current dark:text-blue-400 dark:hover:text-blue-300 xl:inline"
                                >
                                  {t('postDetail.more')}
                                </button>
                              ) : null}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2 xl:border-zinc-100 dark:xl:border-zinc-800">
                      <InlineActionButton icon={<HeartIcon filled={Boolean(post?.likedByViewer)} />} label={t('common.like')} count={post?.stats?.likes ?? 0} active={Boolean(post?.likedByViewer)} disabled={!isAuthenticated || postAction === 'like'} onClick={() => runPostAction('like', togglePostLike)} />
                      <InlineActionButton icon={<CommentIcon />} label={t('common.comment')} count={post?.stats?.comments ?? 0} onClick={() => commentTextareaRef.current?.focus()} />
                      <InlineActionButton icon={<BookmarkIcon filled={Boolean(post?.savedByViewer)} />} label={t('common.save')} count={post?.stats?.saves ?? 0} active={Boolean(post?.savedByViewer)} disabled={!isAuthenticated || postAction === 'save'} onClick={() => runPostAction('save', togglePostSave)} />
                      <div ref={desktopShareMenuRef} className="relative">
                        <InlineActionButton
                          icon={<ShareIcon />}
                          label={t('common.share')}
                          count={post?.stats?.shares ?? 0}
                          active={Boolean(post?.sharedByViewer)}
                          disabled={isShareProcessing || postAction === 'share'}
                          onClick={handleShareButtonClick}
                        />
                        {isShareMenuOpen ? (
                          <div className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-[0_20px_45px_rgba(15,23,42,0.16)]">
                            <button
                              type="button"
                              onClick={handleShareCopyLink}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                            >
                              <span>{t('common.shareActions.copyLink')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShareToPlatform('whatsapp')}
                              className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                            >
                              <span>{t('common.shareActions.whatsapp')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShareToPlatform('x')}
                              className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                            >
                              <span>{t('common.shareActions.x')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShareToPlatform('facebook')}
                              className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                            >
                              <span>{t('common.shareActions.facebook')}</span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div
                        className="inline-flex shrink-0 items-center gap-1.5 px-2 text-xs font-semibold text-muted"
                        aria-label={t('postDetail.viewCountLabel')}
                        title={t('postDetail.viewCountLabel')}
                      >
                        <EyeIcon />
                        <span>{formatViewCount(postViews, lang === 'tr' ? 'tr-TR' : 'en-US')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end  px-4 py-2  xl:px-4 xl:py-2 ">
                <button type="button" onClick={() => setCommentSort('popular')} className={`rounded-lg cursor-pointer px-3 py-1.5 text-sm font-medium transition ${commentSort === 'popular' ? 'bg-primary text-inverse xl:bg-primary xl:text-inverse ' : 'bg-secondary text-muted xl:bg-secondary xl:text-muted'}`}>{t('postDetail.popular')}</button>
                <button type="button" onClick={() => setCommentSort('latest')} className={`rounded-lg cursor-pointer px-3 py-1.5 text-sm font-medium transition ${commentSort === 'latest' ? 'bg-primary text-inverse xl:bg-primary xl:text-inverse' : 'bg-secondary text-muted xl:bg-secondary xl:text-muted'}`}>{t('postDetail.latest')}</button>
              </div>

              <div className="px-4 py-4 xl:px-4 xl:py-2">
                {detailState.isLoading ? <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65 xl:border-zinc-200 xl:bg-zinc-50 xl:text-zinc-500 dark:xl:border-zinc-800 dark:xl:bg-zinc-900 dark:xl:text-zinc-400">{t('postDetail.commentsLoading')}</div> : null}
                {!detailState.isLoading && !sortedComments.length ? <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-6 text-sm text-white/65 xl:border-zinc-200 xl:text-zinc-500 dark:xl:border-zinc-800 dark:xl:text-zinc-400">{t('postDetail.noComments')}</div> : null}
                <div className="space-y-1">
                  {sortedComments.map((comment) => (
                    <Suspense key={comment.id || comment._id} fallback={null}>
                      <PostDetailCommentItem
                        comment={comment}
                        level={0}
                        lang={lang}
                        t={t}
                        viewerUserId={viewerUserId}
                        postAuthorId={postAuthorId}
                        onReply={(target) => {
                          setReplyTargetId(target.id || target._id)
                          setEditingCommentId(null)
                          setCommentDraft('')
                          clearCommentMedia()
                          commentTextareaRef.current?.focus()
                        }}
                        onLike={(target) => updateCommentAction(target, toggleCommentLike)}
                        onEdit={(target) => {
                          setEditingCommentId(target.id || target._id)
                          setReplyTargetId(null)
                          setCommentDraft(target.text || '')
                          clearCommentMedia()
                          commentTextareaRef.current?.focus()
                        }}
                        onDelete={handleDeleteComment}
                        onRequestDelete={handleRequestDeleteComment}
                        replyTargetId={replyTargetId}
                        commentDraft={commentDraft}
                        onCommentDraftChange={setCommentDraft}
                        onSubmitReply={handleSubmitComment}
                        onCancelReply={() => {
                          setReplyTargetId(null)
                          setEditingCommentId(null)
                        }}
                        onOpenMediaPicker={() => commentMediaInputRef.current?.click()}
                        commentPreview={commentPreview}
                        onClearMedia={clearCommentMedia}
                        submitError={submitError}
                        canSubmitComment={canSubmitComment}
                        isSubmitting={isSubmitting}
                        activeCommentMenuId={activeCommentMenuId}
                        onToggleCommentMenu={setActiveCommentMenuId}
                        onReportComment={handleOpenCommentReport}
                        openRepliesById={openRepliesById}
                        onToggleReplies={handleToggleReplies}
                        editingCommentId={editingCommentId}
                        isAuthenticated={isAuthenticated}
                      />
                    </Suspense>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-white/10 bg-black/95 px-4 py-3 xl:border-zinc-200 xl:bg-white xl:px-5 xl:py-4 dark:xl:border-zinc-800 dark:xl:bg-zinc-950">
              {editingComment ? <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/65 xl:border-zinc-200 xl:bg-zinc-50 xl:text-zinc-500 dark:xl:border-zinc-800 dark:xl:bg-zinc-900 dark:xl:text-zinc-400"><span>{t('postDetail.editingComment')}</span><button type="button" onClick={resetComposerState}>{t('postDetail.cancel')}</button></div> : null}
              {submitError ? <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">{submitError}</div> : null}

              {!replyTarget ? <div className="flex items-end gap-3 rounded-lg border border-border-soft bg-secondary px-3 py-3 transition-colors focus-within:border-border xl:border-border-soft xl:bg-secondary xl:focus-within:border-border ">
                <UserAvatar user={user || author} className="size-10 shrink-0 bg-white text-zinc-950 xl:bg-zinc-950 xl:text-white dark:xl:bg-white dark:xl:text-zinc-950" textClassName="text-xs font-semibold" />
                <div className="min-w-0  flex-1">
                  <textarea
                    ref={commentTextareaRef}
                    rows={1}
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    onKeyDown={handleCommentKeyDown}
                    disabled={!isAuthenticated || isSubmitting}
                    placeholder={isAuthenticated ? t('postDetail.addComment') : t('postDetail.commentLoginPlaceholder')}
                    className="max-h-[140px] min-h-[44px] w-full resize-none bg-transparent py-2 text-sm leading-6 text-white outline-none placeholder:text-white/40 disabled:cursor-not-allowed xl:text-zinc-900 xl:placeholder:text-zinc-400 dark:xl:text-zinc-100 dark:xl:placeholder:text-zinc-500"
                  />
                  <CommentComposerPreview
                    preview={commentPreview}
                    onRemove={clearCommentMedia}
                    removeLabel={t('postDetail.removePreview')}
                  />
                </div>
                <div className="flex items-center gap-1 pb-1">
                  <button type="button" onClick={() => commentMediaInputRef.current?.click()} disabled={!isAuthenticated || isSubmitting} className="grid size-10 place-items-center rounded-full text-white/72 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 xl:text-zinc-500 xl:hover:bg-zinc-200 xl:hover:text-zinc-950 dark:xl:text-zinc-400 dark:xl:hover:bg-zinc-800 dark:xl:hover:text-white" aria-label={t('postDetail.addMedia')} title={t('postDetail.addMedia')}><PhotoIcon /></button>
                  <button type="button" onClick={handleSubmitComment} disabled={!isAuthenticated || isSubmitting || !canSubmitComment} className="grid size-10 place-items-center rounded-full bg-white text-zinc-950 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/30 xl:bg-zinc-950 xl:text-white xl:disabled:bg-zinc-300 dark:xl:bg-white dark:xl:text-zinc-950 dark:xl:disabled:bg-zinc-700 dark:xl:disabled:text-zinc-500" aria-label={editingCommentId ? t('postDetail.updateComment') : t('postDetail.sendComment')} title={editingCommentId ? t('postDetail.updateComment') : t('postDetail.sendComment')}><SendIcon /></button>
                </div>
              </div> : null}
            </div>
          </aside>

          {isMobileCommentsOpen ? (
            <div className="fixed inset-0 z-[85] flex flex-col bg-card md:hidden">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <InlineActionButton
                    icon={<HeartIcon filled={Boolean(post?.likedByViewer)} className="size-4.5" />}
                    count={post?.stats?.likes ?? 0}
                    label={t('common.like')}
                    active={Boolean(post?.likedByViewer)}
                    disabled={!isAuthenticated || postAction === 'like'}
                    onClick={() => runPostAction('like', togglePostLike)}
                  />
                  <InlineActionButton
                    icon={<CommentIcon className="size-4.5" />}
                    count={post?.stats?.comments ?? 0}
                    label={t('common.comment')}
                    onClick={() => commentTextareaRef.current?.focus()}
                  />
                  <InlineActionButton
                    icon={<BookmarkIcon filled={Boolean(post?.savedByViewer)} className="size-4.5" />}
                    count={post?.stats?.saves ?? 0}
                    label={t('common.save')}
                    active={Boolean(post?.savedByViewer)}
                    disabled={!isAuthenticated || postAction === 'save'}
                    onClick={() => runPostAction('save', togglePostSave)}
                  />
                  <div ref={mobileShareMenuRef} className="relative">
                    <InlineActionButton
                      icon={<ShareIcon className="size-4.5" />}
                      count={post?.stats?.shares ?? 0}
                      label={t('common.share')}
                      active={Boolean(post?.sharedByViewer)}
                      disabled={isShareProcessing || postAction === 'share'}
                      onClick={handleShareButtonClick}
                    />
                    {isShareMenuOpen ? (
                      <div className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-[0_20px_45px_rgba(15,23,42,0.16)]">
                        <button
                          type="button"
                          onClick={handleShareCopyLink}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                        >
                          <span>{t('common.shareActions.copyLink')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareToPlatform('whatsapp')}
                          className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                        >
                          <span>{t('common.shareActions.whatsapp')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareToPlatform('x')}
                          className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                        >
                          <span>{t('common.shareActions.x')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareToPlatform('facebook')}
                          className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                        >
                          <span>{t('common.shareActions.facebook')}</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted">
                    <EyeIcon />
                    <span>{formatViewCount(postViews, lang === 'tr' ? 'tr-TR' : 'en-US')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileCommentsOpen(false)}
                    className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
                    aria-label={t('common.close')}
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              <div className="border-b border-border px-4 py-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setCommentSort('popular')} className={`rounded-lg cursor-pointer px-3 py-1.5 text-sm font-medium transition ${commentSort === 'popular' ? 'bg-primary text-inverse' : 'bg-secondary text-muted'}`}>{t('postDetail.popular')}</button>
                  <button type="button" onClick={() => setCommentSort('latest')} className={`rounded-lg cursor-pointer px-3 py-1.5 text-sm font-medium transition ${commentSort === 'latest' ? 'bg-primary text-inverse' : 'bg-secondary text-muted'}`}>{t('postDetail.latest')}</button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {detailState.isLoading ? <div className="rounded-[24px] border border-border bg-secondary px-4 py-4 text-sm text-muted">{t('postDetail.commentsLoading')}</div> : null}
                {!detailState.isLoading && !sortedComments.length ? <div className="rounded-[24px] border border-dashed border-border px-4 py-6 text-sm text-muted">{t('postDetail.noComments')}</div> : null}
                <div className="space-y-1">
                  {sortedComments.map((comment) => (
                    <Suspense key={comment.id || comment._id} fallback={null}>
                      <PostDetailCommentItem
                        comment={comment}
                        level={0}
                        lang={lang}
                        t={t}
                        viewerUserId={viewerUserId}
                        postAuthorId={postAuthorId}
                        onReply={(target) => {
                          setReplyTargetId(target.id || target._id)
                          setEditingCommentId(null)
                          setCommentDraft('')
                          clearCommentMedia()
                          commentTextareaRef.current?.focus()
                        }}
                        onLike={(target) => updateCommentAction(target, toggleCommentLike)}
                        onEdit={(target) => {
                          setEditingCommentId(target.id || target._id)
                          setReplyTargetId(null)
                          setCommentDraft(target.text || '')
                          clearCommentMedia()
                          commentTextareaRef.current?.focus()
                        }}
                        onDelete={handleDeleteComment}
                        onRequestDelete={handleRequestDeleteComment}
                        replyTargetId={replyTargetId}
                        commentDraft={commentDraft}
                        onCommentDraftChange={setCommentDraft}
                        onSubmitReply={handleSubmitComment}
                        onCancelReply={() => {
                          setReplyTargetId(null)
                          setEditingCommentId(null)
                        }}
                        onOpenMediaPicker={() => commentMediaInputRef.current?.click()}
                        commentPreview={commentPreview}
                        onClearMedia={clearCommentMedia}
                        submitError={submitError}
                        canSubmitComment={canSubmitComment}
                        isSubmitting={isSubmitting}
                        activeCommentMenuId={activeCommentMenuId}
                        onToggleCommentMenu={setActiveCommentMenuId}
                        onReportComment={handleOpenCommentReport}
                        openRepliesById={openRepliesById}
                        onToggleReplies={handleToggleReplies}
                        editingCommentId={editingCommentId}
                        isAuthenticated={isAuthenticated}
                      />
                    </Suspense>
                  ))}
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                {editingComment ? <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-secondary px-4 py-3 text-xs text-muted"><span>{t('postDetail.editingComment')}</span><button type="button" onClick={resetComposerState}>{t('postDetail.cancel')}</button></div> : null}
                {submitError ? <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">{submitError}</div> : null}
                {!replyTarget ? <div className="flex items-end gap-3 rounded-lg border border-border-soft bg-secondary px-3 py-3 transition-colors focus-within:border-border">
                  <UserAvatar user={user || author} className="size-10 shrink-0 bg-white text-zinc-950" textClassName="text-xs font-semibold" />
                  <div className="min-w-0 flex-1">
                    <textarea
                      ref={commentTextareaRef}
                      rows={1}
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      onKeyDown={handleCommentKeyDown}
                      disabled={!isAuthenticated || isSubmitting}
                      placeholder={isAuthenticated ? t('postDetail.addComment') : t('postDetail.commentLoginPlaceholder')}
                      className="max-h-[140px] min-h-[44px] w-full resize-none bg-transparent py-2 text-sm leading-6 text-text outline-none placeholder:text-soft disabled:cursor-not-allowed"
                    />
                    <CommentComposerPreview
                      preview={commentPreview}
                      onRemove={clearCommentMedia}
                      removeLabel={t('postDetail.removePreview')}
                    />
                  </div>
                  <div className="flex items-center gap-1 pb-1">
                    <button type="button" onClick={() => commentMediaInputRef.current?.click()} disabled={!isAuthenticated || isSubmitting} className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text disabled:cursor-not-allowed disabled:opacity-50" aria-label={t('postDetail.addMedia')} title={t('postDetail.addMedia')}><PhotoIcon /></button>
                    <button type="button" onClick={handleSubmitComment} disabled={!isAuthenticated || isSubmitting || !canSubmitComment} className="grid size-10 place-items-center rounded-full bg-primary text-inverse transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-secondary-hover disabled:text-soft" aria-label={editingCommentId ? t('postDetail.updateComment') : t('postDetail.sendComment')} title={editingCommentId ? t('postDetail.updateComment') : t('postDetail.sendComment')}><SendIcon /></button>
                  </div>
                </div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <input
        ref={commentMediaInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleCommentMediaChange}
        className="hidden"
      />
      {isReportOpen ? (
        <Suspense fallback={null}>
          <ReportDialog
            open={isReportOpen}
            targetKind={reportTarget.kind}
            targetId={reportTarget.id || postId}
            title={reportTarget.kind === 'comment' ? t('postDetail.reportComment') : t('postDetail.reportContent')}
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
            title={t('postDetail.deleteCommentTitle')}
            description={t('postDetail.deleteCommentBody')}
            confirmLabel={t('postDetail.delete')}
            cancelLabel={t('postDetail.cancel')}
            confirmTone="danger"
            showReasonField={false}
            onCancel={() => setPendingDeleteComment(null)}
            onConfirm={async () => {
              await handleConfirmDeleteComment()
            }}
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

export default PostDetailModal
