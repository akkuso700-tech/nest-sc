import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPostInsights } from '../../services/postsService.js'
import { resolveMediaUrl } from '../../utils/media.js'
import { formatRelativeTime } from '../../utils/social.js'

function ChartBarIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
      className={`size-5 shrink-0 ${className}`}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function CloseIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      className={`size-4 shrink-0 ${className}`}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function EyeIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      className={`size-4.5 shrink-0 ${className}`}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function HeartIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className={`size-4 shrink-0 ${className}`}>
      <path d="m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function CommentIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" className={`size-4 shrink-0 ${className}`}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ShareIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" className={`size-4 shrink-0 ${className}`}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function BookmarkIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className={`size-4 shrink-0 ${className}`}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ReplayIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" className={`size-4 shrink-0 ${className}`}>
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

function InsightsSkeleton() {
  return (
    <div className="space-y-4 p-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="size-14 rounded-xl bg-secondary shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-3/4 rounded bg-secondary" />
          <div className="h-3 w-1/3 rounded bg-secondary" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl bg-secondary" />
        <div className="h-20 rounded-2xl bg-secondary" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="h-16 rounded-xl bg-secondary" />
        <div className="h-16 rounded-xl bg-secondary" />
        <div className="h-16 rounded-xl bg-secondary" />
        <div className="h-16 rounded-xl bg-secondary" />
      </div>
      <div className="h-32 rounded-2xl bg-secondary" />
    </div>
  )
}

