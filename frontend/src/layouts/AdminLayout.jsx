import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import Seo from '../components/seo/Seo.jsx'
import {
  getAdminContentSummary,
  getAdminOverview,
  getAdminUsersSummary,
} from '../services/adminService.js'
import { useAuth } from '../store/AuthContext.jsx'
import { getAvatarLabel, getFullName } from '../utils/social.js'

const SIDEBAR_STORAGE_KEY = 'nest_admin_sidebar_collapsed_v2'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function formatCompactNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0'
  }
  return new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(value)
}

function formatFullNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0'
  }
  return new Intl.NumberFormat('tr-TR').format(value)
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '0%'
  }
  return `${value.toFixed(1)}%`
}

function formatChangePercent(value) {
  if (!Number.isFinite(value)) {
    return '%0.0'
  }

  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toFixed(1)}%`
}

function getTrendTone(value) {
  if (!Number.isFinite(value) || value === 0) {
    return 'text-slate-300'
  }

  return value > 0 ? 'text-emerald-300' : 'text-rose-300'
}

function DashboardIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 13.5c0-.7 0-1.1.14-1.48.12-.33.31-.62.57-.87.29-.29.68-.5 1.47-.91l3.18-1.68c.9-.47 1.35-.71 1.84-.8.43-.08.87-.08 1.3 0 .49.09.94.33 1.84.8l3.18 1.68c.79.41 1.18.62 1.47.91.26.25.45.54.57.87.14.38.14.78.14 1.48V18c0 .93 0 1.4-.18 1.76a2 2 0 0 1-.88.88C18.4 20.82 17.93 20.82 17 20.82H7c-.93 0-1.4 0-1.76-.18a2 2 0 0 1-.88-.88C4.18 19.4 4.18 18.93 4.18 18v-4.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 20.5V15h6v5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UsersIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M16.5 21a4.5 4.5 0 0 0-9 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.5 20.5a3.8 3.8 0 0 0-2.7-3.62M17 4.8a3.5 3.5 0 0 1 0 6.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ContentIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 9h8M8 12h8M8 15h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CommentsIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 17.5H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7l-4 3v-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 10h8M8 13h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ReportsIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3 4.5 6v5.6c0 4.19 2.72 8.08 7.5 9.4 4.78-1.32 7.5-5.21 7.5-9.4V6L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 8v4M12 16h.01"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LogsIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 4h8l3 3v11a2 2 0 0 1-2 2H8a3 3 0 1 1 0-6h9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 14h8M8 10h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SettingsIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13.5a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.64V20a2 2 0 1 1-4 0v-.09a1.8 1.8 0 0 0-1.1-1.64 1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.8 1.8 0 0 0 .36-1.98 1.8 1.8 0 0 0-1.64-1.1H4a2 2 0 1 1 0-4h.09a1.8 1.8 0 0 0 1.64-1.1 1.8 1.8 0 0 0-.36-1.98l-.06-.06A2 2 0 1 1 8.14 2.75l.06.06a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 11.28 1.5V1.4a2 2 0 1 1 4 0v.09a1.8 1.8 0 0 0 1.1 1.64 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.36 1.98A1.8 1.8 0 0 0 22.5 10.28h.1a2 2 0 1 1 0 4h-.09a1.8 1.8 0 0 0-1.64 1.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-4.2-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BellIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6.5 9.5a5.5 5.5 0 1 1 11 0v2.64c0 .77.18 1.53.54 2.22l.59 1.14a1 1 0 0 1-.89 1.5H6.26a1 1 0 0 1-.89-1.5l.59-1.14c.36-.69.54-1.45.54-2.22V9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 18a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PanelIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM11 4h7.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H11V4Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function ActivityIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 12h4l2.2-5 3.6 10L15 12h6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ServerIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="6" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4" y="14" width="16" height="6" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 7h.01M8 17h.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TimerIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="13" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 13 15.5 10.5M9 3h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UserCheckIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.5 19a5.5 5.5 0 0 1 11 0M16.5 11.5l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronDownIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AdminNavLink({ to, label, shortLabel, icon, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to.endsWith('/admin')}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center rounded-2xl border text-sm font-medium transition-all duration-200',
          collapsed ? 'justify-center px-0 py-3.5' : 'gap-3 px-3.5 py-3.5',
          isActive
            ? 'border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(99,102,241,0.18))] text-white shadow-[0_10px_30px_rgba(6,182,212,0.16)]'
            : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
        )
      }
    >
      <span
        className={cx(
          'grid size-11 shrink-0 place-items-center rounded-2xl border transition-all duration-200',
          'border-white/10 bg-white/[0.06] text-slate-100 group-hover:border-white/15 group-hover:bg-white/[0.08]',
          collapsed ? 'mx-auto' : ''
        )}
      >
        {icon}
      </span>

      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {shortLabel}
          </span>
        </>
      ) : null}
    </NavLink>
  )
}

function AdminSubNavLink({ to, label, collapsed }) {
  if (collapsed) return null

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition',
          isActive
            ? 'bg-white/15 text-slate-950'
            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
        )
      }
    >
      <span className="size-1.5 rounded-full bg-current" />
      <span>{label}</span>
    </NavLink>
  )
}

function AdminMetricCard({ icon, label, value, meta, details = [], trend = null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06]  p-4 ">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
            {trend ? (
              <p className={cx('text-xs font-semibold', trend.tone || 'text-slate-300')}>
                {trend.text}
              </p>
            ) : null}
          </div>
          {meta ? <p className="mt-1 text-xs text-slate-400">{meta}</p> : null}
          {details.length ? (
            <ul className="mt-3 space-y-1.5 text-[11px] leading-4">
              {details.map((detail) => (
                <li
                  key={typeof detail === 'string' ? detail : detail.text}
                  className="flex items-start gap-1.5"
                >
                  <span
                    className={cx(
                      'mt-1 size-1.5 shrink-0 rounded-full',
                      typeof detail === 'string' ? 'bg-cyan-300/90' : detail.dotTone || 'bg-cyan-300/90',
                    )}
                  />
                  <span className={typeof detail === 'string' ? 'text-slate-300' : detail.tone || 'text-slate-300'}>
                    {typeof detail === 'string' ? detail : detail.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="grid size-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#1e293b)] text-white shadow-lg">
          {icon}
        </div>
      </div>
    </div>
  )
}

function getPageMeta(pathname, lang) {
  const base = `/${lang}/admin`

  if (pathname === base) {
    return {
      title: 'Genel Bakış',
      eyebrow: 'Admin Console',
      description:
        'Platform sağlığı, kullanıcı büyümesi, moderasyon akışı ve teknik operasyon görünürlüğü.',
    }
  }

  if (pathname.includes(`${base}/users`)) {
    return {
      title: 'Kullanıcılar',
      eyebrow: 'User Operations',
      description:
        'Üyelik durumu, doğrulama, risk sinyalleri ve kullanıcı yönetim akışları.',
    }
  }

  if (pathname.includes(`${base}/content`)) {
    return {
      title: 'İçerikler',
      eyebrow: 'Content Intelligence',
      description:
        'İçerik hacmi, etkileşim sinyalleri, içerik yaşam döngüsü ve içerik operasyonları.',
    }
  }

  if (pathname.includes(`${base}/comments`)) {
    return {
      title: 'Yorumlar',
      eyebrow: 'Conversation Control',
      description:
        'Yorum kalitesi, kötüye kullanım sinyalleri ve topluluk sağlığı takibi.',
    }
  }

  if (pathname.includes(`${base}/reports`)) {
    return {
      title: 'Raporlar',
      eyebrow: 'Moderation Queue',
      description:
        'Açık vakalar, öncelik sıralaması, çözüm süreleri ve moderasyon iş akışları.',
    }
  }

  if (pathname.includes(`${base}/audit-logs`)) {
    return {
      title: 'İşlem Kayıtları',
      eyebrow: 'Audit Trail',
      description:
        'Yönetici eylemleri, sistem olayları ve kritik operasyon kayıtlarının izlenmesi.',
    }
  }

  if (pathname.includes(`${base}/settings`)) {
    return {
      title: 'Ayarlar',
      eyebrow: 'Configuration',
      description:
        'Sistem ayarları, sözleşmeler ve panel yapılandırmalarının yönetimi.',
    }
  }

  return {
    title: 'Yönetim Paneli',
    eyebrow: 'Admin Console',
    description:
      'Kullanıcı analizi, moderasyon, sistem sağlığı ve platform operasyonları için yönetim alanı.',
  }
}

function AdminLayout() {
  const { lang } = useParams()
  const location = useLocation()
  const { user } = useAuth()

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [overviewStats, setOverviewStats] = useState(null)
  const [usersSummaryRange, setUsersSummaryRange] = useState('today')
  const [isCustomRangeOpen, setIsCustomRangeOpen] = useState(false)
  const [customRangeDraft, setCustomRangeDraft] = useState({
    dateFrom: '',
    dateTo: '',
  })
  const [usersSummaryState, setUsersSummaryState] = useState({
    isLoading: false,
    error: '',
    data: null,
  })
  const [contentSummaryState, setContentSummaryState] = useState({
    isLoading: false,
    error: '',
    data: null,
  })

  const isSettingsRoute = location.pathname.includes(`/${lang}/admin/settings/`)
  const isUsersRoute = location.pathname.includes(`/${lang}/admin/users`)
  const isContentRoute = location.pathname.includes(`/${lang}/admin/content`)
  const isSummaryRoute = isUsersRoute || isContentRoute
  const pageMeta = useMemo(() => getPageMeta(location.pathname, lang), [location.pathname, lang])

  useEffect(() => {
    const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (storedValue === 'false') {
      setIsSidebarCollapsed(false)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  useEffect(() => {
    if (isSettingsRoute) {
      setIsSettingsOpen(true)
      setIsSidebarCollapsed(false)
    }
  }, [isSettingsRoute])

  useEffect(() => {
    setIsNotificationsOpen(false)
    setIsCustomRangeOpen(false)
  }, [location.pathname])

  useEffect(() => {
    let cancelled = false

    async function loadOverviewStats() {
      try {
        const payload = await getAdminOverview()
        if (!cancelled) {
          setOverviewStats(payload)
        }
      } catch {
        if (!cancelled) {
          setOverviewStats(null)
        }
      }
    }

    loadOverviewStats()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isUsersRoute) {
      return undefined
    }

    if (usersSummaryRange === 'custom' && (!customRangeDraft.dateFrom || !customRangeDraft.dateTo)) {
      return undefined
    }

    let cancelled = false

    async function loadUsersSummary() {
      setUsersSummaryState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: '',
      }))

      try {
        const payload = await getAdminUsersSummary({
          period: usersSummaryRange,
          dateFrom: usersSummaryRange === 'custom' ? customRangeDraft.dateFrom : '',
          dateTo: usersSummaryRange === 'custom' ? customRangeDraft.dateTo : '',
        })

        if (cancelled) {
          return
        }

        setUsersSummaryState({
          isLoading: false,
          error: '',
          data: payload,
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setUsersSummaryState((currentState) => ({
          ...currentState,
          isLoading: false,
          error: error.message || 'Kullanıcı metrikleri yüklenemedi.',
        }))
      }
    }

    loadUsersSummary()

    return () => {
      cancelled = true
    }
  }, [customRangeDraft.dateFrom, customRangeDraft.dateTo, isUsersRoute, usersSummaryRange])

  useEffect(() => {
    if (!isContentRoute) {
      return undefined
    }

    if (usersSummaryRange === 'custom' && (!customRangeDraft.dateFrom || !customRangeDraft.dateTo)) {
      return undefined
    }

    let cancelled = false

    async function loadContentSummary() {
      setContentSummaryState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: '',
      }))

      try {
        const payload = await getAdminContentSummary({
          period: usersSummaryRange,
          dateFrom: usersSummaryRange === 'custom' ? customRangeDraft.dateFrom : '',
          dateTo: usersSummaryRange === 'custom' ? customRangeDraft.dateTo : '',
        })

        if (cancelled) {
          return
        }

        setContentSummaryState({
          isLoading: false,
          error: '',
          data: payload,
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setContentSummaryState((currentState) => ({
          ...currentState,
          isLoading: false,
          error: error.message || 'İçerik metrikleri yüklenemedi.',
        }))
      }
    }

    loadContentSummary()

    return () => {
      cancelled = true
    }
  }, [customRangeDraft.dateFrom, customRangeDraft.dateTo, isContentRoute, usersSummaryRange])

  const handleSettingsToggle = () => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false)
      setIsSettingsOpen(true)
      return
    }
    setIsSettingsOpen((current) => !current)
  }

  const analyzedOverviewMetrics = useMemo(() => {
    if (isUsersRoute) {
      const usersMetrics = usersSummaryState?.data?.metrics
      const totalUsers = Number(usersMetrics?.totalUsers || 0)
      const growthUsers = Number(usersMetrics?.userGrowth?.newUsers || 0)
      const activeUsers = Number(usersMetrics?.activeUsers?.count || 0)
      const totalVisitors = Number(usersMetrics?.conversion?.totalVisitors || 0)
      const loggedInUsers = Number(usersMetrics?.conversion?.loggedInUsers || 0)
      const conversionRate = Number(usersMetrics?.conversion?.rate || 0)
      const periodLabelMap = {
        today: 'gün',
        '7d': '7 gün',
        '30d': '30 gün',
        custom: 'özel aralık',
      }
      const activePeriodLabel = periodLabelMap[usersSummaryRange] || 'seçilen filtre'

      return [
        {
          label: '1. Toplam Kullanıcı',
          value: formatFullNumber(totalUsers),
          meta: 'Platform genelindeki kayıtlı hesaplar',
          icon: <UsersIcon className="size-5" />,
        },
        {
          label: '2. Kullanıcı Büyümesi',
          value: formatFullNumber(growthUsers),
          meta: `Yeni üye (${activePeriodLabel}) sayısı`,
          icon: <TimerIcon className="size-5" />,
        },
        {
          label: '3. Aktif Kullanıcılar',
          value: formatFullNumber(activeUsers),
          meta: `Aktif üye (${activePeriodLabel}) sayısı`,
          icon: <UserCheckIcon className="size-5" />,
        },
        {
          label: '4. Kullanıcı Dönüşüm',
          value: formatPercent(conversionRate),
          meta: `Toplam ziyaretçi: ${formatFullNumber(totalVisitors)} · Giriş yapan kullanıcı: ${formatFullNumber(loggedInUsers)}`,
          icon: <ActivityIcon className="size-5" />,
        },
      ]
    }

    if (isContentRoute) {
      const contentMetrics = contentSummaryState?.data?.metrics
      const totalContent = Number(contentMetrics?.totalContent?.total || 0)
      const totalLoops = Number(contentMetrics?.totalContent?.loops || 0)
      const totalPosts = Number(contentMetrics?.totalContent?.posts || 0)

      const activityTotal = Number(contentMetrics?.activity?.total || 0)
      const activityDelta = Number(contentMetrics?.activity?.changePct || 0)
      const activityLoopsCount = Number(contentMetrics?.activity?.loops?.count || 0)
      const activityLoopsDelta = Number(contentMetrics?.activity?.loops?.changePct || 0)
      const activityPostsCount = Number(contentMetrics?.activity?.posts?.count || 0)
      const activityPostsDelta = Number(contentMetrics?.activity?.posts?.changePct || 0)

      const postTrendCount = Number(contentMetrics?.postEngagement?.trendCount || 0)
      const postTrendDelta = Number(contentMetrics?.postEngagement?.trendChangePct || 0)
      const postPopularCount = Number(contentMetrics?.postEngagement?.popularCount || 0)
      const postPopularDelta = Number(contentMetrics?.postEngagement?.popularChangePct || 0)

      const loopTrendCount = Number(contentMetrics?.loopEngagement?.trendCount || 0)
      const loopTrendDelta = Number(contentMetrics?.loopEngagement?.trendChangePct || 0)
      const loopPopularCount = Number(contentMetrics?.loopEngagement?.popularCount || 0)
      const loopPopularDelta = Number(contentMetrics?.loopEngagement?.popularChangePct || 0)

      const storiesCount = Number(contentMetrics?.stories?.count || 0)
      const storiesDelta = Number(contentMetrics?.stories?.changePct || 0)

      const removedCount = Number(contentMetrics?.removedContent?.count || 0)
      const removedDelta = Number(contentMetrics?.removedContent?.changePct || 0)

      const pendingReviewCount = Number(contentMetrics?.pendingReview?.count || 0)
      const pendingReviewDelta = Number(contentMetrics?.pendingReview?.changePct || 0)
      const contentComparisonText =
        usersSummaryRange === 'today'
          ? 'Düne göre karşılaştırma.'
          : usersSummaryRange === '7d'
            ? 'Önceki 7 güne göre karşılaştırma.'
            : usersSummaryRange === '30d'
              ? 'Önceki 30 güne göre karşılaştırma.'
              : 'Önceki eş döneme göre karşılaştırma.'

      return [
        {
          label: '1. Toplam İçerik',
          value: formatFullNumber(totalContent),
          meta: 'Platformda yayınlanan tüm içerikler (ilk günden bugüne).',
          details: [
            `Toplam loop videosu: ${formatFullNumber(totalLoops)}`,
            `Toplam gönderi içeriği: ${formatFullNumber(totalPosts)}`,
          ],
          icon: <ContentIcon className="size-5" />,
        },
        {
          label: '2. Paylaşım Aktivitesi',
          value: formatFullNumber(activityTotal),
          meta: '',
          trend: {
            text: `${formatChangePercent(activityDelta)}`,
            tone: getTrendTone(activityDelta),
          },
          details: [
            {
              text: `Loop video sayısı: ${formatFullNumber(activityLoopsCount)} (${formatChangePercent(activityLoopsDelta)})`,
              tone: getTrendTone(activityLoopsDelta),
            },
            {
              text: `Gönderi içeriği: ${formatFullNumber(activityPostsCount)} (${formatChangePercent(activityPostsDelta)})`,
              tone: getTrendTone(activityPostsDelta),
            },
            {
              text: contentComparisonText,
              tone: 'text-slate-400',
              dotTone: 'bg-slate-400/70',
            },
          ],
          icon: <ActivityIcon className="size-5" />,
        },
        {
          label: '3. Gönderi Etkileşim',
          value: formatFullNumber(postTrendCount),
          meta: 'Etkileşimi yüksek trend gönderi sayısı.',
          trend: {
            text: `${formatChangePercent(postTrendDelta)}`,
            tone: getTrendTone(postTrendDelta),
          },
          details: [
            {
              text: `Popüler gönderi içerik sayısı: ${formatFullNumber(postPopularCount)} (${formatChangePercent(postPopularDelta)})`,
              tone: getTrendTone(postPopularDelta),
            },
          ],
          icon: <TimerIcon className="size-5" />,
        },
        {
          label: '4. Loop Video Etkileşim',
          value: formatFullNumber(loopTrendCount),
          meta: 'Etkileşimi yüksek trend loop video sayısı.',
          trend: {
            text: `${formatChangePercent(loopTrendDelta)}`,
            tone: getTrendTone(loopTrendDelta),
          },
          details: [
            {
              text: `Popüler loop video sayısı: ${formatFullNumber(loopPopularCount)} (${formatChangePercent(loopPopularDelta)})`,
              tone: getTrendTone(loopPopularDelta),
            },
          ],
          icon: <ActivityIcon className="size-5" />,
        },
        {
          label: '5. Hikaye',
          value: formatFullNumber(storiesCount),
          meta: 'Seçilen tarih aralığında paylaşılan hikaye adedi.',
          trend: {
            text: `${formatChangePercent(storiesDelta)}`,
            tone: getTrendTone(storiesDelta),
          },
          icon: <CommentsIcon className="size-5" />,
        },
        {
          label: '6. Öne Çıkanlar',
          value: '-',
          meta: 'Bu kart şimdilik aktif değil.',
          icon: <ServerIcon className="size-5" />,
        },
        {
          label: '7. Kaldırılan İçerikler',
          value: formatFullNumber(removedCount),
          meta: 'Silinen, gizlenen veya askıya alınan içerikler.',
          trend: {
            text: `${formatChangePercent(removedDelta)}`,
            tone: getTrendTone(removedDelta),
          },
          icon: <ReportsIcon className="size-5" />,
        },
        {
          label: '8. İnceleme Bekleyenler',
          value: formatFullNumber(pendingReviewCount),
          meta: 'Şikayet edilen veya kontrol bekleyen içerikler.',
          trend: {
            text: `${formatChangePercent(pendingReviewDelta)}`,
            tone: getTrendTone(pendingReviewDelta),
          },
          icon: <BellIcon className="size-5" />,
        },
      ]
    }

    const metrics = overviewStats?.metrics
    const moderation = overviewStats?.moderationSummary
    const engagement = overviewStats?.contentEngagement
    const latestRegistrations = overviewStats?.latestRegistrations || []

    const totalUsers = metrics?.totalUsers || 0
    const monthlyActiveUsers = metrics?.activeUsers || 0
    const weeklyActiveUsers = metrics?.weeklyActiveUsers || 0
    const totalPosts = metrics?.totalPosts || 0
    const totalAuditLogs = moderation?.totalAuditLogs || 0
    const openReports = (moderation?.openReports || 0) + (moderation?.inReviewReports || 0)
    const suspendedUsers = moderation?.suspendedUsers || 0
    const hiddenOrRemovedContent =
      (moderation?.hiddenPosts || 0) +
      (moderation?.removedPosts || 0) +
      (moderation?.hiddenComments || 0) +
      (moderation?.removedComments || 0)
    const totalInteractions =
      (engagement?.likes || 0) +
      (engagement?.comments || 0) +
      (engagement?.shares || 0) +
      (engagement?.saves || 0)
    const interactionsPerPost = totalPosts > 0 ? totalInteractions / totalPosts : 0
    const last30DaysRegistrations = latestRegistrations.reduce(
      (total, item) => total + (item?.count || 0),
      0
    )
    const weeklyActivationRate = totalUsers > 0 ? (weeklyActiveUsers / totalUsers) * 100 : 0
    const locationConsentRate =
      totalUsers > 0 ? ((moderation?.usersWithLocationConsent || 0) / totalUsers) * 100 : 0
    const nearbyUsageTotal = moderation?.nearbyDiscoveryUsageTotal || 0

    return [
      {
        label: '1. Kullanici Buyumesi ve Tutundurma',
        value: formatPercent(weeklyActivationRate),
        meta: `Haftalik aktivasyon Â· 30g yeni kayit: ${formatCompactNumber(last30DaysRegistrations)} Â· 30g aktif: ${formatCompactNumber(monthlyActiveUsers)}`,
        icon: <TimerIcon className="size-5" />,
      },
      {
        label: '2. Icerik ve Etkilesim Kalitesi',
        value: `${interactionsPerPost.toFixed(1)}/post`,
        meta: `Toplam etkilesim: ${formatCompactNumber(totalInteractions)} Â· Toplam gonderi: ${formatCompactNumber(totalPosts)}`,
        icon: <UserCheckIcon className="size-5" />,
      },
      {
        label: '3. Topluluk ve Ag Etkisi',
        value: formatPercent(locationConsentRate),
        meta: `Konum izni orani Â· Yakinindaki kisiler kullanimi: ${formatCompactNumber(nearbyUsageTotal)}`,
        icon: <ActivityIcon className="size-5" />,
      },
      {
        label: '4. Teknik Performans ve Guven',
        value: formatCompactNumber(openReports),
        meta: `Acik rapor yuku Â· Askidaki hesap: ${formatCompactNumber(suspendedUsers)} Â· Moderasyon etkisi: ${formatCompactNumber(hiddenOrRemovedContent)} Â· Audit: ${formatCompactNumber(totalAuditLogs)}`,
        icon: <ServerIcon className="size-5" />,
      },
    ]
  }, [
    contentSummaryState,
    isContentRoute,
    isUsersRoute,
    overviewStats,
    usersSummaryRange,
    usersSummaryState,
  ])

  const notifications = [
    {
      title: 'Yeni yüksek öncelikli rapor',
      description: 'Taciz etiketi ile 12 yeni bildirim sıraya düştü.',
      time: '2 dk önce',
    },
    {
      title: 'Auth hata oranı yükseldi',
      description: 'Refresh token başarısızlık oranı normal seviyenin üstünde.',
      time: '11 dk önce',
    },
    {
      title: 'İçerik onay kuyruğu güncellendi',
      description: 'Otomatik moderasyon 34 içeriği incelemeye yönlendirdi.',
      time: '28 dk önce',
    },
    {
      title: 'Storage eşiği izleniyor',
      description: 'Medya depolama kullanım oranı %78 seviyesine ulaştı.',
      time: '44 dk önce',
    },
  ]

  function handleRangeSelect(range) {
    if (!isSummaryRoute) {
      return
    }

    if (range === 'custom') {
      setIsCustomRangeOpen((current) => !current)
      return
    }

    setUsersSummaryRange(range)
    setIsCustomRangeOpen(false)
  }

  function applyCustomRange() {
    if (!isSummaryRoute) {
      return
    }

    if (!customRangeDraft.dateFrom || !customRangeDraft.dateTo) {
      return
    }

    setUsersSummaryRange('custom')
    setIsCustomRangeOpen(false)
  }

  return (
    <>
      <Seo
        title={`My Social 1 - ${pageMeta.title}`}
        description={pageMeta.description}
      />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f8fbff_0%,#f3f7ff_26%,#eef2ff_55%,#f8fafc_100%)] text-slate-900">
        <div className="flex min-h-screen">
          <aside
            className={cx(
              'hidden lg:flex lg:shrink-0 lg:flex-col lg:border-r lg:border-white/10',
              'lg:bg-[linear-gradient(180deg,#020617_0%,#0f172a_42%,#111827_100%)] lg:text-white',
              'lg:shadow-[24px_0_60px_rgba(2,6,23,0.18)] lg:transition-all lg:duration-300',
              'lg:sticky lg:top-0 lg:h-screen',
              isSidebarCollapsed ? 'lg:w-20' : 'lg:w-60'
            )}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div
                className={cx(
                  'flex items-center px-3 py-0',
                  isSidebarCollapsed ? 'justify-center' : 'gap-3'
                )}
              >
               

               

                {!isSidebarCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label="Sidebar kapat"
                    title="Sidebar kapat"
                  >
                    <PanelIcon className="size-5" />
                  </button>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
                {isSidebarCollapsed ? (
                  <div className="mb-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed(false)}
                      className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
                      aria-label="Sidebar aç"
                      title="Sidebar aç"
                    >
                      <PanelIcon className="size-5" />
                    </button>
                  </div>
                ) : null}

               

                

                <nav className="space-y-2">
                  <AdminNavLink
                    to={`/${lang}/admin`}
                    label="Genel Bakış"
                    shortLabel="GB"
                    icon={<DashboardIcon />}
                    collapsed={isSidebarCollapsed}
                  />
                  <AdminNavLink
                    to={`/${lang}/admin/users`}
                    label="Kullanıcılar"
                    shortLabel="KL"
                    icon={<UsersIcon />}
                    collapsed={isSidebarCollapsed}
                  />
                  <AdminNavLink
                    to={`/${lang}/admin/content`}
                    label="İçerikler"
                    shortLabel="IC"
                    icon={<ContentIcon />}
                    collapsed={isSidebarCollapsed}
                  />
                  <AdminNavLink
                    to={`/${lang}/admin/comments`}
                    label="Yorumlar"
                    shortLabel="YR"
                    icon={<CommentsIcon />}
                    collapsed={isSidebarCollapsed}
                  />
                  <AdminNavLink
                    to={`/${lang}/admin/reports`}
                    label="Raporlar"
                    shortLabel="RP"
                    icon={<ReportsIcon />}
                    collapsed={isSidebarCollapsed}
                  />
                  <AdminNavLink
                    to={`/${lang}/admin/audit-logs`}
                    label="İşlem Kayıtları"
                    shortLabel="LK"
                    icon={<LogsIcon />}
                    collapsed={isSidebarCollapsed}
                  />

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleSettingsToggle}
                      title={isSidebarCollapsed ? 'Ayarlar' : undefined}
                      className={cx(
                        'flex w-full items-center rounded-2xl border text-sm font-medium transition-all duration-200',
                        isSidebarCollapsed ? 'justify-center px-0 py-3.5' : 'gap-3 px-3.5 py-3.5',
                        isSettingsRoute
                          ? 'border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(99,102,241,0.18))] text-white shadow-[0_10px_30px_rgba(6,182,212,0.16)]'
                          : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
                      )}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-slate-100">
                        <SettingsIcon />
                      </span>

                      {!isSidebarCollapsed ? (
                        <>
                          <span className="flex-1 text-left">Ayarlar</span>
                          <span
                            className={cx(
                              'transition-transform',
                              isSettingsOpen ? 'rotate-180' : ''
                            )}
                          >
                            <ChevronDownIcon className="size-4" />
                          </span>
                        </>
                      ) : null}
                    </button>

{isSettingsOpen ? (
                      <div className={cx('mt-2 space-y-1', isSidebarCollapsed ? '' : 'pl-14')}>
                        <AdminSubNavLink
                          to={`/${lang}/admin/settings/notifications`}
                          label="Bildirimler"
                          collapsed={isSidebarCollapsed}
                        />
                        <AdminSubNavLink
                          to={`/${lang}/admin/settings/contracts`}
                          label="Sözleşmeler"
                          collapsed={isSidebarCollapsed}
                        />
                      </div>
                    ) : null}
                  </div>
                  {!isSidebarCollapsed ? (
                  <div className="mb-4 rounded-[24px] border border-cyan-400/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(99,102,241,0.12))] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                      Live status
                    </p>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Core services operational
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-300">
                          API, auth, upload, websocket ve queue servisleri stabil çalışıyor.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-950">
                        Live
                      </span>
                    </div>
                  </div>
                ) : null}
                </nav>

                {!isSidebarCollapsed ? (
                  <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                      Queue summary
                    </p>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-300">Open reports</span>
                        <span className="font-semibold text-white">86</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-300">Pending reviews</span>
                        <span className="font-semibold text-white">24</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-300">Failed jobs</span>
                        <span className="font-semibold text-amber-300">3</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
              <div className="mb-3 lg:hidden">
                <div className="overflow-x-auto rounded-lg border border-white/60 bg-white/80 p-2 shadow-sm backdrop-blur">
                  <nav className="flex w-max items-center gap-2 pr-2">
                    <NavLink
                      to={`/${lang}/admin`}
                      end
                      className={({ isActive }) =>
                        cx(
                          'rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-slate-900'
                            : 'border-zinc-200 bg-white text-zinc-700',
                        )
                      }
                    >
                      Genel Bakis
                    </NavLink>
                    <NavLink
                      to={`/${lang}/admin/users`}
                      className={({ isActive }) =>
                        cx(
                          'rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-slate-900'
                            : 'border-zinc-200 bg-white text-zinc-700',
                        )
                      }
                    >
                      Kullanicilar
                    </NavLink>
                    <NavLink
                      to={`/${lang}/admin/content`}
                      className={({ isActive }) =>
                        cx(
                          'rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-slate-900'
                            : 'border-zinc-200 bg-white text-zinc-700',
                        )
                      }
                    >
                      Icerikler
                    </NavLink>
                    <NavLink
                      to={`/${lang}/admin/comments`}
                      className={({ isActive }) =>
                        cx(
                          'rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-slate-900'
                            : 'border-zinc-200 bg-white text-zinc-700',
                        )
                      }
                    >
                      Yorumlar
                    </NavLink>
                    <NavLink
                      to={`/${lang}/admin/reports`}
                      className={({ isActive }) =>
                        cx(
                          'rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-slate-900'
                            : 'border-zinc-200 bg-white text-zinc-700',
                        )
                      }
                    >
                      Raporlar
                    </NavLink>
                    <NavLink
                      to={`/${lang}/admin/audit-logs`}
                      className={({ isActive }) =>
                        cx(
                          'rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-slate-900'
                            : 'border-zinc-200 bg-white text-zinc-700',
                        )
                      }
                    >
                      Loglar
                    </NavLink>
                    <NavLink
                      to={`/${lang}/admin/settings/notifications`}
                      className={({ isActive }) =>
                        cx(
                          'rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-slate-900'
                            : 'border-zinc-200 bg-white text-zinc-700',
                        )
                      }
                    >
                      Bildirim Ayarlari
                    </NavLink>
                    <NavLink
                      to={`/${lang}/admin/settings/contracts`}
                      className={({ isActive }) =>
                        cx(
                          'rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-slate-900'
                            : 'border-zinc-200 bg-white text-zinc-700',
                        )
                      }
                    >
                      Sozlesmeler
                    </NavLink>
                  </nav>
                </div>
              </div>

              <header className="rounded-lg bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_48%,#312e81_100%)] border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
                <div className="flex flex-col gap-4 border-b border-white/10 px-3 py-3 sm:px-5 sm:py-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                  
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                        {pageMeta.title}
                      </h1>
                      
                    </div>
                    
                  </div>

                  <div className="flex flex-col gap-3 lg:min-w-[540px] lg:flex-row lg:items-center lg:justify-end">
                    <label className="relative block w-full lg:max-w-[380px]">
                      <span className="pointer-events-none absolute inset-y-0 left-0 grid w-12 place-items-center text-slate-400">
                        <SearchIcon className="size-4.5" />
                      </span>
                      <input
                        type="search"
                        placeholder="Kullanıcı, içerik, rapor veya log ara..."
                        className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-12 pr-4 text-sm text-white/70 outline-none transition placeholder:text-slate-400 focus:border-white/20 focus:bg-white/10"
                      />
                    </label>

                    <div className="flex items-center gap-2 self-end lg:self-auto">
                      <button
                        type="button"
                        className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 cursor-pointer transition hover:border-white/20 hover:text-white"
                      >
                        <ActivityIcon className="size-4.5" />
                        <span className="hidden sm:inline">Canlı durum</span>
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsNotificationsOpen((current) => !current)}
                          className="relative grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-white/80 cursor-pointer transition hover:border-white/20 hover:text-white"
                          aria-label="Bildirimler"
                        >
                          <BellIcon className="size-5" />
                          <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500" />
                        </button>

                        {isNotificationsOpen ? (
                          <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[280px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:w-[330px]">
                            <div className="border-b border-slate-100 px-4 py-3">
                              <p className="text-sm font-semibold text-slate-950">Bildirimler</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Operasyon ve sistem uyarıları
                              </p>
                            </div>

                            <div className="max-h-[340px] overflow-y-auto p-2">
                              {notifications.map((item) => (
                                <button
                                  key={`${item.title}-${item.time}`}
                                  type="button"
                                  className="w-full rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#1e293b)] text-white">
                                      <BellIcon className="size-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {item.title}
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-slate-500">
                                        {item.description}
                                      </p>
                                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                                        {item.time}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="hidden min-w-0 items-center gap-3 rounded-lg cursor-pointer  border border-white/10 hover:border-white/20 bg-white/[0.06] px-3 py-2 sm:flex">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#0f172a,#1e293b)] text-xs font-bold text-white">
                          {getAvatarLabel(user)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white/80 hover:text-white">
                            {getFullName(user)}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            @{user?.username || 'admin'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                    <div className="relative flex flex-wrap justify-end gap-2 px-3 py-2 sm:px-4">
                       <button
                         type="button"
                        onClick={() => handleRangeSelect('today')}
                        disabled={!isSummaryRoute}
                        className={cx(
                          'inline-flex h-8 items-center rounded-lg border px-4 text-sm font-medium transition',
                          usersSummaryRange === 'today' && isSummaryRoute
                            ? 'border-cyan-300/60 bg-cyan-500/20 text-white'
                            : 'border-white/10 bg-white/[0.06] text-white/80 hover:border-white/20 hover:text-white',
                          !isSummaryRoute ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        )}>
                         <span className="hidden sm:inline">Bugün</span>
                       </button>
                       <button
                         type="button"
                        onClick={() => handleRangeSelect('7d')}
                        disabled={!isSummaryRoute}
                        className={cx(
                          'inline-flex h-8 items-center rounded-lg border px-4 text-sm font-medium transition',
                          usersSummaryRange === '7d' && isSummaryRoute
                            ? 'border-cyan-300/60 bg-cyan-500/20 text-white'
                            : 'border-white/10 bg-white/[0.06] text-white/80 hover:border-white/20 hover:text-white',
                          !isSummaryRoute ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        )}>
                         <span className="hidden sm:inline">7 Gün</span>
                       </button>
                       <button
                         type="button"
                        onClick={() => handleRangeSelect('30d')}
                        disabled={!isSummaryRoute}
                        className={cx(
                          'inline-flex h-8 items-center rounded-lg border px-4 text-sm font-medium transition',
                          usersSummaryRange === '30d' && isSummaryRoute
                            ? 'border-cyan-300/60 bg-cyan-500/20 text-white'
                            : 'border-white/10 bg-white/[0.06] text-white/80 hover:border-white/20 hover:text-white',
                          !isSummaryRoute ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        )}>
                         <span className="hidden sm:inline">30 Gün</span>
                       </button>
                       <button
                         type="button"
                        onClick={() => handleRangeSelect('custom')}
                        disabled={!isSummaryRoute}
                        className={cx(
                          'inline-flex h-8 items-center rounded-lg border px-4 text-sm font-medium transition',
                          usersSummaryRange === 'custom' && isSummaryRoute
                            ? 'border-cyan-300/60 bg-cyan-500/20 text-white'
                            : 'border-white/10 bg-white/[0.06] text-white/80 hover:border-white/20 hover:text-white',
                          !isSummaryRoute ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        )}>
                         <span className="hidden sm:inline">Özel</span>
                       </button>

                      {isSummaryRoute && isCustomRangeOpen ? (
                        <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[300px] max-w-[calc(100vw-2rem)] rounded-lg border border-white/15 bg-slate-900/95 p-3 shadow-2xl backdrop-blur sm:right-4 sm:w-[320px]">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className="text-xs text-slate-300">
                              Başlangıç
                              <input
                                type="date"
                                value={customRangeDraft.dateFrom}
                                onChange={(event) =>
                                  setCustomRangeDraft((currentState) => ({
                                    ...currentState,
                                    dateFrom: event.target.value,
                                  }))
                                }
                                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-white/[0.06] px-2 text-sm text-white outline-none focus:border-cyan-400/50"
                              />
                            </label>
                            <label className="text-xs text-slate-300">
                              Bitiş
                              <input
                                type="date"
                                value={customRangeDraft.dateTo}
                                onChange={(event) =>
                                  setCustomRangeDraft((currentState) => ({
                                    ...currentState,
                                    dateTo: event.target.value,
                                  }))
                                }
                                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-white/[0.06] px-2 text-sm text-white outline-none focus:border-cyan-400/50"
                              />
                            </label>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setIsCustomRangeOpen(false)}
                              className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs font-medium text-white/80 transition hover:border-white/20 hover:text-white"
                            >
                              Kapat
                            </button>
                            <button
                              type="button"
                              onClick={applyCustomRange}
                              disabled={!customRangeDraft.dateFrom || !customRangeDraft.dateTo}
                              className="inline-flex h-8 items-center rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 text-xs font-medium text-white transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Uygula
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                <div className="grid gap-3 px-3 py-4 sm:px-5 sm:grid-cols-2 xl:grid-cols-4">
                  {analyzedOverviewMetrics.map((item) => (
                    <AdminMetricCard
                      key={item.label}
                      icon={item.icon}
                      label={item.label}
                      value={item.value}
                      meta={item.meta}
                      details={item.details}
                      trend={item.trend}
                    />
                  ))}
                </div>
                {isUsersRoute && usersSummaryState.error ? (
                  <p className="px-3 pb-3 text-xs text-rose-300 sm:px-5">{usersSummaryState.error}</p>
                ) : null}
                {isUsersRoute && usersSummaryState.isLoading ? (
                  <p className="px-3 pb-3 text-xs text-slate-300 sm:px-5">Kullanıcı kartları güncelleniyor...</p>
                ) : null}
                {isContentRoute && contentSummaryState.error ? (
                  <p className="px-3 pb-3 text-xs text-rose-300 sm:px-5">{contentSummaryState.error}</p>
                ) : null}
                {isContentRoute && contentSummaryState.isLoading ? (
                  <p className="px-3 pb-3 text-xs text-slate-300 sm:px-5">İçerik kartları güncelleniyor...</p>
                ) : null}
              </header>

              <main className="mt-5 flex-1">
              
                    <Outlet />
                
              </main>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default AdminLayout
