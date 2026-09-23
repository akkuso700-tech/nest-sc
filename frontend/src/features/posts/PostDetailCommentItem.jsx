import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import HashtagText from '../../components/common/HashtagText.jsx'
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
  const navigate = useNavigate()

  function handleMentionNavigate(mention) {
    const username = mention.replace(/^@/, '')
    if (username.toLowerCase() === 'nestai') return
    navigate(`/${lang}/u/${username}`)
  }

  function handleTopicNavigate(topic) {
    navigate(`/${lang}?topic=${encodeURIComponent(topic)}`)
  }

  useEffect(() => {
    if (isInlineComposerOpen) {
      onToggleReplies(commentId, true)
    }
  }, [commentId, isInlineComposerOpen, onToggleReplies])

  return (
    <div className="space-y-0">
      <article className="py-1">
        <div className="relative min-w-0 rounded-xl bg-secondary p-2.5 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Link to={`/${lang}/u/${author.username || ''}`} className="shrink-0">
                <UserAvatar
                  user={author}
                  className="size-8 text-xs font-semibold"
                  textClassName="text-xs font-semibold"
                />
              </Link>
              <div className="min-w-0">
                <Link to={`/${lang}/u/${author.username || ''}`} className="flex min-w-0 items-center gap-1 transition hover:opacity-80">
                  <span className="truncate text-sm font-semibold text-text">{getFullName(author)}</span>
                  <VerifiedBadge user={author} size="xs" />
                </Link>
                <div className="flex min-w-0 items-center gap-1 text-xs text-soft">
                  <span className="truncate">@{author.username}</span>
                  <span className="shrink-0">-</span>
                  <span className="shrink-0">{formatRelativeTime(comment.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="relative shrink-0">
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

          <div className="mt-2">
            {comment.text ? (
              <p className="whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                <HashtagText
                  text={comment.text}
                  onHashtagClick={handleTopicNavigate}
                  onMentionClick={handleMentionNavigate}
                />
              </p>
            ) : null}

            <Suspense fallback={null}>
              <MediaGallery items={comment.media || []} className="mt-3 border-0 bg-transparent p-0 dark:bg-transparent" />
            </Suspense>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
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
            <div className="relative mt-2.5">
              <Suspense fallback={null}>
                <ReplyComposer
                  draft={commentDraft}
                  onCommentDraftChange={onCommentDraftChange}
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
      </article>

      {replyCount && isRepliesVisible ? (
        <div className="relative mt-1 ml-2.5 sm:ml-3 pl-2 sm:pl-3 border-l-2 border-border/80 space-y-1">
          {comment.replies.map((reply) => (
            <PostDetailCommentItem
              key={reply.id || reply._id}
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
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default PostDetailCommentItem