function formatDayLabel(dateStr, lang = 'tr') {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function PostInsightsModal({
  open,
  onClose,
  postId,
  isMobile = false,
  lang = 'tr',
}) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !postId) return

    let isMounted = true
    setIsLoading(true)
    setError('')

    getPostInsights(postId)
      .then((res) => {
        if (isMounted) {
          setData(res)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || t('common.loadFailed', { defaultValue: 'Yüklenemedi.' }))
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [open, postId, t])

  // ESC key listener
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const post = data?.post || {}
  const kpi = data?.kpi || {}
  const interactions = data?.interactions || {}
  const videoMetrics = data?.videoMetrics || {}
  const trend = data?.trend || []

  const firstMedia = (post.media || [])[0]
  const thumbnail = firstMedia
    ? resolveMediaUrl(firstMedia.posterUrl || firstMedia.url)
    : null

  const totalInteractions = kpi.totalInteractions || 0
  const maxTrendViews = Math.max(...trend.map((t) => t.views), 1)

  function getEngagementTone(rate) {
    if (rate >= 10) return { label: t('insights.viral', { defaultValue: 'Çok Yüksek 🚀' }), color: 'text-emerald-500 bg-emerald-500/10' }
    if (rate >= 5) return { label: t('insights.good', { defaultValue: 'İyi Etkileşim ✨' }), color: 'text-blue-500 bg-blue-500/10' }
    if (rate >= 2) return { label: t('insights.average', { defaultValue: 'Ortalama' }), color: 'text-amber-500 bg-amber-500/10' }
    return { label: t('insights.low', { defaultValue: 'Gelişmekte' }), color: 'text-muted bg-secondary' }
  }

  const engagementTone = getEngagementTone(kpi.engagementRate || 0)

  function renderContent() {
    if (isLoading) {
      return <InsightsSkeleton />
    }

    if (error) {
      return (
        <div className="py-12 px-5 text-center">
          <p className="text-sm text-rose-500 font-medium">{error}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true)
              setError('')
              getPostInsights(postId)
                .then(setData)
                .catch((e) => setError(e.message))
                .finally(() => setIsLoading(false))
            }}
            className="mt-3 text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            {t('common.tryAgain', { defaultValue: 'Tekrar dene' })}
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-5 p-5">
        {/* Post Snippet Banner */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-secondary/40 p-3">
          {thumbnail ? (
            <div className="size-13 shrink-0 overflow-hidden rounded-xl border border-border bg-black">
              <img
                src={thumbnail}
                alt=""
                className="size-full object-cover"
              />
            </div>
          ) : (
            <div className="grid size-13 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-muted">
              <ChartBarIcon className="size-6 opacity-60" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                {post.contentType === 'loop' ? 'Loop' : 'Gönderi'}
              </span>
              <span className="text-xs text-muted">
                {post.createdAt ? formatRelativeTime(post.createdAt, lang) : ''}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-xs font-medium text-text">
              {post.title || post.text || t('postDetail.fallbackTitle', { defaultValue: 'İçerik' })}
            </p>
          </div>
        </div>

        {/* KPI Overview Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">
                {t('insights.totalViews', { defaultValue: 'Görüntülenme' })}
              </span>
              <span className="text-primary">
                <EyeIcon />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-text">
              {(kpi.views || 0).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {t('insights.viewsDesc', { defaultValue: 'Toplam gösterim sayısı' })}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">
                {t('insights.engagementRate', { defaultValue: 'Etkileşim Oranı' })}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${engagementTone.color}`}>
                {engagementTone.label}
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-text">
              %{kpi.engagementRate || 0}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {totalInteractions.toLocaleString()} {t('insights.totalInteractions', { defaultValue: 'toplam aksiyon' })}
            </p>
          </div>
        </div>

        {/* Interaction Breakdown Grid */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            {t('insights.interactionBreakdown', { defaultValue: 'Etkileşim Dağılımı' })}
          </h3>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-rose-500/10 p-2.5 dark:bg-rose-950/30">
              <span className="text-rose-500 mx-auto block mb-1">
                <HeartIcon className="mx-auto" />
              </span>
              <p className="text-sm font-black text-text">{(interactions.likes || 0).toLocaleString()}</p>
              <p className="text-[10px] font-medium text-muted">{t('common.like', { defaultValue: 'Beğeni' })}</p>
            </div>

            <div className="rounded-xl bg-blue-500/10 p-2.5 dark:bg-blue-950/30">
              <span className="text-blue-500 mx-auto block mb-1">
                <CommentIcon className="mx-auto" />
              </span>
              <p className="text-sm font-black text-text">{(interactions.comments || 0).toLocaleString()}</p>
              <p className="text-[10px] font-medium text-muted">{t('common.comment', { defaultValue: 'Yorum' })}</p>
            </div>

            <div className="rounded-xl bg-emerald-500/10 p-2.5 dark:bg-emerald-950/30">
              <span className="text-emerald-500 mx-auto block mb-1">
                <ShareIcon className="mx-auto" />
              </span>
              <p className="text-sm font-black text-text">{(interactions.shares || 0).toLocaleString()}</p>
              <p className="text-[10px] font-medium text-muted">{t('common.share', { defaultValue: 'Paylaşım' })}</p>
            </div>

            <div className="rounded-xl bg-amber-500/10 p-2.5 dark:bg-amber-950/30">
              <span className="text-amber-500 mx-auto block mb-1">
                <BookmarkIcon className="mx-auto" />
              </span>
              <p className="text-sm font-black text-text">{(interactions.saves || 0).toLocaleString()}</p>
              <p className="text-[10px] font-medium text-muted">{t('common.save', { defaultValue: 'Kaydetme' })}</p>
            </div>
          </div>
        </div>

        {/* Video / Loop Metrics (if applicable) */}
        {videoMetrics.isVideo ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-500">
                <ReplayIcon />
              </span>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                {t('insights.videoPerformance', { defaultValue: 'Loop / Video Dinamikleri' })}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted">{t('insights.retentionRate', { defaultValue: 'İzlenme Oranı' })}</p>
                <p className="mt-1 text-lg font-black text-text">%{videoMetrics.averageWatchRatio || 0}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, videoMetrics.averageWatchRatio || 0)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted">{t('insights.completionRate', { defaultValue: 'Tamamlama Oranı' })}</p>
                <p className="mt-1 text-lg font-black text-text">%{videoMetrics.completionRate || 0}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, videoMetrics.completionRate || 0)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted">{t('insights.replays', { defaultValue: 'Tekrar Oynatma' })}</p>
                <p className="mt-1 text-lg font-black text-text">{(videoMetrics.loopReplays || 0).toLocaleString()} <span className="text-xs font-normal text-muted">kez</span></p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted">{t('insights.avgDuration', { defaultValue: 'Ortalama Süre' })}</p>
                <p className="mt-1 text-lg font-black text-text">{videoMetrics.averageWatchSeconds || 0} <span className="text-xs font-normal text-muted">sn</span></p>
              </div>
            </div>
          </div>
        ) : null}

        {/* 7-Day Trend Chart */}
        {trend.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
              {t('insights.trendTitle', { defaultValue: 'Son 7 Günlük İzlenme Grafiği' })}
            </h3>

            <div className="flex items-end justify-between gap-2 h-32 pt-4 px-1">
              {trend.map((day) => {
                const heightPercent = Math.max(8, Math.round((day.views / maxTrendViews) * 100))
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-bold text-text opacity-0 group-hover:opacity-100 transition-opacity">
                      {day.views}
                    </span>
                    <div className="w-full max-w-[28px] bg-secondary rounded-t-lg overflow-hidden flex items-end h-20">
                      <div
                        className="w-full bg-primary transition-all duration-500 rounded-t-lg group-hover:brightness-110"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-muted truncate w-full text-center">
                      {formatDayLabel(day.date, lang)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // --- MOBILE BOTTOM SHEET ---
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-[135] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="insights-title"
      >
        <div
          className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[28px] border-t border-border bg-card shadow-[0_-20px_50px_rgba(0,0,0,0.35)] transition-transform duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Grabber */}
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border-strong shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-primary/10 p-1.5 text-primary">
                <ChartBarIcon />
              </span>
              <h2 id="insights-title" className="text-base font-bold text-text">
                {t('insights.title', { defaultValue: 'Gönderi İstatistikleri' })}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full bg-secondary text-muted hover:text-text cursor-pointer"
              aria-label={t('common.close')}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    )
  }

  // --- DESKTOP CENTERED DIALOG ---
  return (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="insights-title"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-[scaleIn_160ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <ChartBarIcon />
            </span>
            <div>
              <h2 id="insights-title" className="text-base font-bold text-text">
                {t('insights.title', { defaultValue: 'Gönderi İstatistikleri' })}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full bg-secondary text-muted transition hover:text-text cursor-pointer"
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
