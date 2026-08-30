import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BulkActionBar from '../components/admin/BulkActionBar.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ConfirmActionDialog from '../components/feedback/ConfirmActionDialog.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import {
  bulkUpdateAdminPostModeration,
  getAdminContent,
  updateAdminPostModeration,
} from '../services/adminService.js'
import { resolveMediaUrl } from '../utils/media.js'
import { getFullName } from '../utils/social.js'

const initialFilters = {
  q: '',
  privacy: 'all',
  contentType: 'all',
  mediaKind: 'all',
  visibility: 'all',
  sortBy: 'createdAt',
  sortDirection: 'desc',
  page: 1,
  limit: 12,
}

function mapContentTypeLabel(contentType = 'post') {
  if (contentType === 'loop') return 'Loop'
  if (contentType === 'story') return 'Hikaye'
  return 'Gönderi'
}

function mapPrivacyLabel(privacy = 'public') {
  if (privacy === 'followers') return 'Takipçiler'
  if (privacy === 'private') return 'Özel'
  return 'Herkese Açık'
}

function resolvePostCover(post) {
  const firstMedia = Array.isArray(post?.media) ? post.media[0] : null

  if (!firstMedia) {
    return { kind: 'empty', url: '', count: 0 }
  }

  const mediaCount = post.media.length
  const imageLikeUrl =
    firstMedia?.posterUrl ||
    firstMedia?.thumbnailUrl ||
    firstMedia?.previewUrl ||
    (firstMedia?.type === 'image' ? firstMedia?.url : '')
  const resolvedImageUrl = resolveMediaUrl(imageLikeUrl || '')

  if (resolvedImageUrl) {
    return { kind: 'image', url: resolvedImageUrl, count: mediaCount }
  }

  if (firstMedia?.type === 'video') {
    const resolvedVideoUrl = resolveMediaUrl(firstMedia?.url || firstMedia?.hlsUrl || '')
    return { kind: 'video', url: resolvedVideoUrl, count: mediaCount }
  }

  return { kind: 'empty', url: '', count: mediaCount }
}

