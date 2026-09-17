import { InlineActionButton } from './PostCardButtons.jsx'
import ShareMenuPopover from '../ShareMenuPopover.jsx'
import {
  BookmarkIcon,
  CommentIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
} from '../PostCardIcons.jsx'

export default function PostCardActions({
  localPost,
  likes,
  comments,
  saves,
  shares,
  views,
  isAuthenticated,
  pendingAction,
  isShareProcessing,
  isShareMenuOpen,
  shareMenuRef,
  sharePayload,
  shareTargets,
  isMobileViewport,
  canViewInsights,
  lang,
  t,
  formatViewCount,
  onLike,
  onLikeCountClick,
  onCommentClick,
  onSave,
  onShareButtonClick,
  onShareMenuClose,
  onTrackShare,
  onShowToast,
  onOpenInsights,
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 px-4">
      <div className="flex flex-wrap items-center gap-1">
        <InlineActionButton
          icon={<HeartIcon filled={Boolean(localPost.likedByViewer)} />}
          count={likes}
          label={t('common.like')}
          onClick={onLike}
          onCountClick={onLikeCountClick}
          active={Boolean(localPost.likedByViewer)}
          disabled={!isAuthenticated || pendingAction === 'like'}
        />
        <InlineActionButton
          icon={<CommentIcon />}
          count={comments}
          label={t('common.comment')}
          onClick={onCommentClick}
        />
        <InlineActionButton
          icon={<BookmarkIcon filled={Boolean(localPost.savedByViewer)} />}
          count={saves}
          label={t('common.save')}
          onClick={onSave}
          active={Boolean(localPost.savedByViewer)}
          disabled={!isAuthenticated || pendingAction === 'save'}
        />
        <div ref={shareMenuRef} data-share-menu="true" className="relative">
          <InlineActionButton
            icon={<ShareIcon />}
            count={shares}
            label={t('common.share')}
            onClick={onShareButtonClick}
            active={Boolean(localPost.sharedByViewer)}
            disabled={isShareProcessing || pendingAction === 'share'}
          />

          <ShareMenuPopover
            open={isShareMenuOpen}
            onClose={onShareMenuClose}
            sharePayload={sharePayload}
            shareTargets={shareTargets}
            isMobile={isMobileViewport}
            variant="feed"
            onTrackShare={onTrackShare}
            onShowToast={onShowToast}
          />
        </div>
      </div>

      {canViewInsights ? (
        <button
          type="button"
          onClick={onOpenInsights}
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
  )
}
