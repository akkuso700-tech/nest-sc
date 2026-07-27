import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAdminOverview, getAdminPerformanceSummary } from '../services/adminService.js'

function formatNumber(value, compact = false) {
  return new Intl.NumberFormat('tr-TR', compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(Number(value || 0))
}

function formatPercent(value, digits = 1) {
  return `%${Number(value || 0).toFixed(digits)}`
}

function KpiCard({ label, value, helper, tone = 'blue', progress }) {
  return (
    <article className="overview-kpi-card">
      <div className={`overview-kpi-icon is-${tone}`}>{label.slice(0, 2).toUpperCase()}</div>
      <div className="overview-kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
        {typeof progress === 'number' ? (
          <div className="overview-progress" aria-label={`${label} ${progress.toFixed(1)} yüzde`}>
            <i style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
          </div>
        ) : null}
      </div>
    </article>
  )
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`overview-panel ${className}`}>
      <header className="overview-panel-header">
        <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
        {action}
      </header>
      {children}
    </section>
  )
}

function EmptyState({ children }) {
  return <div className="overview-empty">{children}</div>
}

function AdminOverviewPage() {
  const { lang = 'tr' } = useParams()
  const [state, setState] = useState({ data: null, loading: true, error: '' })

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getAdminOverview(),
      getAdminPerformanceSummary({ days: 7 }).catch(() => ({ totalSamples: 0, metrics: [], routes: [] })),
    ])
      .then(([overview, performance]) => {
        if (!cancelled) setState({ data: { ...overview, performance }, loading: false, error: '' })
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error: error.message || 'Yönetim analizleri yüklenemedi.' })
      })
    return () => { cancelled = true }
  }, [])

  const derived = useMemo(() => {
    const data = state.data
    if (!data) return null
    const totalUsers = Number(data.metrics?.totalUsers || 0)
    const weeklyActive = Number(data.metrics?.weeklyActiveUsers || 0)
    const monthlyActive = Number(data.metrics?.activeUsers || 0)
    const openReports = Number(data.moderationSummary?.openReports || 0) + Number(data.moderationSummary?.inReviewReports || 0)
    const totalInteractions = ['likes', 'comments', 'shares', 'saves'].reduce((total, key) => total + Number(data.contentEngagement?.[key] || 0), 0)
    const registrations = data.latestRegistrations || []
    const newRegistrations = registrations.reduce((total, item) => total + Number(item.count || 0), 0)
    return {
      totalUsers,
      weeklyActive,
      monthlyActive,
      openReports,
      totalInteractions,
      newRegistrations,
      activationRate: totalUsers ? (weeklyActive / totalUsers) * 100 : 0,
      monthlyRate: totalUsers ? (monthlyActive / totalUsers) * 100 : 0,
      locationConsentRate: totalUsers ? (Number(data.moderationSummary?.usersWithLocationConsent || 0) / totalUsers) * 100 : 0,
      maxRegistration: Math.max(...registrations.map((item) => Number(item.count || 0)), 1),
    }
  }, [state.data])

  if (state.loading) {
    return (
      <div className="overview-loading" aria-busy="true">
        {Array.from({ length: 8 }, (_, index) => <div key={index} />)}
      </div>
    )
  }

  if (state.error) return <div className="overview-error">{state.error}</div>

  const { metrics, moderationSummary, roleBreakdown = [], countryBreakdown = [], latestRegistrations = [], contentEngagement = {}, loopQuality = {}, performance = {} } = state.data
  const vitalMap = new Map((performance.metrics || []).map((metric) => [metric.name, metric]))
  const rolesTotal = Math.max(roleBreakdown.reduce((total, item) => total + Number(item.count || 0), 0), 1)
  const roleColors = ['#2563eb', '#7c3aed', '#0ea5e9', '#14b8a6']
  let roleOffset = 0
  const roleGradient = roleBreakdown.length
    ? `conic-gradient(${roleBreakdown.map((item, index) => {
        const start = roleOffset
        roleOffset += (Number(item.count || 0) / rolesTotal) * 100
        return `${roleColors[index % roleColors.length]} ${start}% ${roleOffset}%`
      }).join(',')})`
    : '#e2e8f0'

  return (
    <div className="admin-overview">
      <section className="overview-kpi-grid">
        <KpiCard label="Toplam kullanıcı" value={formatNumber(derived.totalUsers)} helper={`${formatNumber(derived.newRegistrations)} yeni kayıt · 30 gün`} tone="blue" />
        <KpiCard label="Haftalık aktif" value={formatNumber(derived.weeklyActive)} helper={`${formatPercent(derived.activationRate)} aktivasyon oranı`} progress={derived.activationRate} tone="green" />
        <KpiCard label="Toplam içerik" value={formatNumber(metrics.totalPosts)} helper={`${formatNumber(derived.totalInteractions, true)} toplam etkileşim`} tone="purple" />
        <KpiCard label="Açık rapor" value={formatNumber(derived.openReports)} helper={`${formatNumber(moderationSummary.suspendedUsers)} askıdaki hesap`} tone={derived.openReports ? 'orange' : 'green'} />
      </section>

      <div className="overview-primary-grid">
        <Panel
          title="Kayıt trendi"
          subtitle="Son 30 gündeki günlük yeni üyelikler"
          action={<span className="overview-live-pill"><i /> Canlı veri</span>}
          className="overview-registration-panel"
        >
          {latestRegistrations.length ? (
            <div className="overview-bar-chart" aria-label="Günlük kayıt grafiği">
              {latestRegistrations.map((item, index) => (
                <div className="overview-bar-column" key={item._id} title={`${item._id}: ${item.count} kayıt`}>
                  <span>{item.count}</span>
                  <i style={{ height: `${Math.max((Number(item.count || 0) / derived.maxRegistration) * 100, 6)}%` }} />
                  {(index === 0 || index === latestRegistrations.length - 1 || index % 5 === 0) ? <small>{`${item._id}`.slice(5)}</small> : <small />}
                </div>
              ))}
            </div>
          ) : <EmptyState>Henüz kayıt trendi oluşturacak veri yok.</EmptyState>}
        </Panel>

        <Panel title="Kullanıcı sağlığı" subtitle="Aktiflik ve izin kapsamı">
          <div className="overview-health-list">
            {[
              ['30 günlük aktiflik', derived.monthlyRate, `${formatNumber(derived.monthlyActive)} kullanıcı`],
              ['7 günlük aktivasyon', derived.activationRate, `${formatNumber(derived.weeklyActive)} kullanıcı`],
              ['Konum izni kapsamı', derived.locationConsentRate, `${formatNumber(moderationSummary.usersWithLocationConsent)} kullanıcı`],
            ].map(([label, value, helper]) => (
              <div key={label} className="overview-health-item">
                <div><strong>{label}</strong><span>{helper}</span></div><b>{formatPercent(value)}</b>
                <div className="overview-health-track"><i style={{ width: `${Math.min(value, 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <Link to={`/${lang}/admin/users`} className="overview-panel-link">Kullanıcı operasyonlarını aç →</Link>
        </Panel>
      </div>

      <div className="overview-secondary-grid">
        <Panel title="Etkileşim dağılımı" subtitle="Platform genelindeki içerik aksiyonları">
          <div className="overview-engagement-list">
            {[
              ['Beğeni', contentEngagement.likes, '#2563eb'],
              ['Yorum', contentEngagement.comments, '#7c3aed'],
              ['Paylaşım', contentEngagement.shares, '#0ea5e9'],
              ['Kaydetme', contentEngagement.saves, '#14b8a6'],
            ].map(([label, value, color]) => {
              const percent = derived.totalInteractions ? (Number(value || 0) / derived.totalInteractions) * 100 : 0
              return <div key={label}><span><i style={{ background: color }} />{label}</span><strong>{formatNumber(value)}</strong><small>{formatPercent(percent)}</small></div>
            })}
          </div>
        </Panel>

        <Panel title="Rol dağılımı" subtitle={`${formatNumber(derived.totalUsers)} kayıtlı hesap`}>
          <div className="overview-role-layout">
            <div className="overview-donut" style={{ background: roleGradient }}><span><strong>{formatNumber(derived.totalUsers)}</strong><small>hesap</small></span></div>
            <div className="overview-role-legend">
              {roleBreakdown.map((item, index) => <div key={item._id || index}><i style={{ background: roleColors[index % roleColors.length] }} /><span>{item._id || 'Belirsiz'}</span><strong>{formatNumber(item.count)}</strong></div>)}
            </div>
          </div>
        </Panel>

        <Panel title="Moderasyon yükü" subtitle="Güncel müdahale görünümü">
          <div className="overview-moderation-list">
            {[
              ['Gizlenen gönderi', moderationSummary.hiddenPosts, 'warning'],
              ['Kaldırılan gönderi', moderationSummary.removedPosts, 'danger'],
              ['Gizlenen yorum', moderationSummary.hiddenComments, 'warning'],
              ['Kaldırılan yorum', moderationSummary.removedComments, 'danger'],
            ].map(([label, value, tone]) => <div key={label}><span><i className={`is-${tone}`} />{label}</span><strong>{formatNumber(value)}</strong></div>)}
          </div>
          <Link to={`/${lang}/admin/reports`} className="overview-panel-link">Moderasyon kuyruğunu aç →</Link>
        </Panel>
      </div>

      <div className="overview-primary-grid overview-bottom-grid">
        <Panel title="Gerçek kullanıcı performansı" subtitle={`Son 7 gün · ${formatNumber(performance.totalSamples)} anonim ölçüm`}>
          <div className="overview-vitals-grid">
            {['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].map((name) => {
              const metric = vitalMap.get(name)
              const value = metric?.p75 === null || metric?.p75 === undefined ? '—' : name === 'CLS' ? Number(metric.p75).toFixed(3) : `${metric.p75} ms`
              const rating = metric?.rating || 'waiting'
              const labels = { good: 'İyi', 'needs-improvement': 'İyileştirilmeli', poor: 'Zayıf', waiting: 'Veri bekleniyor' }
              return <article key={name}><span>{name} p75</span><strong>{value}</strong><small className={`is-${rating}`}>{labels[rating] || labels.waiting}</small></article>
            })}
          </div>
        </Panel>

        <Panel title="Loop kalite sinyalleri" subtitle={`${formatNumber(loopQuality.totalLoops)} yayınlanmış loop`}>
          <div className="overview-loop-grid">
            <div><span>Tamamlama</span><strong>{formatPercent(loopQuality.completionRate)}</strong></div>
            <div><span>Ortalama izleme</span><strong>{formatPercent(Number(loopQuality.avgWatchRatio || 0) * 100)}</strong></div>
            <div><span>Sinyal kapsamı</span><strong>{formatPercent(loopQuality.signalCoverage)}</strong></div>
            <div><span>Güven skoru</span><strong>{formatPercent(loopQuality.rankingConfidenceScore)}</strong></div>
          </div>
        </Panel>
      </div>

      <Panel title="Öne çıkan ülkeler" subtitle="Kullanıcı profil konumlarına göre ilk 10 ülke">
        {countryBreakdown.length ? (
          <div className="overview-country-grid">
            {countryBreakdown.slice(0, 10).map((item, index) => <div key={`${item._id}-${index}`}><span>{index + 1}</span><strong>{item._id || 'Belirsiz'}</strong><b>{formatNumber(item.count)}</b></div>)}
          </div>
        ) : <EmptyState>Ülke dağılımı için henüz yeterli profil verisi yok.</EmptyState>}
      </Panel>
    </div>
  )
}

export default AdminOverviewPage
