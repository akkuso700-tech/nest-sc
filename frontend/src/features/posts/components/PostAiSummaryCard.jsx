import { useState } from 'react'
import { SparklesIcon } from '../../../layouts/SocialLayoutIcons.jsx'

export default function PostAiSummaryCard({
  summary,
  isLoading,
  error,
  isCached,
  onRefresh,
  onClose,
  onShowToast,
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!summary) return
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      if (typeof onShowToast === 'function') {
        onShowToast({ message: 'Özet panoya kopyalandı.', tone: 'success' })
      }
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback ignore
    }
  }

  // Parse lines for bullet rendering
  const lines = summary
    ? summary
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : []

  return (
    <div className="mx-4 my-2.5 overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/80 dark:border-zinc-800/70 dark:bg-black/35 p-3.5 backdrop-blur-sm transition-all duration-200 shadow-xs animate-in fade-in slide-in-from-top-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/60 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-sm select-none">✨</span>
          <span className="text-xs font-semibold text-text tracking-tight">Nest AI Özeti</span>
          <span className="rounded-full border border-slate-200/70 bg-white/90 dark:border-zinc-800/80 dark:bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium text-muted">
            {isCached ? 'Hızlı Özet' : 'Yeni Analiz'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {summary && !isLoading ? (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-secondary hover:text-text transition cursor-pointer"
                title="Özeti Kopyala"
                aria-label="Özeti Kopyala"
              >
                {copied ? (
                  <svg className="size-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <rect width="14" height="14" x="8" y="8" rx="2" strokeWidth={1.8} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={onRefresh}
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-secondary hover:text-text transition cursor-pointer"
                title="Yeniden Özetle"
                aria-label="Yeniden Özetle"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-muted hover:bg-secondary hover:text-text transition cursor-pointer"
            title="Kapat"
            aria-label="Kapat"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2 py-1">
          <div className="flex items-center gap-2 text-xs text-muted mb-2 animate-pulse">
            <span className="size-2 rounded-full bg-primary animate-ping" />
            <span>Gönderi ve öne çıkan yorumlar analiz ediliyor...</span>
          </div>
          <div className="h-3 w-4/5 animate-pulse rounded bg-secondary/80" />
          <div className="h-3 w-full animate-pulse rounded bg-secondary/80" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-secondary/80" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 py-1 text-xs text-rose-500 dark:text-rose-400">
          <div className="flex items-center gap-1.5">
            <span>⚠</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="font-semibold underline hover:opacity-80 cursor-pointer"
          >
            Yeniden Dene
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {lines.map((line, idx) => {
            const cleanText = line.replace(/^[•\-\*]\s*/, '').replace(/^\d+\.\s*/, '')
            return (
              <div key={idx} className="flex items-start gap-2 text-[13px] leading-relaxed text-text/90">
                <span className="mt-1 text-xs text-primary/80 font-bold select-none">•</span>
                <span className="flex-1">{cleanText}</span>
              </div>
            )
          })}

          <div className="pt-2 text-[10px] text-muted flex items-center justify-between border-t border-slate-200/50 dark:border-white/[0.05]">
            <span>Yapay zeka ile özetlenmiştir</span>
            <span className="font-medium text-text/60">Nest AI</span>
          </div>
        </div>
      )}
    </div>
  )
}
