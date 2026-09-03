import { Link } from 'react-router-dom'
import AdminDateFilterPopover from './AdminDateFilterPopover.jsx'

export default function AdminSystemPulse({
  lastSyncTime,
  isRefreshing,
  onRefresh,
  openReportsCount = 0,
  lang = 'tr',
  dateFilter,
  dateRangeMeta,
  onDateFilterChange,
}) {
  return (
    <div className="admin-command-bar">
      <div className="admin-pulse-status">
        <span className="admin-live-dot" />
        <div className="admin-pulse-texts">
          <span className="admin-pulse-title">Sistemler Tam Operasyonel</span>
          <span className="admin-pulse-sub">
            {lastSyncTime ? `Son senkronizasyon: ${lastSyncTime}` : 'Canlı veri senkronize edildi'}
          </span>
        </div>
      </div>

      <div className="admin-command-actions">
        <div className="admin-quick-links">
          <Link to={`/${lang}/admin/users`} className="admin-quick-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Kullanıcılar</span>
          </Link>

          <Link to={`/${lang}/admin/reports`} className="admin-quick-btn is-alert-target">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>Moderasyon</span>
            {openReportsCount > 0 && (
              <span className="admin-quick-count">{openReportsCount}</span>
            )}
          </Link>

          <Link to={`/${lang}/admin/verification-requests`} className="admin-quick-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Mavi Tik</span>
          </Link>

          <Link to={`/${lang}/admin/content`} className="admin-quick-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            <span>İçerikler</span>
          </Link>
        </div>

        {dateFilter && onDateFilterChange && (
          <AdminDateFilterPopover
            period={dateFilter.period}
            dateFrom={dateFilter.dateFrom}
            dateTo={dateFilter.dateTo}
            dateRangeMeta={dateRangeMeta}
            onChange={onDateFilterChange}
            disabled={isRefreshing}
          />
        )}

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`admin-refresh-btn ${isRefreshing ? 'is-loading' : ''}`}
          title="Verileri Yenile"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isRefreshing ? 'animate-spin' : ''}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          <span>{isRefreshing ? 'Yenileniyor...' : 'Yenile'}</span>
        </button>
      </div>
    </div>
  )
}
