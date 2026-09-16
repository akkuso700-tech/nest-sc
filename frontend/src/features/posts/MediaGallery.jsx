import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveMediaUrl, resolveMediaUrlCandidates } from '../../utils/media.js'
import { useReducedDataMode } from '../../hooks/useReducedDataMode.js'
import { useAdaptiveVideoSource } from '../../hooks/useAdaptiveVideoSource.js'
import { videoPlaybackManager } from '../../services/VideoPlaybackManager.js'
import { VolumeOffIcon, VolumeOnIcon } from './PostCardIcons.jsx'

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
    return 'col-span-1 row-span-2'
  }

  return 'col-span-1 row-span-1'
}

function clampFeedAspectRatio(ratio, mediaType = 'image') {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return mediaType === 'video' ? 16 / 9 : 16 / 10
  }
  // Twitter/X standard:
  // - Videos preserve natural aspect ratios down to 9:16 (~0.5625) without stretching or cropping
  // - Photos are capped between 0.75 (3:4 portrait) and 1.91 (approx 16:9 landscape)
  const minRatio = mediaType === 'video' ? 9 / 16 : 0.75
  const maxRatio = 1.91

  return Math.min(Math.max(ratio, minRatio), maxRatio)
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

  const firstItem = limitedItems[0]
  const firstMediaType = firstItem?.type === 'video' ? 'video' : 'image'
  const initialSingleRatio = clampFeedAspectRatio(
    firstItem?.aspectRatio ||
      (firstItem?.width && firstItem?.height ? firstItem.width / firstItem.height : null) ||
      (firstMediaType === 'video'
        ? firstItem?.durationSeconds > 60
          ? 9 / 16
          : 16 / 9
        : 16 / 10),
    firstMediaType,
  )
  const [singleAspectRatio, setSingleAspectRatio] = useState(initialSingleRatio)

  const firstUrl = firstItem?.url
  const firstHlsUrl = firstItem?.hlsUrl
  const firstAspect = firstItem?.aspectRatio
  const firstWidth = firstItem?.width
  const firstHeight = firstItem?.height
  const firstDuration = firstItem?.durationSeconds
  const firstType = firstItem?.type

  useEffect(() => {
    if (!firstUrl && !firstHlsUrl) return
    const mediaType = firstType === 'video' ? 'video' : 'image'
    const ratio = clampFeedAspectRatio(
      firstAspect ||
        (firstWidth && firstHeight ? firstWidth / firstHeight : null) ||
        (mediaType === 'video'
          ? firstDuration > 60
            ? 9 / 16
            : 16 / 9
          : 16 / 10),
      mediaType,
    )
    setSingleAspectRatio(ratio)
  }, [firstUrl, firstHlsUrl, firstAspect, firstWidth, firstHeight, firstDuration, firstType])

  const handleRatioMeasured = useCallback((measuredRatio) => {
    if (measuredRatio && Number.isFinite(measuredRatio) && measuredRatio > 0) {
      setSingleAspectRatio(clampFeedAspectRatio(measuredRatio, firstMediaType))
    }
  }, [firstMediaType])

  const setVideoRef = useCallback((refKey, node) => {
    if (!refKey) {
      return
    }

    if (node) {
      node.dataset.previewKey = refKey
      videoRefs.current.set(refKey, node)
      videoPlaybackManager.register(refKey, {
        play: () => {
          node.muted = videoPlaybackManager.getMuted()
          node.playsInline = true
          const playPromise = node.play()
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => undefined)
          }
        },
        pause: () => {
          try {
            node.pause()
            node.currentTime = 0
          } catch {
            // Ignore pause errors when browser blocks operations
          }
        },
      })
      return
    }

    videoPlaybackManager.unregister(refKey)
    videoRefs.current.delete(refKey)
  }, [])

  const handleVideoPreviewStart = useCallback((refKey) => {
    if (!previewEnabled) {
      return
    }

    videoPlaybackManager.play(refKey)
  }, [previewEnabled])

  const handleVideoPreviewStop = useCallback((refKey) => {
    if (!previewEnabled) {
      return
    }

    videoPlaybackManager.pause(refKey)
  }, [previewEnabled])

  useEffect(
    () => () => {
      videoRefs.current.forEach((_videoElement, refKey) => {
        videoPlaybackManager.unregister(refKey)
      })
      videoRefs.current.clear()
    },
    [],
  )

  useEffect(() => {
    if (previewEnabled) {
      return
    }

    videoRefs.current.forEach((_videoElement, refKey) => {
      videoPlaybackManager.pause(refKey)
    })
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

  if (feedLayout) {
    // Single feed item: dynamic proportional width & height, preserving natural aspect ratio without horizontal stretching
    if (limitedItems.length === 1) {
      const item = limitedItems[0]
      const mediaSource = item?.url || item?.hlsUrl || ''
      const mediaCandidates = resolveMediaUrlCandidates(mediaSource)
      const posterCandidates = resolveMediaUrlCandidates(
        item?.posterUrl || item?.thumbnailUrl || item?.previewUrl || '',
      )
      const mediaType = item?.type === 'video' ? 'video' : 'image'
      const mediaIsProcessing =
        mediaType === 'video' && ['queued', 'processing'].includes(`${item?.processing || ''}`)
      const refKey = `${mediaSource || item?.name || 'media'}-0`
      const isPortrait = singleAspectRatio < 1

      return (
        <div
          className={`mt-2 overflow-hidden rounded-md border border-zinc-200/90 bg-zinc-100 dark:border-zinc-800/90 dark:bg-zinc-900 mx-auto max-h-[min(440px,calc(100dvh-160px))] md:max-h-[540px] [--media-max-h:min(440px,calc(100dvh-160px))] md:[--media-max-h:540px] ${
            isPortrait ? 'w-fit max-w-full' : 'w-full'
          } ${className}`.trim()}
          style={
            isPortrait
              ? {
                  width: `min(100%, calc(var(--media-max-h, 440px) * ${singleAspectRatio}))`,
                  aspectRatio: `${singleAspectRatio}`,
                }
              : {
                  width: '100%',
                  aspectRatio: `${singleAspectRatio}`,
                }
          }
        >
          <div
            role="button"
            tabIndex={0}
            onClick={onItemClick ? () => onItemClick(item, 0) : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onItemClick?.(item, 0)
              }
            }}
            className={`group relative flex size-full max-h-[min(440px,calc(100dvh-160px))] md:max-h-[540px] items-center justify-center overflow-hidden text-left ${
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
                preserveNaturalRatio={false}
                reducedDataMode={reducedDataMode}
                hlsUrl={resolveMediaUrl(item?.hlsUrl || '')}
                onRatioMeasured={handleRatioMeasured}
              />
            ) : (
              <MediaImage
                candidates={mediaCandidates}
                index={0}
                preserveNaturalRatio={false}
                priority={priority}
                onRatioMeasured={handleRatioMeasured}
              />
            )}

            {interactive ? (
              <span className="pointer-events-none absolute inset-0 bg-black/0 transition duration-200 group-hover:bg-black/5 dark:group-hover:bg-white/5" />
            ) : null}
          </div>
        </div>
      )
    }

    // Multiple feed items (2, 3, 4 items) in X.com-style 16:9 mosaic grid
    return (
      <div
        className={`mt-2 relative w-full aspect-[16/9] max-h-[460px] md:max-h-[520px] overflow-hidden rounded-md border border-zinc-200/90 bg-zinc-200 dark:border-zinc-800/90 dark:bg-zinc-800 mx-auto ${className}`.trim()}
      >
        <div className={`grid size-full ${getFeedGridClass(limitedItems.length)} gap-[2px]`}>
          {limitedItems.map((item, index) => {
            const mediaSource = item?.url || item?.hlsUrl || ''
            const mediaCandidates = resolveMediaUrlCandidates(mediaSource)
            const posterCandidates = resolveMediaUrlCandidates(
              item?.posterUrl || item?.thumbnailUrl || item?.previewUrl || '',
            )
            const mediaType = item?.type === 'video' ? 'video' : 'image'
            const mediaIsProcessing =
              mediaType === 'video' && ['queued', 'processing'].includes(`${item?.processing || ''}`)
            const refKey = `${mediaSource || item?.name || 'media'}-${index}`
            const feedItemClass = getFeedItemClass(limitedItems.length, index)

            return (
              <div
                key={refKey}
                role="button"
                tabIndex={0}
                onClick={onItemClick ? () => onItemClick(item, index) : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onItemClick?.(item, index)
                  }
                }}
                className={`group relative size-full overflow-hidden bg-zinc-100 text-left dark:bg-zinc-900 ${feedItemClass} ${
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
                    preserveNaturalRatio={false}
                    reducedDataMode={reducedDataMode}
                    hlsUrl={resolveMediaUrl(item?.hlsUrl || '')}
                  />
                ) : (
                  <MediaImage
                    candidates={mediaCandidates}
                    index={index}
                    preserveNaturalRatio={false}
                    priority={priority && index === 0}
                  />
                )}

                {interactive ? (
                  <span className="pointer-events-none absolute inset-0 bg-black/0 transition duration-200 group-hover:bg-black/5 dark:group-hover:bg-white/5" />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Non-feed layout fallback (e.g. comments, messages)
  return (
    <div
      className={`mt-1 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 mx-auto ${className}`.trim()}
    >
      <div className={`grid w-full ${getGridClass(limitedItems.length)} gap-2`}>
        {limitedItems.map((item, index) => {
          const mediaSource = item?.url || item?.hlsUrl || ''
          const mediaCandidates = resolveMediaUrlCandidates(mediaSource)
          const posterCandidates = resolveMediaUrlCandidates(
            item?.posterUrl || item?.thumbnailUrl || item?.previewUrl || '',
          )
          const mediaType = item.type === 'video' ? 'video' : 'image'
          const mediaIsProcessing =
            mediaType === 'video' && ['queued', 'processing'].includes(`${item?.processing || ''}`)
          const aspectClass = getAspectClass(item, limitedItems.length)
          const refKey = `${mediaSource || item.name || 'media'}-${index}`

          return (
            <div
              key={refKey}
              role="button"
              tabIndex={0}
              onClick={onItemClick ? () => onItemClick(item, index) : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onItemClick?.(item, index)
                }
              }}
              className={`group relative overflow-hidden bg-zinc-100 text-left dark:bg-zinc-900 ${aspectClass} ${
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
                  feedLayout={false}
                  preserveNaturalRatio={false}
                  reducedDataMode={reducedDataMode}
                  hlsUrl={resolveMediaUrl(item?.hlsUrl || '')}
                />
              ) : (
                <MediaImage
                  candidates={mediaCandidates}
                  index={index}
                  preserveNaturalRatio={false}
                  priority={priority && index === 0}
                />
              )}

              {interactive ? (
                <span className="pointer-events-none absolute inset-0 bg-black/0 transition duration-200 group-hover:bg-black/5 dark:group-hover:bg-white/5" />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MediaImage({
  candidates,
  index,
  preserveNaturalRatio = false,
  priority = false,
  onRatioMeasured,
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const src = candidates[activeIndex] || ''

  return (
    <img
      src={src}
      alt={`Post media ${index + 1}`}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'low'}
      onLoad={(e) => {
        if (onRatioMeasured) {
          const nw = e.currentTarget?.naturalWidth
          const nh = e.currentTarget?.naturalHeight
          if (nw && nh && nh > 0) {
            onRatioMeasured(nw / nh)
          }
        }
      }}
      onError={() => {
        setActiveIndex((current) => {
          if (current >= candidates.length - 1) {
            return current
          }
          return current + 1
        })
      }}
      className={`size-full ${
        preserveNaturalRatio ? 'object-contain' : 'object-cover'
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
  onRatioMeasured,
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(() => videoPlaybackManager.getMuted())
  const src = candidates[activeIndex] || ''
  const internalVideoRef = useRef(null)
  const adaptiveSource = useAdaptiveVideoSource({
    videoRef: internalVideoRef,
    hlsUrl,
    fallbackUrl: src,
    enabled: Boolean(hlsUrl),
  })

  useEffect(() => {
    return videoPlaybackManager.onMuteChange((newMuted) => {
      setIsMuted(newMuted)
      if (internalVideoRef.current) {
        internalVideoRef.current.muted = newMuted
      }
    })
  }, [])

  const handleToggleMute = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const nextMuted = videoPlaybackManager.toggleMuted()
    const video = internalVideoRef.current
    if (video) {
      video.muted = nextMuted
      if (!nextMuted) {
        video.playsInline = true
        const playPromise = video.play()
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => undefined)
        }
      }
    }
  }, [])

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
        muted={isMuted}
        loop={previewEnabled}
        preload={interactive || reducedDataMode ? 'none' : 'metadata'}
        onLoadedMetadata={(e) => {
          if (onRatioMeasured) {
            const vw = e.currentTarget?.videoWidth
            const vh = e.currentTarget?.videoHeight
            if (vw && vh && vh > 0) {
              onRatioMeasured(vw / vh)
            }
          }
        }}
        onError={() => {
          setActiveIndex((current) => {
            if (current >= candidates.length - 1) {
              return current
            }
            return current + 1
          })
        }}
        className={`size-full ${
          preserveNaturalRatio ? 'object-contain' : 'object-cover'
        } object-center`}
      />

      {interactive && (!feedLayout || reducedDataMode) ? <PlayBadge /> : null}

      {/* X.com Style Bottom-Right Mute/Unmute Sound Button */}
      {interactive ? (
        <button
          type="button"
          aria-label={isMuted ? 'Sesi aç' : 'Sesi kapat'}
          title={isMuted ? 'Sesi aç' : 'Sesi kapat'}
          onClick={handleToggleMute}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 right-2.5 z-30 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all duration-150 hover:scale-110 hover:bg-black/85 active:scale-95 shadow-md border border-white/15 cursor-pointer"
        >
          {isMuted ? (
            <VolumeOffIcon className="size-4 text-white" />
          ) : (
            <VolumeOnIcon className="size-4 text-white" />
          )}
        </button>
      ) : null}
    </>
  )
}

export default MediaGallery
