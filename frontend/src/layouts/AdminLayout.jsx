import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import Seo from '../components/seo/Seo.jsx'
import {
  getAdminContentSummary,
  getAdminOverview,
  getAdminUsersSummary,
} from '../services/adminService.js'
import { useAuth } from '../store/AuthContext.jsx'
import { getAvatarLabel, getFullName } from '../utils/social.js'
import '../styles/admin.css'

const SIDEBAR_STORAGE_KEY = 'nest_admin_sidebar_collapsed_v3'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR').format(Number(value || 0))
}

function formatPercent(value) {
  return `%${Number(value || 0).toFixed(1)}`
}

function formatChange(value) {
  const number = Number(value || 0)
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}%`
}

const navigation = [
  { path: '', label: 'Genel Bakış', short: 'GB' },
  { path: '/users', label: 'Kullanıcılar', short: 'KU' },
  { path: '/content', label: 'İçerikler', short: 'İÇ' },
  { path: '/comments', label: 'Yorumlar', short: 'YO' },
  { path: '/reports', label: 'Raporlar', short: 'RA' },
  { path: '/audit-logs', label: 'İşlem Kayıtları', short: 'İK' },
]

const settingsNavigation = [
  { path: '/settings/notifications', label: 'Bildirim E-postaları' },
  { path: '/settings/contracts', label: 'Üyelik Sözleşmeleri' },
]

function getPageMeta(pathname, lang) {
  const base = `/${lang}/admin`
  if (pathname === base) {
    return {
      title: 'Genel Bakış',
      eyebrow: 'Operasyon Merkezi',
      description: 'Platform sağlığını, büyümeyi ve moderasyon yükünü tek ekrandan izleyin.',
    }
  }
  if (pathname.includes(`${base}/users/`)) {
    return {
      title: 'Kullanıcı Detayı',
      eyebrow: 'Kullanıcı Operasyonları',
      description: 'Hesap, aktivite, içerik ve güvenlik kayıtlarını birlikte değerlendirin.',
    }
  }
  if (pathname.includes(`${base}/users`)) {
    return {
      title: 'Kullanıcılar',
      eyebrow: 'Kullanıcı Operasyonları',
      description: 'Üyeleri filtreleyin, durumlarını yönetin ve büyüme sinyallerini takip edin.',
    }
  }
  if (pathname.includes(`${base}/content`)) {
    return {
      title: 'İçerikler',
      eyebrow: 'İçerik Operasyonları',
      description: 'Gönderi, loop ve hikâyeleri performans ve moderasyon durumuyla yönetin.',
    }
  }
  if (pathname.includes(`${base}/comments`)) {
    return {
      title: 'Yorumlar',
      eyebrow: 'Topluluk Sağlığı',
      description: 'Yorum akışını inceleyin ve gerekli moderasyon kararlarını uygulayın.',
    }
  }
  if (pathname.includes(`${base}/reports`)) {
    return {
      title: 'Raporlar',
      eyebrow: 'Moderasyon Kuyruğu',
      description: 'Açık vakaları önceliklendirin, inceleyin ve sonuçlandırın.',
    }
  }
  if (pathname.includes(`${base}/audit-logs`)) {
    return {
      title: 'İşlem Kayıtları',
      eyebrow: 'Denetim İzi',
      description: 'Yönetici eylemlerini ve kritik sistem değişikliklerini takip edin.',
    }
  }
  if (pathname.includes(`${base}/settings/notifications`)) {
    return {
      title: 'Bildirim E-postaları',
      eyebrow: 'Sistem Ayarları',
      description: 'Yeni üyelik bildirimlerinin gönderileceği adresleri yönetin.',
    }
  }
  return {
    title: 'Üyelik Sözleşmeleri',
    eyebrow: 'Sistem Ayarları',
    description: 'Kayıt akışındaki sözleşme metinlerini dil bazında güncelleyin.',
  }
}

function Sidebar({ base, collapsed, mobile, onCollapse, onClose, isSettingsOpen, onSettingsToggle }) {
  return (
    <aside className={cx('admin-sidebar', collapsed && !mobile ? 'is-collapsed' : '', mobile ? 'is-mobile' : '')}>
      <div className="admin-brand-row">
        <Link to={base} className="admin-brand" onClick={onClose} aria-label="Nest yönetim ana sayfası">
          <span className="admin-brand-mark">N</span>
          {collapsed && !mobile ? null : (
            <span className="admin-brand-copy">
              <strong>Nest</strong>
              <small>Yönetim Merkezi</small>
            </span>
          )}
        </Link>
        {mobile ? (
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Menüyü kapat">×</button>
        ) : null}
      </div>

      <nav className="admin-navigation" aria-label="Yönetim menüsü">
        <p className="admin-nav-label">{collapsed && !mobile ? 'MENÜ' : 'YÖNETİM'}</p>
        {navigation.map((item) => (
          <NavLink
            key={item.path || 'overview'}
            to={`${base}${item.path}`}
            end={!item.path}
            onClick={onClose}
            title={collapsed && !mobile ? item.label : undefined}
            className={({ isActive }) => cx('admin-nav-link', isActive ? 'is-active' : '')}
          >
            <span className="admin-nav-icon">{item.short}</span>
            {collapsed && !mobile ? null : <span>{item.label}</span>}
          </NavLink>
        ))}

        <button
          type="button"
          className={cx('admin-nav-link admin-settings-toggle', isSettingsOpen ? 'is-open' : '')}
          onClick={onSettingsToggle}
          title={collapsed && !mobile ? 'Ayarlar' : undefined}
        >
          <span className="admin-nav-icon">AY</span>
          {collapsed && !mobile ? null : <><span>Ayarlar</span><span className="admin-nav-chevron">⌄</span></>}
        </button>
        {isSettingsOpen && (!collapsed || mobile) ? (
          <div className="admin-subnav">
            {settingsNavigation.map((item) => (
              <NavLink
                key={item.path}
                to={`${base}${item.path}`}
                onClick={onClose}
                className={({ isActive }) => cx('admin-subnav-link', isActive ? 'is-active' : '')}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ) : null}
      </nav>

      <div className="admin-sidebar-footer">
        {collapsed && !mobile ? null : (
          <div className="admin-security-note">
            <span className="admin-status-dot" />
            <div><strong>Güvenli oturum</strong><small>Yönetici erişimi etkin</small></div>
          </div>
        )}
        {!mobile ? (
          <button type="button" className="admin-collapse-button" onClick={onCollapse}>
            <span>{collapsed ? '→' : '←'}</span>
            {collapsed ? null : 'Menüyü daralt'}
          </button>
        ) : null}
      </div>
    </aside>
  )
}

function SummaryCard({ label, value, helper, trend }) {
  const trendValue = Number(trend || 0)
  return (
    <article className="admin-summary-card">
      <div className="admin-summary-card-top">
        <span>{label}</span>
        {trend !== undefined && trend !== null ? (
          <span className={cx('admin-trend', trendValue > 0 ? 'is-up' : trendValue < 0 ? 'is-down' : '')}>
            {formatChange(trendValue)}
          </span>
        ) : null}
      </div>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  )
}

function AdminLayout() {
  const { lang = 'tr' } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const base = `/${lang}/admin`
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(location.pathname.includes('/settings/'))
  const [overview, setOverview] = useState(null)
  const [range, setRange] = useState('7d')
  const [customOpen, setCustomOpen] = useState(false)
  const [customDates, setCustomDates] = useState({ dateFrom: '', dateTo: '' })
  const [summary, setSummary] = useState({ loading: false, error: '', data: null })

  const pageMeta = useMemo(() => getPageMeta(location.pathname, lang), [location.pathname, lang])
  const isUsersRoute = location.pathname === `${base}/users`
  const isContentRoute = location.pathname === `${base}/content`
  const supportsRange = isUsersRoute || isContentRoute

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true')
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
    setNotificationsOpen(false)
    setCustomOpen(false)
    if (location.pathname.includes('/settings/')) setSettingsOpen(true)
  }, [location.pathname])

  useEffect(() => {
    let cancelled = false
    getAdminOverview()
      .then((payload) => { if (!cancelled) setOverview(payload) })
      .catch(() => { if (!cancelled) setOverview(null) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!supportsRange) {
      setSummary({ loading: false, error: '', data: null })
      return undefined
    }
    if (range === 'custom' && (!customDates.dateFrom || !customDates.dateTo)) return undefined
    let cancelled = false
    setSummary((current) => ({ ...current, loading: true, error: '' }))
    const request = isUsersRoute ? getAdminUsersSummary : getAdminContentSummary
    request({
      period: range,
      dateFrom: range === 'custom' ? customDates.dateFrom : '',
      dateTo: range === 'custom' ? customDates.dateTo : '',
    })
      .then((data) => { if (!cancelled) setSummary({ loading: false, error: '', data }) })
      .catch((error) => { if (!cancelled) setSummary({ loading: false, error: error.message || 'Özet verileri yüklenemedi.', data: null }) })
    return () => { cancelled = true }
  }, [customDates.dateFrom, customDates.dateTo, isUsersRoute, range, supportsRange])

  const summaryCards = useMemo(() => {
    const metrics = summary.data?.metrics
    if (isUsersRoute) {
      return [
        { label: 'Toplam kullanıcı', value: formatNumber(metrics?.totalUsers), helper: 'Kayıtlı hesap' },
        { label: 'Yeni üyeler', value: formatNumber(metrics?.userGrowth?.newUsers), helper: 'Seçilen dönem', trend: metrics?.userGrowth?.changePct },
        { label: 'Aktif kullanıcı', value: formatNumber(metrics?.activeUsers?.count), helper: 'Seçilen dönem', trend: metrics?.activeUsers?.changePct },
        { label: 'Dönüşüm oranı', value: formatPercent(metrics?.conversion?.rate), helper: `${formatNumber(metrics?.conversion?.loggedInUsers)} giriş yapan` },
      ]
    }
    if (isContentRoute) {
      return [
        { label: 'Toplam içerik', value: formatNumber(metrics?.totalContent?.total), helper: `${formatNumber(metrics?.totalContent?.loops)} loop · ${formatNumber(metrics?.totalContent?.posts)} gönderi` },
        { label: 'Yeni paylaşımlar', value: formatNumber(metrics?.activity?.total), helper: 'Seçilen dönem', trend: metrics?.activity?.changePct },
        { label: 'Trend gönderiler', value: formatNumber(metrics?.postEngagement?.trendCount), helper: 'Yüksek etkileşim', trend: metrics?.postEngagement?.trendChangePct },
        { label: 'İnceleme bekleyen', value: formatNumber(metrics?.pendingReview?.count), helper: 'Açık moderasyon kuyruğu', trend: metrics?.pendingReview?.changePct },
      ]
    }
    return []
  }, [isContentRoute, isUsersRoute, summary.data])

  const reportCount = Number(overview?.moderationSummary?.openReports || 0) + Number(overview?.moderationSummary?.inReviewReports || 0)
  const alertItems = [
    { label: 'Açık raporlar', value: reportCount, to: `${base}/reports`, tone: reportCount > 0 ? 'warning' : 'success' },
    { label: 'Askıdaki hesaplar', value: Number(overview?.moderationSummary?.suspendedUsers || 0), to: `${base}/users`, tone: 'neutral' },
    { label: 'Gizlenen içerikler', value: Number(overview?.moderationSummary?.hiddenPosts || 0) + Number(overview?.moderationSummary?.hiddenComments || 0), to: `${base}/content`, tone: 'neutral' },
  ]

  function selectRange(nextRange) {
    if (nextRange === 'custom') {
      setCustomOpen((current) => !current)
      return
    }
    setRange(nextRange)
    setCustomOpen(false)
  }

  return (
    <>
      <Seo title={`Nest Yönetim · ${pageMeta.title}`} description={pageMeta.description} />
      <div className="admin-shell">
        <Sidebar
          base={base}
          collapsed={collapsed}
          onCollapse={() => setCollapsed((current) => !current)}
          isSettingsOpen={settingsOpen}
          onSettingsToggle={() => {
            if (collapsed) setCollapsed(false)
            setSettingsOpen((current) => !current)
          }}
        />

        {mobileOpen ? (
          <div className="admin-mobile-layer">
            <button type="button" className="admin-mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat" />
            <Sidebar
              base={base}
              mobile
              onClose={() => setMobileOpen(false)}
              isSettingsOpen={settingsOpen}
              onSettingsToggle={() => setSettingsOpen((current) => !current)}
            />
          </div>
        ) : null}

        <div className="admin-workspace">
          <header className="admin-topbar">
            <button type="button" className="admin-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Yönetim menüsünü aç">☰</button>
            <div className="admin-topbar-context">
              <span className="admin-topbar-label">Nest / Yönetim</span>
              <strong>{pageMeta.title}</strong>
            </div>
            <div className="admin-topbar-actions">
              <Link className="admin-view-site" to={`/${lang}`}>Siteyi görüntüle ↗</Link>
              <div className="admin-notification-wrap">
                <button type="button" className="admin-icon-button admin-bell" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Operasyon bildirimleri">
                  <span>!</span>{reportCount > 0 ? <b>{Math.min(reportCount, 99)}</b> : null}
                </button>
                {notificationsOpen ? (
                  <div className="admin-notification-panel">
                    <div className="admin-notification-heading"><strong>Operasyon özeti</strong><span>Canlı veriler</span></div>
                    {alertItems.map((item) => (
                      <Link key={item.label} to={item.to} className="admin-notification-item">
                        <span className={`admin-alert-dot is-${item.tone}`} />
                        <span><strong>{item.label}</strong><small>Detayları görüntüle</small></span>
                        <b>{formatNumber(item.value)}</b>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="admin-profile-chip">
                <span>{getAvatarLabel(user)}</span>
                <div><strong>{getFullName(user)}</strong><small>Yönetici</small></div>
              </div>
            </div>
          </header>

          <main className="admin-main">
            <section className="admin-page-heading">
              <div>
                <span>{pageMeta.eyebrow}</span>
                <h1>{pageMeta.title}</h1>
                <p>{pageMeta.description}</p>
              </div>
              {supportsRange ? (
                <div className="admin-range-wrap">
                  <div className="admin-segmented-control" aria-label="Analiz dönemi">
                    {[['today', 'Bugün'], ['7d', '7 gün'], ['30d', '30 gün'], ['custom', 'Özel']].map(([key, label]) => (
                      <button key={key} type="button" className={range === key ? 'is-active' : ''} onClick={() => selectRange(key)}>{label}</button>
                    ))}
                  </div>
                  {customOpen ? (
                    <div className="admin-date-popover">
                      <label>Başlangıç<input type="date" value={customDates.dateFrom} onChange={(event) => setCustomDates((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
                      <label>Bitiş<input type="date" value={customDates.dateTo} onChange={(event) => setCustomDates((current) => ({ ...current, dateTo: event.target.value }))} /></label>
                      <button type="button" disabled={!customDates.dateFrom || !customDates.dateTo} onClick={() => { setRange('custom'); setCustomOpen(false) }}>Uygula</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            {supportsRange ? (
              <section className="admin-summary-grid" aria-busy={summary.loading}>
                {summaryCards.map((card) => <SummaryCard key={card.label} {...card} />)}
                {summary.loading && !summaryCards.length ? Array.from({ length: 4 }, (_, index) => <div key={index} className="admin-summary-skeleton" />) : null}
              </section>
            ) : null}
            {summary.error ? <div className="admin-inline-error">{summary.error}</div> : null}

            <div className="admin-page-content"><Outlet /></div>
          </main>
        </div>
      </div>
    </>
  )
}

export default AdminLayout
