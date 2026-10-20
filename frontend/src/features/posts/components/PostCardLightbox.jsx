import { useEffect, useRef } from 'react'
import { useAdaptiveVideoSource } from '../../../hooks/useAdaptiveVideoSource.js'
import { prefetchHlsVideo } from '../../../utils/hlsPreload.js'
import { resolveMediaUrl } from '../../../utils/media.js'

function resolveLightboxDimensions(item) {
  const rawWidth = Number(item?.width || item?.meta?.width || item?.dimensions?.width || 0)
  const rawHeight = Number(item?.height || item?.meta?.height || item?.dimensions?.height || 0)
  if (Number.isFinite(rawWidth) && rawWidth > 0 && Number.isFinite(rawHeight) && rawHeight > 0) {
    return { width: Math.round(rawWidth), height: Math.round(rawHeight) }
  }
  return item?.type === 'video' ? { width: 1280, height: 720 } : { width: 1200, height: 900 }
}

export default function PostCardLightbox({ items, activeIndex, onClose, onChange }) {
  const item = items?.[activeIndex]
  const videoRef = useRef(null)
  const isVideo = item?.type === 'video'
  const resolvedVideoUrl = isVideo && item?.url ? resolveMediaUrl(item.url) : ''
  const resolvedHlsUrl = isVideo && item?.hlsUrl ? resolveMediaUrl(item.hlsUrl) : ''
  const resolvedPosterUrl = isVideo
    ? resolveMediaUrl(item?.posterUrl || item?.thumbnailUrl || '')
    : ''
  const { src: adaptiveVideoSrc } = useAdaptiveVideoSource({
    videoRef,
    hlsUrl: resolvedHlsUrl,
    fallbackUrl: resolvedVideoUrl,
    enabled: Boolean(isVideo && item),
  })

  useEffect(() => {
    if (!Array.isArray(items) || items.length <= 1) {
      return
    }
    const nextItem = items[activeIndex + 1]
    if (!nextItem) {
      return
    }
    if (nextItem.type === 'video') {
      const nextHlsUrl = nextItem.hlsUrl ? resolveMediaUrl(nextItem.hlsUrl) : ''
      const nextFallbackUrl = nextItem.url ? resolveMediaUrl(nextItem.url) : ''
      prefetchHlsVideo(nextHlsUrl, nextFallbackUrl)
      return
    }
    const nextImageUrl = resolveMediaUrl(nextItem.url || '')
    if (!nextImageUrl || typeof Image === 'undefined') {
      return
    }
    const preloadImage = new Image()
    preloadImage.decoding = 'async'
    if ('fetchPriority' in preloadImage) {
      preloadImage.fetchPriority = 'low'
    }
    preloadImage.src = nextImageUrl
  }, [activeIndex, items])

  if (!item) {
    return null
  }

  const dimensions = resolveLightboxDimensions(item)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/92 p-4" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white cursor-pointer"
        aria-label="Close Lightbox"
      >
        ✕
      </button>

      {activeIndex > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onChange(activeIndex - 1)
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-white cursor-pointer"
          aria-label="Previous image"
        >
          {'<'}
        </button>
      ) : null}

      <div className="max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
        {isVideo ? (
          <video
            ref={videoRef}
            src={adaptiveVideoSrc || undefined}
            poster={resolvedPosterUrl || undefined}
            width={dimensions.width}
            height={dimensions.height}
            preload="auto"
            controls
            playsInline
            autoPlay
            className="max-h-[85vh] max-w-full rounded-[24px]"
          />
        ) : (
          <img
            src={resolveMediaUrl(item.url)}
            alt={item.alt || 'Expanded post media'}
            width={dimensions.width}
            height={dimensions.height}
            decoding="async"
            fetchPriority="high"
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
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-white cursor-pointer"
          aria-label="Next image"
        >
          {'>'}
        </button>
      ) : null}
    </div>
  )
}
