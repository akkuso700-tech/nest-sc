import { useState } from 'react'

export function LinkPreviewCard({ preview, isMine = false, className = '' }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (!preview || !preview.url) return null

  const { url, title, description, image, siteName, domain, favicon } = preview

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`group/link-card mt-2 block overflow-hidden rounded-xl border transition-all duration-200 hover:opacity-95 ${
        isMine
          ? 'border-white/20 bg-black/15 hover:bg-black/25 text-inverse'
          : 'border-border bg-secondary/80 hover:bg-secondary text-text'
      } ${className}`}
    >
      {image && !imageFailed ? (
        <div className="relative aspect-video w-full overflow-hidden bg-black/5 dark:bg-white/5">
          <img
            src={image}
            alt={title || domain || 'Link preview'}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover/link-card:scale-103"
          />
        </div>
      ) : null}

      <div className="p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium opacity-75">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              className="size-3.5 shrink-0 rounded-xs object-contain"
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          ) : (
            <svg
              className="size-3.5 shrink-0 opacity-60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          )}
          <span className="truncate">{siteName || domain || url}</span>
          <span className="ml-auto text-[10px] opacity-60 transition-transform group-hover/link-card:translate-x-0.5">
            ↗
          </span>
        </div>

        {title ? (
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug group-hover/link-card:underline">
            {title}
          </h4>
        ) : null}

        {description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-80">
            {description}
          </p>
        ) : null}
      </div>
    </a>
  )
}
