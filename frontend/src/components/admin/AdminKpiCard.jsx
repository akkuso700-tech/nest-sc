function Sparkline({ data = [3, 5, 4, 8, 7, 9, 12, 10, 14], color = '#2563eb' }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data, min + 1)
  const width = 64
  const height = 24
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width
    const y = height - ((val - min) / (max - min)) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="admin-kpi-sparkline" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export default function AdminKpiCard({
  icon,
  label,
  value,
  helper,
  trend,
  tone = 'blue',
  progress,
  sparklineData,
  statusBadge,
}) {
  const toneColors = {
    blue: '#2563eb',
    green: '#16a34a',
    purple: '#7c3aed',
    orange: '#ea580c',
    red: '#dc2626',
  }
  const sparkColor = toneColors[tone] || '#2563eb'

  return (
    <article className={`admin-kpi-card is-${tone}`}>
      <div className="admin-kpi-top">
        <div className={`admin-kpi-icon is-${tone}`}>
          {icon}
        </div>
        <div className="admin-kpi-top-right">
          {statusBadge ? (
            <span className={`admin-kpi-badge is-${statusBadge.tone || 'neutral'}`}>
              {statusBadge.label}
            </span>
          ) : trend !== undefined && trend !== null ? (
            <span className={`admin-kpi-trend ${Number(trend) >= 0 ? 'is-up' : 'is-down'}`}>
              {Number(trend) >= 0 ? '↑ ' : '↓ '}
              {Math.abs(Number(trend)).toFixed(1)}%
            </span>
          ) : null}
          {sparklineData && <Sparkline data={sparklineData} color={sparkColor} />}
        </div>
      </div>

      <div className="admin-kpi-body">
        <span className="admin-kpi-label">{label}</span>
        <strong className="admin-kpi-value">{value}</strong>
        <p className="admin-kpi-helper">{helper}</p>

        {typeof progress === 'number' && (
          <div className="admin-kpi-progress-wrap">
            <div className="admin-kpi-progress-track">
              <i
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                className={`is-${tone}`}
              />
            </div>
            <span className="admin-kpi-progress-text">%{progress.toFixed(1)} aktivasyon</span>
          </div>
        )}
      </div>
    </article>
  )
}
