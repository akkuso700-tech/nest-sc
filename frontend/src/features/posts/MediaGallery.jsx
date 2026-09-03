import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveMediaUrl, resolveMediaUrlCandidates } from '../../utils/media.js'
import { useReducedDataMode } from '../../hooks/useReducedDataMode.js'
import { useAdaptiveVideoSource } from '../../hooks/useAdaptiveVideoSource.js'

let activePreviewVideoElement = null

function stopPreviewVideo(videoElement) {
  if (!videoElement) {
    return
  }

  try {
    videoElement.pause()
    videoElement.currentTime = 0
  } catch {
    // Ignore pause/reset errors when browser blocks media operations.
  }
}

function setActivePreviewVideo(videoElement) {
  if (activePreviewVideoElement && activePreviewVideoElement !== videoElement) {
    stopPreviewVideo(activePreviewVideoElement)
  }

  activePreviewVideoElement = videoElement
}

function PlayBadge() {
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-lg">
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
        <path d="m10 8 6 4-6 4V8Z" />
      </svg>
    </span>
  )
}

function ProcessingBadge({ progress = 0, posterUrl = '' }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-black text-white overflow-hidden">
      {posterUrl ? (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover opacity-40 blur-md scale-105"
        />
      ) : null}
      <div className="relative z-10 px-4 text-center">
        <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        <p className="mt-3 text-sm font-semibold">Video işleniyor</p>
        <p className="mt-1 text-xs text-white/65">%{Math.max(0, Math.min(99, Number(progress || 0)))}</p>
      </div>
    </div>
  )
}

function getGridClass(count) {
  if (count <= 1) {
    return 'grid-cols-1'
  }

  return 'grid-cols-2'
}

function getFeedGridClass(count) {
  if (count <= 1) {
    return 'grid-cols-1 grid-rows-1'
  }

  if (count === 2) {
    return 'grid-cols-2 grid-rows-1'
  }

  return 'grid-cols-2 grid-rows-2'
}

function getFeedItemClass(count, index) {
  if (count === 3 && index === 0) {
    return 'row-span-2'
  }

  return ''
}

function getAspectClass(item, count) {
  if (item?.type === 'video' && item?.durationSeconds > 0) {
    return item.durationSeconds > 60 ? 'aspect-[9/16]' : 'aspect-[16/10]'
  }

  if (count === 1) {
    return 'aspect-[16/10]'
  }

  return 'aspect-square'
}

