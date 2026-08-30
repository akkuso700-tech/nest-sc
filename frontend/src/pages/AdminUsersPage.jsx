import { useEffect, useState } from 'react'
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
  country: '',
  sortBy: 'createdAt',
  sortDirection: 'desc',
  page: 1,
  limit: 12,
}

function AdminUsersPage() {
  const { lang = 'tr' } = useParams()
  const [filters, setFilters] = useState(initialFilters)
  const [draftFilters, setDraftFilters] = useState(initialFilters)
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

  function handleFilterSubmit(event) {
    event.preventDefault()
    setFilters({
      ...draftFilters,
      page: 1,
    })
  }

  function handleResetFilters() {
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

  const allCurrentSelected =
    state.items.length > 0 &&
    state.items.every((item) => selectedUserIds.includes(item._id))

  return (
    <>
      <BulkActionBar
        count={selectedUserIds.length}
        label="kullanıcı"
        onClear={() => setSelectedUserIds([])}
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

      <div className="space-y-4">
        {/* Filtre ve Arama Toolbarı */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form
            onSubmit={handleFilterSubmit}
            className="flex flex-col gap-3 lg:flex-row lg:items-center"
          >
            {/* Arama Alanı */}
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={draftFilters.q}
                onChange={(e) => setDraftFilters((curr) => ({ ...curr, q: e.target.value }))}
                placeholder="Ad, kullanıcı adı veya e-posta ara..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
              {draftFilters.q && (
                <button
                  type="button"
                  onClick={() => setDraftFilters((curr) => ({ ...curr, q: '' }))}
                  className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Rol Filtresi */}
            <div className="relative w-full sm:w-44">
              <select
                value={draftFilters.role}
                onChange={(e) => setDraftFilters((curr) => ({ ...curr, role: e.target.value }))}
                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 pr-8 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100/70 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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

            {/* Durum Filtresi */}
            <div className="relative w-full sm:w-40">
              <select
                value={draftFilters.accountStatus}
                onChange={(e) => setDraftFilters((curr) => ({ ...curr, accountStatus: e.target.value }))}
                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 pr-8 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100/70 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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

            {/* Ülke Filtresi */}
            <div className="w-full sm:w-36">
              <input
                type="text"
                value={draftFilters.country}
                onChange={(e) => setDraftFilters((curr) => ({ ...curr, country: e.target.value }))}
                placeholder="Ülke kodu/adı"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {/* Aksiyon Butonları */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 active:scale-[0.98]"
              >
                Filtrele
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                Sıfırla
              </button>
            </div>
          </form>
        </section>

        {/* Toplu İşlem / Bildirim Mesajı */}
        {bulkMessage ? (
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
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
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {state.error}
          </div>
        ) : null}

        {/* Ana İçerik Kartı: Tablo & Kartlar */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Üst Bar: Seçim Sayısı ve Başlık */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allCurrentSelected}
                  onChange={toggleSelectAllCurrentPage}
                  className="size-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Tümünü Seç</span>
              </label>
              {selectedUserIds.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {selectedUserIds.length} kullanıcı seçili
                </span>
              )}
            </div>

            <div className="text-xs font-medium text-slate-500">
              {state.pagination ? `Toplam ${state.pagination.totalItems} kayıt` : ''}
            </div>
          </div>

          {/* Masaüstü Tablo Görünümü */}
          <div className="hidden md:block admin-table-container">
            <table className="admin-table min-w-[1240px]">
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
                  <th className="w-36">
                    <button
                      type="button"
                      onClick={() => handleSort('lastLoginAt')}
                      className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
                    >
                      <span>Son Giriş</span>
                      {renderSortIcon('lastLoginAt')}
                    </button>
                  </th>
                  <th className="w-36">
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

                        {/* Son Giriş */}
                        <td className="text-xs text-slate-600">
                          {userItem.lastLoginAt
                            ? formatRelativeTime(userItem.lastLoginAt)
                            : 'Hiç giriş yapmadı'}
                        </td>

                        {/* Kayıt Tarihi */}
                        <td className="text-xs text-slate-600">
                          {userItem.createdAt
                            ? new Date(userItem.createdAt).toLocaleDateString('tr-TR')
                            : '-'}
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

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="admin-badge is-neutral">
                          {userItem.role === 'admin'
                            ? 'Admin'
                            : userItem.role === 'moderator'
                              ? 'Moderatör'
                              : 'Kullanıcı'}
                        </span>
                        <span>
                          {userItem.createdAt
                            ? new Date(userItem.createdAt).toLocaleDateString('tr-TR')
                            : ''}
                        </span>
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
          {state.pagination && state.pagination.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 bg-slate-50/50">
              <p className="text-xs font-medium text-slate-500">
                Sayfa <span className="font-semibold text-slate-800">{state.pagination.page}</span> /{' '}
                <span className="font-semibold text-slate-800">{state.pagination.totalPages}</span> · Toplam{' '}
                <span className="font-semibold text-slate-800">{state.pagination.totalItems}</span> kullanıcı
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => changePage(state.pagination.page - 1)}
                  disabled={!state.pagination.hasPrevPage}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ← Önceki
                </button>
                <button
                  type="button"
                  onClick={() => changePage(state.pagination.page + 1)}
                  disabled={!state.pagination.hasNextPage}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sonraki →
                </button>
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
