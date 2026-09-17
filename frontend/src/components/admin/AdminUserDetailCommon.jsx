import { useState } from 'react'
import { formatRelativeTime } from '../../utils/social.js'

export function calculateAge(birthDate) {
  if (!birthDate) return null
  const dob = new Date(birthDate)
  if (isNaN(dob.getTime())) return null
  const diffMs = Date.now() - dob.getTime()
  const ageDt = new Date(diffMs)
  return Math.abs(ageDt.getUTCFullYear() - 1970)
}

export function calculateAccountTenure(createdAt) {
  if (!createdAt) return 'Bilinmiyor'
  const created = new Date(createdAt)
  if (isNaN(created.getTime())) return 'Bilinmiyor'
  const now = new Date()
  const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24))
  if (diffDays < 1) return 'Bugün Katıldı'
  if (diffDays < 30) return `${diffDays} Günlük Üye`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} Aylık Üye`
  const diffYears = Math.floor(diffMonths / 12)
  const remMonths = diffMonths % 12
  return remMonths > 0 ? `${diffYears} Yıl ${remMonths} Ay` : `${diffYears} Yıllık Üye`
}

export function parseUserAgent(ua) {
  if (!ua || typeof ua !== 'string') {
    return { browser: 'Bilinmiyor', os: 'Bilinmiyor', device: 'Masaüstü/Mobil', icon: '💻' }
  }

  let browser = 'Bilinmeyen Tarayıcı'
  let os = 'Bilinmeyen İşletim Sistemi'
  let icon = '💻'

  // OS Detection
  if (/windows/i.test(ua)) {
    os = 'Windows'
    icon = '🪟'
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS'
    icon = '🍎'
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS'
    icon = '📱'
  } else if (/android/i.test(ua)) {
    os = 'Android'
    icon = '🤖'
  } else if (/linux/i.test(ua)) {
    os = 'Linux'
    icon = '🐧'
  }

  // Browser Detection
  if (/edg/i.test(ua)) {
    browser = 'Microsoft Edge'
  } else if (/chrome|crios/i.test(ua) && !/opr|opera/i.test(ua)) {
    browser = 'Google Chrome'
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Mozilla Firefox'
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = 'Apple Safari'
  } else if (/opr|opera/i.test(ua)) {
    browser = 'Opera'
  }

  const isMobile = /iphone|ipad|android|mobile/i.test(ua)
  return {
    browser,
    os,
    device: isMobile ? 'Mobil Cihaz' : 'Masaüstü Bilgisayar',
    icon,
  }
}

export function calculateTrustScore(user = {}, consent = {}) {
  let score = 35
  if (user.accountStatus === 'active') score += 15
  if (user.accountStatus === 'suspended') score -= 35
  if (user.emailVerifiedAt) score += 20
  if (user.avatarUrl) score += 10
  if (user.bio && user.bio.trim().length > 5) score += 5
  if (user.verification?.status === 'approved') score += 15
  if (consent.acceptedAt) score += 10
  if (user.birthDate) score += 5

  score = Math.max(5, Math.min(100, score))

  let tone = 'emerald'
  let label = 'Yüksek Güvenilirlik'
  if (score < 45) {
    tone = 'rose'
    label = 'Düşük Güvenilirlik / İnceleme Gerekli'
  } else if (score < 75) {
    tone = 'amber'
    label = 'Orta Düzey Güvenilirlik'
  }

  return { score, tone, label }
}

export function formatBrowserLanguage(langHeader) {
  if (!langHeader || typeof langHeader !== 'string') return 'Belirtilmemiş'
  
  const primaryLang = langHeader.split(',')[0].split(';')[0].trim()
  if (!primaryLang) return 'Belirtilmemiş'

  try {
    const displayNames = new Intl.DisplayNames(['tr'], { type: 'language' })
    const baseCode = primaryLang.split('-')[0]
    const formatted = displayNames.of(primaryLang) || displayNames.of(baseCode)
    if (formatted) {
      const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1)
      return `${capitalized} (${primaryLang})`
    }
  } catch {
    // Fallback if Intl is unavailable
  }

  const map = {
    tr: 'Türkçe',
    'tr-tr': 'Türkçe (TR)',
    en: 'İngilizce',
    'en-us': 'İngilizce (ABD)',
    'en-gb': 'İngilizce (İngiltere)',
    de: 'Almanca',
    es: 'İspanyolca',
    fr: 'Fransızca',
    ru: 'Rusça',
    ar: 'Arapça',
    it: 'İtalyanca',
  }

  const found = map[primaryLang.toLowerCase()] || map[primaryLang.split('-')[0].toLowerCase()]
  return found ? `${found} (${primaryLang})` : primaryLang
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatCallDuration(sec = 0) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function CopyButton({ text, label = 'Kopyala' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e) => {
    e.stopPropagation()
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Kopyalandı!' : label}
      className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 active:scale-95 cursor-pointer"
    >
      {copied ? (
        <>
          <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-700">Kopyalandı</span>
        </>
      ) : (
        <>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  )
}

export function StatusBadge({ type, value }) {
  if (type === 'status') {
    const isSuspended = value === 'suspended'
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          isSuspended
            ? 'border border-rose-200 bg-rose-50 text-rose-700'
            : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${isSuspended ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
        {isSuspended ? 'Hesap Askıda' : 'Aktif Hesap'}
      </span>
    )
  }

  if (type === 'role') {
    const map = {
      admin: { label: 'Yönetici (Admin)', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
      moderator: { label: 'Moderatör', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
      user: { label: 'Standart Üye', bg: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
    }
    const current = map[value] || map.user
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${current.bg}`}>
        {current.label}
      </span>
    )
  }

  if (type === 'verification') {
    const isApproved = value === 'approved'
    const isPending = value === 'pending' || value === 'in_review'
    const isRevoked = value === 'revoked'
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          isApproved
            ? 'border-sky-200 bg-sky-50 text-sky-700'
            : isPending
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : isRevoked
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600'
        }`}
      >
        {isApproved && '🔷 Doğrulanmış Profil'}
        {isPending && '⏳ Doğrulama Bekliyor'}
        {isRevoked && '🚫 Doğrulama İptal'}
        {!isApproved && !isPending && !isRevoked && '⚪ Doğrulanmamış'}
      </span>
    )
  }

  return null
}

export function SectionCard({ title, eyebrow, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">{eyebrow}</p>
          ) : null}
          <h3 className="text-base font-bold text-zinc-950">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function StatCard({ label, value, subtext, icon }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 transition-all hover:bg-zinc-50">
      {icon ? (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-zinc-500">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-zinc-950">{value}</p>
        {subtext ? <p className="mt-0.5 text-[11px] text-zinc-400">{subtext}</p> : null}
      </div>
    </div>
  )
}

export function DetailRow({ label, value, copyValue, isBadge = false, isDate = false, isRelative = false, fullWidth = false }) {
  let displayValue = value
  if (isDate && value) {
    displayValue = new Date(value).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } else if (isRelative && value) {
    displayValue = `${formatRelativeTime(value)} (${new Date(value).toLocaleDateString('tr-TR')})`
  }

  return (
    <div className={`flex flex-col justify-between rounded-xl bg-zinc-50/80 p-3.5 sm:flex-row sm:items-center ${fullWidth ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-semibold text-zinc-500">{label}</span>
      <div className="mt-1 flex items-center gap-2 sm:mt-0">
        <span className={`text-sm font-medium ${isBadge ? 'text-zinc-900' : 'text-zinc-800'}`}>
          {displayValue || '—'}
        </span>
        {copyValue ? <CopyButton text={copyValue} /> : null}
      </div>
    </div>
  )
}

export function getOtherParticipant(conv, currentUserId) {
  if (!conv || !conv.participantIds || !conv.participantIds.length) return null
  const other = conv.participantIds.find((p) => {
    const pId = typeof p === 'object' && p !== null ? p._id : p
    return String(pId) !== String(currentUserId)
  })
  if (typeof other === 'object' && other !== null) {
    return other
  }
  return { _id: other || 'unknown', firstName: 'Kullanıcı', lastName: '', username: 'user' }
}
