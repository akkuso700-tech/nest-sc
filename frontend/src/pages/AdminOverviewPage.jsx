import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AdminAreaChart from '../components/admin/AdminAreaChart.jsx'
import AdminKpiCard from '../components/admin/AdminKpiCard.jsx'
import AdminPendingReportsTable from '../components/admin/AdminPendingReportsTable.jsx'
import AdminRecentUsersTable from '../components/admin/AdminRecentUsersTable.jsx'
import AdminSystemPulse from '../components/admin/AdminSystemPulse.jsx'
import {
  getAdminOverview,
  getAdminPerformanceSummary,
  getAdminReports,
  getAdminUsers,
} from '../services/adminService.js'

function formatNumber(value, compact = false) {
  return new Intl.NumberFormat('tr-TR', compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(
    Number(value || 0),
  )
}

function formatPercent(value, digits = 1) {
  return `%${Number(value || 0).toFixed(digits)}`
}

export default function AdminOverviewPage() {
  const { lang = 'tr' } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastSyncTime, setLastSyncTime] = useState('')
  const [algoTab, setAlgoTab] = useState('loops') // 'loops' | 'recommendations'
  const [dateFilter, setDateFilter] = useState({
    period: '28d',
    dateFrom: '',
    dateTo: '',
  })

  const fetchData = useCallback(async (isManual = false, filterToUse = dateFilter) => {
    if (isManual) setIsRefreshing(true)
    try {
      const [overview, performance, usersRes, reportsRes] = await Promise.all([
        getAdminOverview({
          period: filterToUse.period,
          dateFrom: filterToUse.dateFrom,
          dateTo: filterToUse.dateTo,
        }),
        getAdminPerformanceSummary({ days: 7 }).catch(() => ({ totalSamples: 0, metrics: [], routes: [] })),
        getAdminUsers({ limit: 6, sortBy: 'createdAt', sortDirection: 'desc' }).catch(() => ({ users: [] })),
        getAdminReports({ limit: 5, status: 'open' }).catch(() => ({ reports: [] })),
      ])

      setData({
        ...overview,
        performance,
        recentUsers: usersRes?.users || [],
        pendingReports: reportsRes?.reports || [],
      })
      setLastSyncTime(
        new Intl.DateTimeFormat('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()),
      )
      setError('')
    } catch (err) {
      setError(err.message || 'Yönetim analizleri yüklenemedi.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [dateFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDateFilterChange = (nextFilter) => {
    setDateFilter(nextFilter)
    fetchData(true, nextFilter)
  }

  const derived = useMemo(() => {
    if (!data) return null
    const totalUsers = Number(data.metrics?.totalUsers || 0)
    const weeklyActive = Number(data.metrics?.weeklyActiveUsers || 0)
    const monthlyActive = Number(data.metrics?.activeUsers || 0)
    const openReports =
      Number(data.moderationSummary?.openReports || 0) +
      Number(data.moderationSummary?.inReviewReports || 0)
    const totalInteractions = ['likes', 'comments', 'shares', 'saves'].reduce(
      (total, key) => total + Number(data.contentEngagement?.[key] || 0),
      0,
    )
    const registrations = data.latestRegistrations || []
    const newRegistrations = registrations.reduce((total, item) => total + Number(item.count || 0), 0)

    // Period specific metrics from backend dateFilter
    const periodNewUsers = data.dateFilter?.newUsers?.current ?? newRegistrations
    const newUsersTrend = data.dateFilter?.newUsers?.changePct
    const periodActiveUsers = data.dateFilter?.activeUsers?.current ?? weeklyActive
    const activeUsersTrend = data.dateFilter?.activeUsers?.changePct
    const periodPosts = data.dateFilter?.posts?.current ?? 0
    const postsTrend = data.dateFilter?.posts?.changePct

    // Sparklines
    const regCounts = registrations.map((r) => Number(r.count || 0))
    const recentSparkline = regCounts.length >= 4 ? regCounts.slice(-14) : [2, 4, 6, 8, 5, 9, 12]

    return {
      totalUsers,
      weeklyActive,
      monthlyActive,
      openReports,
      totalInteractions,
      newRegistrations,
      periodNewUsers,
      newUsersTrend,
      periodActiveUsers,
      activeUsersTrend,
      periodPosts,
      postsTrend,
      activationRate: totalUsers ? (weeklyActive / totalUsers) * 100 : 0,
      monthlyRate: totalUsers ? (monthlyActive / totalUsers) * 100 : 0,
      locationConsentRate: totalUsers
        ? (Number(data.moderationSummary?.usersWithLocationConsent || 0) / totalUsers) * 100
        : 0,
      recentSparkline,
    }
  }, [data])

  if (loading) {
    return (
      <div className="admin-overview-loading" aria-busy="true">
        <div className="admin-loading-pulse-bar" />
        <div className="admin-loading-kpi-grid">
          {Array.from({ length: 4 }, (_, idx) => (
            <div key={idx} className="admin-loading-skeleton-card" />
          ))}
        </div>
        <div className="admin-loading-chart-skeleton" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-overview-error-banner">
        <div className="admin-error-icon">⚠️</div>
        <div className="admin-error-copy">
          <strong>Veriler Yüklenemedi</strong>
          <p>{error}</p>
        </div>
        <button type="button" onClick={() => fetchData(true)} className="admin-retry-btn">
          Tekrar Dene
        </button>
      </div>
    )
  }

  const {
    metrics,
    moderationSummary,
    roleBreakdown = [],
    countryBreakdown = [],
    latestRegistrations = [],
    contentEngagement = {},
    loopQuality = {},
    recommendationQuality = {},
    performance = {},
    recentUsers = [],
    pendingReports = [],
    dateFilter: dateRangeMeta = null,
  } = data

  const vitalMap = new Map((performance.metrics || []).map((metric) => [metric.name, metric]))
  const rolesTotal = Math.max(
    roleBreakdown.reduce((total, item) => total + Number(item.count || 0), 0),
    1,
  )

  const roleColors = {
    admin: '#3b82f6',
    moderator: '#8b5cf6',
    user: '#10b981',
  }

  const periodLabel = dateRangeMeta?.label || 'Son 28 Gün'

  return (
    <div className="admin-overview-v2">
      {/* 1. Canlı Komuta, Sistem Nabız Çubuğu ve Tarih Aralığı Filtresi */}
      <AdminSystemPulse
        lastSyncTime={lastSyncTime}
        isRefreshing={isRefreshing}
        onRefresh={() => fetchData(true)}
        openReportsCount={derived.openReports}
        lang={lang}
        dateFilter={dateFilter}
        dateRangeMeta={dateRangeMeta}
        onDateFilterChange={handleDateFilterChange}
      />

      {/* 2. Ana Yönetici KPI Matrisi */}
      <section className="admin-kpi-grid-v2" aria-label="Ana Yönetim Göstergeleri">
        <AdminKpiCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
          label="Toplam Kullanıcı"
          value={formatNumber(derived.totalUsers)}
          helper={`${periodLabel}: +${formatNumber(derived.periodNewUsers)} yeni üye`}
          tone="blue"
          trend={derived.newUsersTrend}
          sparklineData={derived.recentSparkline}
        />

        <AdminKpiCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
          label="Aktif Kullanıcılar"
          value={formatNumber(derived.periodActiveUsers)}
          helper={`${periodLabel} giriş yapan tekil hesaplar`}
          tone="green"
          trend={derived.activeUsersTrend}
          progress={derived.activationRate}
          sparklineData={[derived.periodActiveUsers * 0.85, derived.periodActiveUsers * 0.9, derived.periodActiveUsers * 0.95, derived.periodActiveUsers]}
        />

        <AdminKpiCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
            </svg>
          }
          label="Toplam İçerik & Loop"
          value={formatNumber(metrics.totalPosts)}
          helper={`${periodLabel}: +${formatNumber(derived.periodPosts)} yeni paylaşım`}
          tone="purple"
          trend={derived.postsTrend}
          sparklineData={[metrics.totalPosts * 0.92, metrics.totalPosts * 0.95, metrics.totalPosts * 0.98, metrics.totalPosts]}
        />

        <AdminKpiCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          }
          label="Operasyonel Moderasyon"
          value={formatNumber(derived.openReports)}
          helper={`${formatNumber(moderationSummary.suspendedUsers)} askıya alınmış hesap`}
          tone={derived.openReports > 0 ? 'orange' : 'green'}
          statusBadge={{
            label: derived.openReports > 0 ? 'İnceleme Bekliyor' : 'Kuyruk Temiz',
            tone: derived.openReports > 0 ? 'danger' : 'success',
          }}
        />
      </section>

      {/* 3. Etkileşimli Büyüme Grafiği ve Kullanıcı Sağlığı */}
      <div className="admin-growth-section-grid">
        <div className="admin-chart-primary-panel">
          <AdminAreaChart data={latestRegistrations} />
        </div>

        <div className="admin-card admin-health-panel">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Kullanıcı Sağlığı & İzinler</h3>
              <p className="admin-card-subtitle">Platform bağlılığı ve izin kapsam oranları</p>
            </div>
            <span className="admin-health-badge">Canlı</span>
          </div>

          <div className="admin-health-metrics-list">
            <div className="admin-health-metric-item">
              <div className="admin-health-metric-top">
                <span className="admin-health-metric-title">30 Günlük Aktiflik (MAU)</span>
                <strong>{formatPercent(derived.monthlyRate)}</strong>
              </div>
              <div className="admin-metric-track">
                <i style={{ width: `${Math.min(derived.monthlyRate, 100)}%` }} className="is-blue" />
              </div>
              <span className="admin-health-metric-caption">
                {formatNumber(derived.monthlyActive)} / {formatNumber(derived.totalUsers)} kayıtlı üye
              </span>
            </div>

            <div className="admin-health-metric-item">
              <div className="admin-health-metric-top">
                <span className="admin-health-metric-title">7 Günlük Aktivasyon (WAU)</span>
                <strong>{formatPercent(derived.activationRate)}</strong>
              </div>
              <div className="admin-metric-track">
                <i style={{ width: `${Math.min(derived.activationRate, 100)}%` }} className="is-green" />
              </div>
              <span className="admin-health-metric-caption">
                {formatNumber(derived.weeklyActive)} üye bu hafta aktifti
              </span>
            </div>

            <div className="admin-health-metric-item">
              <div className="admin-health-metric-top">
                <span className="admin-health-metric-title">Konum İzni Kapsamı</span>
                <strong>{formatPercent(derived.locationConsentRate)}</strong>
              </div>
              <div className="admin-metric-track">
                <i style={{ width: `${Math.min(derived.locationConsentRate, 100)}%` }} className="is-purple" />
              </div>
              <span className="admin-health-metric-caption">
                {formatNumber(moderationSummary.usersWithLocationConsent)} üye konum izni verdi
              </span>
            </div>
          </div>

          <div className="admin-health-footer">
            <Link to={`/${lang}/admin/users`} className="admin-footer-link">
              Kullanıcı operasyonlarına git →
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Canlı Operasyon Tabloları (Son Kayıt Olanlar & Acil Moderasyon Kuyruğu) */}
      <div className="admin-tables-dual-grid">
        <AdminRecentUsersTable users={recentUsers} loading={false} lang={lang} />
        <AdminPendingReportsTable reports={pendingReports} loading={false} lang={lang} />
      </div>

      {/* 5. Dağılım & Etkileşim Paneli */}
      <div className="admin-distribution-grid">
        {/* Etkileşim Dağılımı */}
        <div className="admin-card admin-panel-box">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Etkileşim Hacmi</h3>
              <p className="admin-card-subtitle">Platform genelindeki kullanıcı reaksiyonları</p>
            </div>
          </div>
          <div className="admin-engagement-bars">
            {[
              { label: 'Beğeni', count: contentEngagement.likes, color: '#3b82f6', icon: '❤️' },
              { label: 'Yorum', count: contentEngagement.comments, color: '#8b5cf6', icon: '💬' },
              { label: 'Paylaşım', count: contentEngagement.shares, color: '#06b6d4', icon: '↗️' },
              { label: 'Kaydetme', count: contentEngagement.saves, color: '#10b981', icon: '🔖' },
            ].map((item) => {
              const pct = derived.totalInteractions ? (Number(item.count || 0) / derived.totalInteractions) * 100 : 0
              return (
                <div key={item.label} className="admin-engagement-row">
                  <div className="admin-engagement-row-info">
                    <span className="admin-engagement-label">
                      <span className="admin-engagement-icon">{item.icon}</span>
                      {item.label}
                    </span>
                    <div className="admin-engagement-values">
                      <strong>{formatNumber(item.count)}</strong>
                      <small>({formatPercent(pct)})</small>
                    </div>
                  </div>
                  <div className="admin-metric-track">
                    <i style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Kullanıcı Rolleri Dağılımı */}
        <div className="admin-card admin-panel-box">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Kullanıcı Rolleri</h3>
              <p className="admin-card-subtitle">Hesap yetki seviyesi dağılımı</p>
            </div>
            <span className="admin-header-counter">{formatNumber(derived.totalUsers)} Hesap</span>
          </div>

          <div className="admin-role-breakdown-wrap">
            <div className="admin-role-stacked-bar">
              {roleBreakdown.map((item) => {
                const pct = (Number(item.count || 0) / rolesTotal) * 100
                const color = roleColors[item._id] || '#64748b'
                return (
                  <div
                    key={item._id}
                    style={{ width: `${pct}%`, backgroundColor: color }}
                    title={`${item._id}: ${item.count} (%${pct.toFixed(1)})`}
                    className="admin-role-segment"
                  />
                )
              })}
            </div>

            <div className="admin-role-legend-grid">
              {roleBreakdown.map((item) => {
                const count = Number(item.count || 0)
                const pct = (count / rolesTotal) * 100
                const color = roleColors[item._id] || '#64748b'
                const roleLabels = { admin: 'Yönetici', moderator: 'Moderatör', user: 'Standart Üye' }
                return (
                  <div key={item._id} className="admin-role-legend-card">
                    <div className="admin-role-legend-left">
                      <span className="admin-role-indicator-dot" style={{ backgroundColor: color }} />
                      <strong className="admin-role-legend-name">{roleLabels[item._id] || item._id}</strong>
                    </div>
                    <div className="admin-role-legend-right">
                      <span className="admin-role-legend-count">{formatNumber(count)}</span>
                      <small className="admin-role-legend-pct">%{pct.toFixed(1)}</small>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Moderasyon Durumu */}
        <div className="admin-card admin-panel-box">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Moderasyon Bilançosu</h3>
              <p className="admin-card-subtitle">Müdahale edilen içerik ve yorumlar</p>
            </div>
            <Link to={`/${lang}/admin/reports`} className="admin-card-link-btn">
              Kuyruğa Git →
            </Link>
          </div>

          <div className="admin-moderation-summary-grid">
            <div className="admin-moderation-stat-tile is-warning">
              <span className="admin-mod-tile-label">Gizlenen Gönderi</span>
              <strong>{formatNumber(moderationSummary.hiddenPosts)}</strong>
              <small>Görünürlük kısıtlı</small>
            </div>

            <div className="admin-moderation-stat-tile is-danger">
              <span className="admin-mod-tile-label">Kaldırılan Gönderi</span>
              <strong>{formatNumber(moderationSummary.removedPosts)}</strong>
              <small>Kalıcı silindi</small>
            </div>

            <div className="admin-moderation-stat-tile is-warning">
              <span className="admin-mod-tile-label">Gizlenen Yorum</span>
              <strong>{formatNumber(moderationSummary.hiddenComments)}</strong>
              <small>Yorum gizlendi</small>
            </div>

            <div className="admin-moderation-stat-tile is-danger">
              <span className="admin-mod-tile-label">Kaldırılan Yorum</span>
              <strong>{formatNumber(moderationSummary.removedComments)}</strong>
              <small>İhlal tespiti</small>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Algoritma & Video Keşif Laboratuvarı */}
      <div className="admin-card admin-algo-card">
        <div className="admin-card-header">
          <div className="admin-algo-header-left">
            <div>
              <h3 className="admin-card-title">Algoritma & Video Keşif Zekâsı</h3>
              <p className="admin-card-subtitle">
                Loop video tamamlama sinyalleri ve öneri motoru A/B deney performansı
              </p>
            </div>
          </div>

          <div className="admin-segmented-tabs">
            <button
              type="button"
              className={algoTab === 'loops' ? 'is-active' : ''}
              onClick={() => setAlgoTab('loops')}
            >
              Loop Kalitesi ({formatNumber(loopQuality.totalLoops)} Video)
            </button>
            <button
              type="button"
              className={algoTab === 'recommendations' ? 'is-active' : ''}
              onClick={() => setAlgoTab('recommendations')}
            >
              Öneri Motoru ({formatNumber(recommendationQuality.impressions)} Gösterim)
            </button>
          </div>
        </div>

        {algoTab === 'loops' ? (
          <div className="admin-loop-intelligence-grid">
            <div className="admin-algo-kpi-tile">
              <span className="admin-algo-kpi-label">Tamamlama Oranı</span>
              <strong className="admin-algo-kpi-val">{formatPercent(loopQuality.completionRate)}</strong>
              <div className="admin-metric-track">
                <i style={{ width: `${Math.min(loopQuality.completionRate || 0, 100)}%` }} className="is-blue" />
              </div>
              <small>Videonun sonuna kadar izlenme sıklığı</small>
            </div>

            <div className="admin-algo-kpi-tile">
              <span className="admin-algo-kpi-label">Ortalama İzleme Oranı</span>
              <strong className="admin-algo-kpi-val">{formatPercent(Number(loopQuality.avgWatchRatio || 0) * 100)}</strong>
              <div className="admin-metric-track">
                <i style={{ width: `${Math.min(Number(loopQuality.avgWatchRatio || 0) * 100, 100)}%` }} className="is-purple" />
              </div>
              <small>Video süresine oranlanan izleme payı</small>
            </div>

            <div className="admin-algo-kpi-tile">
              <span className="admin-algo-kpi-label">Sinyal Kapsamı</span>
              <strong className="admin-algo-kpi-val">{formatPercent(loopQuality.signalCoverage)}</strong>
              <div className="admin-metric-track">
                <i style={{ width: `${Math.min(loopQuality.signalCoverage || 0, 100)}%` }} className="is-green" />
              </div>
              <small>İzlenme başına toplanan telemetri</small>
            </div>

            <div className="admin-algo-kpi-tile">
              <span className="admin-algo-kpi-label">Sıralama Güven Skoru</span>
              <strong className="admin-algo-kpi-val">{formatPercent(loopQuality.rankingConfidenceScore)}</strong>
              <div className="admin-metric-track">
                <i style={{ width: `${Math.min(loopQuality.rankingConfidenceScore || 0, 100)}%` }} className="is-orange" />
              </div>
              <small>Modelin loop kalitesine güven endeksi</small>
            </div>
          </div>
        ) : (
          <div className="admin-recommendations-panel">
            <div className="admin-rec-rates-grid">
              <div className="admin-rec-rate-chip">
                <span>Hızlı Geçiş (Skip)</span>
                <strong className="text-rose-600">{formatPercent(recommendationQuality.quickSkipRate)}</strong>
              </div>
              <div className="admin-rec-rate-chip">
                <span>Uzun İzleme</span>
                <strong className="text-emerald-600">{formatPercent(recommendationQuality.longViewRate)}</strong>
              </div>
              <div className="admin-rec-rate-chip">
                <span>Kaydetme</span>
                <strong className="text-sky-600">{formatPercent(recommendationQuality.saveRate)}</strong>
              </div>
              <div className="admin-rec-rate-chip">
                <span>Paylaşım</span>
                <strong className="text-purple-600">{formatPercent(recommendationQuality.shareRate)}</strong>
              </div>
              <div className="admin-rec-rate-chip">
                <span>Gizleme / İlgisiz</span>
                <strong className="text-amber-600">{formatPercent(recommendationQuality.hideRate)}</strong>
              </div>
            </div>

            {(recommendationQuality.breakdown || []).length > 0 ? (
              <div className="admin-table-container mt-4">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Algoritma Modeli / Deney</th>
                      <th>Gösterim</th>
                      <th>Hızlı Geçiş</th>
                      <th>Uzun İzleme</th>
                      <th>Kaydetme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendationQuality.breakdown.slice(0, 6).map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.algorithm}</strong>
                          <div className="text-xs text-slate-400">
                            {item.experimentId || 'deney yok'} · {item.variant || 'atanmamış'}
                          </div>
                        </td>
                        <td>{formatNumber(item.impressions)}</td>
                        <td>
                          <span className={item.quickSkipRate > 40 ? 'text-rose-600 font-semibold' : ''}>
                            {formatPercent(item.quickSkipRate)}
                          </span>
                        </td>
                        <td>
                          <span className={item.longViewRate > 25 ? 'text-emerald-600 font-semibold' : ''}>
                            {formatPercent(item.longViewRate)}
                          </span>
                        </td>
                        <td>{formatPercent(item.saveRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty-state-notice">
                Öneri kalitesi analitiği için henüz yeterli telemetri verisi toplanmadı.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Altyapı Hızı & Coğrafi Dağılım */}
      <div className="admin-infrastructure-grid">
        {/* Core Web Vitals */}
        <div className="admin-card admin-panel-box">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Gerçek Kullanıcı Hız Skorları (Web Vitals)</h3>
              <p className="admin-card-subtitle">
                Son 7 gün · {formatNumber(performance.totalSamples)} anonim tarayıcı ölçümü (p75)
              </p>
            </div>
            <span className="admin-cwv-badge">Google Standartları</span>
          </div>

          <div className="admin-vitals-matrix">
            {['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].map((name) => {
              const metric = vitalMap.get(name)
              const value =
                metric?.p75 === null || metric?.p75 === undefined
                  ? '—'
                  : name === 'CLS'
                    ? Number(metric.p75).toFixed(3)
                    : `${metric.p75} ms`
              const rating = metric?.rating || 'waiting'
              const labels = {
                good: 'İyi',
                'needs-improvement': 'Geliştirilmeli',
                poor: 'Zayıf',
                waiting: 'Veri Bekleniyor',
              }

              return (
                <div key={name} className={`admin-vital-tile is-${rating}`}>
                  <div className="admin-vital-header">
                    <span className="admin-vital-name">{name}</span>
                    <span className={`admin-vital-pill is-${rating}`}>{labels[rating] || labels.waiting}</span>
                  </div>
                  <strong className="admin-vital-val">{value}</strong>
                  <small className="admin-vital-desc">
                    {name === 'LCP' && 'En Büyük İçerikli Boyama'}
                    {name === 'INP' && 'Sonraki Boyamayla Etkileşim'}
                    {name === 'CLS' && 'Kümülatif Düzen Kayması'}
                    {name === 'FCP' && 'İlk İçerikli Boyama'}
                    {name === 'TTFB' && 'İlk Bayta Ulaşma Süresi'}
                  </small>
                </div>
              )
            })}
          </div>
        </div>

        {/* Coğrafi Dağılım */}
        <div className="admin-card admin-panel-box">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Öne Çıkan Ülkeler</h3>
              <p className="admin-card-subtitle">Kullanıcı profil konumlarına göre dağılım</p>
            </div>
          </div>

          {countryBreakdown.length > 0 ? (
            <div className="admin-country-list">
              {countryBreakdown.slice(0, 6).map((item, idx) => {
                const totalCountryUsers = countryBreakdown.reduce((acc, c) => acc + Number(c.count || 0), 0) || 1
                const pct = (Number(item.count || 0) / totalCountryUsers) * 100
                return (
                  <div key={item._id || idx} className="admin-country-row">
                    <div className="admin-country-left">
                      <span className="admin-country-rank">{idx + 1}</span>
                      <strong className="admin-country-name">{item._id || 'Belirtilmemiş'}</strong>
                    </div>
                    <div className="admin-country-right">
                      <div className="admin-metric-track admin-country-bar">
                        <i style={{ width: `${Math.min(pct, 100)}%` }} className="is-blue" />
                      </div>
                      <span className="admin-country-count">{formatNumber(item.count)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="admin-empty-state-notice">
              Henüz konum bildiren kullanıcı profili verisi toplanmadı.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
