import { Link } from 'react-router-dom'

function formatReportDate(dateStr) {
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

const targetKindLabels = {
  post: { label: 'Gönderi', tone: 'blue' },
  comment: { label: 'Yorum', tone: 'purple' },
  user: { label: 'Kullanıcı', tone: 'orange' },
  message: { label: 'Mesaj', tone: 'slate' },
}

export default function AdminPendingReportsTable({ reports = [], loading = false, lang = 'tr' }) {
  return (
    <div className="admin-card admin-mini-table-card">
      <div className="admin-mini-table-header">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="admin-mini-table-title">Acil Moderasyon Kuyruğu</h3>
            <p className="admin-mini-table-subtitle">İnceleme bekleyen açık şikayet vakaları</p>
          </div>
          {reports.length > 0 && (
            <span className="admin-urgent-badge">{reports.length} Açık</span>
          )}
        </div>
        <Link to={`/${lang}/admin/reports`} className="admin-mini-table-action">
          Tüm Kuyruğu Aç →
        </Link>
      </div>

      <div className="admin-table-container">
        {loading ? (
          <div className="admin-mini-table-skeleton">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="admin-skeleton-row" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="admin-reports-resolved-box">
            <div className="admin-resolved-icon">✓</div>
            <div className="admin-resolved-text">
              <strong>Tüm Şikayetler Çözümlendi</strong>
              <p>Şu anda bekleyen açık moderasyon vakası bulunmuyor. Topluluk güvenliği iyi durumda.</p>
            </div>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Hedef</th>
                <th>Şikayet Sebebi</th>
                <th>Bildiren</th>
                <th>Tarih</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const kindMeta = targetKindLabels[r.targetKind] || { label: r.targetKind, tone: 'slate' }
                const reporterName = r.reporter
                  ? `@${r.reporter.username}`
                  : 'Anonim'

                return (
                  <tr key={r._id} className="admin-table-row">
                    <td>
                      <span className={`admin-kind-pill is-${kindMeta.tone}`}>
                        {kindMeta.label}
                      </span>
                    </td>
                    <td>
                      <span className="admin-report-reason" title={r.reason || r.details}>
                        {r.reason || r.details || 'Belirtilmemiş'}
                      </span>
                    </td>
                    <td>
                      <span className="admin-reporter-handle">{reporterName}</span>
                    </td>
                    <td>
                      <span className="admin-date-text">{formatReportDate(r.createdAt)}</span>
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/${lang}/admin/reports`}
                        className="admin-row-action-btn is-warn"
                        title="Raporu Çözümle"
                      >
                        İncele →
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
