import { useState, useEffect } from 'react'
import { resolveMediaUrl } from '../../../utils/media.js'
import { CloseIcon, DownloadIcon, ChevronIcon } from '../../../pages/MessagesPageIcons.jsx'

export default function MediaLightbox({ items = [], activeIndex = 0, onClose, onNavigate, t }) {
  const activeMedia = items[activeIndex] || null
  const [isZoomed, setIsZoomed] = useState(false)

  useEffect(() => {
    setIsZoomed(false)
  }, [activeIndex])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (items.length <= 1) {
        return
      }

      if (event.key === 'ArrowLeft') {
        onNavigate(-1)
      }

      if (event.key === 'ArrowRight') {
        onNavigate(1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [items.length, onClose, onNavigate])

  if (!activeMedia?.url) {
    return null
  }

  const mediaUrl = resolveMediaUrl(activeMedia.url)
  const canNavigate = items.length > 1
  const activeCounterLabel = `${activeIndex + 1} / ${items.length}`

  return (
    <div className="fixed inset-0 z-[110] bg-black/88 px-4 py-4 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
        <div className="rounded-full bg-white/12 px-3 py-2 text-sm font-medium text-white">
          {activeCounterLabel}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={mediaUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="grid size-11 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.downloadMedia')}
            title={t('messages.downloadMedia')}
            onClick={(event) => event.stopPropagation()}
          >
            <DownloadIcon />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.closeMedia')}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="flex h-full items-center justify-center gap-3" onClick={(event) => event.stopPropagation()}>
        {canNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            className="hidden md:grid size-12 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.previousMedia')}
          >
            <ChevronIcon direction="left" />
          </button>
        ) : null}

        <div className="relative flex max-h-full max-w-full flex-1 items-center justify-center overflow-auto">
          {activeMedia.type === 'video' ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-[24px] bg-black"
            />
          ) : (
            <img
              src={mediaUrl}
              alt={t('messages.mediaAlt')}
              onClick={() => setIsZoomed((current) => !current)}
              className={`max-h-full max-w-full rounded-[24px] object-contain transition duration-300 ${
                isZoomed ? 'cursor-zoom-out scale-[1.35]' : 'cursor-zoom-in scale-100'
              }`}
            />
          )}

          {!isZoomed && !activeMedia.type?.includes('video') ? (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white">
              {t('messages.clickToZoom')}
            </div>
          ) : null}
        </div>

        {canNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate(1)}
            className="hidden md:grid size-12 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.nextMedia')}
          >
            <ChevronIcon direction="right" />
          </button>
        ) : null}
      </div>

      {canNavigate ? (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-white">
          {items.map((item, index) => (
            <button
              key={`${item.url}-${index}`}
              type="button"
              onClick={() => onNavigate(index - activeIndex)}
              className={`size-2.5 rounded-full transition ${
                index === activeIndex ? 'bg-white' : 'bg-white/35'
              }`}
              aria-label={t('messages.mediaNumber', { number: index + 1 })}
            />
          ))}
        </div>
      ) : null}

      {canNavigate ? (
        <div className="absolute inset-x-0 bottom-20 flex justify-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            className="grid size-11 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.previousMedia')}
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            className="grid size-11 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.nextMedia')}
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
