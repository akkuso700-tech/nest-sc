import { useEffect, useRef, useState } from 'react'
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
    <div className="space-y-3 p-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="size-14 rounded-md bg-secondary shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-3/4 rounded-md bg-secondary" />
          <div className="h-3 w-1/3 rounded-md bg-secondary" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-md bg-secondary" />
        <div className="h-20 rounded-md bg-secondary" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="h-16 rounded-md bg-secondary" />
        <div className="h-16 rounded-md bg-secondary" />
        <div className="h-16 rounded-md bg-secondary" />
        <div className="h-16 rounded-md bg-secondary" />
      </div>
      <div className="h-32 rounded-md bg-secondary" />
    </div>
  )
}

function formatDayLabel(dateStr, lang = 'tr', includeMonth = false) {
  try {
    const d = new Date(dateStr)
    if (includeMonth) {
      return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
        day: 'numeric',
        month: 'short',
      })
    }
    return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function TrendLineChart({
  trend = [],
  timeRange = 7,
  lang = 'tr',
  activeTrendIndex,
  setActiveTrendIndex,
  t,
}) {
  const svgRef = useRef(null)

  const maxTrendViews = Math.max(...trend.map((t) => t.views), 1)
  const periodTotalViews = trend.reduce((sum, d) => sum + (d.views || 0), 0)
  const peakDay = trend.reduce(
    (max, d) => (d.views > (max?.views || 0) ? d : max),
    trend[0] || null
  )
  const activeDay = activeTrendIndex !== null ? trend[activeTrendIndex] : null

  // SVG dimensions & coordinate space
  const svgWidth = 500
  const svgHeight = 150
  const paddingLeft = 34
  const paddingRight = 16
  const paddingTop = 18
  const baselineY = 120
  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = baselineY - paddingTop

  // Calculate coordinates for each data point
  const points = trend.map((day, idx) => {
    const x =
      trend.length <= 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (idx / (trend.length - 1)) * chartWidth
    const ratio = maxTrendViews > 0 ? day.views / maxTrendViews : 0
    const y = baselineY - ratio * (chartHeight - 12)
    return { x, y, day, idx }
  })

  // Smooth Bezier spline
  const linePath = (() => {
    if (points.length === 0) return ''
    if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
    if (points.length === 2) {
      return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`
    }

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(i + 2, points.length - 1)]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      let cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      let cp2y = p2.y - (p3.y - p1.y) / 6

      cp1y = Math.min(baselineY, Math.max(paddingTop, cp1y))
      cp2y = Math.min(baselineY, Math.max(paddingTop, cp2y))

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d
  })()

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baselineY} L ${points[0].x.toFixed(1)} ${baselineY} Z`
      : ''

  // Date tick indexes for X-axis labels
  const tickIndices = (() => {
    const len = trend.length
    if (len <= 7) return Array.from({ length: len }, (_, i) => i)
    if (timeRange === 28) {
      return [0, Math.floor(len * 0.25), Math.floor(len * 0.5), Math.floor(len * 0.75), len - 1]
    }
    return [0, Math.floor(len * 0.33), Math.floor(len * 0.66), len - 1]
  })()

  // Pointer event tracking for scrubber
  const handlePointer = (e) => {
    if (!svgRef.current || points.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX)
    if (clientX === undefined) return
    const relX = (clientX - rect.left) / rect.width
    const svgX = relX * svgWidth
    const clampedX = Math.max(paddingLeft, Math.min(svgWidth - paddingRight, svgX))
    const ratio = (clampedX - paddingLeft) / chartWidth
    const idx = Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))))
    setActiveTrendIndex(idx)
  }

  const activePoint = activeTrendIndex !== null ? points[activeTrendIndex] : null

  return (
    <div className="space-y-3">
      {/* Dynamic Stats Banner */}
      {activeDay ? (
        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-3 py-2 transition-all">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold text-text">
              {formatDayLabel(activeDay.date, lang, timeRange > 7)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-primary">
              {activeDay.views.toLocaleString()}
            </span>
            <span className="text-[11px] font-medium text-muted">
              {t('insights.views', { defaultValue: 'görüntülenme' })}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted">
            <span>{timeRange} {t('insights.daysTotal', { defaultValue: 'günlük toplam' })}:</span>
            <strong className="text-text font-bold">{periodTotalViews.toLocaleString()}</strong>
          </div>
          {peakDay && peakDay.views > 0 ? (
            <div className="text-[11px] text-muted">
              <span>{t('insights.peak', { defaultValue: 'Zirve' })}: </span>
              <strong className="text-primary font-bold">{peakDay.views.toLocaleString()}</strong>
              <span className="text-muted/80 ml-1">({formatDayLabel(peakDay.date, lang, true)})</span>
            </div>
          ) : (
            <span className="text-[11px] text-muted/70">
              {t('insights.tapHint', { defaultValue: 'İncelemek için grafiğe dokunun' })}
            </span>
          )}
        </div>
      )}

      {/* SVG Chart Frame */}
      <div className="relative w-full overflow-hidden rounded-md border border-border bg-secondary/30 p-1.5">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-36 select-none touch-none cursor-crosshair overflow-visible"
          onPointerDown={handlePointer}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch' || e.pointerType === 'mouse') {
              handlePointer(e)
            }
          }}
          onPointerLeave={() => setActiveTrendIndex(null)}
        >
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.32" />
              <stop offset="95%" stopColor="rgb(var(--color-primary))" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Top dashed line & Max views label */}
          <line
            x1={paddingLeft}
            y1={paddingTop + 6}
            x2={svgWidth - paddingRight}
            y2={paddingTop + 6}
            stroke="rgb(var(--color-border-soft))"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text
            x={paddingLeft - 6}
            y={paddingTop + 10}
            textAnchor="end"
            className="text-[9px] fill-muted font-medium select-none"
          >
            {maxTrendViews >= 1000 ? `${(maxTrendViews / 1000).toFixed(1)}k` : maxTrendViews}
          </text>

          {/* Middle dashed line */}
          <line
            x1={paddingLeft}
            y1={(paddingTop + 6 + baselineY) / 2}
            x2={svgWidth - paddingRight}
            y2={(paddingTop + 6 + baselineY) / 2}
            stroke="rgb(var(--color-border-soft))"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Bottom baseline & 0 label */}
          <line
            x1={paddingLeft}
            y1={baselineY}
            x2={svgWidth - paddingRight}
            y2={baselineY}
            stroke="rgb(var(--color-border))"
            strokeWidth="1"
          />
          <text
            x={paddingLeft - 6}
            y={baselineY + 3}
            textAnchor="end"
            className="text-[9px] fill-muted font-medium select-none"
          >
            0
          </text>

          {/* Gradient Area */}
          {areaPath && <path d={areaPath} fill="url(#trendGradient)" />}

          {/* Smooth Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="rgb(var(--color-primary))"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 7-day data dots */}
          {timeRange === 7 &&
            points.map((pt, i) => {
              const isSelected = activeTrendIndex === i
              return (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 4.5 : 3}
                  fill={isSelected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-card))'}
                  stroke="rgb(var(--color-primary))"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />
              )
            })}

          {/* Interactive Scrubber Cursor */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={baselineY}
                stroke="rgb(var(--color-primary))"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.8"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="9"
                fill="rgb(var(--color-primary))"
                fillOpacity="0.22"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4.5"
                fill="rgb(var(--color-primary))"
                stroke="rgb(var(--color-card))"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X-axis date labels */}
          {tickIndices.map((idx, i) => {
            const pt = points[idx]
            if (!pt) return null
            const isFirst = i === 0
            const isLast = i === tickIndices.length - 1
            const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
            return (
              <text
                key={pt.day.date}
                x={pt.x}
                y={svgHeight - 6}
                textAnchor={textAnchor}
                className="text-[10px] fill-muted font-medium select-none"
              >
                {formatDayLabel(pt.day.date, lang, timeRange > 7)}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Footer hint & Reset button */}
      <div className="flex items-center justify-between text-[11px] text-muted px-1">
        <span>{t('insights.chartHint', { defaultValue: 'Tarih detayları için grafiğe dokunun veya kaydırın' })}</span>
        {activeTrendIndex !== null && (
          <button
            type="button"
            onClick={() => setActiveTrendIndex(null)}
            className="font-medium text-primary hover:underline cursor-pointer"
          >
            {t('common.reset', { defaultValue: 'Sıfırla' })}
          </button>
        )}
      </div>
    </div>
  )
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
  const [timeRange, setTimeRange] = useState(7)
  const [activeTrendIndex, setActiveTrendIndex] = useState(null)

  useEffect(() => {
    if (!open || !postId) return

    let isMounted = true
    setIsLoading(true)
    setError('')
    setActiveTrendIndex(null)

    getPostInsights(postId, timeRange)
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
  }, [open, postId, timeRange, t])

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
              getPostInsights(postId, timeRange)
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
      <div className="space-y-3 p-5">
        {/* Post Snippet Banner */}
        <div className="flex items-center gap-3.5 rounded-md border border-border bg-secondary/40 p-3">
          {thumbnail ? (
            <div className="size-13 shrink-0 overflow-hidden rounded-md border border-border bg-black">
              <img
                src={thumbnail}
                alt=""
                className="size-full object-cover"
              />
            </div>
          ) : (
            <div className="grid size-13 shrink-0 place-items-center rounded-md border border-border bg-secondary text-muted">
              <ChartBarIcon className="size-6 opacity-60" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
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
          <div className="rounded-md border border-border bg-card p-4 shadow-sm">
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

          <div className="rounded-md border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">
                {t('insights.engagementRate', { defaultValue: 'Etkileşim Oranı' })}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${engagementTone.color}`}>
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
        <div className="rounded-md border border-border bg-card p-4 shadow-sm">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            {t('insights.interactionBreakdown', { defaultValue: 'Etkileşim Dağılımı' })}
          </h3>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-md bg-rose-500/10 p-2.5 dark:bg-rose-950/30">
              <span className="text-rose-500 mx-auto block mb-1">
                <HeartIcon className="mx-auto" />
              </span>
              <p className="text-sm font-black text-text">{(interactions.likes || 0).toLocaleString()}</p>
              <p className="text-[10px] font-medium text-muted">{t('common.like', { defaultValue: 'Beğeni' })}</p>
            </div>

            <div className="rounded-md bg-blue-500/10 p-2.5 dark:bg-blue-950/30">
              <span className="text-blue-500 mx-auto block mb-1">
                <CommentIcon className="mx-auto" />
              </span>
              <p className="text-sm font-black text-text">{(interactions.comments || 0).toLocaleString()}</p>
              <p className="text-[10px] font-medium text-muted">{t('common.comment', { defaultValue: 'Yorum' })}</p>
            </div>

            <div className="rounded-md bg-emerald-500/10 p-2.5 dark:bg-emerald-950/30">
              <span className="text-emerald-500 mx-auto block mb-1">
                <ShareIcon className="mx-auto" />
              </span>
              <p className="text-sm font-black text-text">{(interactions.shares || 0).toLocaleString()}</p>
              <p className="text-[10px] font-medium text-muted">{t('common.share', { defaultValue: 'Paylaşım' })}</p>
            </div>

            <div className="rounded-md bg-amber-500/10 p-2.5 dark:bg-amber-950/30">
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
          <div className="rounded-md border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-500/10 p-1.5 text-indigo-500">
                <ReplayIcon />
              </span>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                {t('insights.videoPerformance', { defaultValue: 'Loop / Video Dinamikleri' })}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-md border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted">{t('insights.retentionRate', { defaultValue: 'İzlenme Oranı' })}</p>
                <p className="mt-1 text-lg font-black text-text">%{videoMetrics.averageWatchRatio || 0}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-md bg-border">
                  <div
                    className="h-full bg-indigo-500 rounded-md transition-all duration-500"
                    style={{ width: `${Math.min(100, videoMetrics.averageWatchRatio || 0)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-md border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted">{t('insights.completionRate', { defaultValue: 'Tamamlama Oranı' })}</p>
                <p className="mt-1 text-lg font-black text-text">%{videoMetrics.completionRate || 0}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-md bg-border">
                  <div
                    className="h-full bg-emerald-500 rounded-md transition-all duration-500"
                    style={{ width: `${Math.min(100, videoMetrics.completionRate || 0)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-md border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted">{t('insights.replays', { defaultValue: 'Tekrar Oynatma' })}</p>
                <p className="mt-1 text-lg font-black text-text">{(videoMetrics.loopReplays || 0).toLocaleString()} <span className="text-xs font-normal text-muted">kez</span></p>
              </div>

              <div className="rounded-md border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted">{t('insights.avgDuration', { defaultValue: 'Ortalama Süre' })}</p>
                <p className="mt-1 text-lg font-black text-text">{videoMetrics.averageWatchSeconds || 0} <span className="text-xs font-normal text-muted">sn</span></p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Trend Chart (7, 28, 90 Days) */}
        {trend.length > 0 ? (
          <div className="rounded-md border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                {t('insights.trendTitle', { defaultValue: 'İzlenme Grafiği' })}
              </h3>

              {/* 7, 28, 90 Day Segmented Buttons */}
              <div className="inline-flex items-center rounded-md border border-border bg-secondary p-1 shadow-xs">
                {[
                  { value: 7, label: `7 ${t('insights.daysShort', { defaultValue: 'G' })}` },
                  { value: 28, label: `28 ${t('insights.daysShort', { defaultValue: 'G' })}` },
                  { value: 90, label: `90 ${t('insights.daysShort', { defaultValue: 'G' })}` },
                ].map((item) => {
                  const isActive = timeRange === item.value
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setTimeRange(item.value)
                        setActiveTrendIndex(null)
                      }}
                      className={`rounded-md px-3 py-1 text-xs font-bold transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-primary text-white shadow-sm shadow-primary/25 scale-[1.02]'
                          : 'text-muted hover:text-text hover:bg-card'
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <TrendLineChart
              trend={trend}
              timeRange={timeRange}
              lang={lang}
              activeTrendIndex={activeTrendIndex}
              setActiveTrendIndex={setActiveTrendIndex}
              t={t}
            />
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
          className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-md border-t border-border bg-card shadow-[0_-20px_50px_rgba(0,0,0,0.35)] transition-transform duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Grabber */}
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-md bg-border-strong shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                <ChartBarIcon />
              </span>
              <h2 id="insights-title" className="text-base font-bold text-text">
                {t('insights.title', { defaultValue: 'Gönderi İstatistikleri' })}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-md bg-secondary text-muted hover:text-text cursor-pointer"
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
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-border bg-card shadow-2xl animate-[scaleIn_160ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="rounded-md bg-primary/10 p-1.5 text-primary">
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
            className="grid size-8 place-items-center rounded-md bg-secondary text-muted transition hover:text-text cursor-pointer"
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
