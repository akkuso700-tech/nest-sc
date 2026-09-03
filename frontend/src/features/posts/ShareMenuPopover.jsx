import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { copyTextToClipboard, shareWithNative, triggerHapticFeedback } from '../../utils/postShare.js'

function LinkIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function CheckIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function WhatsAppIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.72 4.31 3.81.6.26 1.07.42 1.44.54.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.12-.22-.19-.47-.32" />
    </svg>
  )
}

function XIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function FacebookIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function TelegramIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

function MoreShareIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

export default function ShareMenuPopover({
  open,
  onClose,
  sharePayload,
  shareTargets,
  isMobile = false,
  variant = 'feed', // 'feed' | 'loop'
  onTrackShare,
  onShowToast,
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setCopied(false)
    }
  }, [open])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open || !sharePayload?.url) {
    return null
  }

  const isLoop = Boolean(variant === 'loop' || sharePayload.isLoop)
  const titleText = isLoop ? t('common.shareActions.shareLoop') : t('common.shareActions.sharePost')

  async function handleCopy() {
    if (isProcessing) return
    setIsProcessing(true)

    try {
      await copyTextToClipboard(sharePayload.url)
      setCopied(true)
      triggerHapticFeedback(40)
      onShowToast?.({ message: t('common.shareActions.linkCopied'), tone: 'success' })
      onTrackShare?.()

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        setCopied(false)
        if (isMobile) {
          onClose?.()
        }
      }, 1600)
    } catch {
      onShowToast?.({ message: t('common.shareActions.copyFailed'), tone: 'error' })
    } finally {
      setIsProcessing(false)
    }
  }

  function handleShareTarget(platformKey) {
    const targetUrl = shareTargets?.[platformKey]
    if (!targetUrl) return

    if (typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    }

    onShowToast?.({ message: t('common.shareActions.platformOpened'), tone: 'success' })
    onTrackShare?.()
    onClose?.()
  }

  async function handleNativeShareTrigger() {
    setIsProcessing(true)
    const result = await shareWithNative(sharePayload)
    setIsProcessing(false)

    if (result.status === 'shared') {
      onShowToast?.({ message: t('common.shareActions.shared'), tone: 'success' })
      onTrackShare?.()
      onClose?.()
    } else if (result.status === 'error') {
      onShowToast?.({ message: t('common.shareActions.failed'), tone: 'error' })
    }
  }

  // --- MOBILE BOTTOM SHEET ---
  if (isMobile) {
    const mobileSheet = (
      <div
        data-share-menu="true"
        className="fixed inset-0 z-[140] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            onClose?.()
          }
          e.stopPropagation()
        }}
        role="dialog"
        aria-modal="true"
        aria-label={titleText}
      >
        <div
          data-share-menu="true"
          className="w-full max-w-lg rounded-t-[28px] border-t border-border bg-card p-5 pb-8 shadow-[0_-20px_50px_rgba(0,0,0,0.35)] transition-transform duration-300"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Top Handle */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border-strong" />

          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                {isLoop ? 'Loop' : t('createMenu.post', { defaultValue: 'Gönderi' })}
              </span>
              <h3 className="mt-1 truncate text-base font-bold text-text">
                {sharePayload.title || titleText}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted hover:text-text"
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </div>

          {/* Instant Copy Box */}
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-border bg-secondary/70 p-2 pl-3">
            <LinkIcon className="size-4 shrink-0 text-muted" />
            <input
              type="text"
              readOnly
              value={sharePayload.url}
              className="min-w-0 flex-1 bg-transparent text-xs text-muted outline-none select-all"
            />
            <button
              type="button"
              onClick={handleCopy}
              disabled={isProcessing}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition duration-200 active:scale-95 ${
                copied
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-primary text-white hover:bg-primary-hover shadow-sm'
              }`}
            >
              {copied ? <CheckIcon className="size-3.5" /> : <LinkIcon className="size-3.5" />}
              <span>{copied ? t('common.shareActions.copied') : t('common.shareActions.copy')}</span>
            </button>
          </div>

          {/* Social Channels Icons Grid */}
          <div className="grid grid-cols-4 gap-3 text-center sm:grid-cols-5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition hover:bg-secondary active:scale-95"
            >
              <div
                className={`grid size-12 place-items-center rounded-full transition ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'border border-border bg-card text-text shadow-sm'
                }`}
              >
                {copied ? <CheckIcon className="size-5" /> : <LinkIcon className="size-5" />}
              </div>
              <span className="text-[11px] font-medium text-text">
                {copied ? t('common.shareActions.copied') : t('common.shareActions.copyLink')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleShareTarget('whatsapp')}
              className="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition hover:bg-secondary active:scale-95"
            >
              <div className="grid size-12 place-items-center rounded-full bg-[#25D366]/15 text-[#25D366] shadow-sm">
                <WhatsAppIcon className="size-6" />
              </div>
              <span className="text-[11px] font-medium text-text">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => handleShareTarget('x')}
              className="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition hover:bg-secondary active:scale-95"
            >
              <div className="grid size-12 place-items-center rounded-full bg-zinc-900 text-white shadow-sm dark:bg-zinc-800">
                <XIcon className="size-5" />
              </div>
              <span className="text-[11px] font-medium text-text">X</span>
            </button>

            <button
              type="button"
              onClick={() => handleShareTarget('telegram')}
              className="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition hover:bg-secondary active:scale-95"
            >
              <div className="grid size-12 place-items-center rounded-full bg-[#229ED9]/15 text-[#229ED9] shadow-sm">
                <TelegramIcon className="size-6" />
              </div>
              <span className="text-[11px] font-medium text-text">Telegram</span>
            </button>

            <button
              type="button"
              onClick={() => handleShareTarget('facebook')}
              className="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition hover:bg-secondary active:scale-95"
            >
              <div className="grid size-12 place-items-center rounded-full bg-[#1877F2]/15 text-[#1877F2] shadow-sm">
                <FacebookIcon className="size-6" />
              </div>
              <span className="text-[11px] font-medium text-text">Facebook</span>
            </button>

            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
              <button
                type="button"
                onClick={handleNativeShareTrigger}
                className="flex flex-col items-center gap-1.5 rounded-2xl p-2 transition hover:bg-secondary active:scale-95"
              >
                <div className="grid size-12 place-items-center rounded-full border border-border bg-secondary text-text shadow-sm">
                  <MoreShareIcon className="size-5" />
                </div>
                <span className="text-[11px] font-medium text-text">
                  {t('common.shareActions.more')}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )

    if (typeof document !== 'undefined') {
      return createPortal(mobileSheet, document.body)
    }
    return mobileSheet
  }

  // --- DESKTOP POPOVER ---
  const popoverPositionClass =
    variant === 'loop'
      ? 'absolute bottom-0 right-full z-50 mr-3'
      : 'absolute bottom-full right-0 z-50 mb-2.5'

  return (
    <div
      data-share-menu="true"
      className={`${popoverPositionClass} w-72 rounded-2xl border border-border bg-card/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop-blur-md animate-[scaleIn_160ms_ease-out]`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      role="menu"
      aria-label={titleText}
    >
      {/* Direct Copy Bar */}
      <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-border bg-secondary/80 p-1.5 pl-2.5">
        <LinkIcon className="size-3.5 shrink-0 text-muted" />
        <input
          type="text"
          readOnly
          value={sharePayload.url}
          className="min-w-0 flex-1 bg-transparent text-[11px] text-muted outline-none select-all"
        />
        <button
          type="button"
          onClick={handleCopy}
          disabled={isProcessing}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition duration-200 active:scale-95 ${
            copied
              ? 'bg-emerald-500 text-white'
              : 'bg-primary text-white hover:bg-primary-hover shadow-sm'
          }`}
        >
          {copied ? <CheckIcon className="size-3" /> : <LinkIcon className="size-3" />}
          <span>{copied ? t('common.shareActions.copied') : t('common.shareActions.copy')}</span>
        </button>
      </div>

      {/* Social Targets List */}
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => handleShareTarget('whatsapp')}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-text transition hover:bg-secondary"
        >
          <span className="grid size-6 place-items-center rounded-full bg-[#25D366]/15 text-[#25D366]">
            <WhatsAppIcon className="size-3.5" />
          </span>
          <span>WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={() => handleShareTarget('x')}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-text transition hover:bg-secondary"
        >
          <span className="grid size-6 place-items-center rounded-full bg-zinc-900 text-white dark:bg-zinc-700">
            <XIcon className="size-3" />
          </span>
          <span>X (Twitter)</span>
        </button>

        <button
          type="button"
          onClick={() => handleShareTarget('telegram')}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-text transition hover:bg-secondary"
        >
          <span className="grid size-6 place-items-center rounded-full bg-[#229ED9]/15 text-[#229ED9]">
            <TelegramIcon className="size-3.5" />
          </span>
          <span>Telegram</span>
        </button>

        <button
          type="button"
          onClick={() => handleShareTarget('facebook')}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-text transition hover:bg-secondary"
        >
          <span className="grid size-6 place-items-center rounded-full bg-[#1877F2]/15 text-[#1877F2]">
            <FacebookIcon className="size-3.5" />
          </span>
          <span>Facebook</span>
        </button>
      </div>
    </div>
  )
}
