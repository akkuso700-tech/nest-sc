import { resolveMediaUrl } from '../../../../utils/media.js'

export default function ComposerMediaPreview({ previewItems, onRemovePreview }) {
  if (!previewItems?.length) {
    return null
  }

  return (
    <div className="mt-1 grid gap-3 sm:grid-cols-2">
      {previewItems.map((item) => (
        <div
          key={item.id}
          className="relative overflow-hidden rounded-lg border border-border bg-secondary"
        >
          {item.type === 'video' ? (
            <video
              src={resolveMediaUrl(item.url)}
              controls
              playsInline
              preload="metadata"
              className="aspect-[16/10] w-full bg-black object-contain"
            />
          ) : (
            <img
              src={resolveMediaUrl(item.url)}
              alt={item.name}
              className="aspect-[16/10] w-full object-cover"
            />
          )}

          <button
            type="button"
            onClick={() => onRemovePreview(item.id)}
            className="absolute right-3 cursor-pointer top-3 grid size-8 place-items-center rounded-full bg-black/70 text-white hover:bg-black/90 transition"
            aria-label="Remove media"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
