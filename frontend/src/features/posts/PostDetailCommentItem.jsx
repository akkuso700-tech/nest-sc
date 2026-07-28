import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import UserAvatar from '../../components/common/UserAvatar.jsx'
import VerifiedBadge from '../../components/common/VerifiedBadge.jsx'
import { formatRelativeTime, getFullName } from '../../utils/social.js'

const ReplyComposer = lazy(() => import('./ReplyComposer.jsx'))
const MediaGallery = lazy(() => import('./MediaGallery.jsx'))

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

function PostDetailCommentItem({
  comment,
  level = 0,
  lang,
  t,
  viewerUserId,
  postAuthorId,
  onReply,
  onLike,
  onEdit,
  onDelete,
  onRequestDelete,
  replyTargetId,
  commentDraft,
  onCommentDraftChange,
  onSubmitReply,
  onCancelReply,
  onOpenMediaPicker,
  commentPreview,
  onClearMedia,
  submitError,
  canSubmitComment,
  isSubmitting,
  activeCommentMenuId,
  onToggleCommentMenu,
  onReportComment,
  openRepliesById,
  onToggleReplies,
  editingCommentId,
  isAuthenticated,
}) {
  const author = comment.author || {}
  const commentId = comment.id || comment._id
  const isReplying = replyTargetId === commentId
  const isEditing = editingCommentId === commentId
  const isInlineComposerOpen = isReplying || isEditing
  const isMenuOpen = activeCommentMenuId === commentId
  const isRepliesVisible = Boolean(openRepliesById[commentId])
  const avatarAnchorRef = useRef(null)
  const repliesRailRef = useRef(null)
  const [threadGeometry, setThreadGeometry] = useState({ x: 18, start: -54, indent: 46 })
  const replyCount = comment.replies?.length || 0
  const normalizedViewerUserId = viewerUserId?.toString?.() || ''
  const normalizedPostAuthorId = postAuthorId?.toString?.() || ''
  const isPostOwner =
    Boolean(normalizedViewerUserId) &&
    Boolean(normalizedPostAuthorId) &&
    normalizedViewerUserId === normalizedPostAuthorId
  const canEditComment = Boolean(comment.canEdit)
  const canDeleteComment = Boolean(comment.canDelete || canEditComment || isPostOwner)

  useEffect(() => {
    if (isInlineComposerOpen) {
      onToggleReplies(commentId, true)
    }
  }, [commentId, isInlineComposerOpen, onToggleReplies])

  useLayoutEffect(() => {
    if (!isRepliesVisible) return

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
  }, [isRepliesVisible])

  return (
    <div className="space-y-1" style={{ marginLeft: `${level * 18}px` }}>
      <article className="relative py-1 ">
        <div className="flex items-start gap-1">
          <Link ref={avatarAnchorRef} to={`/${lang}/u/${author.username || ''}`} className="shrink-0">
            <UserAvatar
              user={author}
              className="size-10 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
              textClassName="text-xs font-semibold"
            />
          </Link>

          <div className="relative min-w-0 flex-1 rounded-lg bg-secondary p-2 pr-10">
            <div className="flex items-center gap-2 text-sm">
              <Link to={`/${lang}/u/${author.username || ''}`} className="truncate font-semibold text-zinc-950 transition hover:opacity-80 dark:text-white">
                <span className="flex items-center gap-1">{getFullName(author)} <VerifiedBadge user={author} size="xs" /></span>
              </Link>
              <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">@{author.username}</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{formatRelativeTime(comment.createdAt)}</span>
              <div className="absolute right-2 top-2 z-10">
                <button
                  type="button"
                  onClick={() => onToggleCommentMenu(commentId)}
                  className="grid size-7 place-items-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label={t('postDetail.commentOptions')}
                  title={t('postDetail.commentOptions')}
                >
                  <DotsIcon className="size-4" />
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

            <div className=" ">
              {comment.text ? (
                <p className="whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                  {comment.text}
                </p>
              ) : null}

              <Suspense fallback={null}>
                <MediaGallery items={comment.media || []} className="mt-3 border-0 bg-transparent p-0 dark:bg-transparent" />
              </Suspense>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <CommentActionText
                label={t('postDetail.likeCount', { count: comment.stats?.likes ?? 0 })}
                onClick={() => onLike(comment)}
                active={Boolean(comment.likedByViewer)}
                disabled={!isAuthenticated}
              />
              <CommentActionText
                label={isReplying ? t('postDetail.hideReplies') : t('common.reply')}
                onClick={() => (isReplying ? onCancelReply() : onReply(comment))}
                active={isReplying}
              />
              {canEditComment ? (
                <CommentActionText
                  label={isEditing ? t('postDetail.editing') : t('postDetail.edit')}
                  onClick={() => onEdit(comment)}
                  active={isEditing}
                />
              ) : null}
            </div>

            {replyCount ? (
              <button
                type="button"
                onClick={() => onToggleReplies(commentId)}
                className="mt-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                {isRepliesVisible
                  ? t('postDetail.hideReplies')
                  : t('postDetail.viewReplies', { count: replyCount })}
              </button>
            ) : null}

            {isInlineComposerOpen ? (
              <div className="relative mt-3 pl-4">
                <span className="absolute -left-[30px] top-[-12px] h-5 w-[24px] rounded-bl-[12px] border-b border-l border-zinc-300/75 dark:border-zinc-600/80" />
                <span className="absolute left-0 top-2 bottom-2 w-px rounded-full bg-zinc-300/75 dark:bg-zinc-600/80" />
                <Suspense fallback={null}>
                  <ReplyComposer
                    draft={commentDraft}
                    onDraftChange={onCommentDraftChange}
                    disabled={!isAuthenticated}
                    isSubmitting={isSubmitting}
                    placeholder={
                      isAuthenticated
                        ? isEditing
                          ? t('postDetail.updateComment')
                          : `${getFullName(author)} ${t('postDetail.replyingToUser')}`
                        : t('postDetail.commentLoginPlaceholder')
                    }
                    onCancel={onCancelReply}
                    onOpenMediaPicker={onOpenMediaPicker}
                    onSubmit={onSubmitReply}
                    canSubmit={canSubmitComment}
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
      </article>

      {replyCount && isRepliesVisible ? (
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
                <PostDetailCommentItem
                  comment={reply}
                  level={level + 1}
                  lang={lang}
                  t={t}
                  viewerUserId={viewerUserId}
                  postAuthorId={postAuthorId}
                  onReply={onReply}
                  onLike={onLike}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRequestDelete={onRequestDelete}
                  replyTargetId={replyTargetId}
                  commentDraft={commentDraft}
                  onCommentDraftChange={onCommentDraftChange}
                  onSubmitReply={onSubmitReply}
                  onCancelReply={onCancelReply}
                  onOpenMediaPicker={onOpenMediaPicker}
                  commentPreview={commentPreview}
                  onClearMedia={onClearMedia}
                  submitError={submitError}
                  canSubmitComment={canSubmitComment}
                  isSubmitting={isSubmitting}
                  activeCommentMenuId={activeCommentMenuId}
                  onToggleCommentMenu={onToggleCommentMenu}
                  onReportComment={onReportComment}
                  openRepliesById={openRepliesById}
                  onToggleReplies={onToggleReplies}
                  editingCommentId={editingCommentId}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PostDetailCommentItem
