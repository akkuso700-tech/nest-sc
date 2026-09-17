import { resolveMediaUrl } from '../../../utils/media.js'

export default function PostCardLightbox({ items, activeIndex, onClose, onChange }) {
  const item = items?.[activeIndex]

  if (!item) {
    return null
  }

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
        {item.type === 'video' ? (
          <video
            src={resolveMediaUrl(item.url)}
            controls
            playsInline
            autoPlay
            className="max-h-[85vh] max-w-full rounded-[24px]"
          />
        ) : (
          <img
            src={resolveMediaUrl(item.url)}
            alt="Expanded post media"
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
