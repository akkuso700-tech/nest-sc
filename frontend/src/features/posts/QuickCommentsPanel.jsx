import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import HashtagText from '../../components/common/HashtagText.jsx'
import UserAvatar from '../../components/common/UserAvatar.jsx'
import { formatRelativeTime, getFullName } from '../../utils/social.js'
import {
  BookmarkIcon,
  CloseIcon,
  CommentIcon,
  EyeIcon,
  HeartIcon,
  MoreIcon,
  ShareIcon,
} from './PostCardIcons.jsx'
import { PhotoIcon } from './PostComposerIcons.jsx'
const ReplyComposer = lazy(() => import('./ReplyComposer.jsx'))
const MediaGallery = lazy(() => import('./MediaGallery.jsx'))

function InlineActionButton({
  icon,
  count,
  label,
  onClick,
  active = false,
  disabled = false,
}) {
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
      <span className="text-xs font-semibold">{count}</span>
    </button>
  )
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

function shouldClampCommentText(text) {
  if (!text) {
    return false
  }

  const normalized = String(text).replace(/\r/g, '')
  const lineCount = normalized.split('\n').length
  return lineCount > 3 || normalized.length > 220
}

function QuickCommentItem({
  comment,
  lang,
  isAuthenticated,
  replyTargetId,
  onReply,
  onEdit,
  onLike,
  draft,
  onDraftChange,
  onSubmitReply,
  onCancelReply,
  onOpenMediaPicker,
  commentPreview,
  onClearMedia,
  submitError,
  canSubmit,
  isSubmitting,
  activeCommentMenuId,
  onToggleCommentMenu,
  onRequestDelete,
  onReportComment,
  editingCommentId,
  level = 0,
}) {
  const { t } = useTranslation()
  const commentId = comment.id || comment._id
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRepliesOpen, setIsRepliesOpen] = useState(false)
  const isMenuOpen = activeCommentMenuId === commentId
  const canDeleteComment = Boolean(comment?.canDelete || comment?.canEdit)
  const canEditComment = Boolean(comment?.canEdit)
  const isReplying = replyTargetId === commentId
  const isEditing = editingCommentId === commentId
  const isInlineComposerOpen = isReplying || isEditing
  const avatarAnchorRef = useRef(null)
  const repliesRailRef = useRef(null)
  const [threadGeometry, setThreadGeometry] = useState({ x: 18, start: -54, indent: 46 })
  const hasLongText = shouldClampCommentText(comment.text)
  const replyCount = comment.replies?.length || 0

  useLayoutEffect(() => {
    if (!isRepliesOpen) return

    function updateThreadGeometry() {
      const avatarEl = avatarAnchorRef.current
      const railEl = repliesRailRef.current
      if (!avatarEl || !railEl) return

      const avatarRect = avatarEl.getBoundingClientRect()
      const railRect = railEl.getBoundingClientRect()
      const x = Math.max(8, Math.round(avatarRect.left + avatarRect.width / 2 - railRect.left))
      const start = Math.round(avatarRect.bottom - railRect.top)
      const indent = Math.max(x + 28, 44)
      setThreadGeometry({ x, start, indent })
    }

    updateThreadGeometry()
    window.addEventListener('resize', updateThreadGeometry)
    return () => window.removeEventListener('resize', updateThreadGeometry)
  }, [isRepliesOpen])

  return (
    <div className="space-y-0" style={{ marginLeft: `${level * 14}px` }}>
      <div className=" md:px-4 py-1">
        <div className="flex items-start gap-1">
          <Link
            ref={avatarAnchorRef}
            to={`/${lang}/u/${comment.author?.username || ''}`}
            className="shrink-0 transition hover:scale-[1.02]"
          >
            <UserAvatar
              user={comment.author}
              className="size-9 text-[11px] font-semibold"
            />
          </Link>

          <div className="relative min-w-0 flex-1 rounded-lg bg-secondary p-2 pr-10">
            <Link
              to={`/${lang}/u/${comment.author?.username || ''}`}
              className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl transition hover:opacity-80"
            >
              <span className="truncate text-sm font-semibold text-text">
                {getFullName(comment.author)}
              </span>
              <span className="text-xs text-soft">
                @{comment.author?.username} - {formatRelativeTime(comment.createdAt)}
              </span>
            </Link>
            <div className="absolute right-2 top-2 z-10">
              <button
                type="button"
                onClick={() => onToggleCommentMenu(commentId)}
                data-comment-menu-trigger
                className="grid size-7 cursor-pointer place-items-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label={t('postDetail.commentOptions')}
              >
                <MoreIcon />
              </button>
              {isMenuOpen ? (
                <div data-comment-menu className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-36 rounded-xl border border-border bg-card p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
                  {canDeleteComment ? (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleCommentMenu(null)
                        onRequestDelete(comment)
                      }}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-secondary"
                    >
                      {t('postDetail.delete')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCommentMenu(null)
                      onReportComment(comment)
                    }}
                    className="mt-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium text-text transition hover:bg-secondary"
                  >
                    {t('postDetail.reportComment')}
                  </button>
                </div>
              ) : null}
            </div>

            {comment.text ? (
              <>
                <p
                  className="md:mt-2 whitespace-pre-line text-base leading-6 text-text"
                  style={
                    !isExpanded
                      ? {
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }
                      : undefined
                  }
                >
                  {comment.text}
                </p>
                {hasLongText ? (
                  <button
                    type="button"
                    onClick={() => setIsExpanded((current) => !current)}
                    className="mt-1 text-xs font-medium text-accent transition hover:text-primary"
                  >
                    {isExpanded ? t('postDetail.less') : t('postDetail.more')}
                  </button>
                ) : null}
              </>
            ) : null}

            <div className="md:mt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onLike(comment)}
                disabled={!isAuthenticated}
                className={`text-xs cursor-pointer font-medium transition ${
                  comment.likedByViewer
                    ? 'text-primary dark:text-primary'
                    : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {t('postDetail.likeCount', { count: comment.stats?.likes ?? 0 })}
              </button>
              <button
                type="button"
                onClick={() => onReply(comment)}
                className={`rounded-full cursor-pointer px-2.5 py-1.5 text-xs font-medium transition ${
                  replyTargetId === commentId
                    ? 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white '
                    : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white '
                }`}
              >
                {isReplying ? t('postDetail.hideReplies') : t('common.reply')}
              </button>
              {canEditComment ? (
                <button
                  type="button"
                  onClick={() => onEdit(comment)}
                  className={`rounded-full cursor-pointer px-2.5 py-1.5 text-xs font-medium transition ${
                    isEditing ? 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white' : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  {isEditing ? t('postDetail.editing') : t('postDetail.edit')}
                </button>
              ) : null}
            </div>

            {replyCount ? (
              <button
                type="button"
                onClick={() => setIsRepliesOpen((current) => !current)}
                className="md:mt-1 cursor-pointer rounded-full px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-secondary hover:text-text"
              >
                {isRepliesOpen
                  ? t('postDetail.hideReplies')
                  : t('postDetail.viewReplies', { count: replyCount })}
              </button>
            ) : null}

            {isInlineComposerOpen ? (
              <div className="relative mt-3 pl-4">
                <span className="absolute -left-[28px] top-[-12px] h-5 w-[24px] rounded-bl-[12px] border-b border-l border-zinc-300/75 dark:border-zinc-600/80" />
                <span className="absolute left-0 top-2 bottom-2 w-px rounded-full bg-zinc-300/75 dark:bg-zinc-600/80" />
                <Suspense fallback={null}>
                  <ReplyComposer
                    draft={draft}
                    onDraftChange={onDraftChange}
                    disabled={!isAuthenticated}
                    isSubmitting={isSubmitting}
                    placeholder={
                      isAuthenticated
                        ? isEditing
                          ? t('postDetail.updateComment')
                          : `${getFullName(comment.author)} ${t('postDetail.replyingToUser')}`
                        : t('postDetail.commentLoginPlaceholder')
                    }
                    onCancel={onCancelReply}
                    onOpenMediaPicker={onOpenMediaPicker}
                    onSubmit={onSubmitReply}
                    canSubmit={canSubmit}
                    commentPreview={commentPreview}
                    onClearMedia={onClearMedia}
                    submitError={submitError}
                    labels={{
                      cancel: t('postDetail.cancel'),
                      addMedia: t('postDetail.addMedia'),
                      send: t('postDetail.sendComment'),
                      removePreview: t('postDetail.removePreview'),
                    }}
                  />
                </Suspense>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {replyCount && isRepliesOpen ? (
        <div ref={repliesRailRef} className="relative">
          <span
            className="absolute w-px rounded-full bg-zinc-300/85 dark:bg-zinc-600/90"
            style={{ left: `${threadGeometry.x}px`, top: `${threadGeometry.start}px`, bottom: '26px' }}
          />
          <div className="space-y-3" style={{ paddingLeft: `${threadGeometry.indent}px` }}>
            {comment.replies.map((reply) => (
              <div key={reply.id || reply._id} className="relative">
                <span
                  className="absolute top-[22px] h-px bg-zinc-300/85 dark:bg-zinc-600/90"
                  style={{
                    left: `${-(threadGeometry.indent - threadGeometry.x)}px`,
                    width: `${threadGeometry.indent - threadGeometry.x}px`,
                  }}
                />
                <QuickCommentItem
                  comment={reply}
                  lang={lang}
                  isAuthenticated={isAuthenticated}
                  replyTargetId={replyTargetId}
                  onReply={onReply}
                  onLike={onLike}
                  draft={draft}
                  onDraftChange={onDraftChange}
                  onSubmitReply={onSubmitReply}
                  onCancelReply={onCancelReply}
                  onOpenMediaPicker={onOpenMediaPicker}
                  commentPreview={commentPreview}
                  onClearMedia={onClearMedia}
                  submitError={submitError}
                  canSubmit={canSubmit}
                  isSubmitting={isSubmitting}
                  activeCommentMenuId={activeCommentMenuId}
                  onToggleCommentMenu={onToggleCommentMenu}
                  onRequestDelete={onRequestDelete}
                  onReportComment={onReportComment}
                  onEdit={onEdit}
                  editingCommentId={editingCommentId}
                  level={level + 1}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function QuickCommentsPanel({
  open,
  isMobile,
  lang,
  t,
  author,
  postText,
  mediaItems,
  onTopicClick,
  onMentionClick,
  onMediaClick,
  commentSort,
  onSortChange,
  likeCount,
  commentCount,
  saveCount,
  shareCount,
  viewCount,
  likedByViewer,
  savedByViewer,
  sharedByViewer,
  onLikePost,
  onCommentAction,
  onSavePost,
  onShareAction,
  shareMenuOpen,
  shareMenuRef,
  shareProcessing,
  onShareCopyLink,
  onShareToPlatform,
  likeDisabled,
  saveDisabled,
  shareDisabled,
  comments,
  draft,
  onDraftChange,
  onSubmit,
  onReply,
  onEdit,
  onLike,
  replyTarget,
  editingCommentId,
  onCancelReply,
  onOpenMediaPicker,
  commentPreview,
  onClearMedia,
  submitError,
  activeCommentMenuId,
  onToggleCommentMenu,
  onRequestDelete,
  onReportComment,
  isSubmitting,
  canSubmit,
  disabled,
  isLoading,
  commentInputRef,
  onClose,
}) {
  const authorName = author?.name || getFullName(author)
  const [isMobileSheetVisible, setIsMobileSheetVisible] = useState(false)

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!isMobile || !open || typeof window === 'undefined') {
      setIsMobileSheetVisible(false)
      return undefined
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      setIsMobileSheetVisible(true)
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [isMobile, open])

  const commentsList = (
    <div className="space-y-1">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-[24px] border border-border bg-secondary px-4 py-4"
            >
              <div className="h-4 w-36 rounded-full bg-secondary-hover" />
              <div className="mt-3 h-3 w-full rounded-full bg-secondary-hover" />
              <div className="mt-2 h-3 w-2/3 rounded-full bg-secondary-hover" />
            </div>
          ))}
        </div>
      ) : comments.length ? (
        comments.map((comment) => (
          <QuickCommentItem
            key={comment.id || comment._id}
            comment={comment}
            lang={lang}
            isAuthenticated={!disabled}
            replyTargetId={replyTarget?.id || replyTarget?._id || null}
            onReply={onReply}
            onEdit={onEdit}
            onLike={onLike}
            draft={draft}
            onDraftChange={onDraftChange}
            onSubmitReply={onSubmit}
            onCancelReply={onCancelReply}
            onOpenMediaPicker={onOpenMediaPicker}
            commentPreview={commentPreview}
            onClearMedia={onClearMedia}
            submitError={submitError}
            activeCommentMenuId={activeCommentMenuId}
            onToggleCommentMenu={onToggleCommentMenu}
            onRequestDelete={onRequestDelete}
            onReportComment={onReportComment}
            editingCommentId={editingCommentId}
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
          />
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted">
          {t('postDetail.noComments')}
        </div>
      )}
    </div>
  )

  const composer = (
    <div className="space-y-3">
      {!replyTarget ? <div className="flex items-end gap-2">
        <textarea
          ref={commentInputRef}
          rows={isMobile ? 3 : 2}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          disabled={disabled}
          placeholder={disabled ? t('postDetail.commentLoginPlaceholder') : (replyTarget ? t('postDetail.replyPlaceholder') : t('postDetail.addComment'))}
          className="flex-1 resize-none rounded-lg h-10 border border-border bg-card px-4 py-2 text-sm text-text outline-none placeholder:text-soft"
        />
        <button
          type="button"
          onClick={onOpenMediaPicker}
          disabled={disabled || isSubmitting}
          className="grid size-10 place-items-center rounded-lg border border-border text-muted transition hover:bg-secondary hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('postDetail.addMedia')}
        >
          <PhotoIcon />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || isSubmitting || !canSubmit}
          className="grid size-10 place-items-center rounded-lg bg-primary text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-secondary-hover disabled:text-soft"
          aria-label={t('postDetail.sendComment')}
          title={t('postDetail.sendComment')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-5" aria-hidden="true">
            <path d="M3 12 20 4l-4.5 16-4-6-8.5-2z" />
          </svg>
        </button>
      </div> : null}
    </div>
  )

  if (!open) {
    return null
  }

  function handleClose(event) {
    event.stopPropagation()
    onClose()
  }

  if (isMobile) {
    return createPortal(
      <div
        className={`fixed inset-0 z-[90] flex flex-col bg-card transition-all duration-300 md:hidden ${
          isMobileSheetVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <p className="text-sm font-semibold text-text">{t('common.comment')}</p>
          <button
            type="button"
            onClick={handleClose}
            className="grid min-h-11 cursor-pointer min-w-11 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="border-b border-border px-4">
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <InlineActionButton
                icon={<HeartIcon filled={Boolean(likedByViewer)} />}
                count={likeCount}
                label={t('common.like')}
                onClick={onLikePost}
                active={Boolean(likedByViewer)}
                disabled={likeDisabled}
              />
              <InlineActionButton
                icon={<CommentIcon />}
                count={commentCount}
                label={t('common.comment')}
                onClick={onCommentAction}
              />
              <InlineActionButton
                icon={<BookmarkIcon filled={Boolean(savedByViewer)} />}
                count={saveCount}
                label={t('common.save')}
                onClick={onSavePost}
                active={Boolean(savedByViewer)}
                disabled={saveDisabled}
              />
              <div ref={shareMenuRef} className="relative">
                <InlineActionButton
                  icon={<ShareIcon />}
                  count={shareCount}
                  label={t('common.share')}
                  onClick={onShareAction}
                  active={Boolean(sharedByViewer)}
                  disabled={shareProcessing || shareDisabled}
                />
                {shareMenuOpen ? (
                  <div className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-[0_20px_45px_rgba(15,23,42,0.16)]">
                    <button
                      type="button"
                      onClick={onShareCopyLink}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                    >
                      <span>{t('common.shareActions.copyLink')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onShareToPlatform('whatsapp')}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                    >
                      <span>{t('common.shareActions.whatsapp')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onShareToPlatform('x')}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                    >
                      <span>{t('common.shareActions.x')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onShareToPlatform('facebook')}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
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
              <span>{formatViewCount(viewCount, lang === 'tr' ? 'tr-TR' : 'en-US')}</span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSortChange('popular')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                commentSort === 'popular'
                  ? 'bg-primary text-inverse'
                  : 'bg-secondary text-muted hover:bg-secondary-hover hover:text-text'
              }`}
            >
              {t('postDetail.popular')}
            </button>
            <button
              type="button"
              onClick={() => onSortChange('latest')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                commentSort === 'latest'
                  ? 'bg-primary text-inverse'
                  : 'bg-secondary text-muted hover:bg-secondary-hover hover:text-text'
              }`}
            >
              {t('postDetail.latest')}
            </button>
          </div>
      <div className=''>
          <div className="hidden md:block rounded-[18px] border border-border bg-secondary px-3 py-3">
            <p className="text-sm font-semibold text-text">
              {authorName ? `${authorName} ${t('postDetail.fallbackTitle')}` : t('postDetail.fallbackTitle')}
            </p>
            {postText ? (
              <p className="mt-1 whitespace-pre-line text-base leading-6 text-text">
                <HashtagText
                  text={postText}
                  onHashtagClick={onTopicClick}
                  onMentionClick={onMentionClick}
                />
              </p>
            ) : null}
            {mediaItems?.length ? (
              <Suspense fallback={null}>
                <MediaGallery
                  items={mediaItems}
                  className="w-full"
                  interactive
                  hoverPlayVideos
                  feedLayout
                  onItemClick={onMediaClick}
                />
              </Suspense>
            ) : null}
          </div>
      </div>

          <p className="hidden md:block mb-3 mt-4 text-sm font-semibold text-text">{t('common.comment')}</p>
          {commentsList}
        </div>

        <div className="shrink-0 border-t border-border bg-card px-4 py-1.5 pb-[max(12px,env(safe-area-inset-bottom))]">
          {composer}
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[75] hidden items-center justify-center p-4 md:flex"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label={t('common.close')}
      />

      <div
        className="relative z-10 flex h-[min(99vh,860px)] w-full max-w-[720px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[0_30px_90px_rgba(15,23,42,0.38)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/95 px-5 py-2 backdrop-blur">
          <p className="truncate text-base font-semibold text-text">
            {authorName ? `${authorName} ${t('postDetail.fallbackTitle')}` : `${t('postDetail.fallbackTitle')} ${t('common.comment')}`}
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="border-b border-border px-5">
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <InlineActionButton
                icon={<HeartIcon filled={Boolean(likedByViewer)} />}
                count={likeCount}
                label={t('common.like')}
                onClick={onLikePost}
                active={Boolean(likedByViewer)}
                disabled={likeDisabled}
              />
              <InlineActionButton
                icon={<CommentIcon />}
                count={commentCount}
                label={t('common.comment')}
                onClick={onCommentAction}
              />
              <InlineActionButton
                icon={<BookmarkIcon filled={Boolean(savedByViewer)} />}
                count={saveCount}
                label={t('common.save')}
                onClick={onSavePost}
                active={Boolean(savedByViewer)}
                disabled={saveDisabled}
              />
              <div ref={shareMenuRef} className="relative">
                <InlineActionButton
                  icon={<ShareIcon />}
                  count={shareCount}
                  label={t('common.share')}
                  onClick={onShareAction}
                  active={Boolean(sharedByViewer)}
                  disabled={shareProcessing || shareDisabled}
                />

                {shareMenuOpen ? (
                  <div className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-[0_20px_45px_rgba(15,23,42,0.16)]">
                    <button
                      type="button"
                      onClick={onShareCopyLink}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                    >
                      <span>{t('common.shareActions.copyLink')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onShareToPlatform('whatsapp')}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                    >
                      <span>{t('common.shareActions.whatsapp')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onShareToPlatform('x')}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
                    >
                      <span>{t('common.shareActions.x')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onShareToPlatform('facebook')}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-secondary"
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
              <span>{formatViewCount(viewCount, lang === 'tr' ? 'tr-TR' : 'en-US')}</span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-border bg-secondary px-4 py-4">
            {postText ? (
              <p className="whitespace-pre-line text-sm leading-7 text-text">
                <HashtagText
                  text={postText}
                  onHashtagClick={onTopicClick}
                  onMentionClick={onMentionClick}
                />
              </p>
            ) : null}
            {mediaItems?.length ? (
              <Suspense fallback={null}>
                <MediaGallery
                  items={mediaItems}
                  className="w-full"
                  interactive
                  hoverPlayVideos
                  feedLayout
                  onItemClick={onMediaClick}
                />
              </Suspense>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-text">{t('common.comment')}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSortChange('popular')}
                  className={`rounded-lg cursor-pointer px-3 py-1.5 text-xs font-medium transition ${
                    commentSort === 'popular'
                      ? 'bg-primary text-inverse'
                      : 'bg-secondary text-muted hover:bg-secondary-hover hover:text-text'
                  }`}
                >
                  {t('postDetail.popular')}
                </button>
                <button
                  type="button"
                  onClick={() => onSortChange('latest')}
                  className={`rounded-lg cursor-pointer px-3 py-1.5 text-xs font-medium transition ${
                    commentSort === 'latest'
                      ? 'bg-primary text-inverse'
                      : 'bg-secondary text-muted hover:bg-secondary-hover hover:text-text'
                  }`}
                >
                  {t('postDetail.latest')}
                </button>
              </div>
            </div>
            {commentsList}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card px-5 py-4">
          {composer}
        </div>
      </div>
    </div>,
    document.body,
  )
}


export default QuickCommentsPanel
