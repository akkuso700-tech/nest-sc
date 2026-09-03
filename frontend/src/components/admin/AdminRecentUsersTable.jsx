import { Link } from 'react-router-dom'
import { getAvatarLabel, getFullName } from '../../utils/social.js'

function formatUserDate(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminRecentUsersTable({ users = [], loading = false, lang = 'tr' }) {
  return (
    <div className="admin-card admin-mini-table-card">
      <div className="admin-mini-table-header">
        <div>
          <h3 className="admin-mini-table-title">Son Kayıt Olanlar</h3>
          <p className="admin-mini-table-subtitle">Platforma en son katılan 6 kullanıcı</p>
        </div>
        <Link to={`/${lang}/admin/users`} className="admin-mini-table-action">
          Tümünü Gör ({users.length ? '100+' : '0'}) →
        </Link>
      </div>

      <div className="admin-table-container">
        {loading ? (
          <div className="admin-mini-table-skeleton">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="admin-skeleton-row" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="admin-mini-table-empty">
            <span>Henüz kayıtlı kullanıcı bulunmuyor.</span>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Kayıt Tarihi</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const fullName = getFullName(u)
                const avatarLabel = getAvatarLabel(u)
                const roleBadge =
                  u.role === 'admin'
                    ? { label: 'Admin', cls: 'is-admin' }
                    : u.role === 'moderator'
                      ? { label: 'Moderatör', cls: 'is-mod' }
                      : { label: 'Kullanıcı', cls: 'is-user' }

                const statusBadge =
                  u.accountStatus === 'suspended'
                    ? { label: 'Askıda', cls: 'is-danger' }
                    : { label: 'Aktif', cls: 'is-success' }

                return (
                  <tr key={u._id} className="admin-table-row">
                    <td>
                      <div className="admin-user-cell">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt=""
                            className="admin-user-avatar-img"
                            loading="lazy"
                          />
                        ) : (
                          <span className="admin-user-avatar-initials">{avatarLabel}</span>
                        )}
                        <div className="admin-user-info">
                          <strong className="admin-user-name">{fullName}</strong>
                          <span className="admin-user-handle">@{u.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`admin-role-pill ${roleBadge.cls}`}>
                        {roleBadge.label}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-status-pill ${statusBadge.cls}`}>
                        <i />
                        {statusBadge.label}
                      </span>
                    </td>
                    <td>
                      <span className="admin-date-text">{formatUserDate(u.createdAt)}</span>
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/${lang}/admin/users/${u._id}`}
                        className="admin-row-action-btn"
                        title="Kullanıcı Detayını İncele"
                      >
                        İncele
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
