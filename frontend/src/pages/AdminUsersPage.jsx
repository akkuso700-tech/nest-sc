import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import BulkActionBar from '../components/admin/BulkActionBar.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ConfirmActionDialog from '../components/feedback/ConfirmActionDialog.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import {
  bulkDeleteAdminUsers,
  bulkUpdateAdminUserStatus,
  getAdminUsers,
} from '../services/adminService.js'
import { formatLocation, formatRelativeTime, getFullName } from '../utils/social.js'

const initialFilters = {
  q: '',
  role: 'all',
  accountStatus: 'all',
  sourcePage: 'all',
  country: '',
  sortBy: 'createdAt',
  sortDirection: 'desc',
  page: 1,
  limit: 20,
  period: 'all',
  dateFrom: '',
  dateTo: '',
}

function formatPlatformName(platform) {
  if (!platform || platform === 'direct') return 'Doğrudan'
  const p = platform.toLowerCase()
  if (p === 'instagram') return 'Instagram'
  if (p === 'google') return 'Google'
  if (p === 'twitter') return 'X (Twitter)'
  if (p === 'tiktok') return 'TikTok'
  if (p === 'facebook') return 'Facebook'
  if (p === 'youtube') return 'YouTube'
  if (p === 'linkedin') return 'LinkedIn'
  if (p === 'threads') return 'Threads'
  if (p === 'whatsapp') return 'WhatsApp'
  if (p === 'telegram') return 'Telegram'
  if (p === 'referral') return 'Dış Bağlantı'
  return platform
}

function renderPlatformIcon(platform) {
  const p = (platform || 'direct').toLowerCase()
  if (p === 'instagram') {
    return (
      <span className="inline-flex size-3.5 items-center justify-center rounded-sm bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-[8px] text-white font-bold">
        ig
      </span>
    )
  }
  if (p === 'google') {
    return <span className="text-[11px]">🔍</span>
  }
  if (p === 'twitter') {
    return <span className="text-[11px] font-bold">𝕏</span>
  }
  if (p === 'tiktok') {
    return <span className="text-[11px]">🎵</span>
  }
  if (p === 'facebook') {
    return <span className="text-[11px] font-bold text-blue-600">f</span>
  }
  if (p === 'youtube') {
    return <span className="text-[11px] text-red-600">▶</span>
  }
  return <span className="text-[11px] text-slate-400">🌐</span>
}

function renderSourcePageBadge(sourcePage) {
  if (!sourcePage) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        -
      </span>
    )
  }

  if (sourcePage === 'shadow_mode') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200/70">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        Gölge Modu
      </span>
    )
  }

  if (sourcePage === 'about') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 border border-sky-200/70">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Hakkımızda
      </span>
    )
  }

  if (sourcePage === 'creators') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200/70">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        İçerik Üretici
      </span>
    )
  }

  if (sourcePage === 'login') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/70">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Giriş Ekranı
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200/70">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Standart (Web)
    </span>
  )
}

function renderAcquisitionTooltip(acquisition) {
  if (!acquisition) return 'Kayıt kaynağı bilgisi mevcut değil'
  const lines = []
  if (acquisition.sourcePage) lines.push(`Kayıt Sayfası: ${acquisition.sourcePage}`)
  if (acquisition.platform) lines.push(`Trafik Platformu: ${formatPlatformName(acquisition.platform)}`)
  if (acquisition.referrer) lines.push(`Yönlendiren (Referrer): ${acquisition.referrer}`)
  if (acquisition.utmSource) lines.push(`UTM Kaynağı: ${acquisition.utmSource}`)
  if (acquisition.utmMedium) lines.push(`UTM Ortamı: ${acquisition.utmMedium}`)
  if (acquisition.utmCampaign) lines.push(`UTM Kampanyası: ${acquisition.utmCampaign}`)
  if (acquisition.landingPage) lines.push(`İlk Giriş Sayfası: ${acquisition.landingPage}`)
  return lines.join('\n') || 'Kayıt kaynağı bilgisi mevcut değil'
}

