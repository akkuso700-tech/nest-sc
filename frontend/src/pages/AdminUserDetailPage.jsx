import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ConfirmActionDialog from '../components/feedback/ConfirmActionDialog.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import AudioMessagePlayer from '../components/media/AudioMessagePlayer.jsx'
import { resolveMediaUrl } from '../utils/media.js'
import { formatLocation, formatRelativeTime, getFullName } from '../utils/social.js'
import {
  deleteAdminConversation,
  deleteAdminMessage,
  getAdminUserDetail,
  revokeAdminUserVerification,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '../services/adminService.js'

function calculateAge(birthDate) {
  if (!birthDate) return null
  const dob = new Date(birthDate)
  if (isNaN(dob.getTime())) return null
  const diffMs = Date.now() - dob.getTime()
  const ageDt = new Date(diffMs)
  return Math.abs(ageDt.getUTCFullYear() - 1970)
}

function calculateAccountTenure(createdAt) {
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

function parseUserAgent(ua) {
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

function calculateTrustScore(user = {}, consent = {}) {
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

function formatBrowserLanguage(langHeader) {
  if (!langHeader || typeof langHeader !== 'string') return 'Belirtilmemiş'
  
  const primaryLang = langHeader.split(',')[0].split(';')[0].trim()
  if (!primaryLang) return 'Belirtilmemiş'

  try {
    const displayNames = new Intl.DisplayNames(['tr'], { type: 'language' })
    const baseCode = primaryLang.split('-')[0]
    const formatted = displayNames.of(primaryLang) || displayNames.of(baseCode)
    if (formatted) {
      // Capitalize first letter e.g. "türkçe" -> "Türkçe"
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

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatCallDuration(sec = 0) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function CopyButton({ text, label = 'Kopyala' }) {
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
      className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 active:scale-95"
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

function StatusBadge({ type, value }) {
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
        {isApproved && '🔷 Doğrulanmış (Mavi Tik)'}
        {isPending && '⏳ Doğrulama Bekliyor'}
        {isRevoked && '🚫 Mavi Tik İptal'}
        {!isApproved && !isPending && !isRevoked && '⚪ Doğrulanmamış'}
      </span>
    )
  }

  return null
}

function SectionCard({ title, eyebrow, subtitle, action, children, className = '' }) {
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

function StatCard({ label, value, subtext, icon }) {
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

function DetailRow({ label, value, copyValue, isBadge = false, isDate = false, isRelative = false, fullWidth = false }) {
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

function getOtherParticipant(conv, currentUserId) {
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

function AdminUserDetailPage() {
  const { lang = 'tr', userId } = useParams()
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: '',
  })
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedRole, setSelectedRole] = useState('user')
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const [statusDialog, setStatusDialog] = useState(null)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false)
  const [isSavingVerification, setIsSavingVerification] = useState(false)

  // Chat & Messages Inspector State
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [conversationSearch, setConversationSearch] = useState('')
  const [chatFilter, setChatFilter] = useState('all') // 'all' | 'media' | 'deleted'
  const [chatSubTab, setChatSubTab] = useState('stream') // 'stream' | 'media' | 'calls'
  const [messageSearch, setMessageSearch] = useState('')
  const [previewMedia, setPreviewMedia] = useState(null)
  const [videoModalRecording, setVideoModalRecording] = useState(null)

  // Chat & Message Delete State
  const [conversationToDelete, setConversationToDelete] = useState(null)
  const [isDeletingChat, setIsDeletingChat] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState(null)
  const [isDeletingMsg, setIsDeletingMsg] = useState(false)

  useEffect(() => {
    if (!toast.message) return undefined
    const timer = window.setTimeout(() => setToast({ message: '', tone: 'success' }), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const loadUserDetail = async () => {
    setState((curr) => ({ ...curr, isLoading: true, error: '' }))
    try {
      const payload = await getAdminUserDetail(userId)
      setSelectedRole(payload.user.role || 'user')
      if (payload.conversations?.length && !selectedConversationId) {
        setSelectedConversationId(payload.conversations[0]._id)
      }
      setState({
        data: payload,
        isLoading: false,
        error: '',
      })
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error.message || 'Kullanıcı detayları yüklenemedi.',
      })
    }
  }

  useEffect(() => {
    loadUserDetail()
  }, [userId])

  async function handleRoleUpdate() {
    if (!state.data?.user || selectedRole === state.data.user.role) return
    setIsSavingRole(true)
    try {
      const payload = await updateAdminUserRole(userId, selectedRole)
      setState((currentState) => ({
        ...currentState,
        data: {
          ...currentState.data,
          user: payload.user,
        },
      }))
      setToast({ message: 'Kullanıcı rolü başarıyla güncellendi.', tone: 'success' })
    } catch (error) {
      setToast({ message: error.message || 'Rol güncellenemedi.', tone: 'error' })
    } finally {
      setIsSavingRole(false)
    }
  }

  function handleStatusUpdate(nextStatus) {
    if (!state.data?.user || nextStatus === state.data.user.accountStatus) return
    setStatusDialog({
      nextStatus,
      title: nextStatus === 'suspended' ? 'Kullanıcıyı Askıya Al' : 'Kullanıcıyı Yeniden Aktif Et',
      description:
        nextStatus === 'suspended'
          ? 'Bu işlem hesabın platforma giriş yapmasını, akışta görünmesini ve mesajlaşmasını derhal engeller.'
          : 'Hesabın askı durumu kaldırılacak ve platform erişimi yeniden açılacaktır.',
    })
  }

  async function confirmStatusUpdate(reason) {
    if (!statusDialog) return
    setIsSavingStatus(true)
    try {
      const payload = await updateAdminUserStatus(userId, {
        accountStatus: statusDialog.nextStatus,
        reason,
      })
      setState((currentState) => ({
        ...currentState,
        data: {
          ...currentState.data,
          user: payload.user,
        },
      }))
      setToast({ message: payload.message || 'Hesap durumu güncellendi.', tone: 'success' })
      setStatusDialog(null)
    } catch (error) {
      setToast({ message: error.message || 'Hesap durumu güncellenemedi.', tone: 'error' })
    } finally {
      setIsSavingStatus(false)
    }
  }

  async function confirmVerificationRevoke(reason) {
    if (!reason || reason.trim().length < 3) {
      setToast({ message: 'Lütfen geçerli bir iptal gerekçesi belirtin.', tone: 'error' })
      return
    }
    setIsSavingVerification(true)
    try {
      const payload = await revokeAdminUserVerification(userId, reason)
      setState((current) => ({
        ...current,
        data: { ...current.data, user: payload.user },
      }))
      setToast({ message: payload.message || 'Mavi tik başarıyla kaldırıldı.', tone: 'success' })
      setVerificationDialogOpen(false)
    } catch (error) {
      setToast({ message: error.message || 'Mavi tik kaldırılamadı.', tone: 'error' })
    } finally {
      setIsSavingVerification(false)
    }
  }

  async function confirmDeleteConversation(reason) {
    if (!conversationToDelete) return
    setIsDeletingChat(true)
    try {
      await deleteAdminConversation(conversationToDelete.conversationId, reason)
      setState((prev) => {
        if (!prev.data) return prev
        const updatedConversations = (prev.data.conversations || []).filter(
          (c) => String(c._id) !== String(conversationToDelete.conversationId)
        )
        const updatedMessages = (prev.data.messages || []).filter((m) => {
          const convId = typeof m.conversation === 'object' ? m.conversation?._id : m.conversation
          return String(convId) !== String(conversationToDelete.conversationId)
        })
        return {
          ...prev,
          data: {
            ...prev.data,
            conversations: updatedConversations,
            messages: updatedMessages,
          },
        }
      })
      setSelectedConversationId(null)
      setConversationToDelete(null)
      setToast({ message: 'Sohbet ve tüm mesajları veritabanından kalıcı olarak silindi.', tone: 'success' })
    } catch (err) {
      setToast({ message: err.message || 'Sohbet silinemedi.', tone: 'error' })
    } finally {
      setIsDeletingChat(false)
    }
  }

  async function confirmDeleteMessage(reason) {
    if (!messageToDelete) return
    setIsDeletingMsg(true)
    try {
      await deleteAdminMessage(messageToDelete.messageId, reason)
      setState((prev) => {
        if (!prev.data) return prev
        const updatedMessages = (prev.data.messages || []).filter(
          (m) => String(m._id) !== String(messageToDelete.messageId)
        )
        return {
          ...prev,
          data: {
            ...prev.data,
            messages: updatedMessages,
          },
        }
      })
      setMessageToDelete(null)
      setToast({ message: 'Mesaj kalıcı olarak silindi.', tone: 'success' })
    } catch (err) {
      setToast({ message: err.message || 'Mesaj silinemedi.', tone: 'error' })
    } finally {
      setIsDeletingMsg(false)
    }
  }

  if (state.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-36 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-64 animate-pulse rounded-3xl border border-zinc-200 bg-white" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-3xl bg-zinc-100" />
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-zinc-950">Kullanıcı Bilgileri Yüklenemedi</h3>
        <p className="mt-1 text-sm text-zinc-600">{state.error}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to={`/${lang}/admin/users`}
            className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Kullanıcı Listesine Dön
          </Link>
          <button
            type="button"
            onClick={loadUserDetail}
            className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    )
  }

  const { user, posts = [], conversations = [], messages = [], locationLogs = [], callLogs = [] } = state.data
  const activity = user.activity || {}
  const discovery = user.discovery || {}
  const consent = user.signupConsent || {}
  const userAge = calculateAge(user.birthDate)
  const tenure = calculateAccountTenure(user.createdAt)
  const trustInfo = calculateTrustScore(user, consent)
  const uaInfo = parseUserAgent(consent.userAgent)

  // Calculate engagement total for distribution bar
  const totalEngagements =
    (activity.viewedProfileIds?.length || 0) +
    (activity.likedPostIds?.length || 0) +
    (activity.commentedPostIds?.length || 0) +
    (activity.savedPostIds?.length || 0) +
    (activity.sharedPostIds?.length || 0)

  const tabs = [
    { id: 'overview', label: 'Genel Bakış', count: null },
    { id: 'posts', label: 'Gönderiler & Medya', count: posts.length },
    { id: 'messages', label: 'Sohbet & Mesajlar', count: messages.length },
    { id: 'location', label: 'Konum & Keşif', count: locationLogs.length },
    { id: 'security', label: 'Güvenlik & Moderasyon', count: null },
  ]

  const handleCopyUserDataJson = () => {
    try {
      const exportData = {
        id: user._id,
        username: user.username,
        name: getFullName(user),
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        location: user.location,
        signupConsent: user.signupConsent,
        postsCount: posts.length,
        friendsCount: user.friendIds?.length || 0,
      }
      navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
      setToast({ message: 'Kullanıcı verisi JSON olarak panoya kopyalandı.', tone: 'success' })
    } catch {
      setToast({ message: 'JSON kopyalanamadı.', tone: 'error' })
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/${lang}/admin/users`}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kullanıcılar Listesine Dön
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/${lang}/admin/audit-logs?userId=${user._id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Denetim Günlükleri</span>
            </Link>

            <button
              type="button"
              onClick={handleCopyUserDataJson}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>JSON Kopyala</span>
            </button>

            <a
              href={`/${lang}/profile/${encodeURIComponent(user.username)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-950 bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800"
            >
              <span>Ön Yüzde Profili Gör</span>
              <svg className="h-3.5 w-3.5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* Hero Identity Header Card */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
          {/* Cover Header */}
          <div className="relative h-44 w-full overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-zinc-900">
            {user.coverUrl ? (
              <img
                src={resolveMediaUrl(user.coverUrl)}
                alt="Cover"
                className="h-full w-full object-cover opacity-60 mix-blend-overlay"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>

          {/* User Info Bar */}
          <div className="relative px-6 pb-6 pt-0">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              {/* Avatar & Identifiers */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-16 sm:-mt-20">
                <div className="relative inline-block rounded-full p-1.5 bg-white shadow-lg">
                  <UserAvatar
                    user={user}
                    className="h-28 w-28 sm:h-32 sm:w-32 border border-zinc-200 text-3xl font-bold"
                  />
                  {user.accountStatus === 'suspended' ? (
                    <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-rose-600 text-white shadow" title="Askıda">
                      ✕
                    </span>
                  ) : null}
                </div>

                <div className="pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
                      {getFullName(user)}
                    </h1>
                    <VerifiedBadge
                      user={{ verification: { isVerified: user.verification?.status === 'approved' } }}
                      size="md"
                    />
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                    <span className="font-semibold text-zinc-800">@{user.username}</span>
                    <span>•</span>
                    <span className="font-mono text-xs text-zinc-400">ID: {user._id}</span>
                    <CopyButton text={user._id} label="ID Kopyala" />
                  </div>

                  {/* Status Badges Row */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge type="status" value={user.accountStatus} />
                    <StatusBadge type="role" value={user.role} />
                    <StatusBadge type="verification" value={user.verification?.status} />
                    
                    {/* Account Tenure Badge */}
                    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                      <span>⏳</span>
                      <span>{tenure}</span>
                    </span>

                    {/* Trust Score Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        trustInfo.tone === 'emerald'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : trustInfo.tone === 'amber'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                      title={trustInfo.label}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      <span>Güven: %{trustInfo.score}</span>
                    </span>

                    {user.isPrivate ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                        🔒 Gizli Hesap
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                        🌐 Herkese Açık
                      </span>
                    )}

                    {user.authProvider === 'google' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        Google OAuth
                      </span>
                    ) : null}

                    {user.emailVerifiedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        ✓ E-posta Onaylı
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        ! E-posta Onaysız
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Operations Toolbar */}
              <div className="flex flex-wrap items-center gap-3 pt-4 md:pt-0">
                {/* Role Changer Dropdown */}
                <div className="flex items-center rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="rounded-xl border-0 bg-transparent px-3 py-1.5 text-xs font-semibold text-zinc-800 outline-none"
                  >
                    <option value="user">Kullanıcı</option>
                    <option value="moderator">Moderatör</option>
                    <option value="admin">Yönetici (Admin)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleRoleUpdate}
                    disabled={isSavingRole || selectedRole === user.role}
                    className="rounded-xl bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {isSavingRole ? 'Kaydediliyor...' : 'Rolü Kaydet'}
                  </button>
                </div>

                {/* Status Switcher Button */}
                {user.accountStatus === 'active' ? (
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('suspended')}
                    disabled={isSavingStatus}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Hesabı Askıya Al
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate('active')}
                    disabled={isSavingStatus}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Hesabı Aktifleştir
                  </button>
                )}

                {/* Verification Action */}
                {user.verification?.status === 'approved' ? (
                  <button
                    type="button"
                    onClick={() => setVerificationDialogOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Mavi Tiki Kaldır
                  </button>
                ) : (
                  <Link
                    to={`/${lang}/admin/verification-requests?q=${encodeURIComponent(user.username)}`}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                  >
                    Başvuruları İncele
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Quick KPI Stat Ribbon */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Gönderi & Medya"
            value={posts.length}
            subtext="Toplam paylaşılan"
            icon={
              <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <StatCard
            label="Beğenilen İçerik"
            value={activity.likedPostIds?.length || 0}
            subtext="Beğendiği gönderi"
            icon={
              <svg className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            }
          />
          <StatCard
            label="Yorum Sayısı"
            value={activity.commentedPostIds?.length || 0}
            subtext="Yorum yapılan"
            icon={
              <svg className="h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
          />
          <StatCard
            label="Arkadaş Sayısı"
            value={user.friendIds?.length || 0}
            subtext="Karşılıklı bağlantı"
            icon={
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <StatCard
            label="Mesajlaşma Kaydı"
            value={messages.length}
            subtext={`${conversations.length} farklı sohbet`}
            icon={
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            }
          />
          <StatCard
            label="Görüşme Kayıtları"
            value={callLogs.length}
            subtext={`${callLogs.filter((c) => c.callType === 'video').length} Video · ${callLogs.filter((c) => c.callType === 'voice').length} Sesli`}
            icon={
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
          />
        </section>

        {/* Tab Navigation Menu */}
        <div className="flex overflow-x-auto border-b border-zinc-200 pb-px scrollbar-none">
          <nav className="flex space-x-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-t-2xl border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'border-zinc-950 bg-white text-zinc-950 shadow-sm'
                      : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== null ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isActive ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab 1: Overview (Genel Bakış) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Account Lifecycle & Milestone Pipeline */}
            <section className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">Yaşam Döngüsü</p>
                  <h3 className="text-base font-bold text-zinc-950">Hesap Gelişim & Denetim Çizelgesi</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    Durum: {user.accountStatus === 'active' ? 'Aktif Üye' : 'Askıda'}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {/* Step 1: Kayıt */}
                <div className="relative flex flex-col justify-between rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 transition-all hover:bg-emerald-50/70">
                  <div className="flex items-center justify-between">
                    <span className="text-lg">📝</span>
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">✓ Tamam</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-900">Hesap Oluşturuldu</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-emerald-700">
                      {consent.acceptedAt ? 'KVKK Onaylı Kayıt' : 'Standart Kayıt'}
                    </p>
                  </div>
                </div>

                {/* Step 2: E-posta */}
                <div
                  className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                    user.emailVerifiedAt
                      ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                      : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">✉️</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        user.emailVerifiedAt ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                      }`}
                    >
                      {user.emailVerifiedAt ? '✓ Onaylı' : 'Bekliyor'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-900">E-posta Doğrulama</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500" title={user.email}>
                      {user.email}
                    </p>
                    <p
                      className={`mt-1 text-[10px] font-medium ${
                        user.emailVerifiedAt ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {user.emailVerifiedAt
                        ? `Onay: ${new Date(user.emailVerifiedAt).toLocaleDateString('tr-TR')}`
                        : 'Aktivasyon Linki Bekliyor'}
                    </p>
                  </div>
                </div>

                {/* Step 3: Gönderi Paylaşımı */}
                <div
                  className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                    posts.length > 0
                      ? 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70'
                      : 'border-zinc-200 bg-zinc-50/60 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">📸</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        posts.length > 0 ? 'bg-indigo-600 text-white' : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {posts.length > 0 ? `${posts.length} Gönderi` : '0 İçerik'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-900">İçerik Üretimi</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {posts.length > 0 ? `Son: ${formatRelativeTime(posts[0].createdAt)}` : 'Henüz Paylaşım Yok'}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-zinc-600">
                      {activity.likedPostIds?.length || 0} Beğeni / {activity.commentedPostIds?.length || 0} Yorum
                    </p>
                  </div>
                </div>

                {/* Step 4: Kimlik Doğrulama / Rozet */}
                <div
                  className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                    user.verification?.status === 'approved'
                      ? 'border-sky-200 bg-sky-50/40 hover:bg-sky-50/70'
                      : user.verification?.status === 'pending'
                      ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                      : 'border-zinc-200 bg-zinc-50/60 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">🔷</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        user.verification?.status === 'approved'
                          ? 'bg-sky-600 text-white'
                          : user.verification?.status === 'pending'
                          ? 'bg-amber-500 text-white'
                          : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {user.verification?.status === 'approved'
                        ? 'Mavi Tik'
                        : user.verification?.status === 'pending'
                        ? 'İncelemede'
                        : 'Standart'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-900">Doğrulama & Rozet</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {user.verification?.status === 'approved'
                        ? 'Doğrulanmış Profil'
                        : user.verification?.status === 'pending'
                        ? 'Başvuru Değerlendiriliyor'
                        : 'Başvuru Yok'}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-zinc-600">
                      Rol: {user.role === 'admin' ? 'Admin' : user.role === 'moderator' ? 'Moderatör' : 'Kullanıcı'}
                    </p>
                  </div>
                </div>

                {/* Step 5: Son Platform Aktivitesi */}
                <div
                  className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                    user.accountStatus === 'suspended'
                      ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/70'
                      : 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">⚡</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        user.accountStatus === 'suspended' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {user.accountStatus === 'suspended' ? 'Askıda' : 'Aktif'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-900">Son Aktivite</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'Giriş Kaydı Yok'}
                    </p>
                    <p
                      className={`mt-1 text-[10px] font-medium ${
                        user.accountStatus === 'suspended' ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {user.accountStatus === 'suspended' ? 'Erişim Engellendi' : 'Oturum Açabilir'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Main 2-Column Grid: Profile Details & System Insights */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Card 1: Enhanced Profile Details */}
              <SectionCard
                title="Profil & Temel Kimlik Bilgileri"
                eyebrow="Hesap Özeti"
                subtitle="Kullanıcının beyan ettiği ve sisteme kayıtlı veriler"
                action={
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                    ID: {user._id?.slice(-8)}
                  </span>
                }
              >
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="E-posta Adresi" value={user.email} copyValue={user.email} fullWidth />
                    <DetailRow
                      label="Doğum Tarihi & Yaş"
                      value={
                        user.birthDate
                          ? `${new Date(user.birthDate).toLocaleDateString('tr-TR')}${userAge ? ` (${userAge} Yaş)` : ''}`
                          : 'Belirtilmemiş'
                      }
                    />
                    <DetailRow label="Konum / Şehir" value={formatLocation(user.location)} />
                    <DetailRow label="Kayıt Tarihi" value={user.createdAt} isDate />
                    <DetailRow label="Son Giriş Zamanı" value={user.lastLoginAt} isRelative />
                    <DetailRow label="Profil Gizliliği" value={user.isPrivate ? 'Gizli Profil 🔒' : 'Herkese Açık 🌐'} />
                    <DetailRow
                      label="Giriş Sağlayıcı"
                      value={user.authProvider === 'google' ? 'Google OAuth 2.0' : 'Standart E-posta & Şifre'}
                    />
                  </div>

                  {/* Bio Callout Block */}
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Biyografi</span>
                      {user.bio ? <CopyButton text={user.bio} label="Metni Kopyala" /> : null}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-800">
                      {user.bio || <span className="italic text-zinc-400">Kullanıcı henüz bir biyografi metni girmedi.</span>}
                    </p>
                  </div>
                </div>
              </SectionCard>

              {/* Card 2: Smart System, Device & Legal KVKK Audit */}
              <SectionCard
                title="Sistem, Cihaz & KVKK Denetimi"
                eyebrow="Hukuki & Teknik"
                subtitle="Kayıt esnasındaki teknik cihaz ayak izi ve yasal onaylar"
              >
                {consent.acceptedAt ? (
                  <div className="space-y-4">
                    {/* Device & OS Highlight Tile */}
                    <div className="flex items-center gap-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
                        {uaInfo.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-indigo-950">{uaInfo.os}</span>
                          <span>•</span>
                          <span className="text-xs font-semibold text-indigo-800">{uaInfo.browser}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-indigo-600/80">{uaInfo.device} üzerinden kayıt yapıldı</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow-xs">
                        {consent.version || 'v1.0'}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailRow label="Kayıt IP Adresi" value={consent.ipAddress} copyValue={consent.ipAddress} />
                      <DetailRow
                        label="Kayıt Şehri / Ülkesi"
                        value={
                          consent.city || consent.country
                            ? `${consent.city || 'Şehir Yok'} / ${consent.country || 'Ülke Yok'}`
                            : user.location?.city || user.location?.country
                            ? `${user.location?.city || 'Şehir Yok'} / ${user.location?.country || 'Ülke Yok'} (Profil Konumu)`
                            : 'Tespit Edilemedi'
                        }
                      />
                      <DetailRow label="KVKK Onay Zamanı" value={consent.acceptedAt} isDate />
                      <DetailRow
                        label="Tarayıcı Dili"
                        value={formatBrowserLanguage(consent.browserLanguage || consent.language || 'tr')}
                      />
                    </div>

                    {/* Raw User Agent Box */}
                    <div className="rounded-2xl bg-zinc-50 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Ham User-Agent</span>
                        {consent.userAgent ? <CopyButton text={consent.userAgent} label="UA Kopyala" /> : null}
                      </div>
                      <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-zinc-600">
                        {consent.userAgent || 'Belirtilmemiş'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
                    Bu kullanıcı için detaylı kayıt onay ve cihaz logu bulunmuyor.
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Bottom 2-Column Grid: Analytics & Social Graph */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Card 3: Engagement & Behavioral Analytics */}
              <SectionCard
                title="Kullanıcı Etkileşim Dağılımı"
                eyebrow="Aktivite Analitiği"
                subtitle="Kullanıcının platformdaki toplam içerik ve etkileşim profili"
              >
                <div className="space-y-5">
                  {/* 5 Metric Badges */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-3 text-center">
                      <p className="text-[11px] font-semibold text-zinc-500">İncelenen Profil</p>
                      <p className="mt-1 text-xl font-bold text-zinc-950">{activity.viewedProfileIds?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3 text-center">
                      <p className="text-[11px] font-semibold text-rose-600">Beğenilen</p>
                      <p className="mt-1 text-xl font-bold text-rose-700">{activity.likedPostIds?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3 text-center">
                      <p className="text-[11px] font-semibold text-sky-600">Yorum</p>
                      <p className="mt-1 text-xl font-bold text-sky-700">{activity.commentedPostIds?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3 text-center">
                      <p className="text-[11px] font-semibold text-amber-600">Kaydedilen</p>
                      <p className="mt-1 text-xl font-bold text-amber-700">{activity.savedPostIds?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 text-center col-span-2 sm:col-span-1">
                      <p className="text-[11px] font-semibold text-emerald-600">Paylaşılan</p>
                      <p className="mt-1 text-xl font-bold text-emerald-700">{activity.sharedPostIds?.length || 0}</p>
                    </div>
                  </div>

                  {/* Visual Distribution Bar */}
                  {totalEngagements > 0 ? (
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 mb-2">
                        <span>Etkileşim Yoğunluk Oranı</span>
                        <span className="text-zinc-900">{totalEngagements} Toplam Aksiyon</span>
                      </div>
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          style={{ width: `${((activity.likedPostIds?.length || 0) / totalEngagements) * 100}%` }}
                          className="bg-rose-500 transition-all"
                          title={`Beğeniler: ${activity.likedPostIds?.length || 0}`}
                        />
                        <div
                          style={{ width: `${((activity.commentedPostIds?.length || 0) / totalEngagements) * 100}%` }}
                          className="bg-sky-500 transition-all"
                          title={`Yorumlar: ${activity.commentedPostIds?.length || 0}`}
                        />
                        <div
                          style={{ width: `${((activity.savedPostIds?.length || 0) / totalEngagements) * 100}%` }}
                          className="bg-amber-500 transition-all"
                          title={`Kayıtlar: ${activity.savedPostIds?.length || 0}`}
                        />
                        <div
                          style={{ width: `${((activity.viewedProfileIds?.length || 0) / totalEngagements) * 100}%` }}
                          className="bg-indigo-500 transition-all"
                          title={`Profil Gezinme: ${activity.viewedProfileIds?.length || 0}`}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-rose-500" /> Beğeni
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-sky-500" /> Yorum
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-500" /> Kaydetme
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-indigo-500" /> Profil İnceleme
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Topic Interests & Recent Searches */}
                  {discovery.interestProfile?.topicScores && Object.keys(discovery.interestProfile.topicScores).length > 0 ? (
                    <div className="border-t border-zinc-100 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
                        Öne Çıkan İlgi Alanları
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(discovery.interestProfile.topicScores)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 8)
                          .map(([topic, score]) => (
                            <span
                              key={topic}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-xs font-semibold text-indigo-900"
                            >
                              <span>#{topic}</span>
                              <span className="rounded-md bg-indigo-200/80 px-1.5 py-0.2 text-[10px] text-indigo-950 font-bold">
                                {score}
                              </span>
                            </span>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {activity.recentSearches?.length ? (
                    <div className="border-t border-zinc-100 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">Son Arama Geçmişi</p>
                      <div className="flex flex-wrap gap-2">
                        {activity.recentSearches.map((search, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
                          >
                            <span>🔍</span>
                            <span>{search.query}</span>
                            <span className="text-[10px] text-zinc-400">
                              {formatRelativeTime(search.searchedAt)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              {/* Card 4: Social Network & Graph Preview */}
              <SectionCard
                title="Sosyal Çevre & Bağlantı Ekosistemi"
                eyebrow="Ağ Grafiği"
                subtitle="Kullanıcının arkadaşları ve etkileşime geçtiği profiller"
              >
                <div className="space-y-5">
                  {/* Friends List Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Karşılıklı Arkadaşlar ({user.friendIds?.length || 0})
                      </span>
                    </div>

                    {user.friendIds && user.friendIds.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {user.friendIds.slice(0, 6).map((friend) => {
                          const fId = typeof friend === 'object' ? friend._id : friend
                          const fName = typeof friend === 'object' ? getFullName(friend) : 'Kullanıcı'
                          const fUsername = typeof friend === 'object' ? friend.username : ''

                          return (
                            <Link
                              key={fId}
                              to={`/${lang}/admin/users/${fId}`}
                              className="group flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-2.5 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-xs"
                            >
                              <UserAvatar
                                user={typeof friend === 'object' ? friend : {}}
                                className="h-9 w-9 text-xs font-bold shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-zinc-900 group-hover:text-indigo-600">
                                  {fName}
                                </p>
                                <p className="truncate text-[11px] text-zinc-400">@{fUsername}</p>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-500">
                        Kullanıcının kayıtlı arkadaş bağlantısı bulunmuyor.
                      </div>
                    )}
                  </div>

                  {/* Recently Viewed Profiles */}
                  {activity.viewedProfileIds && activity.viewedProfileIds.length > 0 ? (
                    <div className="border-t border-zinc-100 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                        Son Ziyaret Edilen Profiller ({activity.viewedProfileIds.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activity.viewedProfileIds.slice(0, 8).map((viewed, idx) => {
                          const vId = typeof viewed === 'object' ? viewed._id : viewed
                          const vUsername = typeof viewed === 'object' ? viewed.username : 'kullanıcı'

                          return (
                            <Link
                              key={idx}
                              to={`/${lang}/admin/users/${vId}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-white"
                            >
                              <span>👤</span>
                              <span>@{vUsername}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Security & Moderation Quick Strip */}
                  <div className="border-t border-zinc-100 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-500">
                      Engellenen Kullanıcı Sayısı: <strong className="text-zinc-800">{user.blockedUserIds?.length || 0}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('security')}
                      className="font-semibold text-indigo-600 hover:underline"
                    >
                      Güvenlik & Moderasyon Detayı →
                    </button>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* Tab 2: Posts & Media */}
        {activeTab === 'posts' && (
          <SectionCard
            title={`Paylaşılan Gönderiler (${posts.length})`}
            eyebrow="İçerik Akışı"
            subtitle="Kullanıcının paylaştığı son 20 gönderi ve medya içerikleri"
            action={
              <Link
                to={`/${lang}/admin/content?author=${encodeURIComponent(user.username)}`}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                İçerik Moderasyonunda Filtrele →
              </Link>
            }
          >
            {posts.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => {
                  const hasMedia = post.media && post.media.length > 0
                  const firstMedia = hasMedia ? post.media[0] : null

                  return (
                    <div
                      key={post._id}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-sm"
                    >
                      <div>
                        {/* Media Preview Box if exists */}
                        {hasMedia && firstMedia ? (
                          <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-xl bg-zinc-900">
                            {firstMedia.type === 'video' ? (
                              <video
                                src={resolveMediaUrl(firstMedia.url)}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                              />
                            ) : (
                              <img
                                src={resolveMediaUrl(firstMedia.url)}
                                alt="Post media"
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                loading="lazy"
                              />
                            )}
                            {post.media.length > 1 ? (
                              <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                                +{post.media.length - 1} Medya
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        <p className="line-clamp-3 text-sm font-medium text-zinc-900">
                          {post.text || <span className="italic text-zinc-400">Yalnızca medya içeren gönderi</span>}
                        </p>
                      </div>

                      <div className="mt-4 border-t border-zinc-100 pt-3">
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>{new Date(post.createdAt).toLocaleDateString('tr-TR')}</span>
                          <div className="flex items-center gap-3 font-semibold">
                            <span className="flex items-center gap-1 text-rose-600">
                              ♥ {post.stats?.likes || 0}
                            </span>
                            <span className="flex items-center gap-1 text-sky-600">
                              💬 {post.stats?.comments || 0}
                            </span>
                          </div>
                        </div>

                        {post.moderation?.status && post.moderation.status !== 'active' ? (
                          <div className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                            Moderasyon: {post.moderation.status}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-500">
                Bu kullanıcı henüz hiç gönderi paylaşmadı.
              </div>
            )}
          </SectionCard>
        )}

        {/* Tab 3: Chat & Messages Inspector */}
        {activeTab === 'messages' && (() => {
          // Filter conversations by search and filter chips
          const filteredConversations = conversations.filter((conv) => {
            const other = getOtherParticipant(conv, user._id)
            const otherName = getFullName(other).toLowerCase()
            const otherUsername = (other?.username || '').toLowerCase()
            const preview = (conv.lastMessagePreview || '').toLowerCase()
            const search = conversationSearch.toLowerCase().trim()

            const matchesSearch = !search || otherName.includes(search) || otherUsername.includes(search) || preview.includes(search)
            if (!matchesSearch) return false

            if (chatFilter === 'media') {
              const hasMedia = messages.some(
                (m) =>
                  String(typeof m.conversation === 'object' ? m.conversation?._id : m.conversation) === String(conv._id) &&
                  m.media &&
                  m.media.length > 0
              )
              return hasMedia
            }

            if (chatFilter === 'deleted') {
              const hasDeleted = messages.some(
                (m) =>
                  String(typeof m.conversation === 'object' ? m.conversation?._id : m.conversation) === String(conv._id) &&
                  m.deletedByUserIds &&
                  m.deletedByUserIds.length > 0
              )
              return hasDeleted
            }

            if (chatFilter === 'calls') {
              const hasCalls = callLogs.some((c) => {
                const cConvId = typeof c.conversation === 'object' ? c.conversation?._id : c.conversation
                if (cConvId && String(cConvId) === String(conv._id)) return true
                const callerId = String(c.caller?._id || c.caller || '')
                const recipientId = String(c.recipient?._id || c.recipient || '')
                const otherId = String(other?._id || '')
                return (
                  (callerId === String(user._id) && recipientId === otherId) ||
                  (callerId === otherId && recipientId === String(user._id))
                )
              })
              return hasCalls
            }

            return true
          })

          // Active Conversation
          const activeConversation = conversations.find((c) => String(c._id) === String(selectedConversationId)) || filteredConversations[0] || null
          const otherParticipant = activeConversation ? getOtherParticipant(activeConversation, user._id) : null

          // Messages for the active conversation
          const activeConversationMessages = activeConversation
            ? messages
                .filter((m) => {
                  const convId = typeof m.conversation === 'object' ? m.conversation?._id : m.conversation
                  if (convId && activeConversation._id) {
                    return String(convId) === String(activeConversation._id)
                  }
                  if (otherParticipant?._id) {
                    const sId = typeof m.sender === 'object' ? m.sender?._id : m.sender
                    const rId = typeof m.recipient === 'object' ? m.recipient?._id : m.recipient
                    const oId = otherParticipant._id
                    return (
                      (String(sId) === String(user._id) && String(rId) === String(oId)) ||
                      (String(sId) === String(oId) && String(rId) === String(user._id))
                    )
                  }
                  return false
                })
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            : []

          // Call logs for the active conversation
          const activeConversationCallLogs = activeConversation
            ? callLogs
                .filter((c) => {
                  const cConvId = typeof c.conversation === 'object' ? c.conversation?._id : c.conversation
                  if (cConvId && activeConversation._id && String(cConvId) === String(activeConversation._id)) {
                    return true
                  }
                  if (otherParticipant?._id) {
                    const callerId = String(c.caller?._id || c.caller || '')
                    const recipientId = String(c.recipient?._id || c.recipient || '')
                    const otherId = String(otherParticipant._id)
                    const currentId = String(user._id)
                    return (
                      (callerId === currentId && recipientId === otherId) ||
                      (callerId === otherId && recipientId === currentId)
                    )
                  }
                  return false
                })
                .sort((a, b) => new Date(b.startedAt || b.createdAt).getTime() - new Date(a.startedAt || a.createdAt).getTime())
            : []

          // Filter by messageSearch inside the active conversation
          const searchedMessages = messageSearch.trim()
            ? activeConversationMessages.filter((m) =>
                (m.text || '').toLowerCase().includes(messageSearch.toLowerCase().trim())
              )
            : activeConversationMessages

          // Media list for the active conversation
          const activeConversationMedia = activeConversationMessages.flatMap((m) =>
            (m.media || []).map((med, idx) => ({
              ...med,
              key: `${m._id}-${idx}`,
              messageId: m._id,
              createdAt: m.createdAt,
              sender: m.sender,
            }))
          )

          return (
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">Denetim İstasyonu</p>
                  <h3 className="text-base font-bold text-slate-900">Sohbetler & Mesaj Kayıtları</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Kullanıcının yaptığı tüm konuşmaları, silinmiş mesajları ve paylaşılan medya dosyalarını inceleyin.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                    Toplam {conversations.length} Sohbet · {messages.length} Mesaj Kaydı
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[330px_1fr] xl:grid-cols-[360px_1fr]">
                {/* Sol Panel: Sohbet Listesi & Filtreler */}
                <div className="flex flex-col border-r-0 border-slate-100 pr-0 lg:border-r lg:pr-5">
                  {/* Arama & Filtre Çubuğu */}
                  <div className="space-y-2.5">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs">🔍</span>
                      <input
                        type="text"
                        placeholder="Sohbet veya kişi ara..."
                        value={conversationSearch}
                        onChange={(e) => setConversationSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-8 pr-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                      />
                      {conversationSearch ? (
                        <button
                          type="button"
                          onClick={() => setConversationSearch('')}
                          className="absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>

                    {/* Filtre Segment Butonları */}
                    <div className="flex gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setChatFilter('all')}
                        className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all ${
                          chatFilter === 'all'
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        Tümü ({conversations.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatFilter('media')}
                        className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all ${
                          chatFilter === 'media'
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        🖼️ Medyalı
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatFilter('calls')}
                        className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all ${
                          chatFilter === 'calls'
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        📞 Aramalar
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatFilter('deleted')}
                        className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all ${
                          chatFilter === 'deleted'
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        ⚠️ Silinenler
                      </button>
                    </div>
                  </div>

                  {/* Sohbet Kartları Listesi */}
                  <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">
                    {filteredConversations.length ? (
                      filteredConversations.map((conv) => {
                        const other = getOtherParticipant(conv, user._id)
                        const isSelected = activeConversation && String(activeConversation._id) === String(conv._id)
                        const isOtherSuspended = other?.accountStatus === 'suspended'

                        // Count messages in this conversation
                        const convMsgs = messages.filter(
                          (m) =>
                            String(typeof m.conversation === 'object' ? m.conversation?._id : m.conversation) ===
                            String(conv._id)
                        )
                        const hasDeleted = convMsgs.some((m) => m.deletedByUserIds?.length > 0)
                        const hasMedia = convMsgs.some((m) => m.media?.length > 0)

                        return (
                          <div
                            key={conv._id}
                            onClick={() => {
                              setSelectedConversationId(conv._id)
                              setMessageSearch('')
                            }}
                            className={`group flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-all ${
                              isSelected
                                ? 'border-blue-500/70 bg-blue-50/70 ring-1 ring-blue-500/20 shadow-xs'
                                : 'border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <UserAvatar
                                user={other}
                                className="h-10 w-10 border border-slate-200 font-bold"
                              />
                              {isOtherSuspended ? (
                                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-rose-500" title="Kullanıcı askıda" />
                              ) : null}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className={`truncate text-xs font-bold ${isSelected ? 'text-blue-950' : 'text-slate-900'}`}>
                                    {getFullName(other)}
                                  </span>
                                  <VerifiedBadge user={{ verification: { isVerified: other?.verification?.status === 'approved' } }} size="sm" />
                                </div>
                                <span className="shrink-0 text-[10px] font-medium text-slate-400">
                                  {formatRelativeTime(conv.lastMessageAt || conv.updatedAt)}
                                </span>
                              </div>

                              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                                @{other?.username || 'user'}
                              </p>

                              <p className={`mt-1 line-clamp-1 text-xs ${isSelected ? 'text-slate-700 font-medium' : 'text-slate-600'}`}>
                                {conv.lastMessagePreview || <span className="italic text-slate-400">Mesaj metni yok</span>}
                              </p>

                              {/* Badges */}
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                {hasMedia ? (
                                  <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                                    🖼️ Medya
                                  </span>
                                ) : null}
                                {hasDeleted ? (
                                  <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                    ⚠️ Silinen Var
                                  </span>
                                ) : null}
                                <span className="ml-auto text-[10px] font-semibold text-slate-400">
                                  {convMsgs.length} mesaj
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">
                        {conversations.length === 0
                          ? 'Kayıtlı sohbet bulunmuyor.'
                          : 'Aramaya veya filtreye uygun sohbet bulunamadı.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sağ Panel: Seçili Sohbet Mesaj Akışı & Medya */}
                <div className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4">
                  {activeConversation && otherParticipant ? (
                    <>
                      {/* Sohbet Başlığı ve Muhatap Detayı */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            user={otherParticipant}
                            className="h-11 w-11 border border-slate-200 font-bold"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-bold text-slate-900">
                                {getFullName(otherParticipant)}
                              </h4>
                              <VerifiedBadge user={{ verification: { isVerified: otherParticipant.verification?.status === 'approved' } }} size="sm" />
                              {otherParticipant.accountStatus === 'suspended' ? (
                                <span className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                  Askıda
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-slate-700">@{otherParticipant.username}</span>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-slate-400">ID: {otherParticipant._id}</span>
                              <CopyButton text={otherParticipant._id} label="ID" />
                              <span>•</span>
                              <a
                                href={`/${lang}/profile/${encodeURIComponent(otherParticipant.username)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                Profili Gör ↗
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Görünüm Değiştirici Sekmeler & Sohbet Sil Butonu */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setChatSubTab('stream')}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                chatSubTab === 'stream'
                                  ? 'bg-slate-900 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              💬 Mesaj Akışı ({activeConversationMessages.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatSubTab('media')}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                chatSubTab === 'media'
                                  ? 'bg-slate-900 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              🖼️ Medya Kasası ({activeConversationMedia.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatSubTab('calls')}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                chatSubTab === 'calls'
                                  ? 'bg-slate-900 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              📞 Görüşme Kayıtları ({activeConversationCallLogs.length})
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setConversationToDelete({
                                conversationId: activeConversation._id,
                                participantName: getFullName(otherParticipant),
                                messageCount: activeConversationMessages.length,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 shadow-2xs active:scale-95"
                            title="Bu sohbeti ve tüm mesajlarını sistemden kalıcı olarak sil"
                          >
                            <span>🗑️</span>
                            <span>Sohbeti Kalıcı Sil</span>
                          </button>
                        </div>
                      </div>

                      {/* Görünüm 1: Mesaj Akışı (Chat Stream) */}
                      {chatSubTab === 'stream' && (
                        <div className="flex flex-1 flex-col">
                          {/* Mesaj İçi Arama Çubuğu */}
                          <div className="mt-3 flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                            <div className="relative flex-1 max-w-xs">
                              <span className="absolute inset-y-0 left-2.5 flex items-center text-xs text-slate-400">🔍</span>
                              <input
                                type="text"
                                placeholder="Bu sohbette kelime ara..."
                                value={messageSearch}
                                onChange={(e) => setMessageSearch(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                              />
                            </div>
                            <span className="text-[11px] font-medium text-slate-400">
                              {searchedMessages.length} kayıt listeleniyor
                            </span>
                          </div>

                          {/* Mesaj Balonları Akışı */}
                          <div className="mt-4 max-h-[500px] flex-1 space-y-4 overflow-y-auto px-1">
                            {searchedMessages.length ? (
                              searchedMessages.map((msg) => {
                                const senderId = typeof msg.sender === 'object' ? msg.sender?._id : msg.sender
                                const isInspectedUser = String(senderId) === String(user._id)
                                const isDeleted = msg.deletedByUserIds && msg.deletedByUserIds.length > 0

                                return (
                                  <div
                                    key={msg._id}
                                    className={`flex flex-col ${isInspectedUser ? 'items-end' : 'items-start'}`}
                                  >
                                    <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
                                      <span className="font-semibold text-slate-700">
                                        {isInspectedUser ? `${getFullName(user)} (İncelenen Hesap)` : getFullName(otherParticipant)}
                                      </span>
                                      <span>•</span>
                                      <span>{new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <button
                                        type="button"
                                        onClick={() => setMessageToDelete({ messageId: msg._id })}
                                        title="Bu mesajı kalıcı olarak sil"
                                        className="rounded px-1 text-[11px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                      >
                                        🗑️ Sil
                                      </button>
                                    </div>

                                    <div
                                      className={`relative max-w-[82%] rounded-2xl p-3.5 shadow-xs transition-all ${
                                        isInspectedUser
                                          ? 'rounded-tr-sm bg-blue-600 text-white'
                                          : 'rounded-tl-sm border border-slate-200/90 bg-white text-slate-900'
                                      }`}
                                    >
                                      {/* Medya Ekleri (Fotoğraf / Video / Sesli Mesaj) */}
                                      {msg.media && msg.media.length > 0 ? (
                                        <div className="mb-2.5 grid gap-2">
                                          {msg.media.map((med, mIdx) => (
                                            <div key={mIdx} className="overflow-hidden rounded-xl">
                                              {med.type === 'audio' || /\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(med?.url || '')) ? (
                                                <div className={`p-2 rounded-xl border ${
                                                  isInspectedUser
                                                    ? 'border-blue-400/40 bg-blue-700/50'
                                                    : 'border-slate-200 bg-slate-50'
                                                }`}>
                                                  <AudioMessagePlayer
                                                    src={med.url}
                                                    duration={med.durationSeconds || 0}
                                                    isMine={isInspectedUser}
                                                    variant="admin"
                                                  />
                                                </div>
                                              ) : med.type === 'video' ? (
                                                <div className="relative bg-black/10 rounded-xl overflow-hidden">
                                                  <video
                                                    src={resolveMediaUrl(med.url)}
                                                    poster={med.posterUrl ? resolveMediaUrl(med.posterUrl) : ''}
                                                    controls
                                                    className="max-h-64 w-full rounded-xl object-contain bg-black"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => setPreviewMedia({ url: resolveMediaUrl(med.url), type: 'video' })}
                                                    className="absolute top-2 right-2 rounded-lg bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm hover:bg-black"
                                                  >
                                                    Tam Ekran ↗
                                                  </button>
                                                </div>
                                              ) : (
                                                <div
                                                  onClick={() => setPreviewMedia({ url: resolveMediaUrl(med.url), type: 'image' })}
                                                  className="group relative cursor-pointer overflow-hidden rounded-xl bg-black/10"
                                                >
                                                  <img
                                                    src={resolveMediaUrl(med.url)}
                                                    alt="Attached media"
                                                    className="max-h-64 w-full rounded-xl object-cover transition-transform group-hover:scale-105"
                                                    loading="lazy"
                                                  />
                                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <span className="rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                                                      🔍 Büyüt
                                                    </span>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}

                                      {/* Mesaj Metni */}
                                      {msg.text ? (
                                        <p className="whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed">
                                          {msg.text}
                                        </p>
                                      ) : null}

                                      {/* Silinmiş Mesaj Uyarısı */}
                                      {isDeleted ? (
                                        <div className={`mt-2.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                                          isInspectedUser
                                            ? 'bg-amber-500/20 text-amber-100 border border-amber-300/30'
                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                        }`}>
                                          ⚠️ Kullanıcı tarafından silindi (Admin Denetim Arşivinde Korunuyor)
                                        </div>
                                      ) : null}

                                      {/* Alt Bilgi: Tarih & Okunma Durumu */}
                                      <div className={`mt-2 flex items-center justify-end gap-2 text-[10px] ${
                                        isInspectedUser ? 'text-blue-100' : 'text-slate-400'
                                      }`}>
                                        <span>{new Date(msg.createdAt).toLocaleDateString('tr-TR')}</span>
                                        {msg.readAt ? (
                                          <span className={isInspectedUser ? 'font-bold text-white' : 'font-semibold text-emerald-600'} title={`Okundu: ${new Date(msg.readAt).toLocaleString('tr-TR')}`}>
                                            ✓✓ Okundu
                                          </span>
                                        ) : msg.deliveredAt ? (
                                          <span title="İletildi">✓ İletildi</span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500">
                                {messageSearch ? 'Aramanıza uygun mesaj bulunamadı.' : 'Bu sohbete ait mesaj kaydı bulunamadı.'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Görünüm 2: Medya Kasası (Media Gallery) */}
                      {chatSubTab === 'media' && (
                        <div className="mt-4 flex-1">
                          {activeConversationMedia.length ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                              {activeConversationMedia.map((med) => {
                                const senderId = typeof med.sender === 'object' ? med.sender?._id : med.sender
                                const isFromInspected = String(senderId) === String(user._id)

                                return (
                                  <div
                                    key={med.key}
                                    onClick={() => med.type !== 'audio' && setPreviewMedia({ url: resolveMediaUrl(med.url), type: med.type })}
                                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-2xs"
                                  >
                                    {med.type === 'audio' || /\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(med?.url || '')) ? (
                                      <div className="flex h-full w-full flex-col justify-between p-3 bg-gradient-to-b from-slate-800 to-slate-900">
                                        <div className="flex items-center justify-between">
                                          <span className="rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold">
                                            🎙️ Sesli Mesaj
                                          </span>
                                        </div>
                                        <div className="my-auto">
                                          <AudioMessagePlayer
                                            src={med.url}
                                            duration={med.durationSeconds || 0}
                                            variant="admin"
                                          />
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          {new Date(med.createdAt).toLocaleDateString('tr-TR')}
                                        </div>
                                      </div>
                                    ) : med.type === 'video' ? (
                                      <video
                                        src={resolveMediaUrl(med.url)}
                                        className="h-full w-full object-cover opacity-85 group-hover:opacity-100"
                                        muted
                                      />
                                    ) : (
                                      <img
                                        src={resolveMediaUrl(med.url)}
                                        alt="Media vault item"
                                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                        loading="lazy"
                                      />
                                    )}

                                    {/* Type badge */}
                                    {med.type !== 'audio' && (
                                      <span className="absolute top-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                                        {med.type === 'video' ? '🎥 Video' : '📷 Fotoğraf'}
                                      </span>
                                    )}

                                    {/* Sender & Date footer */}
                                    {med.type !== 'audio' && (
                                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-2 text-white">
                                        <p className="text-[10px] font-semibold truncate">
                                          {isFromInspected ? 'Kullanıcı' : otherParticipant.firstName}
                                        </p>
                                        <p className="text-[9px] text-slate-300">
                                          {new Date(med.createdAt).toLocaleDateString('tr-TR')}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-500">
                              Bu sohbette paylaşılan fotoğraf veya video bulunmuyor.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Görünüm 3: Görüşme & Arama Kayıtları */}
                      {chatSubTab === 'calls' && (
                        <div className="mt-4 flex flex-1 flex-col space-y-4">
                          {/* İstatistik Rozetleri */}
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
                              <p className="text-[11px] font-semibold text-slate-500">Toplam Çağrı</p>
                              <p className="mt-1 text-base font-bold text-slate-900">{activeConversationCallLogs.length}</p>
                              <span className="text-[10px] text-slate-400">Bu sohbette</span>
                            </div>
                            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                              <p className="text-[11px] font-semibold text-blue-700">📞 Sesli Arama</p>
                              <p className="mt-1 text-base font-bold text-blue-900">
                                {activeConversationCallLogs.filter((c) => c.callType === 'voice').length}
                              </p>
                              <span className="text-[10px] text-blue-600 font-medium">
                                {formatCallDuration(
                                  activeConversationCallLogs
                                    .filter((c) => c.callType === 'voice')
                                    .reduce((acc, c) => acc + (c.durationSec || 0), 0)
                                )} toplam
                              </span>
                            </div>
                            <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-3">
                              <p className="text-[11px] font-semibold text-purple-700">📹 Görüntülü (720p)</p>
                              <p className="mt-1 text-base font-bold text-purple-900">
                                {activeConversationCallLogs.filter((c) => c.callType === 'video').length}
                              </p>
                              <span className="text-[10px] text-purple-600 font-medium">
                                {formatCallDuration(
                                  activeConversationCallLogs
                                    .filter((c) => c.callType === 'video')
                                    .reduce((acc, c) => acc + (c.durationSec || 0), 0)
                                )} toplam
                              </span>
                            </div>
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                              <p className="text-[11px] font-semibold text-emerald-700">💾 Ses/Video Kaydı</p>
                              <p className="mt-1 text-base font-bold text-emerald-900">
                                {activeConversationCallLogs.filter((c) => c.recordingUrl).length}
                              </p>
                              <span className="text-[10px] text-emerald-600 font-medium">Oynatılabilir</span>
                            </div>
                          </div>

                          {/* Çağrı Listesi */}
                          {activeConversationCallLogs.length ? (
                            <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1">
                              {activeConversationCallLogs.map((log) => {
                                const callerId = String(log.caller?._id || log.caller || '')
                                const isInspectedCaller = callerId === String(user._id)
                                const isVideo = log.callType === 'video'
                                const isCompleted = log.status === 'completed'
                                const isMissed = log.status === 'missed'
                                const isDeclined = log.status === 'declined'

                                return (
                                  <div
                                    key={log._id || log.callId}
                                    className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-slate-300"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold shadow-2xs ${
                                            isVideo
                                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                                          }`}
                                        >
                                          {isVideo ? '📹' : '📞'}
                                        </div>

                                        <div>
                                          <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-bold text-slate-900">
                                              {isVideo ? 'Görüntülü Görüşme (720p HD)' : 'Sesli Arama'}
                                            </h4>
                                            <span
                                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                                isInspectedCaller
                                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                                              }`}
                                            >
                                              {isInspectedCaller ? '↗ Giden Çağrı' : '↙ Gelen Çağrı'}
                                            </span>
                                          </div>

                                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                            <span>
                                              Arayan:{' '}
                                              <strong className="text-slate-700">
                                                {isInspectedCaller ? getFullName(user) : getFullName(otherParticipant)}
                                              </strong>
                                            </span>
                                            <span>•</span>
                                            <span>
                                              📅 {new Date(log.startedAt || log.createdAt).toLocaleDateString('tr-TR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                              })}
                                            </span>
                                            <span>•</span>
                                            <span>
                                              🕒 Başlangıç: {new Date(log.startedAt || log.createdAt).toLocaleTimeString('tr-TR', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                              })}
                                              {log.endedAt ? ` • Bitiş: ${new Date(log.endedAt).toLocaleTimeString('tr-TR', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                              })}` : ''}
                                            </span>
                                            {log.durationSec > 0 && (
                                              <>
                                                <span>•</span>
                                                <span className="font-semibold text-slate-700">
                                                  ⏱️ {formatCallDuration(log.durationSec)}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Durum Rozeti */}
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                                            isCompleted
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : isMissed
                                                ? 'bg-amber-100 text-amber-800'
                                                : isDeclined
                                                  ? 'bg-rose-100 text-rose-800'
                                                  : 'bg-slate-100 text-slate-700'
                                          }`}
                                        >
                                          {isCompleted
                                            ? `✓ Görüşüldü (${formatCallDuration(log.durationSec)})`
                                            : isMissed
                                              ? '📵 Cevapsız'
                                              : isDeclined
                                                ? '🚫 Reddedildi'
                                                : log.status}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Kayıt Oynatıcı / İzleme Alanı */}
                                    {log.recordingUrl ? (
                                      <div className="mt-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2 text-[11px]">
                                          <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">
                                            <span>{isVideo ? '🎬 720p HD Video Kaydı' : '🎙️ Ses Kaydı (32kbps Opus)'}</span>
                                            {log.fileSizeBytes && (
                                              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
                                                {formatBytes(log.fileSizeBytes)}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <a
                                              href={resolveMediaUrl(log.recordingUrl)}
                                              download={`call-${log.callId}.webm`}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                              <span>📥</span>
                                              <span>Kaydı İndir</span>
                                            </a>
                                          </div>
                                        </div>

                                        <div className="mt-2.5">
                                          {isVideo ? (
                                            <div className="flex flex-wrap items-center gap-3">
                                              <button
                                                type="button"
                                                onClick={() => setVideoModalRecording(log)}
                                                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700 active:scale-95"
                                              >
                                                <span>▶️</span>
                                                <span>720p Video Kaydını İzle</span>
                                              </button>
                                              <span className="text-[11px] text-slate-500">
                                                Düşük boyutlu 720p HD video ve çift taraflı ses kaydı.
                                              </span>
                                            </div>
                                          ) : (
                                            <audio
                                              controls
                                              className="h-9 w-full rounded-lg"
                                              src={resolveMediaUrl(log.recordingUrl)}
                                              preload="metadata"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-[11px] text-slate-400">
                                        <span>ℹ️</span>
                                        <span>
                                          {isCompleted
                                            ? 'Görüşme kaydı yüklenmedi veya kaydedilmedi.'
                                            : 'Çağrı yanıtlanmadığı için ses/görüntü kaydı bulunmuyor.'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-500">
                              Bu sohbette henüz sesli veya görüntülü görüşme kaydı bulunmuyor.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-slate-500">
                      <span className="text-4xl">💬</span>
                      <h4 className="mt-3 text-sm font-bold text-slate-900">Sohbet Seçilmedi</h4>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        Mesaj geçmişini, silinmiş kayıtları ve medya dosyalarını görüntülemek için sol taraftan bir sohbet seçin.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Tab 4: Location & Discovery */}
        {activeTab === 'location' && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Last Exact GPS */}
              <SectionCard
                title="Son Tam GPS Konumu"
                eyebrow="Cihaz Koordinatı"
                subtitle="Cihaz tarafından verilen en son net koordinat"
              >
                {discovery.lastExactLocation?.latitude != null ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-zinc-50 p-4">
                      <p className="text-lg font-bold text-zinc-900">
                        {discovery.lastExactLocation.city || 'Şehir Yok'} / {discovery.lastExactLocation.country || 'Ülke Yok'}
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-white p-2.5 shadow-sm">
                          <span className="text-zinc-400">Enlem (Lat)</span>
                          <p className="font-mono font-bold text-zinc-800">{discovery.lastExactLocation.latitude}</p>
                        </div>
                        <div className="rounded-xl bg-white p-2.5 shadow-sm">
                          <span className="text-zinc-400">Boylam (Lng)</span>
                          <p className="font-mono font-bold text-zinc-800">{discovery.lastExactLocation.longitude}</p>
                        </div>
                        <div className="rounded-xl bg-white p-2.5 shadow-sm">
                          <span className="text-zinc-400">Hassasiyet</span>
                          <p className="font-mono font-bold text-zinc-800">±{discovery.lastExactLocation.accuracy || 0}m</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-zinc-500">
                        Son görülme: {discovery.lastExactLocation.lastSeenAt ? new Date(discovery.lastExactLocation.lastSeenAt).toLocaleString('tr-TR') : 'Bilinmiyor'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">
                    Kayıtlı tam GPS koordinatı bulunmuyor.
                  </div>
                )}
              </SectionCard>

              {/* Last Approx Location */}
              <SectionCard
                title="Son Yaklaşık Konum (IP / Bölge)"
                eyebrow="Gizlilik Korumalı"
                subtitle="Yuvarlanmış koordinat ve IP tabanlı bölge tahmini"
              >
                {discovery.lastApproxLocation?.latRounded != null ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-zinc-50 p-4">
                      <p className="text-lg font-bold text-zinc-900">
                        {discovery.lastApproxLocation.city || 'Şehir Yok'} / {discovery.lastApproxLocation.country || 'Ülke Yok'}
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-white p-2.5 shadow-sm">
                          <span className="text-zinc-400">Yuvarlanmış Lat</span>
                          <p className="font-mono font-bold text-zinc-800">{discovery.lastApproxLocation.latRounded}</p>
                        </div>
                        <div className="rounded-xl bg-white p-2.5 shadow-sm">
                          <span className="text-zinc-400">Yuvarlanmış Lng</span>
                          <p className="font-mono font-bold text-zinc-800">{discovery.lastApproxLocation.lngRounded}</p>
                        </div>
                        <div className="rounded-xl bg-white p-2.5 shadow-sm">
                          <span className="text-zinc-400">Doğruluk</span>
                          <p className="font-mono font-bold text-zinc-800">±{discovery.lastApproxLocation.accuracy || 0}m</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-zinc-500">
                        Son görülme: {discovery.lastApproxLocation.lastSeenAt ? new Date(discovery.lastApproxLocation.lastSeenAt).toLocaleString('tr-TR') : 'Bilinmiyor'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500">
                    Kayıtlı yaklaşık konum bulunmuyor.
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Algorithmic Topic Scores Card */}
            <SectionCard
              title="Keşif & İlgi Alanı Algoritması"
              eyebrow="Tavsiye Motoru"
              subtitle="Kullanıcının etkileşimlerine göre hesaplanan konu ağırlıkları"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Konum İzni Durumu</p>
                  <p className="mt-2 text-base font-bold text-zinc-900">
                    {discovery.locationConsent?.status === 'granted' ? '✅ İzin Verildi' : '❌ İzin Verilmedi'}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Kaynak: {discovery.locationConsent?.source || 'Bilinmiyor'}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Yakındaki Keşif Kullanımı</p>
                  <p className="mt-2 text-2xl font-bold text-zinc-950">{discovery.nearbyDiscoveryUsageCount || 0}</p>
                  <p className="mt-1 text-xs text-zinc-500">Kişi arama oturumu sayısı</p>
                </div>
              </div>

              {discovery.interestProfile?.topicScores && Object.keys(discovery.interestProfile.topicScores).length > 0 ? (
                <div className="mt-5 border-t border-zinc-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Hesaplanan İlgi Skorları</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(discovery.interestProfile.topicScores).map(([topic, score]) => (
                      <span
                        key={topic}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-900"
                      >
                        <span>#{topic}</span>
                        <span className="rounded-md bg-indigo-200 px-1.5 py-0.5 text-[10px] text-indigo-950">
                          {score}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </SectionCard>

            {/* Location Consent Logs */}
            <SectionCard
              title={`Konum İzni Değişiklik Geçmişi (${locationLogs.length})`}
              eyebrow="Denetim Günlüğü"
              subtitle="Kullanıcının konum izinleri ve log kayıtları"
            >
              {locationLogs.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-400">
                        <th className="pb-3 font-semibold">Tarih</th>
                        <th className="pb-3 font-semibold">Durum</th>
                        <th className="pb-3 font-semibold">Kaynak</th>
                        <th className="pb-3 font-semibold">Şehir / Ülke</th>
                        <th className="pb-3 font-semibold">GPS Koordinatı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {locationLogs.map((log) => (
                        <tr key={log._id} className="text-zinc-700">
                          <td className="py-3 font-medium">
                            {new Date(log.consentGivenAt || log.createdAt).toLocaleString('tr-TR')}
                          </td>
                          <td className="py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                log.status === 'granted'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3 text-zinc-500">{log.source || '—'}</td>
                          <td className="py-3 font-semibold">
                            {log.city || '—'} / {log.country || '—'}
                          </td>
                          <td className="py-3 font-mono text-[11px] text-zinc-500">
                            {log.latitude ? `${log.latitude}, ${log.longitude}` : 'Yok'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 py-6 text-center text-sm text-zinc-500">
                  Konum izni değişiklik kaydı bulunmuyor.
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* Tab 5: Security & Moderation */}
        {activeTab === 'security' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Moderation History Card */}
            <SectionCard
              title="Moderasyon Durumu & İşlem Geçmişi"
              eyebrow="Disiplin & Uyarılar"
              subtitle="Kullanıcıya uygulanan kısıtlamalar ve notlar"
            >
              <div className="space-y-4">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <span className="text-xs font-semibold text-zinc-500">Mevcut Hesap Durumu</span>
                  <div className="mt-2">
                    <StatusBadge type="status" value={user.accountStatus} />
                  </div>
                  {user.moderation?.reason ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800">
                      <p className="font-bold">Uygulanan Moderatör Gerekçesi:</p>
                      <p className="mt-1">{user.moderation.reason}</p>
                      {user.moderation.actionedAt ? (
                        <p className="mt-2 text-[10px] text-rose-600">
                          İşlem Zamanı: {new Date(user.moderation.actionedAt).toLocaleString('tr-TR')}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500">Aktif bir moderatör cezası veya notu bulunmuyor.</p>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Blocked Users & Privacy Card */}
            <SectionCard
              title="Engellemeler & Güvenlik Parametreleri"
              eyebrow="Erişim Denetimi"
              subtitle="Kullanıcının engellediği kişiler ve güvenlik ayarları"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label="Engellenen Kullanıcılar"
                  value={`${user.blockedUserIds?.length || 0} Kişi`}
                />
                <DetailRow
                  label="E-posta Doğrulama"
                  value={user.emailVerifiedAt ? 'Doğrulandı' : 'Doğrulanmadı'}
                  isBadge
                />
                <DetailRow
                  label="Hesap Tipi"
                  value={user.isPrivate ? 'Gizli Profil' : 'Herkese Açık'}
                />
                <DetailRow
                  label="Kimlik Doğrulama"
                  value={user.authProvider === 'google' ? 'Google OAuth 2.0' : 'Bcrypt Şifre'}
                />
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmActionDialog
        open={Boolean(statusDialog)}
        title={statusDialog?.title}
        description={statusDialog?.description}
        confirmLabel={statusDialog?.nextStatus === 'suspended' ? 'Kullanıcıyı Askıya Al' : 'Kullanıcıyı Aktif Et'}
        confirmTone={statusDialog?.nextStatus === 'suspended' ? 'danger' : 'default'}
        reasonLabel="Moderatör İşlem Notu"
        reasonPlaceholder="İşlem kaydı ve denetim için gerekçe yazın"
        isProcessing={isSavingStatus}
        onCancel={() => {
          if (!isSavingStatus) setStatusDialog(null)
        }}
        onConfirm={confirmStatusUpdate}
      />

      <ConfirmActionDialog
        open={verificationDialogOpen}
        title="Mavi Tiki Kaldır"
        description="Bu kullanıcının profil doğrulaması derhal iptal edilecek ve mavi tiki kaldırılacaktır."
        confirmLabel="Mavi Tiki Kaldır"
        confirmTone="danger"
        reasonLabel="Zorunlu Kaldırma Gerekçesi"
        reasonPlaceholder="İptal nedenini detaylıca yazın"
        isProcessing={isSavingVerification}
        onCancel={() => {
          if (!isSavingVerification) setVerificationDialogOpen(false)
        }}
        onConfirm={confirmVerificationRevoke}
      />

      {/* Delete Conversation Confirmation Dialog */}
      <ConfirmActionDialog
        open={Boolean(conversationToDelete)}
        title="Sohbeti ve Tüm Mesajları Kalıcı Olarak Sil"
        description={`${conversationToDelete?.participantName ? `${conversationToDelete.participantName} ile olan bu sohbet` : 'Bu sohbet'} ve içindeki toplam ${conversationToDelete?.messageCount || 0} adet mesaj, paylaşılan tüm medya dosyaları veritabanından kalıcı olarak temizlenecektir. Bu işlem kullanıcıların sohbet kutularından da siler ve geri alınamaz!`}
        confirmLabel="Sohbeti Kalıcı Olarak Sil"
        confirmTone="danger"
        reasonLabel="Silme Gerekçesi (Audit Log)"
        reasonPlaceholder="Örn: Yasadışı içerik, kullanıcı talebi, güvenlik ihlali"
        isProcessing={isDeletingChat}
        onCancel={() => {
          if (!isDeletingChat) setConversationToDelete(null)
        }}
        onConfirm={confirmDeleteConversation}
      />

      {/* Delete Single Message Confirmation Dialog */}
      <ConfirmActionDialog
        open={Boolean(messageToDelete)}
        title="Mesajı Kalıcı Olarak Sil"
        description="Bu mesaj ve varsa ekli medyalar veritabanından kalıcı olarak silinecektir. Her iki kullanıcının sohbet akışından da kaybolacaktır."
        confirmLabel="Mesajı Kalıcı Olarak Sil"
        confirmTone="danger"
        reasonLabel="Moderatör Silme Notu (Opsiyonel)"
        reasonPlaceholder="İşlem gerekçesi belirtin"
        isProcessing={isDeletingMsg}
        onCancel={() => {
          if (!isDeletingMsg) setMessageToDelete(null)
        }}
        onConfirm={confirmDeleteMessage}
      />

      {/* Media Lightbox Preview Modal */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 text-white">
              <span className="text-xs font-semibold text-slate-200">
                {previewMedia.type === 'video' ? '🎥 Video Önizleme' : '📷 Fotoğraf Önizleme'}
              </span>
              <div className="flex items-center gap-2">
                <CopyButton text={previewMedia.url} label="URL Kopyala" />
                <a
                  href={previewMedia.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Yeni Sekmede Aç ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMedia(null)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid place-items-center p-4">
              {previewMedia.type === 'video' ? (
                <video
                  src={previewMedia.url}
                  controls
                  autoPlay
                  className="max-h-[75vh] w-auto max-w-full rounded-2xl shadow-lg"
                />
              ) : (
                <img
                  src={previewMedia.url}
                  alt="Full preview"
                  className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 720p Video Call Recording Modal */}
      {videoModalRecording && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md transition-all"
          onClick={() => setVideoModalRecording(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-slate-900 shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">📹 720p HD Görüntülü Görüşme Kaydı</span>
                <span className="rounded-md bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                  1280x720 • {formatBytes(videoModalRecording.fileSizeBytes || 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={resolveMediaUrl(videoModalRecording.recordingUrl)}
                  download={`video-call-${videoModalRecording.callId}.webm`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  İndir 📥
                </a>
                <button
                  type="button"
                  onClick={() => setVideoModalRecording(null)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid place-items-center bg-black p-4">
              <video
                src={resolveMediaUrl(videoModalRecording.recordingUrl)}
                controls
                autoPlay
                className="max-h-[75vh] w-auto max-w-full rounded-2xl shadow-2xl"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/90 px-5 py-2.5 text-xs text-slate-400">
              <span>
                Kayıt Tarihi: {new Date(videoModalRecording.startedAt || videoModalRecording.createdAt).toLocaleString('tr-TR')}
              </span>
              <span>
                Süre: {formatCallDuration(videoModalRecording.durationSec || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      <ActionToast toast={toast} onClose={() => setToast({ message: '', tone: 'success' })} />
    </>
  )
}

export default AdminUserDetailPage