function AdminContentPage() {
  const { lang = 'tr' } = useParams()
  const [filters, setFilters] = useState(initialFilters)
  const [draftFilters, setDraftFilters] = useState(initialFilters)
  const [selectedPostIds, setSelectedPostIds] = useState([])
  const [bulkMessage, setBulkMessage] = useState('')
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const [dialogState, setDialogState] = useState(null)
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)
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

    async function loadContent() {
      setState((current) => ({ ...current, isLoading: true, error: '' }))
      try {
        const payload = await getAdminContent(filters)
        if (cancelled) return
        setState({
          items: payload.posts || [],
          pagination: payload.pagination || null,
          isLoading: false,
          error: '',
        })
        setSelectedPostIds([])
      } catch (error) {
        if (cancelled) return
        setState((current) => ({
          ...current,
          isLoading: false,
          error: error.message || 'İçerik listesi yüklenemedi.',
        }))
      }
    }

    loadContent()
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

  function openSingleModerationDialog(postId, visibility) {
    setDialogState({
      mode: 'single',
      postId,
      visibility,
      title:
        visibility === 'visible'
          ? 'Gönderiyi Yeniden Görünür Yap'
          : visibility === 'hidden'
            ? 'Gönderiyi Akıştan Gizle'
            : 'Gönderiyi Sistemden Kaldır',
      description:
        visibility === 'visible'
          ? 'Bu gönderi akışlarda ve kullanıcı profillerinde yeniden normal şekilde görünür olacaktır.'
          : visibility === 'hidden'
            ? 'Bu gönderi genel akışlarda gizlenir, ancak yönetici kayıtlarında saklanmaya devam eder.'
            : 'Bu gönderi kaldırıldı olarak işaretlenir ve kullanıcıların erişimine tamamen kapatılır.',
    })
  }

  function toggleSelectedPost(postId) {
    setSelectedPostIds((currentIds) =>
      currentIds.includes(postId)
        ? currentIds.filter((id) => id !== postId)
        : [...currentIds, postId],
    )
  }

  function toggleSelectAllCurrentPage() {
    const currentPageIds = state.items.map((item) => item._id)
    if (!currentPageIds.length) return
    const allSelected = currentPageIds.every((id) => selectedPostIds.includes(id))

    if (allSelected) {
      setSelectedPostIds((currentIds) =>
        currentIds.filter((id) => !currentPageIds.includes(id)),
      )
    } else {
      setSelectedPostIds((currentIds) => [
        ...new Set([...currentIds, ...currentPageIds]),
      ])
    }
  }

  function handleBulkModeration(visibility) {
    if (!selectedPostIds.length) return
    setDialogState({
      mode: 'bulk',
      visibility,
      title:
        visibility === 'visible'
          ? `${selectedPostIds.length} Gönderiyi Geri Yükle`
          : visibility === 'hidden'
            ? `${selectedPostIds.length} Gönderiyi Gizle`
            : `${selectedPostIds.length} Gönderiyi Kaldır`,
      description:
        visibility === 'visible'
          ? 'Seçilen tüm gönderiler normal akışlarda yeniden görünür hale getirilecektir.'
          : visibility === 'hidden'
            ? 'Seçilen gönderiler kullanıcı arayüzlerinde gizlenecektir.'
            : 'Seçilen gönderiler kaldırıldı olarak işaretlenir.',
    })
  }

  async function confirmModeration(reason) {
    if (!dialogState) return
    setIsSubmittingAction(true)
    try {
      if (dialogState.mode === 'single') {
        const payload = await updateAdminPostModeration(dialogState.postId, {
          visibility: dialogState.visibility,
          reason,
        })
        setState((current) => ({
          ...current,
          items: current.items.map((item) =>
            item._id === dialogState.postId ? payload.post : item,
          ),
        }))
        setToast({ message: payload.message, tone: 'success' })
      } else {
        const payload = await bulkUpdateAdminPostModeration({
          postIds: selectedPostIds,
          visibility: dialogState.visibility,
          reason,
        })
        setBulkMessage(payload.message)
        setFilters((current) => ({ ...current }))
        setToast({ message: payload.message, tone: 'success' })
      }
      setDialogState(null)
    } catch (error) {
      setToast({
        message: error.message || 'Moderasyon işlemi tamamlanamadı.',
        tone: 'error',
      })
    } finally {
      setIsSubmittingAction(false)
    }
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

  function changePage(nextPage) {
    setFilters((current) => ({ ...current, page: nextPage }))
  }

  const allCurrentSelected =
    state.items.length > 0 &&
    state.items.every((item) => selectedPostIds.includes(item._id))

  return (
    <>
      <BulkActionBar
        count={selectedPostIds.length}
        label="gönderi"
        onClear={() => setSelectedPostIds([])}
        actions={[
          {
            label: 'Geri Yükle',
            tone: 'success',
            onClick: () => handleBulkModeration('visible'),
          },
          {
            label: 'Gizle',
            tone: 'default',
            onClick: () => handleBulkModeration('hidden'),
          },
          {
            label: 'Kaldır',
            tone: 'danger',
            onClick: () => handleBulkModeration('removed'),
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
                placeholder="Gönderi metni veya yazar ara..."
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

            {/* İçerik Türü */}
            <div className="relative w-full sm:w-36">
              <select
                value={draftFilters.contentType}
                onChange={(e) => setDraftFilters((curr) => ({ ...curr, contentType: e.target.value }))}
                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 pr-8 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100/70 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="all">Tüm Tipler</option>
                <option value="post">Gönderi</option>
                <option value="loop">Loop</option>
                <option value="story">Hikaye</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Gizlilik Filtresi */}
            <div className="relative w-full sm:w-40">
              <select
                value={draftFilters.privacy}
                onChange={(e) => setDraftFilters((curr) => ({ ...curr, privacy: e.target.value }))}
                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 pr-8 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100/70 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="all">Tüm Gizlilikler</option>
                <option value="public">Herkese Açık</option>
                <option value="followers">Takipçiler</option>
                <option value="private">Özel</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Medya Filtresi */}
            <div className="relative w-full sm:w-36">
              <select
                value={draftFilters.mediaKind}
                onChange={(e) => setDraftFilters((curr) => ({ ...curr, mediaKind: e.target.value }))}
                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 pr-8 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100/70 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="all">Tüm Medyalar</option>
                <option value="media">Medyalı</option>
                <option value="text">Sadece Metin</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Moderasyon Durumu */}
            <div className="relative w-full sm:w-40">
              <select
                value={draftFilters.visibility}
                onChange={(e) => setDraftFilters((curr) => ({ ...curr, visibility: e.target.value }))}
                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 pr-8 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100/70 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="visible">Görünür</option>
                <option value="hidden">Gizli</option>
                <option value="removed">Kaldırıldı</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
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
              {selectedPostIds.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {selectedPostIds.length} gönderi seçili
                </span>
              )}
            </div>

            <div className="text-xs font-medium text-slate-500">
              {state.pagination ? `Toplam ${state.pagination.totalItems} içerik` : ''}
            </div>
          </div>

          {/* Masaüstü Tablo Görünümü */}
          <div className="hidden md:block admin-table-container">
            <table className="admin-table min-w-[1360px]">
              <thead>
                <tr>
                  <th className="sticky-col-0 w-12 text-center">
                    <span className="sr-only">Seç</span>
                  </th>
                  <th className="sticky-col-1 w-16 text-center">Kapak</th>
                  <th className="sticky-col-2 w-52">Yazar</th>
                  <th className="w-64">İçerik</th>
                  <th className="w-28">
                    <button
                      type="button"
                      onClick={() => handleSort('contentType')}
                      className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
                    >
                      <span>Tür</span>
                      {renderSortIcon('contentType')}
                    </button>
                  </th>
                  <th className="w-32">
                    <button
                      type="button"
                      onClick={() => handleSort('privacy')}
                      className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
                    >
                      <span>Gizlilik</span>
                      {renderSortIcon('privacy')}
                    </button>
                  </th>
                  <th className="w-24">Medya</th>
                  <th className="w-28">Moderasyon</th>
                  <th className="w-28">
                    <button
                      type="button"
                      onClick={() => handleSort('views')}
                      className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
                    >
                      <span>İzlenme</span>
                      {renderSortIcon('views')}
                    </button>
                  </th>
                  <th className="w-48">Etkileşim</th>
                  <th className="w-36">
                    <button
                      type="button"
                      onClick={() => handleSort('createdAt')}
                      className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
                    >
                      <span>Tarih</span>
                      {renderSortIcon('createdAt')}
                    </button>
                  </th>
                  <th className="w-56 text-right pr-6">Moderasyon / İşlem</th>
                </tr>
              </thead>

              <tbody>
                {state.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={12} className="p-0">
                        <div className="admin-table-skeleton" />
                      </td>
                    </tr>
                  ))
                ) : state.items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                          </svg>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-800">İçerik bulunamadı</p>
                        <p className="mt-1 text-xs text-slate-500">Seçili filtrelere uygun gönderi kaydı bulunmuyor.</p>
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
                  state.items.map((post) => {
                    const visibility = post?.moderation?.visibility || 'visible'
                    const contentType = post?.contentType || 'post'
                    const mediaCount = (post?.media || []).length
                    const contentPreview = (post?.text || '').trim() || 'Sadece medya içeren gönderi'
                    const createdAtDate = post?.createdAt ? new Date(post.createdAt) : null
                    const viewsCount = Number(post?.stats?.views || 0)
                    const cover = resolvePostCover(post)
                    const isSelected = selectedPostIds.includes(post._id)
                    const authorName = getFullName(post.author)

                    return (
                      <tr
                        key={post._id}
                        className={isSelected ? '!bg-blue-50/40' : ''}
                      >
                        {/* Checkbox */}
                        <td className="sticky-col-0 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectedPost(post._id)}
                            aria-label="Gönderi seç"
                            className="size-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>

                        {/* Kapak / Medya Önizleme */}
                        <td className="sticky-col-1 text-center">
                          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                            {cover.kind === 'image' ? (
                              <img
                                src={cover.url}
                                alt="Kapak"
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : cover.kind === 'video' && cover.url ? (
                              <video
                                src={cover.url}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover"
                              />
                            ) : cover.kind === 'video' ? (
                              <span className="text-[10px] font-bold text-slate-500">VIDEO</span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400">METİN</span>
                            )}
                            {cover.count > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 rounded bg-slate-900/80 px-1 text-[9px] font-bold text-white">
                                +{cover.count - 1}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Yazar */}
                        <td className="sticky-col-2">
                          <div className="min-w-0 pr-2">
                            <p className="flex items-center gap-1.5 truncate font-semibold text-slate-900">
                              <span className="truncate">{authorName || 'Bilinmeyen'}</span>
                              <VerifiedBadge user={post.author} size="xs" />
                            </p>
                            <p className="truncate text-xs font-medium text-slate-500">
                              @{post.author?.username || '-'}
                            </p>
                          </div>
                        </td>

                        {/* İçerik Metni */}
                        <td>
                          <p className="line-clamp-2 max-w-[280px] text-xs leading-relaxed text-slate-700" title={contentPreview}>
                            {contentPreview}
                          </p>
                        </td>

                        {/* Tür */}
                        <td>
                          <span className="admin-badge is-primary">
                            {mapContentTypeLabel(contentType)}
                          </span>
                        </td>

                        {/* Gizlilik */}
                        <td>
                          <span className="admin-badge is-neutral">
                            {mapPrivacyLabel(post?.privacy)}
                          </span>
                        </td>

                        {/* Medya */}
                        <td>
                          <span className="text-xs font-medium text-slate-600">
                            {mediaCount > 0 ? `${mediaCount} dosya` : 'Yok'}
                          </span>
                        </td>

                        {/* Moderasyon Durumu */}
                        <td>
                          <span
                            className={`admin-badge ${
                              visibility === 'visible'
                                ? 'is-success'
                                : visibility === 'hidden'
                                  ? 'is-warning'
                                  : 'is-danger'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                visibility === 'visible'
                                  ? 'bg-emerald-500'
                                  : visibility === 'hidden'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                              }`}
                            />
                            {visibility === 'visible'
                              ? 'Görünür'
                              : visibility === 'hidden'
                                ? 'Gizli'
                                : 'Kaldırıldı'}
                          </span>
                        </td>

                        {/* Görüntüleme */}
                        <td className="text-xs font-semibold text-slate-700">
                          {new Intl.NumberFormat('tr-TR').format(viewsCount)}
                        </td>

                        {/* Etkileşimler */}
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                            <span className="admin-stat-chip" title="Beğeniler">
                              ❤️ {post?.stats?.likes || 0}
                            </span>
                            <span className="admin-stat-chip" title="Yorumlar">
                              💬 {post?.stats?.comments || 0}
                            </span>
                            <span className="admin-stat-chip" title="Paylaşımlar">
                              🔄 {post?.stats?.shares || 0}
                            </span>
                            <span className="admin-stat-chip" title="Kaydedilenler">
                              🔖 {post?.stats?.saves || 0}
                            </span>
                          </div>
                        </td>

                        {/* Tarih */}
                        <td className="text-xs text-slate-600">
                          <p>{createdAtDate ? createdAtDate.toLocaleDateString('tr-TR') : '-'}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {createdAtDate ? createdAtDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </td>

                        {/* Eylemler */}
                        <td className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            {visibility !== 'visible' && (
                              <button
                                type="button"
                                onClick={() => openSingleModerationDialog(post._id, 'visible')}
                                className="inline-flex h-7 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                              >
                                Geri Yükle
                              </button>
                            )}
                            {visibility !== 'hidden' && (
                              <button
                                type="button"
                                onClick={() => openSingleModerationDialog(post._id, 'hidden')}
                                className="inline-flex h-7 items-center rounded-lg border border-amber-200 bg-amber-50 px-2 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                              >
                                Gizle
                              </button>
                            )}
                            {visibility !== 'removed' && (
                              <button
                                type="button"
                                onClick={() => openSingleModerationDialog(post._id, 'removed')}
                                className="inline-flex h-7 items-center rounded-lg border border-rose-200 bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                Kaldır
                              </button>
                            )}
                            <Link
                              to={`/${lang}/posts/${post._id}`}
                              className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-blue-600"
                            >
                              Detay ↗
                            </Link>
                          </div>
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
                <p className="text-sm font-semibold text-slate-800">İçerik bulunamadı</p>
                <p className="mt-1 text-xs text-slate-500">Arama kriterlerinizi değiştirmeyi deneyin.</p>
              </div>
            ) : (
              state.items.map((post) => {
                const visibility = post?.moderation?.visibility || 'visible'
                const contentType = post?.contentType || 'post'
                const contentPreview = (post?.text || '').trim() || 'Sadece medya içeren gönderi'
                const cover = resolvePostCover(post)
                const isSelected = selectedPostIds.includes(post._id)
                const authorName = getFullName(post.author)

                return (
                  <article
                    key={post._id}
                    className={`p-4 transition ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/60'}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectedPost(post._id)}
                        className="mt-1 size-4 cursor-pointer rounded border-slate-300 text-blue-600"
                      />

                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {cover.kind === 'image' ? (
                          <img src={cover.url} alt="Kapak" className="h-full w-full object-cover" />
                        ) : cover.kind === 'video' && cover.url ? (
                          <video src={cover.url} muted playsInline className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">METİN</span>
                        )}
                        {cover.count > 1 && (
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-slate-900/80 px-1 text-[9px] font-bold text-white">
                            +{cover.count - 1}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 truncate font-semibold text-slate-900">
                            <span className="truncate">{authorName}</span>
                            <VerifiedBadge user={post.author} size="xs" />
                          </p>
                          <span
                            className={`admin-badge ${
                              visibility === 'visible'
                                ? 'is-success'
                                : visibility === 'hidden'
                                  ? 'is-warning'
                                  : 'is-danger'
                            }`}
                          >
                            {visibility === 'visible'
                              ? 'Görünür'
                              : visibility === 'hidden'
                                ? 'Gizli'
                                : 'Kaldırıldı'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">@{post.author?.username || '-'}</p>
                        <p className="mt-1.5 line-clamp-2 text-xs text-slate-700 leading-relaxed">
                          {contentPreview}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="admin-badge is-primary">
                          {mapContentTypeLabel(contentType)}
                        </span>
                        <span className="admin-stat-chip">
                          👁️ {post?.stats?.views || 0}
                        </span>
                        <span className="admin-stat-chip">
                          ❤️ {post?.stats?.likes || 0}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {visibility !== 'visible' && (
                          <button
                            type="button"
                            onClick={() => openSingleModerationDialog(post._id, 'visible')}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                          >
                            Geri Yükle
                          </button>
                        )}
                        {visibility === 'visible' && (
                          <button
                            type="button"
                            onClick={() => openSingleModerationDialog(post._id, 'hidden')}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                          >
                            Gizle
                          </button>
                        )}
                        <Link
                          to={`/${lang}/posts/${post._id}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                        >
                          Detay ↗
                        </Link>
                      </div>
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
                <span className="font-semibold text-slate-800">{state.pagination.totalItems}</span> içerik
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
        open={Boolean(dialogState)}
        title={dialogState?.title}
        description={dialogState?.description}
        confirmLabel={
          dialogState?.visibility === 'visible'
            ? 'Geri Yükle'
            : dialogState?.visibility === 'hidden'
              ? 'Gizle'
              : 'Kaldır'
        }
        confirmTone={dialogState?.visibility === 'removed' ? 'danger' : 'default'}
        reasonLabel="Moderatör Notu (İsteğe Bağlı)"
        reasonPlaceholder="İşlem kaydı ve denetim izi için açıklama girin..."
        isProcessing={isSubmittingAction}
        onCancel={() => {
          if (!isSubmittingAction) setDialogState(null)
        }}
        onConfirm={confirmModeration}
      />

      <ActionToast
        toast={toast}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </>
  )
}

export default AdminContentPage