function AdminUsersPage() {
  const { lang = 'tr' } = useParams()
  const [filters, setFilters] = useState(initialFilters)
  const [draftFilters, setDraftFilters] = useState(initialFilters)
  const [searchInput, setSearchInput] = useState(initialFilters.q)
  const [portalTarget, setPortalTarget] = useState(null)
  const [customDateOpen, setCustomDateOpen] = useState(false)
  const [customDateRange, setCustomDateRange] = useState({
    dateFrom: '',
    dateTo: '',
  })
  const customDateWrapRef = useRef(null)

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const mobileSearchInputRef = useRef(null)

  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [bulkMessage, setBulkMessage] = useState('')
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const [bulkDialog, setBulkDialog] = useState(null)
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false)
  const [state, setState] = useState({
    items: [],
    pagination: null,
    isLoading: true,
    error: '',
  })

  useEffect(() => {
    setPortalTarget(document.getElementById('admin-topbar-portal'))
  }, [])

  useEffect(() => {
    setSearchInput(filters.q)
  }, [filters.q])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.q) {
        setFilters((curr) => ({ ...curr, q: searchInput, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, filters.q])

  useEffect(() => {
    if (isMobileSearchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus()
    }
  }, [isMobileSearchOpen])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMobileSearchOpen(false)
        setIsMobileFilterOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const activeFilterCount =
    (filters.role !== 'all' ? 1 : 0) +
    (filters.accountStatus !== 'all' ? 1 : 0) +
    (filters.sourcePage !== 'all' ? 1 : 0)

  useEffect(() => {
    if (!customDateOpen) return undefined
    function handleClickOutside(event) {
      if (customDateWrapRef.current && !customDateWrapRef.current.contains(event.target)) {
        setCustomDateOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [customDateOpen])

  useEffect(() => {
    if (!toast.message) return undefined
    const timer = window.setTimeout(() => {
      setToast({ message: '', tone: 'success' })
    }, 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      setState((current) => ({ ...current, isLoading: true, error: '' }))
      try {
        const payload = await getAdminUsers(filters)
        if (cancelled) return
        setState({
          items: payload.users || [],
          pagination: payload.pagination || null,
          isLoading: false,
          error: '',
        })
        setSelectedUserIds([])
      } catch (error) {
        if (cancelled) return
        setState((current) => ({
          ...current,
          isLoading: false,
          error: error.message || 'Kullanıcılar yüklenemedi.',
        }))
      }
    }

    loadUsers()
    return () => {
      cancelled = true
    }
  }, [filters])

  function handleSort(key) {
    const isSameKey = filters.sortBy === key
    const nextDirection = isSameKey && filters.sortDirection === 'desc' ? 'asc' : 'desc'

    setDraftFilters((current) => ({
      ...current,
      sortBy: key,
      sortDirection: nextDirection,
      page: 1,
    }))
    setFilters((current) => ({
      ...current,
      sortBy: key,
      sortDirection: nextDirection,
      page: 1,
    }))
  }

  function renderSortIcon(key) {
    const isActive = filters.sortBy === key
    const isAsc = isActive && filters.sortDirection === 'asc'
    const isDesc = isActive && filters.sortDirection === 'desc'

    return (
      <span className="ml-1.5 inline-flex shrink-0 flex-col items-center justify-center leading-none text-slate-400">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-3.5 w-3.5 transition ${isAsc ? 'text-blue-600 font-bold' : 'text-slate-300'}`}
        >
          <path d="M10 5L6 9H14L10 5Z" fill="currentColor" />
        </svg>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`-mt-1.5 h-3.5 w-3.5 transition ${isDesc ? 'text-blue-600 font-bold' : 'text-slate-300'}`}
        >
          <path d="M10 15L14 11H6L10 15Z" fill="currentColor" />
        </svg>
      </span>
    )
  }

  function handleFilterSelect(key, val) {
    setFilters((current) => ({
      ...current,
      [key]: val,
      page: 1,
    }))
  }

  function handlePeriodSelect(period) {
    if (period === 'custom') {
      setCustomDateOpen((current) => !current)
      return
    }
    setCustomDateOpen(false)
    setFilters((current) => ({
      ...current,
      period,
      dateFrom: '',
      dateTo: '',
      page: 1,
    }))
  }

  function handleApplyCustomDate(event) {
    event.preventDefault()
    if (!customDateRange.dateFrom || !customDateRange.dateTo) return
    setFilters((current) => ({
      ...current,
      period: 'custom',
      dateFrom: customDateRange.dateFrom,
      dateTo: customDateRange.dateTo,
      page: 1,
    }))
    setCustomDateOpen(false)
  }

  function handleResetFilters() {
    setSearchInput('')
    setCustomDateOpen(false)
    setCustomDateRange({ dateFrom: '', dateTo: '' })
    setDraftFilters(initialFilters)
    setFilters(initialFilters)
  }

  function toggleSelectedUser(userId) {
    setSelectedUserIds((currentIds) =>
      currentIds.includes(userId)
        ? currentIds.filter((id) => id !== userId)
        : [...currentIds, userId],
    )
  }

  function toggleSelectAllCurrentPage() {
    const currentPageIds = state.items.map((item) => item._id)
    if (!currentPageIds.length) return
    const allSelected = currentPageIds.every((id) => selectedUserIds.includes(id))

    if (allSelected) {
      setSelectedUserIds((currentIds) =>
        currentIds.filter((id) => !currentPageIds.includes(id)),
      )
    } else {
      setSelectedUserIds((currentIds) => [
        ...new Set([...currentIds, ...currentPageIds]),
      ])
    }
  }

  function handleBulkStatus(accountStatus) {
    if (!selectedUserIds.length) return
    setBulkDialog({
      type: 'status',
      accountStatus,
      title:
        accountStatus === 'suspended'
          ? `${selectedUserIds.length} Kullanıcıyı Askıya Al`
          : `${selectedUserIds.length} Kullanıcıyı Yeniden Aktif Et`,
      description:
        accountStatus === 'suspended'
          ? 'Seçilen kullanıcıların hesapları askıya alınacak ve yönetici tekrar açana kadar giriş yapamayacaklar.'
          : 'Seçilen hesapların platform erişimi tekrar aktif hale getirilecektir.',
    })
  }

  function handleBulkDelete() {
    if (!selectedUserIds.length) return
    setBulkDialog({
      type: 'delete',
      title: `${selectedUserIds.length} Kullanıcıyı Kalıcı Olarak Sil`,
      description:
        'Bu işlem geri alınamaz! Seçilen kullanıcıların profilleri, gönderileri ve tüm verileri sistemden kalıcı olarak silinir.',
    })
  }

  async function confirmBulkAction(reason) {
    if (!bulkDialog) return
    setIsSubmittingBulk(true)
    try {
      let payload = null
      if (bulkDialog.type === 'delete') {
        payload = await bulkDeleteAdminUsers({
          userIds: selectedUserIds,
          reason,
        })
      } else {
        payload = await bulkUpdateAdminUserStatus({
          userIds: selectedUserIds,
          accountStatus: bulkDialog.accountStatus,
          reason,
        })
      }
      setBulkMessage(payload.message)
      setToast({ message: payload.message, tone: 'success' })
      setFilters((current) => ({ ...current }))
      setBulkDialog(null)
    } catch (error) {
      setToast({
        message:
          error.message ||
          (bulkDialog.type === 'delete'
            ? 'Toplu hesap silme işlemi tamamlanamadı.'
            : 'Toplu moderasyon işlemi tamamlanamadı.'),
        tone: 'error',
      })
    } finally {
      setIsSubmittingBulk(false)
    }
  }

  function changePage(nextPage) {
    setFilters((current) => ({ ...current, page: nextPage }))
  }

  function handleLimitChange(nextLimit) {
    const limitNum = Number(nextLimit) || 20
    setFilters((current) => ({
      ...current,
      limit: limitNum,
      page: 1,
    }))
  }

  const allCurrentSelected =
    state.items.length > 0 &&
    state.items.every((item) => selectedUserIds.includes(item._id))

  return (
    <>

      {portalTarget &&
        createPortal(
          <div className="flex md:hidden items-center gap-1.5 ml-auto">
            {/* Arama İkon Butonu */}
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(true)}
              className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                searchInput
                  ? 'border-blue-500 bg-blue-50 text-blue-600 font-semibold'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              aria-label="Kullanıcı ara"
              title="Kullanıcı Ara"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchInput ? (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
              ) : null}
            </button>

            {/* Filtre İkon Butonu */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                activeFilterCount > 0
                  ? 'border-blue-500 bg-blue-50 text-blue-600 font-semibold'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              aria-label="Filtreleri aç"
              title="Filtreler"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {activeFilterCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-extrabold text-white ring-2 ring-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>,
          portalTarget,
        )}

      {/* Mobilde Arama İkonuna Basınca Açılan 48px Tam Genişlik Arama Barı */}
      {isMobileSearchOpen && (
        <div className="fixed top-0 left-0 right-0 h-12 z-50 flex items-center gap-2 bg-white px-3 border-b border-slate-200 shadow-md md:hidden animate-in fade-in duration-150">
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition"
            aria-label="Aramayı kapat"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              ref={mobileSearchInputRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ad, kullanıcı adı, e-posta veya ülke ara..."
              className="h-8.5 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white"
              autoFocus
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setFilters((curr) => ({ ...curr, q: '', page: 1 }))
                }}
                className="absolute inset-y-0 right-2 flex items-center text-xs text-slate-400 hover:text-slate-600"
                aria-label="Aramayı temizle"
              >
                ✕
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(false)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-1 py-1"
          >
            Bitti
          </button>
        </div>
      )}

      {/* Mobilde Filtre İkonuna Tıklayınca Açılan Filtre Paneli (Tüm roller, tüm durumlar, tüm kaynaklar) */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          {/* Karartma Arkalığı */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileFilterOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom Sheet Kartı */}
          <div className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Kullanıcı Filtreleri</h3>
                  {activeFilterCount > 0 ? (
                    <span className="text-[11px] font-medium text-blue-600">{activeFilterCount} filtre aktif</span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Rol, durum ve kaynak seçin</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters((curr) => ({
                        ...curr,
                        role: 'all',
                        accountStatus: 'all',
                        sourcePage: 'all',
                        page: 1,
                      }))
                    }}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-md hover:bg-rose-50 transition"
                  >
                    Sıfırla
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Filtreleri kapat"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Form Elemanları */}
            <div className="mt-4 space-y-4">
              {/* 1. Tüm Roller */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Rol</label>
                <div className="relative">
                  <select
                    value={filters.role}
                    onChange={(e) => handleFilterSelect('role', e.target.value)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="all">Tüm Roller</option>
                    <option value="user">Kullanıcı</option>
                    <option value="moderator">Moderatör</option>
                    <option value="admin">Yönetici (Admin)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 2. Tüm Durumlar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Hesap Durumu</label>
                <div className="relative">
                  <select
                    value={filters.accountStatus}
                    onChange={(e) => handleFilterSelect('accountStatus', e.target.value)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="all">Tüm Durumlar</option>
                    <option value="active">Aktif Hesaplar</option>
                    <option value="suspended">Askıdaki Hesaplar</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 3. Tüm Kaynaklar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Kayıt Kaynağı</label>
                <div className="relative">
                  <select
                    value={filters.sourcePage}
                    onChange={(e) => handleFilterSelect('sourcePage', e.target.value)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="all">Tüm Kaynaklar</option>
                    <option value="normal">⚪ Standart (Web)</option>
                    <option value="shadow_mode">🟣 Gölge Modu</option>
                    <option value="about">🔵 Hakkımızda</option>
                    <option value="creators">🟠 İçerik Üretici</option>
                    <option value="login">🟢 Giriş Ekranı</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Buton */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(false)}
              className="mt-6 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
            >
              <span>Sonuçları Göster</span>
              {state.pagination ? `(${state.pagination.totalItems} Kayıt)` : ''}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col space-y-0 md:space-y-3">
        {/* Toplu İşlem / Bildirim Mesajı */}
        {bulkMessage ? (
          <div className="shrink-0 flex items-center justify-between rounded-none md:rounded-xl border-y md:border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
            <span>{bulkMessage}</span>
            <button
              type="button"
              onClick={() => setBulkMessage('')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-900"
            >
              Kapat
            </button>
          </div>
        ) : null}

        {/* Hata Alanı */}
        {state.error ? (
          <div className="shrink-0 rounded-none md:rounded-2xl border-y md:border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {state.error}
          </div>
        ) : null}

        {/* Ana İçerik Kartı: Tablo & Kartlar */}
        <div className="admin-users-card relative overflow-hidden border border-slate-200 bg-white shadow-sm rounded-none md:rounded-md border-x-0 md:border-x">
          <BulkActionBar
            count={selectedUserIds.length}
            label="kullanıcı"
            onClear={() => setSelectedUserIds([])}
            className="absolute top-1.5 left-2 right-2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:min-w-[560px] max-w-2xl"
            actions={[
              {
                label: 'Yeniden Aktif Et',
                tone: 'success',
                onClick: () => handleBulkStatus('active'),
              },
              {
                label: 'Askıya Al',
                tone: 'danger',
                onClick: () => handleBulkStatus('suspended'),
              },
              {
                label: 'Hesabı Sil',
                tone: 'danger',
                onClick: handleBulkDelete,
              },
            ]}
          />

          {/* Üst Bar: Seçim Sayısı, Tarih Filtresi ve Toplam Kayıt */}
          <div className="relative z-20 shrink-0 flex items-center justify-between gap-1.5 md:gap-3 border-b border-slate-100 px-2.5 md:px-5 h-[42px] min-h-[42px] max-h-[42px] bg-slate-50/50">
            <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
              <label className="inline-flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allCurrentSelected}
                  onChange={toggleSelectAllCurrentPage}
                  className="size-3.5 md:size-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Tümü</span>
              </label>
              {selectedUserIds.length > 0 && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 md:px-2.5 text-[10px] md:text-xs font-semibold text-blue-700 whitespace-nowrap">
                  <span className="hidden md:inline">{selectedUserIds.length} kullanıcı seçili</span>
                  <span className="inline md:hidden">{selectedUserIds.length} seçili</span>
                </span>
              )}
            </div>

            {/* Masaüstü Arama ve Filtreler (Rol, Durum, Kaynak) */}
            <div className="hidden md:flex items-center gap-2 flex-1 min-w-0 max-w-2xl mx-2">
              {/* Arama Alanı (ad, kullanıcı adı, e-posta ve ülke) */}
              <div className="relative min-w-[150px] max-w-xs flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Ara (ad, kullanıcı, e-posta, ülke)..."
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      setFilters((curr) => ({ ...curr, q: '', page: 1 }))
                    }}
                    className="absolute inset-y-0 right-2 flex items-center text-xs text-slate-400 hover:text-slate-600"
                    aria-label="Aramayı temizle"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {/* Rol Filtresi */}
              <div className="relative shrink-0">
                <select
                  value={filters.role}
                  onChange={(e) => handleFilterSelect('role', e.target.value)}
                  className="h-8 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-6 text-xs font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="all">Tüm Roller</option>
                  <option value="user">Kullanıcı</option>
                  <option value="moderator">Moderatör</option>
                  <option value="admin">Yönetici (Admin)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Durum Filtresi */}
              <div className="relative shrink-0">
                <select
                  value={filters.accountStatus}
                  onChange={(e) => handleFilterSelect('accountStatus', e.target.value)}
                  className="h-8 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-6 text-xs font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="all">Tüm Durumlar</option>
                  <option value="active">Aktif Hesaplar</option>
                  <option value="suspended">Askıdaki Hesaplar</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Kayıt Kaynağı Filtresi */}
              <div className="relative shrink-0">
                <select
                  value={filters.sourcePage}
                  onChange={(e) => handleFilterSelect('sourcePage', e.target.value)}
                  className="h-8 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-6 text-xs font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="all">Tüm Kaynaklar</option>
                  <option value="normal">⚪ Standart (Web)</option>
                  <option value="shadow_mode">🟣 Gölge Modu</option>
                  <option value="about">🔵 Hakkımızda</option>
                  <option value="creators">🟠 İçerik Üretici</option>
                  <option value="login">🟢 Giriş Ekranı</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-3 ml-auto shrink-0">
              {/* Tarih Filtreleme: Bugün, Dün, 7, 28, 90, Özel */}
              <div className="relative" ref={customDateWrapRef}>
                <div className="inline-flex items-center p-0.5 rounded-lg border border-slate-200 bg-slate-100/70 text-[11px] md:text-xs font-medium text-slate-600">
                  {[
                    ['all', 'Tümü'],
                    ['today', 'Bugün'],
                    ['yesterday', 'Dün'],
                    ['7d', '7'],
                    ['28d', '28'],
                    ['90d', '90'],
                  ].map(([key, label]) => {
                    const isActive = (filters.period || 'all') === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handlePeriodSelect(key)}
                        className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-md transition whitespace-nowrap ${
                          isActive
                            ? 'bg-white font-semibold text-slate-900 shadow-sm'
                            : 'hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}

                  <button
                    type="button"
                    onClick={() => handlePeriodSelect('custom')}
                    className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-md transition inline-flex items-center gap-0.5 md:gap-1 whitespace-nowrap ${
                      filters.period === 'custom'
                        ? 'bg-white font-semibold text-slate-900 shadow-sm'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    <span>Özel</span>
                    <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {customDateOpen && (
                  <div className="absolute right-0 top-full mt-2 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl">
                    <form onSubmit={handleApplyCustomDate} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Başlangıç Tarihi</label>
                        <input
                          type="date"
                          value={customDateRange.dateFrom}
                          onChange={(e) => setCustomDateRange((curr) => ({ ...curr, dateFrom: e.target.value }))}
                          className="h-8.5 w-full rounded-lg border border-slate-200 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bitiş Tarihi</label>
                        <input
                          type="date"
                          value={customDateRange.dateTo}
                          onChange={(e) => setCustomDateRange((curr) => ({ ...curr, dateTo: e.target.value }))}
                          className="h-8.5 w-full rounded-lg border border-slate-200 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setCustomDateOpen(false)}
                          className="h-7.5 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          İptal
                        </button>
                        <button
                          type="submit"
                          disabled={!customDateRange.dateFrom || !customDateRange.dateTo}
                          className="h-7.5 px-3 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          Uygula
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Toplam Kayıt Sayısı */}
              <div className="text-[11px] md:text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
                {state.pagination ? (
                  <>
                    <span className="hidden sm:inline">Toplam </span>
                    {state.pagination.totalItems} kayıt
                  </>
                ) : ''}
              </div>
            </div>
          </div>

          {/* Masaüstü Tablo Görünümü */}
          <div className="hidden md:block admin-table-container admin-users-table-container">
            <table className="admin-table min-w-[1380px]">
              <thead>
                <tr>
                  <th className="sticky-col-0 w-12 text-center">
                    <span className="sr-only">Seç</span>
                  </th>
                  <th className="sticky-col-1 w-14 text-center">Avatar</th>
                  <th className="sticky-col-2 w-60">Kullanıcı</th>
                  <th className="w-56">E-posta</th>
                  <th className="w-44">IP & Konum</th>
                  <th className="w-28">Dil</th>
                  <th className="w-32">Rol</th>
                  <th className="w-32">Durum</th>
                  <th className="w-44">Kayıt Kaynağı</th>
                  <th className="w-40">
                    <button
                      type="button"
                      onClick={() => handleSort('createdAt')}
                      className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
                    >
                      <span>Kayıt Tarihi</span>
                      {renderSortIcon('createdAt')}
                    </button>
                  </th>
                  <th className="w-24 text-right pr-6">İşlem</th>
                </tr>
              </thead>

              <tbody>
                {state.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={11} className="p-0">
                        <div className="admin-table-skeleton" />
                      </td>
                    </tr>
                  ))
                ) : state.items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-800">Kullanıcı bulunamadı</p>
                        <p className="mt-1 text-xs text-slate-500">Arama kriterlerinize uygun kayıt bulunmuyor.</p>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          Filtreleri Temizle
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  state.items.map((userItem) => {
                    const avatarSrc =
                      userItem.avatar?.url ||
                      userItem.avatarUrl ||
                      userItem.profilePhoto ||
                      userItem.profileImage
                    const fullName = getFullName(userItem)
                    const username = userItem.username ? `@${userItem.username}` : '-'
                    const email = userItem.email || '-'
                    const ipAddress = userItem.signupConsent?.ipAddress || '-'
                    const approxCity = userItem.signupConsent?.city || ''
                    const approxCountry = userItem.signupConsent?.country || ''
                    const approxLocation = [approxCity, approxCountry].filter(Boolean).join(', ')
                    const location = formatLocation(userItem.location)
                    const profileLanguage = userItem.signupConsent?.language || '-'
                    const isSuspended = userItem.accountStatus === 'suspended'
                    const isSelected = selectedUserIds.includes(userItem._id)

                    return (
                      <tr
                        key={userItem._id}
                        className={isSelected ? '!bg-blue-50/40' : ''}
                      >
                        {/* Checkbox */}
                        <td className="sticky-col-0 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectedUser(userItem._id)}
                            aria-label={`${fullName} seç`}
                            className="size-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>

                        {/* Avatar */}
                        <td className="sticky-col-1 text-center">
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 font-semibold text-slate-600 text-xs">
                            {avatarSrc ? (
                              <img
                                src={avatarSrc}
                                alt={fullName}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              fullName?.trim()?.charAt(0)?.toUpperCase() || '?'
                            )}
                          </div>
                        </td>

                        {/* Kullanıcı Adı & Handle */}
                        <td className="sticky-col-2">
                          <div className="min-w-0 pr-2">
                            <p className="flex items-center gap-1.5 truncate font-semibold text-slate-900">
                              <span className="truncate">{fullName || '-'}</span>
                              <VerifiedBadge user={userItem} size="xs" />
                            </p>
                            <p className="truncate text-xs font-medium text-slate-500">{username}</p>
                          </div>
                        </td>

                        {/* E-posta */}
                        <td className="text-sm text-slate-700">
                          <span className="truncate block max-w-[200px]" title={email}>
                            {email}
                          </span>
                        </td>

                        {/* IP ve Lokasyon */}
                        <td>
                          <div className="text-xs">
                            <p className="font-mono text-slate-700">{ipAddress}</p>
                            <p className="mt-0.5 text-slate-500 truncate max-w-[150px]">
                              {location || approxLocation || '-'}
                            </p>
                          </div>
                        </td>

                        {/* Dil */}
                        <td>
                          <span className="admin-stat-chip uppercase tracking-wider text-[10px]">
                            {profileLanguage}
                          </span>
                        </td>

                        {/* Rol */}
                        <td>
                          <span
                            className={`admin-badge ${
                              userItem.role === 'admin'
                                ? 'is-danger'
                                : userItem.role === 'moderator'
                                  ? 'is-primary'
                                  : 'is-neutral'
                            }`}
                          >
                            {userItem.role === 'admin'
                              ? 'Admin'
                              : userItem.role === 'moderator'
                                ? 'Moderatör'
                                : 'Kullanıcı'}
                          </span>
                        </td>

                        {/* Hesap Durumu */}
                        <td>
                          <span
                            className={`admin-badge ${
                              isSuspended ? 'is-danger' : 'is-success'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isSuspended ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                            />
                            {isSuspended ? 'Askıda' : 'Aktif'}
                          </span>
                        </td>

                        {/* Kayıt Kaynağı & Platform */}
                        <td>
                          <div className="text-xs">
                            <div className="flex items-center gap-1.5">
                              {renderSourcePageBadge(userItem.acquisition?.sourcePage)}
                            </div>
                            <div
                              className="mt-1 flex items-center gap-1 text-slate-500 font-medium truncate max-w-[170px]"
                              title={renderAcquisitionTooltip(userItem.acquisition)}
                            >
                              {renderPlatformIcon(userItem.acquisition?.platform)}
                              <span className="capitalize truncate">
                                {formatPlatformName(userItem.acquisition?.platform)}
                              </span>
                              {userItem.acquisition?.utmCampaign ? (
                                <span
                                  className="rounded bg-blue-50 text-blue-700 px-1 py-0.2 text-[9px] font-mono font-semibold"
                                  title={`UTM Kampanya: ${userItem.acquisition.utmCampaign}`}
                                >
                                  UTM
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* Kayıt Tarihi & Son Giriş */}
                        <td>
                          <div className="text-xs">
                            <p className="font-medium text-slate-700">
                              {userItem.createdAt
                                ? new Date(userItem.createdAt).toLocaleDateString('tr-TR')
                                : '-'}
                            </p>
                            <p
                              className="mt-0.5 text-slate-400 truncate"
                              title={
                                userItem.lastLoginAt
                                  ? `Son Giriş: ${new Date(userItem.lastLoginAt).toLocaleString('tr-TR')}`
                                  : 'Hiç giriş yapmadı'
                              }
                            >
                              {userItem.lastLoginAt
                                ? formatRelativeTime(userItem.lastLoginAt)
                                : 'Hiç giriş yapmadı'}
                            </p>
                          </div>
                        </td>

                        {/* İşlem */}
                        <td className="text-right pr-6">
                          <Link
                            to={`/${lang}/admin/users/${userItem._id}`}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-blue-600"
                          >
                            İncele
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobil ve Tablet Kart Görünümü */}
          <div className="divide-y divide-slate-100 md:hidden">
            {state.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="p-4">
                  <div className="admin-table-skeleton rounded-xl" />
                </div>
              ))
            ) : state.items.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <p className="text-sm font-semibold text-slate-800">Kullanıcı bulunamadı</p>
                <p className="mt-1 text-xs text-slate-500">Arama kriterlerinizi değiştirmeyi deneyin.</p>
              </div>
            ) : (
              state.items.map((userItem) => {
                const avatarSrc =
                  userItem.avatar?.url ||
                  userItem.avatarUrl ||
                  userItem.profilePhoto ||
                  userItem.profileImage
                const fullName = getFullName(userItem)
                const username = userItem.username ? `@${userItem.username}` : '-'
                const email = userItem.email || '-'
                const isSuspended = userItem.accountStatus === 'suspended'
                const isSelected = selectedUserIds.includes(userItem._id)

                return (
                  <article
                    key={userItem._id}
                    className={`p-4 transition ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/60'}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectedUser(userItem._id)}
                        className="mt-1 size-4 cursor-pointer rounded border-slate-300 text-blue-600"
                      />

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 font-semibold text-slate-600 text-sm">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt={fullName} className="h-full w-full object-cover" />
                        ) : (
                          fullName?.trim()?.charAt(0)?.toUpperCase() || '?'
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 truncate font-semibold text-slate-900">
                            <span className="truncate">{fullName}</span>
                            <VerifiedBadge user={userItem} size="xs" />
                          </p>
                          <span
                            className={`admin-badge ${
                              isSuspended ? 'is-danger' : 'is-success'
                            }`}
                          >
                            {isSuspended ? 'Askıda' : 'Aktif'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{username}</p>
                        <p className="mt-1 break-all text-xs text-slate-700">{email}</p>
                      </div>
                    </div>

                    {/* Mobil Kayıt Kaynağı Bilgisi */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-medium">Kaynak:</span>
                        {renderSourcePageBadge(userItem.acquisition?.sourcePage)}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium truncate">
                        {renderPlatformIcon(userItem.acquisition?.platform)}
                        <span>{formatPlatformName(userItem.acquisition?.platform)}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="admin-badge is-neutral">
                          {userItem.role === 'admin'
                            ? 'Admin'
                            : userItem.role === 'moderator'
                              ? 'Moderatör'
                              : 'Kullanıcı'}
                        </span>
                        <div>
                          <p className="font-medium text-slate-700">
                            {userItem.createdAt
                              ? new Date(userItem.createdAt).toLocaleDateString('tr-TR')
                              : ''}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {userItem.lastLoginAt
                              ? formatRelativeTime(userItem.lastLoginAt)
                              : 'Hiç giriş yapmadı'}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={`/${lang}/admin/users/${userItem._id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 shadow-sm"
                      >
                        İncele
                      </Link>
                    </div>
                  </article>
                )
              })
            )}
          </div>

          {/* Sayfalama (Pagination) */}
          {state.pagination ? (
            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-slate-200 px-3.5 md:px-5 h-[42px] min-h-[42px] max-h-[42px] bg-slate-50/50">
              <p className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Sayfa <span className="font-semibold text-slate-800">{state.pagination.page}</span> /{' '}
                <span className="font-semibold text-slate-800">{state.pagination.totalPages || 1}</span> · Toplam{' '}
                <span className="font-semibold text-slate-800">{state.pagination.totalItems}</span> kullanıcı
              </p>
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                {/* Sayfa Başına Gösterilecek Kullanıcı Sayısı (20, 40, 50, 100) */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <span className="hidden sm:inline text-slate-400">Göster:</span>
                  <div className="relative">
                    <select
                      value={filters.limit || 20}
                      onChange={(e) => handleLimitChange(e.target.value)}
                      className="h-7.5 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-6 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/80 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label="Sayfa başına kayıt sayısı"
                    >
                      <option value={20}>20 / sayfa</option>
                      <option value={40}>40 / sayfa</option>
                      <option value={50}>50 / sayfa</option>
                      <option value={100}>100 / sayfa</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-400">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Önceki ve Sonraki Butonları */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => changePage(state.pagination.page - 1)}
                    disabled={!state.pagination.hasPrevPage}
                    className="inline-flex h-7.5 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Önceki
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage(state.pagination.page + 1)}
                    disabled={!state.pagination.hasNextPage}
                    className="inline-flex h-7.5 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sonraki →
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmActionDialog
        open={Boolean(bulkDialog)}
        title={bulkDialog?.title}
        description={bulkDialog?.description}
        confirmLabel={
          bulkDialog?.type === 'delete'
            ? 'Kullanıcıları Kalıcı Olarak Sil'
            : bulkDialog?.accountStatus === 'suspended'
              ? 'Kullanıcıları Askıya Al'
              : 'Kullanıcıları Aktif Et'
        }
        confirmTone={
          bulkDialog?.type === 'delete' || bulkDialog?.accountStatus === 'suspended'
            ? 'danger'
            : 'default'
        }
        reasonLabel="Moderatör Notu (İsteğe Bağlı)"
        reasonPlaceholder="İşlem kaydı ve denetim izi için açıklama girin..."
        isProcessing={isSubmittingBulk}
        onCancel={() => {
          if (!isSubmittingBulk) setBulkDialog(null)
        }}
        onConfirm={confirmBulkAction}
      />

      <ActionToast
        toast={toast}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </>
  )
}

export default AdminUsersPage
