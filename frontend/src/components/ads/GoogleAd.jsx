import { useEffect, useRef } from 'react'

const DEFAULT_CLIENT_ID = 'ca-pub-8168100361388093'
const DEFAULT_SLOT_ID = '6236125845'

/**
 * Google AdSense Responsive Ad Unit Component
 * 
 * Supports both feed injection and loop/reels full-viewport slide layouts.
 */
export default function GoogleAd({
  slot = DEFAULT_SLOT_ID,
  client = DEFAULT_CLIENT_ID,
  format = 'auto',
  responsive = true,
  variant = 'feed', // 'feed' | 'loop'
  className = '',
}) {
  const adRef = useRef(null)
  const isPushedRef = useRef(false)

  useEffect(() => {
    if (isPushedRef.current) return

    // Ensure ad element exists in DOM and hasn't been loaded already
    const adElement = adRef.current
    if (adElement && !adElement.getAttribute('data-adsbygoogle-status')) {
      try {
        if (typeof window !== 'undefined') {
          window.adsbygoogle = window.adsbygoogle || []
          window.adsbygoogle.push({})
          isPushedRef.current = true
        }
      } catch (err) {
        // Prevent crashes caused by AdBlockers or duplicate pushes
        if (import.meta.env.DEV) {
          console.warn('[GoogleAd] AdSense push error:', err)
        }
      }
    }
  }, [])

  if (variant === 'loop') {
    return (
      <div
        className={`w-full max-w-[440px] mx-auto flex flex-col items-center justify-center rounded-3xl border border-white/15 bg-zinc-950/80 p-5 shadow-2xl backdrop-blur-md text-white transition-all ${className}`}
      >
        <div className="mb-3 flex w-full items-center justify-between text-xs font-medium text-zinc-400">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-zinc-200">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-3 text-amber-400"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Sponsorlu İçerik
          </span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-400">Reklam</span>
        </div>

        <div className="relative w-full min-h-[300px] flex items-center justify-center overflow-hidden rounded-2xl bg-zinc-900/60 p-2">
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '280px' }}
            data-ad-client={client}
            data-ad-slot={slot}
            data-ad-format={format}
            data-full-width-responsive={responsive ? 'true' : 'false'}
          />
        </div>
      </div>
    )
  }

  // Default: Feed variant for Home & Listing feeds
  return (
    <article
      className={`rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md overflow-hidden ${className}`}
      aria-label="Sponsorlu Reklam"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-3 text-amber-500"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          Sponsorlu
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
          Google Reklamı
        </span>
      </div>

      <div className="w-full min-h-[140px] flex items-center justify-center overflow-hidden rounded-xl bg-muted/30">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: '120px' }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive={responsive ? 'true' : 'false'}
        />
      </div>
    </article>
  )
}
