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
  const containerRef = useRef(null)
  const adRef = useRef(null)
  const isPushedRef = useRef(false)
  const isLoopVariant = variant === 'loop'

  useEffect(() => {
    if (!isLoopVariant || typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
      return undefined
    }

    const rootEl = containerRef.current
    if (!rootEl) return undefined

    // AdSense's responsive script injects `height: auto !important; min-height: 0px !important;`
    // onto ancestor divs, which breaks fixed-height scroll-snap slides in LoopPage.
    // Observe ancestors and immediately strip any inline height/min-height mutations.
    const protectedElements = []
    let cursor = rootEl
    while (cursor && cursor !== document.body && cursor !== document.documentElement) {
      protectedElements.push(cursor)
      cursor = cursor.parentElement
    }

    const stripInjectedHeight = (el) => {
      if (!el || !el.style) return
      if (el.style.height) {
        el.style.removeProperty('height')
      }
      if (el.style.minHeight) {
        el.style.removeProperty('min-height')
      }
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          stripInjectedHeight(mutation.target)
        }
      }
    })

    protectedElements.forEach((el) => {
      stripInjectedHeight(el)
      observer.observe(el, { attributes: true, attributeFilter: ['style'] })
    })

    return () => observer.disconnect()
  }, [isLoopVariant])

  useEffect(() => {
    if (isPushedRef.current) return undefined

    const timerId = window.setTimeout(() => {
      if (isPushedRef.current) return
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
    }, 60)

    return () => window.clearTimeout(timerId)
  }, [])

  if (isLoopVariant) {
    return (
      <div
        ref={containerRef}
        className={`relative mx-auto flex select-none items-center justify-center overflow-hidden bg-zinc-950 text-white h-full w-full md:h-[min(760px,calc(100vh-84px))] md:aspect-[9/16] md:w-auto md:max-w-[440px] md:rounded-2xl md:border md:border-white/10 md:shadow-[0_24px_60px_rgba(0,0,0,0.5)] ${className}`}
        aria-label="Sponsorlu Reklam"
      >
        {/* Ambient Background Glow */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute -left-16 -top-16 size-64 rounded-full bg-blue-600/15 blur-3xl" />
          <div className="absolute -bottom-16 -right-16 size-64 rounded-full bg-amber-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex h-full w-full max-w-[420px] flex-col justify-between px-4 pb-6 pt-14 md:px-5 md:py-5">
          {/* Top Sponsored Header */}
          <div className="flex w-full items-center justify-between text-xs font-medium text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-zinc-100 backdrop-blur-md">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-3.5 text-amber-400"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              Sponsorlu İçerik
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Google Reklamı
            </span>
          </div>

          {/* Center Ad Slot Box */}
          <div className="my-auto flex w-full flex-col items-center justify-center">
            <div className="relative flex w-full min-h-[280px] max-h-[420px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/75 p-2 shadow-inner">
              <ins
                ref={adRef}
                className="adsbygoogle"
                style={{
                  display: 'block',
                  width: '100%',
                  minWidth: '250px',
                  maxWidth: '380px',
                  minHeight: '250px',
                  maxHeight: '380px',
                }}
                data-ad-client={client}
                data-ad-slot={slot}
                data-ad-format={format === 'auto' ? 'rectangle, horizontal' : format}
                data-full-width-responsive="false"
              />
            </div>
          </div>

          {/* Bottom Swipe Hint */}
          <div className="flex flex-col items-center gap-1 text-center text-[11px] text-zinc-400/80">
            <span className="inline-flex items-center gap-1 font-medium text-zinc-300/90">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-3.5 animate-bounce"
                aria-hidden="true"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
              Videolara devam etmek için kaydırın
            </span>
          </div>
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
