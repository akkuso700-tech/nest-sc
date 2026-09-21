import { Link } from 'react-router-dom'
import UserAvatar from '../../../components/common/UserAvatar.jsx'
import VerifiedBadge from '../../../components/common/VerifiedBadge.jsx'
import { formatRelativeTime, getFullName } from '../../../utils/social.js'
import { MoreIcon } from '../PostCardIcons.jsx'

export default function PostCardHeader({
  lang,
  author,
  localPost,
  groupHeaderName,
  groupHeaderCoverUrl,
  hasAuthorStory,
  canFollowAuthor,
  isFollowProcessing,
  isAuthorFollowed,
  followLabelText,
  unfollowLabelText,
  isMenuOpen,
  menuRef,
  isOwnPost,
  isAuthenticated,
  pendingAction,
  onAuthorAvatarClick,
  onFollowToggle,
  onMenuToggle,
  onMenuClose,
  onEditPost,
  onArchivePost,
  onDeletePost,
  onMarkNotInterested,
  onOpenReport,
  onOpenInsights,
  t,
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-1">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to={`/${lang}/u/${author.username || ''}`}
          className="shrink-0 transition hover:scale-[1.02]"
          onClick={onAuthorAvatarClick}
        >
          {groupHeaderName && groupHeaderCoverUrl ? (
            <div className="relative h-14 w-20">
              <img
                src={groupHeaderCoverUrl}
                alt={groupHeaderName}
                className="h-14 w-20 rounded-lg object-cover"
              />
              <div
                className={`absolute -bottom-2 -right-2 rounded-full p-[2px] ${
                  hasAuthorStory
                    ? 'bg-gradient-to-br from-pink-500 via-amber-400 to-violet-500'
                    : 'bg-card'
                }`}
              >
                <UserAvatar
                  user={author}
                  className="size-8 border border-card text-[11px] font-semibold"
                  textClassName="text-[11px] font-semibold"
                />
              </div>
            </div>
          ) : (
            <div
              className={`rounded-full p-[2px] ${
                hasAuthorStory
                  ? 'bg-gradient-to-br from-pink-500 via-amber-400 to-violet-500'
                  : 'bg-transparent'
              }`}
            >
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
              <Link to={`/${lang}/u/${author.username || ''}`} className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5 font-semibold text-base">
                  <span className="truncate">{author.name || getFullName(author)}</span>
                  <VerifiedBadge user={author} />
                </span>
              </Link>
            </div>
            {canFollowAuthor ? (
              <button
                type="button"
                onClick={onFollowToggle}
                disabled={isFollowProcessing}
                className={`shrink-0 rounded-lg cursor-pointer border px-2.5 py-1 text-[11px] font-semibold transition ${
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
          onClick={onMenuToggle}
          className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text cursor-pointer"
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
                    onMenuClose()
                    onOpenInsights()
                  }}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-text transition hover:bg-secondary cursor-pointer"
                >
                  <span className="text-base leading-none">📊</span>
                  <span>{t('insights.viewInsights', { defaultValue: 'İstatistikleri Gör' })}</span>
                </button>
                <button
                  type="button"
                  onClick={onEditPost}
                  className="flex w-full rounded-2xl px-3 py-2.5 text-left text-sm text-text transition hover:bg-secondary cursor-pointer"
                >
                  {t('postDetail.edit')}
                </button>
                <button
                  type="button"
                  onClick={onArchivePost}
                  className="flex w-full rounded-2xl px-3 py-2.5 text-left text-sm text-text transition hover:bg-secondary cursor-pointer"
                >
                  Arşive kaldır
                </button>
                <button
                  type="button"
                  onClick={onDeletePost}
                  className="flex w-full rounded-2xl px-3 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:hover:bg-zinc-900 cursor-pointer"
                >
                  {t('postDetail.delete')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onMarkNotInterested}
                  disabled={!isAuthenticated || pendingAction === 'not-interested'}
                  className="flex w-full rounded-lg cursor-pointer px-3 py-2.5 text-left text-sm text-text transition hover:bg-secondary disabled:opacity-60"
                >
                  {t('postDetail.notInterested', { defaultValue: 'İlgilenmiyorum' })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMenuClose()
                    onOpenReport()
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
  )
}
