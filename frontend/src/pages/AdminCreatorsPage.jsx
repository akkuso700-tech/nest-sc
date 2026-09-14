import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ActionToast from '../components/feedback/ActionToast.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import {
  getAdminMonetizationSummary,
  getAdminCreatorApplications,
  updateAdminCreatorApplicationStatus,
  getAdminPayoutRequests,
  updateAdminPayoutRequestStatus,
  getAdminCreators,
  updateAdminCreatorWalletStatus,
} from '../services/adminService.js'
import { getFullName } from '../utils/social.js'

const APPLICATION_STATUS_LABELS = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
}

const PAYOUT_STATUS_LABELS = {
  pending: 'Bekliyor',
  processing: 'İşleniyor',
  completed: 'Ödendi',
  rejected: 'İptal / İade',
}

export default function AdminCreatorsPage() {
  const { lang = 'tr' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'applications'

  const [summary, setSummary] = useState({
    pendingApplications: 0,
    approvedCreators: 0,
    pendingPayoutsCount: 0,
    pendingPayoutsTotal: 0,
    completedPayoutsTotal: 0,
  })

  // Tab 1: Başvurular
  const [appFilters, setAppFilters] = useState({
    q: '',
    status: 'all',
    page: 1,
    limit: 15,
  })
  const [appState, setAppState] = useState({
    loading: true,
    items: [],
    pagination: null,
    error: '',
  })
  const [selectedApp, setSelectedApp] = useState(null)
  const [appDecisionNote, setAppDecisionNote] = useState('')
  const [isSavingApp, setIsSavingApp] = useState(false)

  // Tab 2: Para Çekme Talepleri
  const [payoutFilters, setPayoutFilters] = useState({
    q: '',
    status: 'all',
    page: 1,
    limit: 15,
  })
  const [payoutState, setPayoutState] = useState({
    loading: true,
    items: [],
    pagination: null,
    error: '',
  })
  const [selectedPayoutForAction, setSelectedPayoutForAction] = useState(null)
  const [payoutActionType, setPayoutActionType] = useState('') // 'completed' | 'rejected'
  const [payoutReceiptUrl, setPayoutReceiptUrl] = useState('')
  const [payoutRejectionReason, setPayoutRejectionReason] = useState('')
  const [isSavingPayout, setIsSavingPayout] = useState(false)

  // Tab 3: Aktif Üreticiler
  const [creatorFilters, setCreatorFilters] = useState({
    q: '',
    status: 'all',
    page: 1,
    limit: 15,
  })
  const [creatorState, setCreatorState] = useState({
    loading: true,
    items: [],
    pagination: null,
    error: '',
  })
  const [isSavingWallet, setIsSavingWallet] = useState(false)

  const [toast, setToast] = useState({ message: '', tone: 'success' })

  const showToast = (message, tone = 'success') => {
    setToast({ message, tone })
  }

  // Özet metrikleri yükle
  const loadSummary = useCallback(async () => {
    try {
      const data = await getAdminMonetizationSummary()
      setSummary(data)
    } catch (_) {}
  }, [])

  // Başvuruları yükle
  const loadApplications = useCallback(async () => {
    setAppState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const data = await getAdminCreatorApplications(appFilters)
      setAppState({
        loading: false,
        items: data.applications || [],
        pagination: data.pagination,
        error: '',
      })
      setSelectedApp((current) =>
        data.applications?.find((item) => item._id === current?._id) || data.applications?.[0] || null,
      )
    } catch (err) {
      setAppState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Başvurular yüklenirken hata oluştu.',
      }))
    }
  }, [appFilters])

  // Çekim taleplerini yükle
  const loadPayouts = useCallback(async () => {
    setPayoutState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const data = await getAdminPayoutRequests(payoutFilters)
      setPayoutState({
        loading: false,
        items: data.payouts || [],
        pagination: data.pagination,
        error: '',
      })
    } catch (err) {
      setPayoutState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Para çekme talepleri yüklenirken hata oluştu.',
      }))
    }
  }, [payoutFilters])

  // Üreticileri yükle
  const loadCreators = useCallback(async () => {
    setCreatorState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const data = await getAdminCreators(creatorFilters)
      setCreatorState({
        loading: false,
        items: data.creators || [],
        pagination: data.pagination,
        error: '',
      })
    } catch (err) {
      setCreatorState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Üreticiler yüklenirken hata oluştu.',
      }))
    }
  }, [creatorFilters])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (activeTab === 'applications') loadApplications()
    if (activeTab === 'payouts') loadPayouts()
    if (activeTab === 'creators') loadCreators()
  }, [activeTab, loadApplications, loadPayouts, loadCreators])

  // Başvuru Onayla / Reddet
  const handleAppDecision = async (status) => {
    if (!selectedApp) return
    setIsSavingApp(true)
    try {
      const res = await updateAdminCreatorApplicationStatus(selectedApp._id, {
        status,
        reviewNote: appDecisionNote,
      })
      showToast(res.message || 'İşlem başarıyla tamamlandı.')
      setAppDecisionNote('')
      await Promise.all([loadApplications(), loadSummary()])
    } catch (err) {
      showToast(err.message || 'Karar kaydedilemedi.', 'error')
    } finally {
      setIsSavingApp(false)
    }
  }

  // Çekim Talebi Karar Ver
  const handlePayoutSubmit = async () => {
    if (!selectedPayoutForAction || !payoutActionType) return
    setIsSavingPayout(true)
    try {
      const payload = {
        status: payoutActionType,
        transferReceiptUrl: payoutReceiptUrl,
        rejectionReason: payoutRejectionReason,
      }
      const res = await updateAdminPayoutRequestStatus(selectedPayoutForAction._id, payload)
      showToast(res.message || 'Ödeme talebi güncellendi.')
      setSelectedPayoutForAction(null)
      setPayoutActionType('')
      setPayoutReceiptUrl('')
      setPayoutRejectionReason('')
      await Promise.all([loadPayouts(), loadSummary()])
    } catch (err) {
      showToast(err.message || 'Ödeme işlemi kaydedilemedi.', 'error')
    } finally {
      setIsSavingPayout(false)
    }
  }

  // Cüzdan Dondur / Aç
  const handleToggleWalletStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'frozen' : 'active'
    setIsSavingWallet(true)
    try {
      const res = await updateAdminCreatorWalletStatus(userId, {
        status: nextStatus,
        reason: nextStatus === 'frozen' ? 'Yönetici tarafından donduruldu.' : 'Cüzdan erişimi açıldı.',
      })
      showToast(res.message || 'Cüzdan durumu güncellendi.')
      await loadCreators()
    } catch (err) {
      showToast(err.message || 'Cüzdan durumu güncellenemedi.', 'error')
    } finally {
      setIsSavingWallet(false)
    }
  }

  // CSV İhracı (Banka Toplu Ödeme)
  const exportPayoutsToCsv = () => {
    if (!payoutState.items.length) {
      showToast('Dışa aktarılacak kayıt bulunmuyor.', 'error')
      return
    }

    const headers = ['Talep ID', 'Kullanıcı Adı', 'Alıcı Ad Soyad', 'Banka', 'IBAN', 'Tutar (TRY)', 'Tarih', 'Durum']
    const rows = payoutState.items.map((p) => [
      p._id,
      p.user?.username || '',
      `"${p.fullName || ''}"`,
      `"${p.bankName || ''}"`,
      p.iban || '',
      p.amount || 0,
      new Date(p.requestedAt).toLocaleDateString('tr-TR'),
      PAYOUT_STATUS_LABELS[p.status] || p.status,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `nest_cekim_talepleri_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('CSV dosyası başarıyla indirildi.')
  }

  // IBAN Kopyala
  const handleCopyIban = (iban) => {
    navigator.clipboard.writeText(iban)
    showToast('IBAN panoya kopyalandı!')
  }

  return (
    <div className="space-y-6">
      {/* 1. Üst KPI Kartları */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Bekleyen Başvurular */}
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-bold uppercase tracking-wider">Bekleyen Başvurular</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600">
              İnceleme
            </span>
          </div>
          <p className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
            {summary.pendingApplications}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Karar bekleyen üretici adayları</p>
        </div>

        {/* Bekleyen Çekim Talepleri */}
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-bold uppercase tracking-wider">Bekleyen Ödemeler</span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-bold text-sky-600">
              {summary.pendingPayoutsCount} Talep
            </span>
          </div>
          <p className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
            ₺{(summary.pendingPayoutsTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Onay bekleyen IBAN transferleri</p>
        </div>

        {/* Aktif Onaylı Üreticiler */}
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-bold uppercase tracking-wider">Aktif Üreticiler</span>
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-600">
              Onaylı
            </span>
          </div>
          <p className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
            {summary.approvedCreators}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Ekosistemde gelir elde edenler</p>
        </div>

        {/* Dağıtılan Toplam Gelir */}
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-bold uppercase tracking-wider">Tamamlanan Ödemeler</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600">
              Ödendi
            </span>
          </div>
          <p className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
            ₺{(summary.completedPayoutsTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Üreticilere aktarılan net fon</p>
        </div>
      </section>

      {/* 2. Sekme Seçici (Tabs) */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-1">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'applications' })}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'applications'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <span>Başvuru Kuyruğu</span>
          {summary.pendingApplications > 0 ? (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
              {summary.pendingApplications}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'payouts' })}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'payouts'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <span>Para Çekme (IBAN) Talepleri</span>
          {summary.pendingPayoutsCount > 0 ? (
            <span className="rounded-full bg-sky-500 px-1.5 py-0.2 text-[10px] text-white">
              {summary.pendingPayoutsCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'creators' })}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'creators'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <span>Aktif Üreticiler & Cüzdanlar</span>
        </button>
      </div>

      {/* ========================================================
          SEKME 1: BAŞVURULAR
         ======================================================== */}
      {activeTab === 'applications' ? (
        <div className="space-y-4">
          {/* Filtre Barı */}
          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={appFilters.q}
                onChange={(e) => setAppFilters((prev) => ({ ...prev, q: e.target.value, page: 1 }))}
                placeholder="Ad, kullanıcı adı veya e-posta ile ara..."
                className="flex-1 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs outline-none focus:border-zinc-500"
              />
              <select
                value={appFilters.status}
                onChange={(e) => setAppFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
                className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 outline-none"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="pending">Sadece Bekleyenler</option>
                <option value="approved">Onaylananlar</option>
                <option value="rejected">Reddedilenler</option>
              </select>
              <button
                type="button"
                onClick={() => setAppFilters({ q: '', status: 'all', page: 1, limit: 15 })}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                Temizle
              </button>
            </div>
          </div>

          {appState.error ? (
            <div className="rounded-xl bg-rose-50 p-4 text-xs font-medium text-rose-700">
              {appState.error}
            </div>
          ) : null}

          {/* Master-Detail 2 Sütunlu Görünüm */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
            {/* Sol: Başvuru Listesi */}
            <div className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-3.5 flex items-center justify-between text-xs text-zinc-500 font-semibold">
                <span>{appState.pagination?.totalItems || 0} Başvuru Bulundu</span>
                {appState.loading ? <span>Yükleniyor...</span> : null}
              </div>

              {!appState.loading && !appState.items.length ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  Bu filtrelerde başvuru kaydı bulunmuyor.
                </div>
              ) : null}

              <div className="divide-y divide-zinc-100">
                {appState.items.map((app) => (
                  <button
                    key={app._id}
                    type="button"
                    onClick={() => {
                      setSelectedApp(app)
                      setAppDecisionNote('')
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-zinc-50 cursor-pointer ${
                      selectedApp?._id === app._id ? 'bg-sky-50/70' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar user={app.user} className="size-10 shrink-0 ring-1 ring-zinc-200" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-xs font-bold text-zinc-900">
                          {getFullName(app.user)}
                          <VerifiedBadge user={app.user} />
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          @{app.user?.username} · {new Date(app.createdAt).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          app.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : app.status === 'rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {APPLICATION_STATUS_LABELS[app.status] || app.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sağ: Başvuru Detay & Karar Kartı */}
            <div>
              {selectedApp ? (
                <div className="sticky top-6 rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
                  {/* Başlık & Kullanıcı Özeti */}
                  <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
                    <UserAvatar user={selectedApp.user} className="size-12 ring-2 ring-zinc-200" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-bold text-sm text-zinc-950 truncate">
                        {getFullName(selectedApp.user)}
                        <VerifiedBadge user={selectedApp.user} />
                      </p>
                      <p className="text-xs text-zinc-500 truncate">@{selectedApp.user?.username} · {selectedApp.user?.email}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${
                        selectedApp.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : selectedApp.status === 'rejected'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {APPLICATION_STATUS_LABELS[selectedApp.status] || selectedApp.status}
                    </span>
                  </div>

                  {/* Kriter Karnesi (Snapshot) */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Otomatik Kriter Karnesi
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5">
                        <span className="text-zinc-500 block text-[11px]">Takipçi Sayısı</span>
                        <span className="font-bold text-zinc-800">
                          {selectedApp.metricsSnapshot?.followersCount ?? 0} / 100
                        </span>
                      </div>
                      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5">
                        <span className="text-zinc-500 block text-[11px]">30G İzlenme</span>
                        <span className="font-bold text-zinc-800">
                          {selectedApp.metricsSnapshot?.viewsCount30d ?? 0} / 1000
                        </span>
                      </div>
                      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5">
                        <span className="text-zinc-500 block text-[11px]">Hesap Yaşı</span>
                        <span className="font-bold text-zinc-800">
                          {selectedApp.metricsSnapshot?.accountAgeDays ?? 0} Gün (Min 14)
                        </span>
                      </div>
                      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5">
                        <span className="text-zinc-500 block text-[11px]">Doğrulanmış Profil</span>
                        <span className={`font-bold ${selectedApp.metricsSnapshot?.isProfileVerified || selectedApp.user?.verification?.status === 'approved' ? 'text-sky-600' : 'text-amber-600'}`}>
                          {selectedApp.metricsSnapshot?.isProfileVerified || selectedApp.user?.verification?.status === 'approved' ? '✓ Onaylı' : 'Eksik'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Niyet Mektubu / Açıklama */}
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Kanal / İçerik Açıklaması
                    </p>
                    <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700 leading-relaxed max-h-36 overflow-y-auto">
                      {selectedApp.statement || 'Herhangi bir açıklama girilmemiş.'}
                    </div>
                  </div>

                  {/* Karar Notu Girişi */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-700">
                      İnceleme Notu / Red Gerekçesi
                    </label>
                    <textarea
                      rows={2}
                      value={appDecisionNote}
                      onChange={(e) => setAppDecisionNote(e.target.value)}
                      placeholder="Kullanıcıya iletilecek açıklama veya gerekçe..."
                      className="w-full rounded-xl border border-zinc-200 p-2.5 text-xs outline-none focus:border-zinc-500"
                    />
                  </div>

                  {/* Aksiyon Butonları */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSavingApp}
                      onClick={() => handleAppDecision('approved')}
                      className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold !text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs transition"
                    >
                      {isSavingApp ? 'İşleniyor...' : '✓ Başvuruyu Onayla'}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingApp}
                      onClick={() => handleAppDecision('rejected')}
                      className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold !text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-xs transition"
                    >
                      {isSavingApp ? 'İşleniyor...' : '✕ Reddet'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-400">
                  Detayları ve karar seçeneklerini görmek için soldaki listeden bir başvuru seçin.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================
          SEKME 2: PARA ÇEKME (IBAN) TALEPLERİ
         ======================================================== */}
      {activeTab === 'payouts' ? (
        <div className="space-y-4">
          {/* Filtre Barı & CSV Dışa Aktar */}
          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                value={payoutFilters.q}
                onChange={(e) => setPayoutFilters((prev) => ({ ...prev, q: e.target.value, page: 1 }))}
                placeholder="Alıcı, kullanıcı adı veya IBAN ile ara..."
                className="flex-1 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs outline-none focus:border-zinc-500"
              />
              <select
                value={payoutFilters.status}
                onChange={(e) => setPayoutFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
                className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 outline-none"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="pending">Sadece Bekleyenler</option>
                <option value="processing">İşlemdekiler</option>
                <option value="completed">Ödenenler</option>
                <option value="rejected">İptal Edilenler</option>
              </select>
            </div>

            <button
              type="button"
              onClick={exportPayoutsToCsv}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
            >
              <span>📥</span>
              <span>Excel / CSV Dışa Aktar</span>
            </button>
          </div>

          {payoutState.error ? (
            <div className="rounded-xl bg-rose-50 p-4 text-xs font-medium text-rose-700">
              {payoutState.error}
            </div>
          ) : null}

          {/* Çekim Talepleri Tablosu */}
          <div className="overflow-x-auto rounded-[24px] border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Üretici</th>
                  <th className="px-5 py-3">Çekim Tutarı</th>
                  <th className="px-5 py-3">Banka & Alıcı</th>
                  <th className="px-5 py-3">IBAN Numarası</th>
                  <th className="px-5 py-3">Talep Tarihi</th>
                  <th className="px-5 py-3">Durum</th>
                  <th className="px-5 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payoutState.loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-400">
                      Yükleniyor...
                    </td>
                  </tr>
                ) : !payoutState.items.length ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-400">
                      Kayıtlı çekim talebi bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  payoutState.items.map((payout) => (
                    <tr key={payout._id} className="hover:bg-zinc-50/70 transition">
                      {/* Üretici */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar user={payout.user} className="size-8 ring-1 ring-zinc-200" />
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-900 block truncate">
                              {getFullName(payout.user)}
                            </span>
                            <span className="text-[11px] text-zinc-400">@{payout.user?.username}</span>
                          </div>
                        </div>
                      </td>

                      {/* Tutar */}
                      <td className="px-5 py-3.5 font-bold text-zinc-900">
                        ₺{payout.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Banka & Alıcı */}
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-zinc-800 block">{payout.fullName}</span>
                        <span className="text-[11px] text-zinc-400">{payout.bankName || 'Banka Belirtilmemiş'}</span>
                      </td>

                      {/* IBAN */}
                      <td className="px-5 py-3.5 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span>{payout.iban}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyIban(payout.iban)}
                            title="IBAN Kopyala"
                            className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                          >
                            📋
                          </button>
                        </div>
                      </td>

                      {/* Tarih */}
                      <td className="px-5 py-3.5 text-zinc-500 text-[11px]">
                        {new Date(payout.requestedAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Durum */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            payout.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : payout.status === 'rejected'
                              ? 'bg-rose-100 text-rose-700'
                              : payout.status === 'processing'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {PAYOUT_STATUS_LABELS[payout.status] || payout.status}
                        </span>
                      </td>

                      {/* Aksiyon */}
                      <td className="px-5 py-3.5 text-right">
                        {payout.status === 'pending' || payout.status === 'processing' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayoutForAction(payout)
                                setPayoutActionType('completed')
                                setPayoutReceiptUrl('')
                              }}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold !text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              Öde
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPayoutForAction(payout)
                                setPayoutActionType('rejected')
                                setPayoutRejectionReason('')
                              }}
                              className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 cursor-pointer"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400">Sonuçlandı</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Çekim İşlem Modalı (Ödeme Onayı / Red) */}
          {selectedPayoutForAction ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-950">
                    {payoutActionType === 'completed' ? 'Ödemeyi Tamamla / Dekont Gir' : 'Talebi İptal Et & Bakiyeyi İade Et'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedPayoutForAction(null)}
                    className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="rounded-xl bg-zinc-50 p-3 text-xs space-y-1 text-zinc-700">
                  <p><strong>Alıcı:</strong> {selectedPayoutForAction.fullName}</p>
                  <p><strong>Banka & IBAN:</strong> {selectedPayoutForAction.bankName} - {selectedPayoutForAction.iban}</p>
                  <p><strong>Ödenecek Tutar:</strong> ₺{selectedPayoutForAction.amount.toLocaleString('tr-TR')}</p>
                </div>

                {payoutActionType === 'completed' ? (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Banka Dekont / Referans No (Opsiyonel)
                    </label>
                    <input
                      type="text"
                      value={payoutReceiptUrl}
                      onChange={(e) => setPayoutReceiptUrl(e.target.value)}
                      placeholder="Örn: TR-REF-2026-99120"
                      className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs outline-none focus:border-zinc-500"
                    />
                    <p className="text-[11px] text-zinc-400">
                      Bu işlem onaylandığında üreticinin bekleyen bakiyesi sıfırlanır ve bildirim gönderilir.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">
                      İptal Gerekçesi (Kullanıcıya İletilecek)
                    </label>
                    <textarea
                      rows={3}
                      value={payoutRejectionReason}
                      onChange={(e) => setPayoutRejectionReason(e.target.value)}
                      placeholder="Hatalı IBAN, isim uyuşmazlığı vb. açıklayınız..."
                      className="w-full rounded-xl border border-zinc-200 p-3 text-xs outline-none focus:border-zinc-500"
                    />
                    <p className="text-[11px] text-amber-600 font-medium">
                      ⚠️ İptal edildiğinde ₺{selectedPayoutForAction.amount} tutarındaki bakiye kullanıcının cüzdanına eksiksiz iade edilecektir.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPayoutForAction(null)}
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={isSavingPayout}
                    onClick={handlePayoutSubmit}
                    className={`rounded-xl px-5 py-2 text-xs font-bold !text-white shadow-xs cursor-pointer ${
                      payoutActionType === 'completed'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {isSavingPayout ? 'İşleniyor...' : payoutActionType === 'completed' ? 'Ödemeyi Onayla' : 'Talebi İptal Et ve İade Et'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ========================================================
          SEKME 3: AKTİF ÜRETİCİLER & CÜZDANLAR
         ======================================================== */}
      {activeTab === 'creators' ? (
        <div className="space-y-4">
          {/* Filtre Barı */}
          <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={creatorFilters.q}
                onChange={(e) => setCreatorFilters((prev) => ({ ...prev, q: e.target.value, page: 1 }))}
                placeholder="Üretici adı, kullanıcı adı veya e-posta ile ara..."
                className="flex-1 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs outline-none focus:border-zinc-500"
              />
              <select
                value={creatorFilters.status}
                onChange={(e) => setCreatorFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
                className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 outline-none"
              >
                <option value="all">Tüm Cüzdan Durumları</option>
                <option value="active">Sadece Aktifler</option>
                <option value="frozen">Dondurulanlar</option>
              </select>
            </div>
          </div>

          {creatorState.error ? (
            <div className="rounded-xl bg-rose-50 p-4 text-xs font-medium text-rose-700">
              {creatorState.error}
            </div>
          ) : null}

          {/* Üreticiler Tablosu */}
          <div className="overflow-x-auto rounded-[24px] border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Üretici Profili</th>
                  <th className="px-5 py-3">Kullanılabilir Bakiye</th>
                  <th className="px-5 py-3">Bekleyen Çekim</th>
                  <th className="px-5 py-3">Toplam Kazanç</th>
                  <th className="px-5 py-3">Cüzdan Durumu</th>
                  <th className="px-5 py-3 text-right">Güvenlik / İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {creatorState.loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-400">
                      Yükleniyor...
                    </td>
                  </tr>
                ) : !creatorState.items.length ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-400">
                      Kayıtlı üretici cüzdanı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  creatorState.items.map((wallet) => (
                    <tr key={wallet._id} className="hover:bg-zinc-50/70 transition">
                      {/* Üretici */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar user={wallet.user} className="size-9 ring-1 ring-zinc-200" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1 font-bold text-zinc-900 truncate">
                              {getFullName(wallet.user)}
                              <VerifiedBadge user={wallet.user} />
                            </p>
                            <span className="text-[11px] text-zinc-400">@{wallet.user?.username}</span>
                          </div>
                        </div>
                      </td>

                      {/* Bakiye */}
                      <td className="px-5 py-3.5 font-bold text-zinc-900">
                        ₺{(wallet.balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Bekleyen */}
                      <td className="px-5 py-3.5 text-zinc-600">
                        ₺{(wallet.pendingBalance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Toplam */}
                      <td className="px-5 py-3.5 font-bold text-emerald-600">
                        ₺{(wallet.lifetimeEarnings || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Durum */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            wallet.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {wallet.status === 'active' ? 'Aktif' : 'Donduruldu'}
                        </span>
                      </td>

                      {/* Aksiyon */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          disabled={isSavingWallet}
                          onClick={() => handleToggleWalletStatus(wallet.user?._id, wallet.status)}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer transition ${
                            wallet.status === 'active'
                              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {wallet.status === 'active' ? 'Cüzdanı Dondur' : 'Cüzdanı Aç'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <ActionToast toast={toast} onClose={() => setToast({ message: '', tone: 'success' })} />
    </div>
  )
}
