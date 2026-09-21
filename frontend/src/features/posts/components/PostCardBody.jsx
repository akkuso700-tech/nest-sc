import { Suspense, lazy } from 'react'
import HashtagText from '../../../components/common/HashtagText.jsx'

const MediaGallery = lazy(() => import('../MediaGallery.jsx'))

export default function PostCardBody({
  groupHeaderName,
  localPost,
  isLoopVariant,
  content,
  isExpandedText,
  shouldCollapseInline,
  collapsedInlineText,
  mediaItems,
  prioritizeMedia,
  onTopicClick,
  onMentionClick,
  onExpandText,
  onOpenPostDetail,
  t,
}) {
  return (
    <>
      {groupHeaderName && localPost?.title ? (
        <div className={`px-4 pb-1 ${isLoopVariant ? 'hidden' : ''}`}>
          <p className="text-sm font-semibold tracking-tight text-text">{localPost.title}</p>
        </div>
      ) : null}

      {content ? (
        <div className={`px-4 ${isLoopVariant ? 'hidden' : ''}`}>
          {isExpandedText ? (
            <>
              <p className="w-full text-left text-[15px] leading-relaxed font-normal text-text whitespace-pre-line break-words">
                <HashtagText
                  text={content}
                  onHashtagClick={onTopicClick}
                  onMentionClick={onMentionClick}
                />
              </p>
              {shouldCollapseInline ? (
                <button
                  type="button"
                  onClick={() => onExpandText(false)}
                  className="mt-1 text-base font-normal text-primary cursor-pointer hover:underline"
                >
                  {t('postDetail.less')}
                </button>
              ) : null}
            </>
          ) : (
            <p className="w-full text-left text-[15px] leading-relaxed font-normal text-text whitespace-pre-line break-words">
              <HashtagText
                text={shouldCollapseInline ? collapsedInlineText : content}
                onHashtagClick={onTopicClick}
                onMentionClick={onMentionClick}
              />
              {shouldCollapseInline ? (
                <button
                  type="button"
                  onClick={() => onExpandText(true)}
                  className="ml-1 inline font-semibold text-primary underline decoration-transparent underline-offset-2 transition hover:text-primary-hover cursor-pointer"
                >
                  {t('postDetail.more')}
                </button>
              ) : null}
            </p>
          )}
        </div>
      ) : null}

      {mediaItems?.length > 0 && !isLoopVariant ? (
        <div className="mt-3">
          <Suspense fallback={null}>
            <MediaGallery
              items={mediaItems}
              interactive
              hoverPlayVideos
              autoplayOnVisible
              feedLayout
              priority={prioritizeMedia}
              className="w-full"
              onItemClick={(_, index) => onOpenPostDetail(index)}
            />
          </Suspense>
        </div>
      ) : null}
    </>
  )
}
