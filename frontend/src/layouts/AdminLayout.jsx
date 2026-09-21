import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import Seo from '../components/seo/Seo.jsx'
import {
  getAdminContentSummary,
  getAdminNotificationFeed,
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

function formatTimeAgo(dateString) {
  if (!dateString) return ''
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000))
  if (diffSeconds < 60) return 'Az önce'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} dk önce`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} sa önce`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} gün önce`
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
  { path: '/verification-requests', label: 'Doğrulama Talepleri', short: 'DT' },
  { path: '/creators', label: 'İçerik Üreticileri', short: 'ÜS' },
  { path: '/content', label: 'İçerikler', short: 'İÇ' },
  { path: '/comments', label: 'Yorumlar', short: 'YO' },
  { path: '/reports', label: 'Raporlar', short: 'RA' },
  { path: '/messages', label: 'Mesajlar', short: 'MS' },
  { path: '/shadow', label: 'Gölge Modu', short: 'GM' },
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
      hideHeading: true,
    }
  }
  if (pathname.includes(`${base}/users/`)) {
    return {
      title: 'Kullanıcı Detayı',
      eyebrow: 'Kullanıcı Operasyonları',
      description: 'Hesap, aktivite, içerik ve güvenlik kayıtlarını birlikte değerlendirin.',
      hideHeading: true,
    }
  }
  if (pathname.includes(`${base}/users`)) {
    return {
      title: 'Kullanıcılar',
      eyebrow: 'Kullanıcı Operasyonları',
      description: 'Üyeleri filtreleyin, durumlarını yönetin ve büyüme sinyallerini takip edin.',
    }
  }
  if (pathname.includes(`${base}/verification-requests`)) {
    return {
      title: 'Doğrulama Talepleri',
      eyebrow: 'Profil Doğrulama',
      description: 'Profil doğrulama ve rozet başvurularını inceleyin ve sonuçlandırın.',
    }
  }
  if (pathname.includes(`${base}/creators`)) {
    return {
      title: 'İçerik Üreticileri & Ödemeler',
      eyebrow: 'Monetizasyon & Finans',
      description: 'Üretici başvurularını onaylayın, IBAN para çekme taleplerini yönetin ve cüzdan durumlarını kontrol edin.',
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
  if (pathname.includes(`${base}/messages`)) {
    return {
      title: 'Mesajlar',
      eyebrow: '',
      description: '',
      hideHeading: true,
    }
  }
  if (pathname.includes(`${base}/shadow`)) {
    return {
      title: 'Gölge Modu',
      eyebrow: '',
      description: '',
      hideHeading: true,
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
  const { user, logout } = useAuth()
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

  const notificationWrapRef = useRef(null)
  const [notificationTab, setNotificationTab] = useState('actions')
  const [notificationData, setNotificationData] = useState({
    loading: false,
    summary: null,
    feed: [],
  })

  const profileWrapRef = useRef(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const navigate = useNavigate()

  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true)
      await logout()
      navigate(`/${lang}/login`, { replace: true })
    } catch {
      window.location.href = `/${lang}/login`
    } finally {
      setIsLoggingOut(false)
    }
  }, [lang, logout, navigate])

  const fetchAdminNotifications = useCallback(() => {
    getAdminNotificationFeed()
      .then((res) => {
        if (res?.data) {
          setNotificationData({
            loading: false,
            summary: res.data.summary,
            feed: res.data.feed || [],
          })
        }
      })
      .catch(() => {
        // silent fallback
      })
  }, [])

  useEffect(() => {
    fetchAdminNotifications()
    const timer = setInterval(fetchAdminNotifications, 45000)
    return () => clearInterval(timer)
  }, [fetchAdminNotifications])

  useEffect(() => {
    if (notificationsOpen) {
      fetchAdminNotifications()
    }
  }, [notificationsOpen, fetchAdminNotifications])

  useEffect(() => {
    if (!notificationsOpen) return undefined
    function handleClickOutside(event) {
      if (notificationWrapRef.current && !notificationWrapRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [notificationsOpen])

  useEffect(() => {
    if (!profileMenuOpen) return undefined
    function handleClickOutside(event) {
      if (profileWrapRef.current && !profileWrapRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
        setLogoutConfirmOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [profileMenuOpen])

  const pageMeta = useMemo(() => getPageMeta(location.pathname, lang), [location.pathname, lang])
  const isUsersRoute = location.pathname === `${base}/users`
  const isContentRoute = location.pathname === `${base}/content`
  const isShadowRoute = location.pathname.includes('/shadow') || location.pathname.includes('/messages')
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
    setProfileMenuOpen(false)
    setLogoutConfirmOpen(false)
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

  const fallbackReportCount =
    Number(overview?.moderationSummary?.openReports || 0) +
    Number(overview?.moderationSummary?.inReviewReports || 0)
  const pendingTotal =
    notificationData.summary?.totalPendingActionCount ?? fallbackReportCount

  const pendingActionItems = [
    {
      label: 'Açık Raporlar',
      desc: 'İnceleme bekleyen şikayetler',
      value: notificationData.summary ? notificationData.summary.openReports : fallbackReportCount,
      to: `${base}/reports`,
      tone: (notificationData.summary ? notificationData.summary.openReports : fallbackReportCount) > 0 ? 'danger' : 'neutral',
      icon: '🛡️',
    },
    {
      label: 'Doğrulama Talepleri',
      desc: 'Mavi rozet & kimlik başvuruları',
      value: Number(notificationData.summary?.pendingVerifications || 0),
      to: `${base}/verification-requests`,
      tone: Number(notificationData.summary?.pendingVerifications || 0) > 0 ? 'warning' : 'neutral',
      icon: '💎',
    },
    {
      label: 'Para Çekme Talepleri',
      desc: 'Üretici IBAN nakit talepleri',
      value: Number(notificationData.summary?.pendingPayouts || 0),
      to: `${base}/creators`,
      tone: Number(notificationData.summary?.pendingPayouts || 0) > 0 ? 'success' : 'neutral',
      icon: '💳',
    },
    {
      label: 'Üretici Başvuruları',
      desc: 'Monetizasyon onay kuyruğu',
      value: Number(notificationData.summary?.pendingCreatorApplications || 0),
      to: `${base}/creators`,
      tone: Number(notificationData.summary?.pendingCreatorApplications || 0) > 0 ? 'primary' : 'neutral',
      icon: '🎨',
    },
    {
      label: 'Bugün Kayıt Olanlar',
      desc: 'Bugün katılan yeni üyeler',
      value: Number(notificationData.summary?.newUsersToday || 0),
      to: `${base}/users`,
      tone: 'info',
      icon: '👤',
    },
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
              <strong>{pageMeta.title}</strong>
            </div>
            <div className="admin-topbar-actions">
              <Link className="admin-view-site" to={`/${lang}`}>Siteyi görüntüle ↗</Link>
              <div className="admin-notification-wrap" ref={notificationWrapRef}>
                <button
                  type="button"
                  className={cx('admin-icon-button admin-bell', pendingTotal > 0 ? 'has-badge' : '')}
                  onClick={() => setNotificationsOpen((current) => !current)}
                  aria-label={`Operasyon bildirimleri (${pendingTotal} bekleyen işlem)`}
                  title="Operasyon Bildirimleri"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  {pendingTotal > 0 ? (
                    <b className="admin-bell-badge animate-pulse">
                      {Math.min(pendingTotal, 99)}
                    </b>
                  ) : null}
                </button>
                {notificationsOpen ? (
                  <div className="admin-notification-panel" role="dialog" aria-label="Operasyon Bildirimleri">
                    <div className="admin-notification-heading">
                      <div className="admin-notification-heading-left">
                        <strong>Operasyon Bildirimleri</strong>
                        <span className="admin-notification-pulse-tag">
                          <span className={cx('admin-pulse-dot', pendingTotal > 0 ? 'is-alert' : '')} />
                          {pendingTotal > 0 ? `${pendingTotal} bekleyen işlem` : 'Tüm işlemler güncel'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="admin-notification-refresh-btn"
                        onClick={fetchAdminNotifications}
                        title="Yenile"
                        aria-label="Bildirimleri Yenile"
                      >
                        ↻
                      </button>
                    </div>

                    <div className="admin-notification-tabs">
                      <button
                        type="button"
                        className={cx('admin-notification-tab', notificationTab === 'actions' ? 'is-active' : '')}
                        onClick={() => setNotificationTab('actions')}
                      >
                        Bekleyen İşlemler
                        {pendingTotal > 0 ? <span className="admin-tab-count">{pendingTotal}</span> : null}
                      </button>
                      <button
                        type="button"
                        className={cx('admin-notification-tab', notificationTab === 'feed' ? 'is-active' : '')}
                        onClick={() => setNotificationTab('feed')}
                      >
                        Canlı Akış
                        {notificationData.feed?.length > 0 ? (
                          <span className="admin-tab-count-subtle">{notificationData.feed.length}</span>
                        ) : null}
                      </button>
                    </div>

                    <div className="admin-notification-body">
                      {notificationTab === 'actions' ? (
                        <div className="admin-action-cards-grid">
                          {pendingActionItems.map((item) => (
                            <Link
                              key={item.label}
                              to={item.to}
                              onClick={() => setNotificationsOpen(false)}
                              className="admin-action-card"
                            >
                              <div className="admin-action-card-left">
                                <span className="admin-action-card-icon">{item.icon}</span>
                                <div className="admin-action-card-meta">
                                  <strong>{item.label}</strong>
                                  <small>{item.desc}</small>
                                </div>
                              </div>
                              <div className="admin-action-card-right">
                                <span className={cx('admin-action-count-pill', `is-${item.tone}`)}>
                                  {formatNumber(item.value)}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="admin-feed-list">
                          {notificationData.feed?.length > 0 ? (
                            notificationData.feed.map((event) => {
                              const eventIcon =
                                event.type === 'user' ? '👤' :
                                event.type === 'verification' ? '💎' :
                                event.type === 'payout' ? '💳' :
                                event.type === 'creator' ? '🎨' : '🚨'
                              return (
                                <Link
                                  key={event.id}
                                  to={event.link?.startsWith('http') ? event.link : `${base}${event.link || ''}`}
                                  onClick={() => setNotificationsOpen(false)}
                                  className="admin-feed-item"
                                >
                                  <span className="admin-feed-item-icon">{eventIcon}</span>
                                  <div className="admin-feed-item-body">
                                    <div className="admin-feed-item-header">
                                      <span className="admin-feed-item-title">{event.title}</span>
                                      <span className="admin-feed-item-time">{formatTimeAgo(event.timestamp)}</span>
                                    </div>
                                    <span className="admin-feed-item-subtitle">{event.subtitle}</span>
                                  </div>
                                </Link>
                              )
                            })
                          ) : (
                            <div className="admin-feed-empty">Henüz kaydedilmiş aktivite bulunmuyor.</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="admin-notification-footer">
                      <Link
                        to={`${base}/audit-logs`}
                        onClick={() => setNotificationsOpen(false)}
                        className="admin-footer-link"
                      >
                        Tüm İşlem Kayıtları (Audit Logs) ↗
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="admin-profile-wrap" ref={profileWrapRef}>
                <button
                  type="button"
                  className={cx('admin-profile-chip admin-profile-btn', profileMenuOpen ? 'is-active' : '')}
                  onClick={() => {
                    setProfileMenuOpen((curr) => !curr)
                    setLogoutConfirmOpen(false)
                  }}
                  aria-label="Yönetici hesabı ve çıkış menüsü"
                  aria-expanded={profileMenuOpen}
                >
                  <span className="admin-profile-avatar">{getAvatarLabel(user)}</span>
                  <div className="admin-profile-meta">
                    <strong>{getFullName(user)}</strong>
                    <small>Yönetici</small>
                  </div>
                  <svg className="admin-profile-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>

                {profileMenuOpen ? (
                  <div className="admin-profile-popover" role="dialog" aria-label="Yönetici Oturumu">
                    <div className="admin-popover-header">
                      <span className="admin-popover-avatar-large">{getAvatarLabel(user)}</span>
                      <div className="admin-popover-user-info">
                        <strong>{getFullName(user)}</strong>
                        <span>@{user?.username || 'admin'}</span>
                        <span className="admin-popover-role-pill">🛡️ Sistem Yöneticisi</span>
                      </div>
                    </div>

                    <div className="admin-popover-menu">
                      <Link
                        to={`/${lang}`}
                        onClick={() => setProfileMenuOpen(false)}
                        className="admin-popover-item"
                      >
                        <span className="admin-popover-item-icon">🌐</span>
                        <span>Site Ana Sayfasına Git</span>
                      </Link>
                      <Link
                        to={`${base}/settings/notifications`}
                        onClick={() => setProfileMenuOpen(false)}
                        className="admin-popover-item"
                      >
                        <span className="admin-popover-item-icon">⚙️</span>
                        <span>Yönetici Ayarları</span>
                      </Link>
                      <Link
                        to={`${base}/audit-logs`}
                        onClick={() => setProfileMenuOpen(false)}
                        className="admin-popover-item"
                      >
                        <span className="admin-popover-item-icon">📋</span>
                        <span>İşlem Kayıtları</span>
                      </Link>
                    </div>

                    <div className="admin-popover-logout-box">
                      {!logoutConfirmOpen ? (
                        <button
                          type="button"
                          className="admin-popover-logout-btn"
                          onClick={() => setLogoutConfirmOpen(true)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          <span>Çıkış Yap</span>
                        </button>
                      ) : (
                        <div className="admin-popover-confirm-box">
                          <p>Yönetici oturumunu kapatmak istediğinize emin misiniz?</p>
                          <div className="admin-popover-confirm-actions">
                            <button
                              type="button"
                              className="admin-popover-confirm-btn"
                              onClick={handleLogout}
                              disabled={isLoggingOut}
                            >
                              {isLoggingOut ? 'Çıkılıyor...' : 'Evet, Çıkış Yap'}
                            </button>
                            <button
                              type="button"
                              className="admin-popover-cancel-btn"
                              onClick={() => setLogoutConfirmOpen(false)}
                              disabled={isLoggingOut}
                            >
                              Vazgeç
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className={cx('admin-main', isShadowRoute ? 'is-shadow-layout' : '')}>
            {!pageMeta.hideHeading ? (
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
            ) : null}

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
