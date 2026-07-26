import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BulkActionBar from '../components/admin/BulkActionBar.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ConfirmActionDialog from '../components/feedback/ConfirmActionDialog.jsx'
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
  const { lang } = useParams()
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

  const headerScrollerRef = useRef(null)
  const bottomScrollbarRef = useRef(null)
  const tableScrollerRef = useRef(null)
  const isSyncingScrollRef = useRef(false)

  useEffect(() => {
    if (!toast.message) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setToast({ message: '', tone: 'success' })
    }, 2600)

    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      setState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: '',
      }))

      try {
        const payload = await getAdminUsers(filters)

        if (cancelled) {
          return
        }

        setState({
          items: payload.users,
          pagination: payload.pagination,
          isLoading: false,
          error: '',
        })
        setSelectedUserIds([])
      } catch (error) {
        if (cancelled) {
          return
        }

        setState((currentState) => ({
          ...currentState,
          isLoading: false,
          error: error.message || 'Kullanicilar yuklenemedi.',
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
    const nextDirection =
      isSameKey && filters.sortDirection === 'desc' ? 'asc' : 'desc'

    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      sortBy: key,
      sortDirection: nextDirection,
      page: 1,
    }))
    setFilters((currentFilters) => ({
      ...currentFilters,
      sortBy: key,
      sortDirection: nextDirection,
      page: 1,
    }))
  }

  function syncHorizontalScroll(source) {
    const headerScroller = headerScrollerRef.current
    const bottomScrollbar = bottomScrollbarRef.current
    const tableScroller = tableScrollerRef.current

    if (
      !headerScroller ||
      !bottomScrollbar ||
      !tableScroller ||
      isSyncingScrollRef.current
    ) {
      return
    }

    const refs = {
      header: headerScroller,
      bottom: bottomScrollbar,
      table: tableScroller,
    }

    const sourceElement = refs[source]

    if (!sourceElement) {
      return
    }

    isSyncingScrollRef.current = true

    const nextScrollLeft = sourceElement.scrollLeft

    Object.entries(refs).forEach(([key, element]) => {
      if (key !== source && element.scrollLeft !== nextScrollLeft) {
        element.scrollLeft = nextScrollLeft
      }
    })

    window.requestAnimationFrame(() => {
      isSyncingScrollRef.current = false
    })
  }

  function renderSortIcon(key) {
    const isActive = filters.sortBy === key
    const isAsc = isActive && filters.sortDirection === 'asc'
    const isDesc = isActive && filters.sortDirection === 'desc'

    return (
      <span className="ml-2 inline-flex cursor-pointer shrink-0 flex-col items-center justify-center leading-none">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-6 w-6 transition ${
            isAsc ? 'text-white' : 'text-white/35'
          }`}
        >
          <path d="M10 5L6 9H14L10 5Z" fill="currentColor" />
        </svg>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`-mt-4 h-6 w-6  transition ${
            isDesc ? 'text-white' : 'text-white/35'
          }`}
        >
          <path d="M10 15L14 11H6L10 15Z" fill="currentColor" />
        </svg>
      </span>
    )
  }

  if (state.isLoading && !state.items?.length && !state.error) {
    return (
      <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
        Kullanicilar yukleniyor...
      </div>
    )
  }

  if (state.error && !state.items?.length) {
    return (
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-600 shadow-sm">
        {state.error}
      </div>
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
    const allSelected = currentPageIds.every((id) => selectedUserIds.includes(id))

    if (allSelected) {
      setSelectedUserIds((currentIds) =>
        currentIds.filter((id) => !currentPageIds.includes(id)),
      )
      return
    }

    setSelectedUserIds((currentIds) => [
      ...new Set([...currentIds, ...currentPageIds]),
    ])
  }

  function handleBulkStatus(accountStatus) {
    if (!selectedUserIds.length) {
      return
    }

    setBulkDialog({
      type: 'status',
      accountStatus,
      title:
        accountStatus === 'suspended'
          ? 'Secili kullanicilari askiya al'
          : 'Secili kullanicilari yeniden aktif et',
      description:
        accountStatus === 'suspended'
          ? 'Bu kullanicilar, bir yonetici yeniden aktif edene kadar sisteme erisemez.'
          : 'Bu islem secili hesaplarin erisimini geri acar.',
    })
  }

  function handleBulkDelete() {
    if (!selectedUserIds.length) {
      return
    }

    setBulkDialog({
      type: 'delete',
      title: 'Secili kullanicilari kalici olarak sil',
      description:
        'Bu islem geri alinamaz. Secilen kullanicilarin hesaplari ve bagli tum verileri sistemden kalici olarak silinir.',
    })
  }

  async function confirmBulkAction(reason) {
    if (!bulkDialog) {
      return
    }

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
      setFilters((currentFilters) => ({ ...currentFilters }))
      setBulkDialog(null)
    } catch (error) {
      setToast({
        message:
          error.message ||
          (bulkDialog.type === 'delete'
            ? 'Toplu hesap silme islemi tamamlanamadi.'
            : 'Toplu moderasyon islemi tamamlanamadi.'),
        tone: 'error',
      })
    } finally {
      setIsSubmittingBulk(false)
    }
  }

  function changePage(nextPage) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      page: nextPage,
    }))
  }

  return (
    <>
      <BulkActionBar
        count={selectedUserIds.length}
        label="kullanici"
        onClear={() => setSelectedUserIds([])}
        actions={[
          {
            label: 'Yeniden Aktif Et',
            tone: 'success',
            onClick: () => handleBulkStatus('active'),
          },
          {
            label: 'Askiya Al',
            tone: 'danger',
            onClick: () => handleBulkStatus('suspended'),
          },
          {
            label: 'Hesabi Sil',
            tone: 'danger',
            onClick: handleBulkDelete,
          },
        ]}
      />

      <section className="rounded-lg border border-white/70 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_48%,#312e81_100%)] shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="border-b border-white/30 px-5 py-3">
          <h2 className="text-lg font-bold text-white">KULLANICILAR</h2>
        </div>

        <form
          onSubmit={handleFilterSubmit}
          className="grid items-center gap-3 px-3 pt-4 pb-0 sm:px-5 md:grid-cols-[0.6fr_1.3fr_0.8fr_0.8fr_0.8fr_auto_auto]"
        >
          <div className="flex-col items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAllCurrentPage}
              className="h-8 items-center rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-normal text-white/80 cursor-pointer transition hover:border-white/20 hover:text-white"
            >
              Tümünü Seç
            </button>
            <p className="px-2 text-xs text-zinc-500">{selectedUserIds.length} seçildi</p>
          </div>

          <input
            type="text"
            value={draftFilters.q}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                q: event.target.value,
              }))
            }
            placeholder="Ad, kullanici adi veya e-posta ara"
            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-3 pr-4 text-sm text-white/85 outline-none transition placeholder:text-slate-400 focus:border-sky-400/40 focus:bg-white/[0.12] focus:ring-4 focus:ring-sky-500/10"
          />

     <div className="relative">
  <select
    value={draftFilters.role}
    onChange={(event) =>
      setDraftFilters((currentFilters) => ({
        ...currentFilters,
        role: event.target.value,
      }))
    }
    className="h-10  cursor-pointer w-full appearance-none rounded-lg border border-white/10 bg-white/[0.08] px-4 pr-11 text-sm font-normal text-white/85 outline-none backdrop-blur-md transition duration-200 hover:border-white/20 hover:bg-white/[0.10] focus:border-sky-400/40 focus:bg-white/[0.12] focus:ring-4 focus:ring-sky-500/10"
  >
    <option value="all" className="bg-slate-900 text-white">
      Tüm Roller
    </option>
    <option value="user" className="bg-slate-900 text-white">
      Kullanıcı
    </option>
    <option value="moderator" className="bg-slate-900 text-white">
      Moderatör
    </option>
    <option value="admin" className="bg-slate-900 text-white">
      Admin
    </option>
  </select>

  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/50">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  </div>
</div>

       <div className="relative">
  <select
    value={draftFilters.accountStatus}
    onChange={(event) =>
      setDraftFilters((currentFilters) => ({
        ...currentFilters,
        accountStatus: event.target.value,
      }))
    }
    className="h-10 w-full appearance-none rounded-lg cursor-pointer border border-white/10 bg-white/[0.08] px-4 pr-11 text-sm font-normal text-white/85 outline-none backdrop-blur-md transition duration-200 hover:border-white/20 hover:bg-white/[0.10] focus:border-sky-400/40 focus:bg-white/[0.12] focus:ring-4 focus:ring-sky-500/10"
  >
    <option value="all" className="bg-slate-900 text-white">
      Durumlar
    </option>
    <option value="active" className="bg-slate-900 text-white">
      Aktif
    </option>
    <option value="suspended" className="bg-slate-900 text-white">
      Askıda
    </option>
  </select>

  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/50">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  </div>
</div>

          <input
            type="text"
            value={draftFilters.country}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                country: event.target.value,
              }))
            }
            placeholder="Ulke"
            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-3 pr-4 text-sm text-white/85 outline-none transition placeholder:text-slate-400 focus:border-sky-400/40 focus:bg-white/[0.12] focus:ring-4 focus:ring-sky-500/10"
          />

          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 cursor-pointer transition hover:border-sky-400/40 hover:ring-4 hover:ring-sky-500/10"
          >
            Uygula
          </button>

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 cursor-pointer transition hover:border-white/20 hover:text-white"
          >
            Sifirla
          </button>
        </form>

        {bulkMessage ? (
          <div className="border-b border-zinc-200 px-5 py-3 text-sm text-zinc-500">
            {bulkMessage}
          </div>
        ) : null}

        <div className="mt-4 space-y-3 md:hidden">
          {state.items?.map((item) => {
            const avatarSrc =
              item.avatar?.url ||
              item.avatarUrl ||
              item.profilePhoto ||
              item.profileImage
            const fullName = getFullName(item)
            const username = item.username ? `@${item.username}` : '-'
            const email = item.email || '-'
            const ipAddress = item.signupConsent?.ipAddress || '-'
            const approxCity = item.signupConsent?.city || ''
            const approxCountry = item.signupConsent?.country || ''
            const approxLocation = [approxCity, approxCountry].filter(Boolean).join(', ') || '-'
            const location = formatLocation(item.location) || '-'
            const profileLanguage = item.signupConsent?.language || '-'
            const browserLanguage = item.signupConsent?.browserLanguage || '-'
            const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'

            return (
              <article
                key={item._id}
                className="rounded-lg border border-white/20 bg-[rgba(20,28,48,0.72)] p-3 text-white"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={(selectedUserIds ?? []).includes(item._id)}
                    onChange={() => toggleSelectedUser(item._id)}
                    aria-label={`${fullName || 'Kullanici'} sec`}
                    className="mt-1 size-4 cursor-pointer rounded-md border border-white/15 bg-white/5 text-sky-500 accent-sky-500 outline-none"
                  />
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-white/5">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={fullName || 'Kullanici'} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-white/70">
                          {fullName?.trim()?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{fullName || '-'}</p>
                      <p className="mt-0.5 text-sm text-white/80">{username}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
                    <p className="text-white/60">E-posta</p>
                    <p className="mt-1 break-all text-white/90">{email}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
                    <p className="text-white/60">IP</p>
                    <p className="mt-1 text-white/90">{ipAddress}</p>
                    <p className="mt-0.5 text-white/60">{approxLocation}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
                    <p className="text-white/60">Konum</p>
                    <p className="mt-1 text-white/90">{location}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
                    <p className="text-white/60">Dil</p>
                    <p className="mt-1 text-white/90">{profileLanguage}</p>
                    <p className="mt-0.5 text-white/60">{browserLanguage}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-white/20 bg-zinc-950/60 px-2 py-1 text-[11px] text-white">
                      {item.role || '-'}
                    </span>
                    <span
                      className={`rounded-lg border border-white/20 px-2 py-1 text-[11px] font-semibold ${
                        item.accountStatus === 'suspended'
                          ? 'bg-rose-100/80 text-rose-700'
                          : 'bg-emerald-100/80 text-emerald-700'
                      }`}
                    >
                      {item.accountStatus === 'suspended' ? 'askida' : 'aktif'}
                    </span>
                  </div>
                  <Link
                    to={`/${lang}/admin/users/${item._id}`}
                    className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs font-medium !text-white/90"
                  >
                    Incele
                  </Link>
                </div>

                <p className="mt-2 text-[11px] text-white/60">
                  Son giris: {item.lastLoginAt ? formatRelativeTime(item.lastLoginAt) : 'Hic'} · Kayit: {createdAt}
                </p>
              </article>
            )
          })}
        </div>

        <div className="mt-4 hidden max-h-[calc(100vh-250px)] flex-col overflow-hidden md:flex md:max-h-[calc(100vh-180px)]">
          <div className="bg-zinc-950/95">
            <div
              ref={headerScrollerRef}
              className="overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
              onScroll={() => syncHorizontalScroll('header')}
            >
              <table className="min-w-[1740px] w-full text-left">
                <colgroup>
                  <col style={{ width: '72px' }} />
                  <col style={{ width: '88px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '260px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '170px' }} />
                  <col style={{ width: '170px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '120px' }} />
                </colgroup>

                <thead className="pt-20 bg-zinc-950/95 text-[13px] uppercase tracking-[0.18em] text-white/95 backdrop-blur">
                  <tr className="">
                    <th className="sticky left-0 z-50 bg-zinc-950/95 px-5 pt-4 pb-1  align-middle font-semibold whitespace-nowrap">
                      Seç
                    </th>

                    <th className="sticky left-[72px] z-50 bg-zinc-950/95 px-5 pt-4 pb-1  align-middle font-semibold whitespace-nowrap">
                      Avatar
                    </th>

                    <th className="sticky left-[160px] z-50 border-r border-white/10 bg-zinc-950/95 px-5 pt-4 pb-1  align-middle font-semibold whitespace-nowrap shadow-[8px_0_18px_-14px_rgba(0,0,0,0.85)]">
                      Kullanıcı
                    </th>

                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      E-posta
                    </th>

                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      IP
                    </th>

                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      Konum
                    </th>

                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1  align-middle font-semibold whitespace-nowrap">
                      Dil
                    </th>

                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1  align-middle font-semibold whitespace-nowrap">
                      Rol
                    </th>

                    <th
                      aria-sort={
                        filters.sortBy === 'lastLoginAt'
                          ? filters.sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort('lastLoginAt')}
                        className="inline-flex items-center whitespace-nowrap text-left font-semibold text-white/95 transition hover:text-white"
                      >
                        <span>Son Giriş</span>
                        {renderSortIcon('lastLoginAt')}
                      </button>
                    </th>

                    <th
                      aria-sort={
                        filters.sortBy === 'createdAt'
                          ? filters.sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      className="bg-zinc-950/95 px-5 pt-4 pb-1  align-middle font-semibold whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort('createdAt')}
                        className="inline-flex items-center whitespace-nowrap text-left font-semibold text-white/95 transition hover:text-white"
                      >
                        <span>Kayıt Tarihi</span>
                        {renderSortIcon('createdAt')}
                      </button>
                    </th>

                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      Detay
                    </th>
                  </tr>
                </thead>
              </table>
            </div>

            <div
              ref={bottomScrollbarRef}
              className="overflow-x-auto overflow-y-hidden  bg-zinc-950/95"
              onScroll={() => syncHorizontalScroll('bottom')}
            >
              <div className="h-1 min-w-[1740px] w-full" />
            </div>
          </div>

          <div
            ref={tableScrollerRef}
            className="relative min-h-0 flex-1 overflow-auto"
            onScroll={() => syncHorizontalScroll('table')}
          >
            {state.isLoading && state.items?.length ? (
              <div className="pointer-events-none sticky top-0 z-40 flex h-10 items-center justify-center bg-zinc-950/70 text-xs font-semibold text-white/80 backdrop-blur">
                Tablo yenileniyor...
              </div>
            ) : null}

            <table className="min-w-[1740px] w-full text-left">
              <colgroup>
                <col style={{ width: '72px' }} />
                <col style={{ width: '88px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '260px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '170px' }} />
                <col style={{ width: '170px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '120px' }} />
              </colgroup>

              <tbody>
                {state.items?.map((item) => {
                  const avatarSrc =
                    item.avatar?.url ||
                    item.avatarUrl ||
                    item.profilePhoto ||
                    item.profileImage

                  const fullName = getFullName(item)
                  const username = item.username ? `@${item.username}` : '-'
                  const email = item.email || '-'
                  const ipAddress = item.signupConsent?.ipAddress || '-'
                  const approxCity = item.signupConsent?.city || ''
                  const approxCountry = item.signupConsent?.country || ''
                  const approxLocation =
                    [approxCity, approxCountry].filter(Boolean).join(', ') || '-'
                  const location = formatLocation(item.location) || '-'
                  const profileLanguage = item.signupConsent?.language || '-'
                  const browserLanguage = item.signupConsent?.browserLanguage || '-'
                  const createdAt = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString()
                    : '-'

                  return (
                    <tr key={item._id} className="border-t border-white/30 align-top">
                      <td className="sticky left-0 z-20 bg-[rgba(20,28,48,0.98)] px-5 py-4">
                        <input
                          type="checkbox"
                          checked={(selectedUserIds ?? []).includes(item._id)}
                          onChange={() => toggleSelectedUser(item._id)}
                          aria-label={`${fullName || 'Kullanıcı'} seç`}
                          className="size-4 cursor-pointer rounded-md border border-white/15 bg-white/5 text-sky-500 accent-sky-500 outline-none transition hover:border-white/25 focus:ring-2 focus:ring-sky-500/30"
                        />
                      </td>

                      <td className="sticky left-[72px] z-20 bg-[rgba(20,28,48,0.98)] px-2 py-1">
                        <div className="flex items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-white/5">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={fullName || 'Kullanıcı'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-white/70">
                              {fullName?.trim()?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="sticky left-[160px] z-20 border-r border-white/10 bg-[rgba(20,28,48,0.98)] px-5 py-4 shadow-[8px_0_18px_-14px_rgba(0,0,0,0.85)]">
                        <p className="font-semibold text-white">{fullName || '-'}</p>
                        <p className="mt-1 text-sm text-white/90">{username}</p>
                      </td>

                      <td className="px-5 py-4 text-sm text-white/80">{email}</td>

                      <td className="px-5 py-4 text-sm text-white/80">
                        <p>{ipAddress}</p>
                        <p className="mt-1 text-xs text-white/60">{approxLocation}</p>
                      </td>

                      <td className="px-5 py-4 text-sm text-white/80">{location}</td>

                      <td className="px-5 py-4 text-sm text-white/80">
                        <p>{profileLanguage}</p>
                        <p className="mt-1 text-xs text-white/60">{browserLanguage}</p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-lg border border-white/20 bg-zinc-950/60 px-3 py-1 text-xs font-normal text-white">
                          {item.role || '-'}
                        </span>

                        <div className="mt-2">
                          <span
                            className={`rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold ${
                              item.accountStatus === 'suspended'
                                ? 'bg-rose-100/80 text-rose-700'
                                : 'bg-emerald-100/80 text-emerald-700'
                            }`}
                          >
                            {item.accountStatus === 'suspended' ? 'askida' : 'aktif'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-white/80">
                        {item.lastLoginAt ? formatRelativeTime(item.lastLoginAt) : 'Hic'}
                      </td>

                      <td className="px-5 py-4 text-sm text-white/80">{createdAt}</td>

                      <td className="px-5 py-4">
                        <Link
                          to={`/${lang}/admin/users/${item._id}`}
                          className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-normal !text-white/80 transition hover:border-white/20 hover:!text-white"
                        >
                          İncele
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {state.pagination ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-3 py-4 sm:px-5">
            <p className="text-sm text-zinc-500">
              Sayfa {state.pagination.page} / {state.pagination.totalPages} - Toplam{' '}
              {state.pagination.totalItems}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changePage(state.pagination.page - 1)}
                disabled={!state.pagination.hasPrevPage}
                className="inline-flex h-8 items-center rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Onceki
              </button>
              <button
                type="button"
                onClick={() => changePage(state.pagination.page + 1)}
                disabled={!state.pagination.hasNextPage}
                className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 cursor-pointer transition hover:border-white/20 hover:text-white"
              >
                Sonraki
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <ConfirmActionDialog
        open={Boolean(bulkDialog)}
        title={bulkDialog?.title}
        description={bulkDialog?.description}
        confirmLabel={
          bulkDialog?.type === 'delete'
            ? 'Kullanicilari kalici olarak sil'
            : bulkDialog?.accountStatus === 'suspended'
              ? 'Kullanicilari askiya al'
              : 'Kullanicilari aktif et'
        }
        confirmTone={
          bulkDialog?.type === 'delete' || bulkDialog?.accountStatus === 'suspended'
            ? 'danger'
            : 'default'
        }
        reasonLabel="Moderator notu"
        reasonPlaceholder="Islem kaydi icin istege bagli not"
        isProcessing={isSubmittingBulk}
        onCancel={() => {
          if (!isSubmittingBulk) {
            setBulkDialog(null)
          }
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
