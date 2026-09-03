import { useId, useMemo, useState } from 'react'

function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  if (dateStr.includes(' ')) {
    const parts = dateStr.split(' ')
    return parts[1] || dateStr
  }
  if (dateStr.length === 7 && dateStr.includes('-')) {
    const [year, month] = dateStr.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })
  }
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function formatFullDate(dateStr) {
  if (!dateStr) return ''
  if (dateStr.includes(' ')) {
    const [dPart, timePart] = dateStr.split(' ')
    const d = new Date(dPart)
    const dateFormatted = !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : dPart
    return `${dateFormatted} Saat ${timePart}`
  }
  if (dateStr.length === 7 && dateStr.includes('-')) {
    const [year, month] = dateStr.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  }
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getSmoothPath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return path
}

export default function AdminAreaChart({ data = [] }) {
  const gradientId = useId()
  const [hoverIndex, setHoverIndex] = useState(null)
  const [viewMode, setViewMode] = useState('spline') // 'spline' | 'bars'

  const chartMetrics = useMemo(() => {
    if (!data.length) return null
    const counts = data.map((d) => Number(d.count || 0))
    const total = counts.reduce((acc, val) => acc + val, 0)
    const maxVal = Math.max(...counts, 1)
    const avg = total / data.length

    // Upper round limit for nice Y ticks
    const step = Math.ceil(maxVal / 4) || 1
    const niceMax = step * 4

    // Dimensions
    const width = 760
    const height = 240
    const padL = 40
    const padR = 24
    const padT = 24
    const padB = 36

    const chartW = width - padL - padR
    const chartH = height - padT - padB

    const points = data.map((item, idx) => {
      const x = data.length > 1 ? padL + (idx / (data.length - 1)) * chartW : padL + chartW / 2
      const val = Number(item.count || 0)
      const y = padT + chartH - (val / niceMax) * chartH
      return { x, y, val, date: item._id }
    })

    const linePath = getSmoothPath(points)
    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padT + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + chartH).toFixed(1)} Z`
      : ''

    const yTicks = [
      { val: niceMax, y: padT },
      { val: Math.round(niceMax * 0.75), y: padT + chartH * 0.25 },
      { val: Math.round(niceMax * 0.5), y: padT + chartH * 0.5 },
      { val: Math.round(niceMax * 0.25), y: padT + chartH * 0.75 },
      { val: 0, y: padT + chartH },
    ]

    return {
      width,
      height,
      padL,
      padR,
      padT,
      padB,
      chartW,
      chartH,
      niceMax,
      total,
      avg: Math.round(avg * 10) / 10,
      points,
      linePath,
      areaPath,
      yTicks,
    }
  }, [data])

  if (!chartMetrics || !data.length) {
    return (
      <div className="overview-chart-empty">
        <span>Henüz kayıt trendi oluşturacak veri bulunmuyor.</span>
      </div>
    )
  }

  const { width, height, padL, padT, chartW, chartH, points, linePath, areaPath, yTicks, avg, total } = chartMetrics
  const activePoint = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div className="admin-chart-card">
      <div className="admin-chart-header">
        <div className="admin-chart-titles">
          <div className="admin-chart-meta-row">
            <span className="admin-chart-badge">Kayıt Büyümesi</span>
            <span className="admin-chart-summary-stat">
              Toplam <strong>{total}</strong> yeni üye · Günlük Ort. <strong>{avg}</strong>
            </span>
          </div>
        </div>

        <div className="admin-chart-actions">
          <div className="admin-chart-segmented">
            <button
              type="button"
              className={viewMode === 'spline' ? 'is-active' : ''}
              onClick={() => setViewMode('spline')}
              title="Eğimli Alan Grafiği"
            >
              Alan
            </button>
            <button
              type="button"
              className={viewMode === 'bars' ? 'is-active' : ''}
              onClick={() => setViewMode('bars')}
              title="Çubuk Grafiği"
            >
              Çubuk
            </button>
          </div>
        </div>
      </div>

      <div className="admin-chart-canvas-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="admin-chart-svg"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const mouseX = ((e.clientX - rect.left) / rect.width) * width
            let closestIdx = 0
            let closestDist = Infinity
            points.forEach((p, idx) => {
              const dist = Math.abs(p.x - mouseX)
              if (dist < closestDist) {
                closestDist = dist
                closestIdx = idx
              }
            })
            setHoverIndex(closestIdx)
          }}
        >
          <defs>
            <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
              <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id={`barGrad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, idx) => (
            <g key={idx} className="admin-chart-grid-line">
              <line
                x1={padL}
                y1={tick.y}
                x2={width - chartMetrics.padR}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeDasharray={idx === yTicks.length - 1 ? '0' : '4 4'}
                strokeWidth="1"
              />
              <text
                x={padL - 10}
                y={tick.y + 3}
                fill="#94a3b8"
                fontSize="10"
                fontWeight="600"
                textAnchor="end"
              >
                {tick.val}
              </text>
            </g>
          ))}

          {/* Bars or Spline */}
          {viewMode === 'bars' ? (
            <g className="admin-chart-bars-group">
              {points.map((p, idx) => {
                const barWidth = Math.max(Math.min((chartW / points.length) * 0.72, 18), 4)
                const barH = padT + chartH - p.y
                const isHovered = hoverIndex === idx
                return (
                  <rect
                    key={idx}
                    x={p.x - barWidth / 2}
                    y={p.y}
                    width={barWidth}
                    height={Math.max(barH, 2)}
                    rx="3"
                    fill={`url(#barGrad-${gradientId})`}
                    opacity={isHovered ? 1 : 0.82}
                    className="admin-chart-bar"
                  />
                )
              })}
            </g>
          ) : (
            <>
              {/* Area */}
              <path d={areaPath} fill={`url(#grad-${gradientId})`} />

              {/* Stroke Line */}
              <path
                d={linePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* X Axis Labels */}
          {points.map((p, idx) => {
            const showLabel =
              idx === 0 ||
              idx === points.length - 1 ||
              idx === Math.floor(points.length / 2) ||
              idx === Math.floor(points.length / 4) ||
              idx === Math.floor((points.length * 3) / 4)

            if (!showLabel) return null
            return (
              <text
                key={idx}
                x={p.x}
                y={padT + chartH + 20}
                fill="#94a3b8"
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
              >
                {formatDateLabel(p.date)}
              </text>
            )
          })}

          {/* Hover effects */}
          {activePoint && (
            <g className="admin-chart-pointer" pointerEvents="none">
              <line
                x1={activePoint.x}
                y1={padT}
                x2={activePoint.x}
                y2={padT + chartH}
                stroke="#3b82f6"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="11"
                fill="#3b82f6"
                opacity="0.22"
              />
            </g>
          )}
        </svg>

        {/* Dynamic HTML Tooltip */}
        {activePoint && (
          <div
            className="admin-chart-tooltip"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(activePoint.y / height) * 100}%`,
            }}
          >
            <div className="admin-chart-tooltip-date">{formatFullDate(activePoint.date)}</div>
            <div className="admin-chart-tooltip-val">
              <span>Yeni Kayıt:</span>
              <strong>{activePoint.val}</strong>
            </div>
            {activePoint.val > avg && (
              <div className="admin-chart-tooltip-pill">
                Ortalamanın +{Math.round(((activePoint.val - avg) / (avg || 1)) * 100)}% üzerinde
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
