import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ConfirmActionDialog from '../components/feedback/ConfirmActionDialog.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import { resolveMediaUrl } from '../utils/media.js'
import { getFullName } from '../utils/social.js'
import {
  deleteAdminConversation,
  deleteAdminMessage,
  getAdminUserDetail,
  revokeAdminUserVerification,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '../services/adminService.js'
import {
  calculateAge,
  calculateAccountTenure,
  parseUserAgent,
  calculateTrustScore,
  CopyButton,
  StatusBadge,
  SectionCard,
  StatCard,
  DetailRow,
} from '../components/admin/AdminUserDetailCommon.jsx'
import { AdminUserDetailOverviewTab } from '../components/admin/AdminUserDetailOverviewTab.jsx'
import { AdminUserDetailConversationsTab } from '../components/admin/AdminUserDetailConversationsTab.jsx'

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
      setToast({ message: payload.message || 'Profil doğrulaması başarıyla kaldırıldı.', tone: 'success' })
      setVerificationDialogOpen(false)
    } catch (error) {
      setToast({ message: error.message || 'Profil doğrulaması kaldırılamadı.', tone: 'error' })
    } finally {
      setIsSavingVerification(false)
    }
  }

  async function handleDeleteConversation(conversationId, reason) {
    try {
      await deleteAdminConversation(conversationId, reason)
      setState((prev) => {
        if (!prev.data) return prev
        const updatedConversations = (prev.data.conversations || []).filter(
          (c) => String(c._id) !== String(conversationId)
        )
        const updatedMessages = (prev.data.messages || []).filter((m) => {
          const convId = typeof m.conversation === 'object' ? m.conversation?._id : m.conversation
          return String(convId) !== String(conversationId)
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
      setToast({ message: 'Sohbet ve tüm mesajları veritabanından kalıcı olarak silindi.', tone: 'success' })
    } catch (err) {
      setToast({ message: err.message || 'Sohbet silinemedi.', tone: 'error' })
      throw err
    }
  }

  async function handleDeleteMessage(messageId, reason) {
    try {
      await deleteAdminMessage(messageId, reason)
      setState((prev) => {
        if (!prev.data) return prev
        const updatedMessages = (prev.data.messages || []).filter(
          (m) => String(m._id) !== String(messageId)
        )
        return {
          ...prev,
          data: {
            ...prev.data,
            messages: updatedMessages,
          },
        }
      })
      setToast({ message: 'Mesaj kalıcı olarak silindi.', tone: 'success' })
    } catch (err) {
      setToast({ message: err.message || 'Mesaj silinemedi.', tone: 'error' })
      throw err
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
                    Doğrulamayı Kaldır
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
          <AdminUserDetailOverviewTab
            user={user}
            posts={posts}
            consent={consent}
            activity={activity}
            discovery={discovery}
            userAge={userAge}
            uaInfo={uaInfo}
            totalEngagements={totalEngagements}
            lang={lang}
            setActiveTab={setActiveTab}
          />
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
        {activeTab === 'messages' && (
          <AdminUserDetailConversationsTab
            user={user}
            conversations={conversations}
            messages={messages}
            callLogs={callLogs}
            lang={lang}
            onDeleteConversation={handleDeleteConversation}
            onDeleteMessage={handleDeleteMessage}
          />
        )}

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
        title="Profil Doğrulamasını Kaldır"
        description="Bu kullanıcının profil doğrulaması derhal iptal edilecek ve doğrulama rozeti kaldırılacaktır."
        confirmLabel="Doğrulamayı Kaldır"
        confirmTone="danger"
        reasonLabel="Zorunlu Kaldırma Gerekçesi"
        reasonPlaceholder="İptal nedenini detaylıca yazın"
        isProcessing={isSavingVerification}
        onCancel={() => {
          if (!isSavingVerification) setVerificationDialogOpen(false)
        }}
        onConfirm={confirmVerificationRevoke}
      />

      

      <ActionToast toast={toast} onClose={() => setToast({ message: '', tone: 'success' })} />
    </>
  )
}

export default AdminUserDetailPage
