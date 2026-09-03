import { useEffect, useRef, useState } from 'react'

const PRESETS = [
  { key: 'today', label: 'Bugün', desc: '00:00 - Şu An' },
  { key: 'yesterday', label: 'Dün', desc: 'Tam gün' },
  { key: '7d', label: 'Son 7 Gün', desc: 'Haftalık görünüm' },
  { key: '28d', label: 'Son 28 Gün', desc: 'Standart 4 haftalık döngü' },
  { key: 'this_month', label: 'Bu Ay', desc: 'Ay başından bugüne' },
  { key: 'last_month', label: 'Geçen Ay', desc: 'Geçtiğimiz tam ay' },
  { key: 'this_year', label: 'Bu Yıl', desc: '1 Ocak\'tan bugüne' },
]

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminDateFilterPopover({
  period = '28d',
  dateFrom = '',
  dateTo = '',
  dateRangeMeta = null,
  onChange,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempFrom, setTempFrom] = useState(dateFrom)
  const [tempTo, setTempTo] = useState(dateTo)
  const popoverRef = useRef(null)

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Sync temp dates
  useEffect(() => {
    setTempFrom(dateFrom)
    setTempTo(dateTo)
  }, [dateFrom, dateTo])

  const activePreset = PRESETS.find((p) => p.key === period)
  const displayLabel = activePreset
    ? activePreset.label
    : period === 'custom' && dateFrom && dateTo
      ? `${formatDateShort(dateFrom)} - ${formatDateShort(dateTo)}`
      : 'Özel Aralık'

  const dateSubLabel =
    dateRangeMeta?.rangeStart && dateRangeMeta?.rangeEnd
      ? `${formatDateShort(dateRangeMeta.rangeStart)} - ${formatDateShort(dateRangeMeta.rangeEnd)}`
      : ''

  const handleSelectPreset = (key) => {
    onChange({ period: key, dateFrom: '', dateTo: '' })
    setIsOpen(false)
  }

  const handleApplyCustom = (e) => {
    e.preventDefault()
    if (!tempFrom || !tempTo) return
    onChange({ period: 'custom', dateFrom: tempFrom, dateTo: tempTo })
    setIsOpen(false)
  }

  return (
    <div className="admin-date-filter-wrap" ref={popoverRef}>
      <button
        type="button"
        className={`admin-date-trigger-btn ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-expanded={isOpen}
        title="Tarih Aralığı Filtresi"
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
          className="admin-date-icon"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        <span className="admin-date-btn-content">
          <strong className="admin-date-btn-main">{displayLabel}</strong>
          {dateSubLabel && <small className="admin-date-btn-sub">{dateSubLabel}</small>}
        </span>

        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`admin-date-chevron ${isOpen ? 'is-flipped' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="admin-date-popover-panel">
          <div className="admin-date-popover-layout">
            {/* Presets Column */}
            <div className="admin-date-presets-col">
              <span className="admin-date-section-tag">Hızlı Dönemler</span>
              <div className="admin-date-presets-list">
                {PRESETS.map((item) => {
                  const isActive = period === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`admin-date-preset-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => handleSelectPreset(item.key)}
                    >
                      <div className="admin-preset-info">
                        <strong>{item.label}</strong>
                        <small>{item.desc}</small>
                      </div>
                      {isActive && <span className="admin-preset-check">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom Range Column */}
            <form className="admin-date-custom-col" onSubmit={handleApplyCustom}>
              <span className="admin-date-section-tag">Özel Tarih Aralığı</span>
              <div className="admin-date-inputs-wrap">
                <label className="admin-date-field">
                  <span>Başlangıç Tarihi</span>
                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    max={tempTo || undefined}
                    required
                  />
                </label>

                <label className="admin-date-field">
                  <span>Bitiş Tarihi</span>
                  <input
                    type="date"
                    value={tempTo}
                    onChange={(e) => setTempTo(e.target.value)}
                    min={tempFrom || undefined}
                    required
                  />
                </label>
              </div>

              <div className="admin-date-custom-actions">
                <button
                  type="button"
                  className="admin-date-cancel-btn"
                  onClick={() => setIsOpen(false)}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="admin-date-apply-btn"
                  disabled={!tempFrom || !tempTo}
                >
                  Uygula
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