function MediaGallery({
  items = [],
  className = '',
  onItemClick,
  interactive = false,
  hoverPlayVideos = false,
  autoplayOnVisible = false,
  feedLayout = false,
  priority = false,
}) {
  const limitedItems = items.slice(0, 4)
  const hasItems = limitedItems.length > 0
  const videoRefs = useRef(new Map())
  const reducedDataMode = useReducedDataMode()
  const previewEnabled =
    interactive && !reducedDataMode && (hoverPlayVideos || autoplayOnVisible)

  const setVideoRef = useCallback((refKey, node) => {
    if (!refKey) {
      return
    }

    if (node) {
      node.dataset.previewKey = refKey
      videoRefs.current.set(refKey, node)
      return
    }

    videoRefs.current.delete(refKey)
  }, [])

  const handleVideoPreviewStart = useCallback((refKey) => {
    if (!previewEnabled) {
      return
    }

    const videoElement = videoRefs.current.get(refKey)

    if (!videoElement) {
      return
    }

    setActivePreviewVideo(videoElement)
    videoElement.muted = true
    videoElement.playsInline = true
    const playPromise = videoElement.play()

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => undefined)
    }
  }, [previewEnabled])

  const handleVideoPreviewStop = useCallback((refKey) => {
    if (!previewEnabled) {
      return
    }

    const videoElement = videoRefs.current.get(refKey)

    if (!videoElement) {
      return
    }

    stopPreviewVideo(videoElement)

    if (activePreviewVideoElement === videoElement) {
      activePreviewVideoElement = null
    }
  }, [previewEnabled])

  useEffect(
    () => () => {
      videoRefs.current.forEach((videoElement) => {
        stopPreviewVideo(videoElement)
        if (activePreviewVideoElement === videoElement) {
          activePreviewVideoElement = null
        }
      })
      videoRefs.current.clear()
    },
    [],
  )

  useEffect(() => {
    if (previewEnabled) {
      return
    }

    videoRefs.current.forEach((videoElement) => stopPreviewVideo(videoElement))
    activePreviewVideoElement = null
  }, [previewEnabled])

  useEffect(() => {
    if (
      !hasItems ||
      !interactive ||
      !autoplayOnVisible ||
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const refKey = entry.target?.dataset?.previewKey

          if (!refKey) {
            return
          }

          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            handleVideoPreviewStart(refKey)
            return
          }

          handleVideoPreviewStop(refKey)
        })
      },
      {
        rootMargin: '0px 0px -10% 0px',
        threshold: [0.35, 0.55, 0.75],
      },
    )

    videoRefs.current.forEach((videoElement) => observer.observe(videoElement))

    return () => observer.disconnect()
  }, [
    autoplayOnVisible,
    handleVideoPreviewStart,
    handleVideoPreviewStop,
    hasItems,
    interactive,
    limitedItems.length,
  ])

  if (!hasItems) {
    return null
  }

  return (
    <div
      className={`mt-1 overflow-hidden border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 ${className}`.trim()}
    >
      <div
        className={
          feedLayout
            ? limitedItems.length === 1
              ? 'w-full max-h-[440px] md:max-h-[540px] overflow-hidden'
              : 'w-full aspect-square max-h-[440px] md:max-h-[540px] overflow-hidden'
            : ''
        }
      >
        <div
          className={`grid w-full ${
            feedLayout
              ? `h-full ${getFeedGridClass(limitedItems.length)} gap-1`
              : `${getGridClass(limitedItems.length)} gap-3`
          }`.trim()}
        >
          {limitedItems.map((item, index) => {
            const mediaSource = item?.url || item?.hlsUrl || ''
            const mediaCandidates = resolveMediaUrlCandidates(mediaSource)
            const posterCandidates = resolveMediaUrlCandidates(
              item?.posterUrl || item?.thumbnailUrl || item?.previewUrl || '',
            )
            const mediaType = item.type === 'video' ? 'video' : 'image'
            const mediaIsProcessing =
              mediaType === 'video' && ['queued', 'processing'].includes(`${item?.processing || ''}`)
            const isSingleFeedItem = feedLayout && limitedItems.length === 1
            const aspectClass = feedLayout
              ? isSingleFeedItem
                ? 'aspect-[16/10] w-full'
                : 'h-full'
              : getAspectClass(item, limitedItems.length)
            const refKey = `${mediaSource || item.name || 'media'}-${index}`
            const feedItemClass = feedLayout ? getFeedItemClass(limitedItems.length, index) : ''

            return (
              <button
                key={refKey}
                type="button"
                onClick={onItemClick ? () => onItemClick(item, index) : undefined}
                className={`group relative overflow-hidden bg-black text-left ${aspectClass} ${feedItemClass} ${
                  interactive ? 'cursor-pointer' : 'cursor-default'
                }`}
                onMouseEnter={() => handleVideoPreviewStart(refKey)}
                onMouseLeave={() => handleVideoPreviewStop(refKey)}
                onFocus={() => handleVideoPreviewStart(refKey)}
                onBlur={() => handleVideoPreviewStop(refKey)}
              >
                {mediaIsProcessing ? (
                  <ProcessingBadge
                    progress={item?.processingProgress}
                    posterUrl={posterCandidates[0] || ''}
                  />
                ) : mediaType === 'video' ? (
                  <MediaVideo
                    refKey={refKey}
                    candidates={mediaCandidates}
                    posterUrl={posterCandidates[0] || ''}
                    interactive={interactive}
                    previewEnabled={previewEnabled}
                    setVideoRef={setVideoRef}
                    feedLayout={feedLayout}
                    preserveNaturalRatio={isSingleFeedItem}
                    reducedDataMode={reducedDataMode}
                    hlsUrl={resolveMediaUrl(item?.hlsUrl || '')}
                  />
                ) : (
                  <MediaImage
                    candidates={mediaCandidates}
                    index={index}
                    preserveNaturalRatio={isSingleFeedItem}
                    priority={priority && index === 0}
                  />
                )}

                {interactive ? (
                  <span className="pointer-events-none absolute inset-0 bg-zinc-950/0 transition group-hover:bg-zinc-950/8" />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MediaImage({ candidates, index, preserveNaturalRatio = false, priority = false }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const src = candidates[activeIndex] || ''

  return (
    <img
      src={src}
      alt={`Post media ${index + 1}`}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'low'}
      onError={() => {
        setActiveIndex((current) => {
          if (current >= candidates.length - 1) {
            return current
          }
          return current + 1
        })
      }}
      className={`w-full ${
        preserveNaturalRatio
          ? 'h-full max-h-[440px] md:max-h-[540px] object-contain'
          : 'h-full object-cover'
      } object-center transition duration-300 group-hover:scale-[1.01]`}
    />
  )
}

function MediaVideo({
  refKey,
  candidates,
  posterUrl,
  interactive,
  previewEnabled,
  setVideoRef,
  feedLayout = false,
  preserveNaturalRatio = false,
  reducedDataMode = false,
  hlsUrl = '',
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const src = candidates[activeIndex] || ''
  const internalVideoRef = useRef(null)
  const adaptiveSource = useAdaptiveVideoSource({
    videoRef: internalVideoRef,
    hlsUrl,
    fallbackUrl: src,
    enabled: Boolean(hlsUrl),
  })

  return (
    <>
      <video
        ref={(node) => {
          internalVideoRef.current = node
          setVideoRef(refKey, node)
        }}
        src={adaptiveSource || undefined}
        poster={posterUrl || undefined}
        controls={!interactive && !feedLayout}
        playsInline
        muted={previewEnabled}
        loop={previewEnabled}
        preload={interactive || reducedDataMode ? 'none' : 'metadata'}
        onError={() => {
          setActiveIndex((current) => {
            if (current >= candidates.length - 1) {
              return current
            }
            return current + 1
          })
        }}
        className={`w-full ${
          preserveNaturalRatio
            ? 'h-full max-h-[440px] md:max-h-[540px] object-contain'
            : 'h-full object-cover'
        } object-center`}
      />
      {interactive && (!feedLayout || reducedDataMode) ? <PlayBadge /> : null}
    </>
  )
}

export default MediaGallery
