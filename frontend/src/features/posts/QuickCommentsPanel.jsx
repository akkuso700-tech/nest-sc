import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import HashtagText from '../../components/common/HashtagText.jsx'
import UserAvatar from '../../components/common/UserAvatar.jsx'
import VerifiedBadge from '../../components/common/VerifiedBadge.jsx'
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
import ShareMenuPopover from './ShareMenuPopover.jsx'
import { renderHighlightedDraft } from './components/composer/ComposerHighlightedDraft.jsx'
const ReplyComposer = lazy(() => import('./ReplyComposer.jsx'))
const MediaGallery = lazy(() => import('./MediaGallery.jsx'))

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
  const navigate = useNavigate()
  const commentId = comment.id || comment._id
  const [isRepliesOpen, setIsRepliesOpen] = useState(false)
  const isMenuOpen = activeCommentMenuId === commentId
  const canDeleteComment = Boolean(comment?.canDelete || comment?.canEdit)
  const canEditComment = Boolean(comment?.canEdit)

  function handleMentionNavigate(mention) {
    const username = mention.replace(/^@/, '')
    if (username.toLowerCase() === 'nestai') return
    navigate(`/${lang}/u/${username}`)
  }

  function handleTopicNavigate(topic) {
    navigate(`/${lang}?topic=${encodeURIComponent(topic)}`)
  }
  const isReplying = replyTargetId === commentId
  const isEditing = editingCommentId === commentId
  const isInlineComposerOpen = isReplying || isEditing
  const replyCount = comment.replies?.length || 0

  return (
    <div className="space-y-0">
      <div className="py-1">
        <div className="relative min-w-0 rounded-xl bg-secondary p-2.5 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Link
                to={`/${lang}/u/${comment.author?.username || ''}`}
                className="shrink-0 transition hover:scale-[1.02]"
              >
                <UserAvatar
                  user={comment.author}
                  className="size-8 text-[11px] font-semibold"
                />
              </Link>
              <div className="min-w-0">
                <Link
                  to={`/${lang}/u/${comment.author?.username || ''}`}
                  className="flex min-w-0 items-center gap-1.5 transition hover:opacity-80"
                >
                  <span className="truncate text-sm font-semibold text-text">
                    {getFullName(comment.author)}
                  </span>
                  <VerifiedBadge user={comment.author} size="xs" />
                </Link>
                <div className="flex min-w-0 items-center gap-1 text-xs text-soft">
                  <span className="truncate">@{comment.author?.username}</span>
                  <span className="shrink-0">-</span>
                  <span className="shrink-0">
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative shrink-0">
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
          </div>

          {comment.text ? (
            <p className="mt-2 whitespace-pre-line text-sm sm:text-[15px] leading-6 text-text">
              <HashtagText
                text={comment.text}
                onHashtagClick={handleTopicNavigate}
                onMentionClick={handleMentionNavigate}
              />
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
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
              className="rounded-full cursor-pointer px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition"
            >
              {isReplying ? t('postDetail.hideReplies') : t('common.reply')}
            </button>
            {canEditComment ? (
              <button
                type="button"
                onClick={() => onEdit(comment)}
                className="rounded-full cursor-pointer px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition"
              >
                {isEditing ? t('postDetail.editing') : t('postDetail.edit')}
              </button>
            ) : null}
          </div>

          {replyCount ? (
            <button
              type="button"
              onClick={() => setIsRepliesOpen((current) => !current)}
              className="mt-1 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-card hover:text-text"
            >
              {isRepliesOpen
                ? t('postDetail.hideReplies')
                : t('postDetail.viewReplies', { count: replyCount })}
            </button>
          ) : null}

          {isInlineComposerOpen ? (
            <div className="relative mt-2.5">
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

      {replyCount && isRepliesOpen ? (
        <div className="relative mt-1 ml-2 sm:ml-3 pl-2 sm:pl-3 border-l-2 border-border/80 space-y-1">
          {comment.replies.map((reply) => (
            <QuickCommentItem
              key={reply.id || reply._id}
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
          ))}
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
  onLikeCountClick,
  onCommentAction,
  onSavePost,
  onShareAction,
  shareMenuOpen,
  shareMenuRef,
  shareProcessing,
  onShareCopyLink,
  onShareToPlatform,
  sharePayload,
  shareTargets,
  onShareClose,
  onTrackShare,
  onShowToast,
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
      {!replyTarget ? (
        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1 rounded-lg border border-border bg-card focus-within:border-primary">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre-wrap break-words px-3.5 py-2 font-sans text-sm leading-5 text-text"
            >
              {renderHighlightedDraft(draft)}
            </div>
            <textarea
              ref={commentInputRef}
              rows={isMobile ? 2 : 1}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              disabled={disabled}
              placeholder={
                disabled
                  ? t('postDetail.commentLoginPlaceholder')
                  : replyTarget
                    ? t('postDetail.replyPlaceholder')
                    : t('postDetail.addComment')
              }
              className="relative z-[1] block w-full resize-none bg-transparent px-3.5 py-2 font-sans text-sm leading-5 text-transparent outline-none placeholder:text-soft selection:bg-primary/25 disabled:cursor-not-allowed"
              style={{ caretColor: 'rgb(var(--color-text))' }}
            />
          </div>
          <button
            type="button"
            onClick={onOpenMediaPicker}
            disabled={disabled || isSubmitting}
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted transition hover:bg-secondary hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('postDetail.addMedia')}
          >
            <PhotoIcon />
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || isSubmitting || !canSubmit}
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-secondary-hover disabled:text-soft"
            aria-label={t('postDetail.sendComment')}
            title={t('postDetail.sendComment')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-5" aria-hidden="true">
              <path d="M3 12 20 4l-4.5 16-4-6-8.5-2z" />
            </svg>
          </button>
        </div>
      ) : null}
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
                onCountClick={onLikeCountClick}
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
              <div data-share-menu="true" className="relative">
                <InlineActionButton
                  icon={<ShareIcon />}
                  count={shareCount}
                  label={t('common.share')}
                  onClick={onShareAction}
                  active={Boolean(sharedByViewer)}
                  disabled={shareProcessing || shareDisabled}
                />
                <ShareMenuPopover
                  open={shareMenuOpen}
                  onClose={onShareClose || (() => {})}
                  sharePayload={sharePayload}
                  shareTargets={shareTargets}
                  isMobile={isMobile}
                  variant="feed"
                  onTrackShare={onTrackShare}
                  onShowToast={onShowToast}
                />
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
