import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BulkActionBar from '../components/admin/BulkActionBar.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ConfirmActionDialog from '../components/feedback/ConfirmActionDialog.jsx'
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
  if (contentType === 'loop') return 'loop'
  if (contentType === 'story') return 'story'
  return 'post'
}

function mapVisibilityClass(visibility = 'visible') {
  if (visibility === 'hidden') return 'bg-amber-100/80 text-amber-700'
  if (visibility === 'removed') return 'bg-rose-100/80 text-rose-700'
  return 'bg-emerald-100/80 text-emerald-700'
}

function resolvePostCover(post) {
  const firstMedia = Array.isArray(post?.media) ? post.media[0] : null

  if (!firstMedia) {
    return { kind: 'empty', url: '' }
  }

  const imageLikeUrl =
    firstMedia?.posterUrl ||
    firstMedia?.thumbnailUrl ||
    firstMedia?.previewUrl ||
    (firstMedia?.type === 'image' ? firstMedia?.url : '')
  const resolvedImageUrl = resolveMediaUrl(imageLikeUrl || '')

  if (resolvedImageUrl) {
    return { kind: 'image', url: resolvedImageUrl }
  }

  if (firstMedia?.type === 'video') {
    const resolvedVideoUrl = resolveMediaUrl(firstMedia?.url || firstMedia?.hlsUrl || '')
    return { kind: 'video', url: resolvedVideoUrl }
  }

  return { kind: 'empty', url: '' }
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

    async function loadContent() {
      setState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: '',
      }))

      try {
        const payload = await getAdminContent(filters)

        if (cancelled) {
          return
        }

        setState({
          items: payload.posts || [],
          pagination: payload.pagination || null,
          isLoading: false,
          error: '',
        })
        setSelectedPostIds([])
      } catch (error) {
        if (cancelled) {
          return
        }

        setState((currentState) => ({
          ...currentState,
          isLoading: false,
          error: error.message || 'Icerik listesi yuklenemedi.',
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

  function renderSortIcon(key) {
    const isActive = filters.sortBy === key
    const isAsc = isActive && filters.sortDirection === 'asc'
    const isDesc = isActive && filters.sortDirection === 'desc'

    return (
      <span className="ml-2 inline-flex shrink-0 flex-col items-center justify-center leading-none">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-6 w-6 transition ${isAsc ? 'text-white' : 'text-white/35'}`}
        >
          <path d="M10 5L6 9H14L10 5Z" fill="currentColor" />
        </svg>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`-mt-4 h-6 w-6 transition ${isDesc ? 'text-white' : 'text-white/35'}`}
        >
          <path d="M10 15L14 11H6L10 15Z" fill="currentColor" />
        </svg>
      </span>
    )
  }

  function syncHorizontalScroll(source) {
    const headerScroller = headerScrollerRef.current
    const bottomScrollbar = bottomScrollbarRef.current
    const tableScroller = tableScrollerRef.current

    if (!headerScroller || !bottomScrollbar || !tableScroller || isSyncingScrollRef.current) {
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

  function openSingleModerationDialog(postId, visibility) {
    setDialogState({
      mode: 'single',
      postId,
      visibility,
      title:
        visibility === 'visible'
          ? 'Bu gonderiyi geri yukle'
          : visibility === 'hidden'
            ? 'Bu gonderiyi gizle'
            : 'Bu gonderiyi kaldir',
      description:
        visibility === 'visible'
          ? 'Bu gonderi yeniden normal kullanici deneyiminde gorunur olacak.'
          : visibility === 'hidden'
            ? 'Bu gonderi admin kayitlarinda kalir ama normal akislardan kaybolur.'
            : 'Bu gonderi normal kullanicilar icin kaldirildi olarak isaretlenir.',
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
    const allSelected = currentPageIds.every((id) => selectedPostIds.includes(id))

    if (allSelected) {
      setSelectedPostIds((currentIds) =>
        currentIds.filter((id) => !currentPageIds.includes(id)),
      )
      return
    }

    setSelectedPostIds((currentIds) => [...new Set([...currentIds, ...currentPageIds])])
  }

  function handleBulkModeration(visibility) {
    if (!selectedPostIds.length) {
      return
    }

    setDialogState({
      mode: 'bulk',
      visibility,
      title:
        visibility === 'visible'
          ? 'Secili gonderileri geri yukle'
          : visibility === 'hidden'
            ? 'Secili gonderileri gizle'
            : 'Secili gonderileri kaldir',
      description:
        visibility === 'visible'
          ? 'Secili gonderiler yeniden gorunur olur.'
          : visibility === 'hidden'
            ? 'Secili gonderiler normal kullanici yuzlerinden gizlenir.'
            : 'Secili gonderiler kaldirildi olarak isaretlenir.',
    })
  }

  async function confirmModeration(reason) {
    if (!dialogState) {
      return
    }

    setIsSubmittingAction(true)

    try {
      if (dialogState.mode === 'single') {
        const payload = await updateAdminPostModeration(dialogState.postId, {
          visibility: dialogState.visibility,
          reason,
        })

        setState((currentState) => ({
          ...currentState,
          items: currentState.items.map((item) =>
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
        setFilters((currentFilters) => ({ ...currentFilters }))
        setToast({ message: payload.message, tone: 'success' })
      }

      setDialogState(null)
    } catch (error) {
      setToast({
        message: error.message || 'Moderasyon islemi tamamlanamadi.',
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
    setFilters((currentFilters) => ({
      ...currentFilters,
      page: nextPage,
    }))
  }

  if (state.isLoading && !state.items?.length && !state.error) {
    return (
      <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
        Icerikler yukleniyor...
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

  return (
    <>
      <BulkActionBar
        count={selectedPostIds.length}
        label="gonderi"
        onClear={() => setSelectedPostIds([])}
        actions={[
          {
            label: 'Geri Yukle',
            tone: 'success',
            onClick: () => handleBulkModeration('visible'),
          },
          {
            label: 'Gizle',
            tone: 'default',
            onClick: () => handleBulkModeration('hidden'),
          },
          {
            label: 'Kaldir',
            tone: 'danger',
            onClick: () => handleBulkModeration('removed'),
          },
        ]}
      />

      <section className="rounded-lg border border-white/70 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_48%,#312e81_100%)] shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="border-b border-white/30 px-5 py-3">
          <h2 className="text-lg font-bold text-white">ICERIKLER</h2>
        </div>

        <form
          onSubmit={handleFilterSubmit}
          className="grid items-center gap-3 px-3 pt-4 pb-0 sm:px-5 md:grid-cols-[0.65fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_auto_auto]"
        >
          <div className="flex-col items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAllCurrentPage}
              className="h-8 items-center rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-normal text-white/80 cursor-pointer transition hover:border-white/20 hover:text-white"
            >
              Tumunu Sec
            </button>
            <p className="px-2 text-xs text-zinc-500">{selectedPostIds.length} secildi</p>
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
            placeholder="Gonderi metni veya yazar ara"
            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-3 pr-4 text-sm text-white/85 outline-none transition placeholder:text-slate-400 focus:border-sky-400/40 focus:bg-white/[0.12] focus:ring-4 focus:ring-sky-500/10"
          />

          <select
            value={draftFilters.privacy}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                privacy: event.target.value,
              }))
            }
            className="h-10 cursor-pointer w-full appearance-none rounded-lg border border-white/10 bg-white/[0.08] px-4 pr-11 text-sm font-normal text-white/85 outline-none backdrop-blur-md transition duration-200 hover:border-white/20 hover:bg-white/[0.10] focus:border-sky-400/40 focus:bg-white/[0.12] focus:ring-4 focus:ring-sky-500/10"
          >
            <option value="all" className="bg-slate-900 text-white">Tum gizlilikler</option>
            <option value="public" className="bg-slate-900 text-white">Herkese acik</option>
            <option value="followers" className="bg-slate-900 text-white">Takipciler</option>
            <option value="private" className="bg-slate-900 text-white">Ozel</option>
          </select>

          <select
            value={draftFilters.contentType}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                contentType: event.target.value,
              }))
            }
            className="h-10 cursor-pointer w-full appearance-none rounded-lg border border-white/10 bg-white/[0.08] px-4 pr-11 text-sm font-normal text-white/85 outline-none backdrop-blur-md transition duration-200 hover:border-white/20 hover:bg-white/[0.10] focus:border-sky-400/40 focus:bg-white/[0.12] focus:ring-4 focus:ring-sky-500/10"
          >
            <option value="all" className="bg-slate-900 text-white">Tum tipler</option>
            <option value="post" className="bg-slate-900 text-white">Post</option>
            <option value="loop" className="bg-slate-900 text-white">Loop</option>
            <option value="story" className="bg-slate-900 text-white">Story</option>
          </select>

          <select
            value={draftFilters.mediaKind}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                mediaKind: event.target.value,
              }))
            }
            className="h-10 cursor-pointer w-full appearance-none rounded-lg border border-white/10 bg-white/[0.08] px-4 pr-11 text-sm font-normal text-white/85 outline-none backdrop-blur-md transition duration-200 hover:border-white/20 hover:bg-white/[0.10] focus:border-sky-400/40 focus:bg-white/[0.12] focus:ring-4 focus:ring-sky-500/10"
          >
            <option value="all" className="bg-slate-900 text-white">Tum gonderiler</option>
            <option value="media" className="bg-slate-900 text-white">Medyali</option>
            <option value="text" className="bg-slate-900 text-white">Sadece metin</option>
          </select>

          <select
            value={draftFilters.visibility}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                visibility: event.target.value,
              }))
            }
            className="h-10 cursor-pointer w-full appearance-none rounded-lg border border-white/10 bg-white/[0.08] px-4 pr-11 text-sm font-normal text-white/85 outline-none backdrop-blur-md transition duration-200 hover:border-white/20 hover:bg-white/[0.10] focus:border-sky-400/40 focus:bg-white/[0.12] focus:ring-4 focus:ring-sky-500/10"
          >
            <option value="all" className="bg-slate-900 text-white">Tum durumlar</option>
            <option value="visible" className="bg-slate-900 text-white">Gorunur</option>
            <option value="hidden" className="bg-slate-900 text-white">Gizli</option>
            <option value="removed" className="bg-slate-900 text-white">Kaldirildi</option>
          </select>

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
          {state.items?.map((post) => {
            const visibility = post?.moderation?.visibility || 'visible'
            const contentType = post?.contentType || 'post'
            const mediaCount = (post?.media || []).length
            const contentPreview = (post?.text || '').trim() || 'Sadece medya iceren gonderi'
            const createdAtDate = post?.createdAt ? new Date(post.createdAt) : null
            const createdAt = createdAtDate ? createdAtDate.toLocaleDateString() : '-'
            const createdAtTime = createdAtDate
              ? createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '-'
            const viewsCount = Number(post?.stats?.views || 0)
            const cover = resolvePostCover(post)

            return (
              <article key={post._id} className="rounded-lg border border-white/20 bg-[rgba(20,28,48,0.72)] p-3 text-white">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPostIds.includes(post._id)}
                    onChange={() => toggleSelectedPost(post._id)}
                    aria-label="Gonderi sec"
                    className="mt-1 size-4 cursor-pointer rounded-md border border-white/15 bg-white/5 text-sky-500 accent-sky-500 outline-none"
                  />
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-white/5">
                      {cover.kind === 'image' ? (
                        <img src={cover.url} alt="Icerik kapagi" className="h-full w-full object-cover" loading="lazy" />
                      ) : cover.kind === 'video' && cover.url ? (
                        <video src={cover.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Medya</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{getFullName(post.author)}</p>
                      <p className="mt-0.5 text-xs text-white/70">@{post.author?.username || '-'}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-white/90">{contentPreview}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
                    <p className="text-white/60">Tip</p>
                    <p className="mt-1 text-white/90">{mapContentTypeLabel(contentType)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
                    <p className="text-white/60">Gizlilik</p>
                    <p className="mt-1 text-white/90">{post?.privacy || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
                    <p className="text-white/60">Medya / Izlenme</p>
                    <p className="mt-1 text-white/90">{mediaCount ? `${mediaCount} medya` : 'yok'} · {viewsCount}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
                    <p className="text-white/60">Moderasyon</p>
                    <span className={`mt-1 inline-flex rounded-lg border border-white/20 px-2 py-1 text-[11px] font-semibold ${mapVisibilityClass(visibility)}`}>
                      {visibility}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => openSingleModerationDialog(post._id, 'visible')} className="inline-flex h-8 items-center rounded-lg border border-emerald-200/60 bg-emerald-50/80 px-2.5 text-xs font-medium text-emerald-700">Geri Yukle</button>
                  <button type="button" onClick={() => openSingleModerationDialog(post._id, 'hidden')} className="inline-flex h-8 items-center rounded-lg border border-amber-200/60 bg-amber-50/80 px-2.5 text-xs font-medium text-amber-700">Gizle</button>
                  <button type="button" onClick={() => openSingleModerationDialog(post._id, 'removed')} className="inline-flex h-8 items-center rounded-lg border border-rose-200/60 bg-rose-50/80 px-2.5 text-xs font-medium text-rose-700">Kaldir</button>
                  <Link to={`/${lang}/posts/${post._id}`} className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs font-medium !text-white/90">Detay</Link>
                </div>

                <p className="mt-2 text-[11px] text-white/60">{createdAt} · {createdAtTime}</p>
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
              <table className="min-w-[1960px] w-full text-left">
                <colgroup>
                  <col style={{ width: '72px' }} />
                  <col style={{ width: '88px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '380px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '170px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '220px' }} />
                </colgroup>
                <thead className="pt-20 bg-zinc-950/95 text-[13px] uppercase tracking-[0.18em] text-white/95 backdrop-blur">
                  <tr>
                    <th className="sticky left-0 z-50 bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      Sec
                    </th>
                    <th className="sticky left-[72px] z-50 bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      Kapak
                    </th>
                    <th className="sticky left-[160px] z-50 border-r border-white/10 bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap shadow-[8px_0_18px_-14px_rgba(0,0,0,0.85)]">
                      Yazar
                    </th>
                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      Icerik
                    </th>
                    <th
                      aria-sort={
                        filters.sortBy === 'contentType'
                          ? filters.sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort('contentType')}
                        className="inline-flex items-center whitespace-nowrap text-left font-semibold text-white/95 transition hover:text-white"
                      >
                        <span>Tip</span>
                        {renderSortIcon('contentType')}
                      </button>
                    </th>
                    <th
                      aria-sort={
                        filters.sortBy === 'privacy'
                          ? filters.sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort('privacy')}
                        className="inline-flex items-center whitespace-nowrap text-left font-semibold text-white/95 transition hover:text-white"
                      >
                        <span>Gizlilik</span>
                        {renderSortIcon('privacy')}
                      </button>
                    </th>
                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      Medya
                    </th>
                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      Moderasyon
                    </th>
                    <th
                      aria-sort={
                        filters.sortBy === 'views'
                          ? filters.sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort('views')}
                        className="inline-flex items-center whitespace-nowrap text-left font-semibold text-white/95 transition hover:text-white"
                      >
                        <span>Goruntuleme</span>
                        {renderSortIcon('views')}
                      </button>
                    </th>
                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      Etkilesim
                    </th>
                    <th
                      aria-sort={
                        filters.sortBy === 'createdAt'
                          ? filters.sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort('createdAt')}
                        className="inline-flex items-center whitespace-nowrap text-left font-semibold text-white/95 transition hover:text-white"
                      >
                        <span>Tarih</span>
                        {renderSortIcon('createdAt')}
                      </button>
                    </th>
                    <th className="bg-zinc-950/95 px-5 pt-4 pb-1 align-middle font-semibold whitespace-nowrap">
                      Islem
                    </th>
                  </tr>
                </thead>
              </table>
            </div>

            <div
              ref={bottomScrollbarRef}
              className="overflow-x-auto overflow-y-hidden bg-zinc-950/95"
              onScroll={() => syncHorizontalScroll('bottom')}
            >
              <div className="h-1 min-w-[1960px] w-full" />
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

            <table className="min-w-[1960px] w-full text-left">
              <colgroup>
                <col style={{ width: '72px' }} />
                <col style={{ width: '88px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '380px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '170px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '220px' }} />
              </colgroup>
              <tbody>
                {state.items?.map((post) => {
                  const visibility = post?.moderation?.visibility || 'visible'
                  const contentType = post?.contentType || 'post'
                  const mediaCount = (post?.media || []).length
                  const contentPreview = (post?.text || '').trim() || 'Sadece medya iceren gonderi'
                  const createdAtDate = post?.createdAt ? new Date(post.createdAt) : null
                  const createdAt = createdAtDate ? createdAtDate.toLocaleDateString() : '-'
                  const createdAtTime = createdAtDate
                    ? createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '-'
                  const viewsCount = Number(post?.stats?.views || 0)
                  const cover = resolvePostCover(post)

                  return (
                    <tr key={post._id} className="border-t border-white/30 align-top">
                      <td className="sticky left-0 z-20 bg-[rgba(20,28,48,0.98)] px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedPostIds.includes(post._id)}
                          onChange={() => toggleSelectedPost(post._id)}
                          aria-label="Gonderi sec"
                          className="size-4 cursor-pointer rounded-md border border-white/15 bg-white/5 text-sky-500 accent-sky-500 outline-none transition hover:border-white/25 focus:ring-2 focus:ring-sky-500/30"
                        />
                      </td>

                      <td className="sticky left-[72px] z-20 bg-[rgba(20,28,48,0.98)] px-2 py-2">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-white/5">
                          {cover.kind === 'image' ? (
                            <img
                              src={cover.url}
                              alt="Icerik kapagi"
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
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                              VIDEO
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                              Yok
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="sticky left-[160px] z-20 border-r border-white/10 bg-[rgba(20,28,48,0.98)] px-5 py-4 shadow-[8px_0_18px_-14px_rgba(0,0,0,0.85)]">
                        <p className="font-semibold text-white">{getFullName(post.author)}</p>
                        <p className="mt-1 text-sm text-white/90">@{post.author?.username || '-'}</p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="line-clamp-2 text-sm leading-6 text-white/85">
                          {contentPreview}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-lg border border-white/20 bg-zinc-950/60 px-3 py-1 text-xs font-normal text-white">
                          {mapContentTypeLabel(contentType)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-white/80">{post?.privacy || '-'}</td>

                      <td className="px-5 py-4 text-sm text-white/80">
                        {mediaCount ? `${mediaCount} medya` : 'yok'}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold ${mapVisibilityClass(
                            visibility,
                          )}`}
                        >
                          {visibility}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-white/80">{viewsCount}</td>

                      <td className="px-5 py-4 text-sm text-white/80">
                        <span>B {post?.stats?.likes || 0}</span>
                        <span className="mx-2">-</span>
                        <span>Y {post?.stats?.comments || 0}</span>
                        <span className="mx-2">-</span>
                        <span>P {post?.stats?.shares || 0}</span>
                        <span className="mx-2">-</span>
                        <span>K {post?.stats?.saves || 0}</span>
                      </td>

                      <td className="px-5 py-4 text-sm text-white/80">
                        <p>{createdAt}</p>
                        <p className="mt-1 text-xs text-white/60">{createdAtTime}</p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => openSingleModerationDialog(post._id, 'visible')}
                            className="inline-flex h-8 items-center rounded-lg border border-emerald-200/60 bg-emerald-50/80 px-2.5 text-xs font-medium text-emerald-700"
                          >
                            Geri Yukle
                          </button>
                          <button
                            type="button"
                            onClick={() => openSingleModerationDialog(post._id, 'hidden')}
                            className="inline-flex h-8 items-center rounded-lg border border-amber-200/60 bg-amber-50/80 px-2.5 text-xs font-medium text-amber-700"
                          >
                            Gizle
                          </button>
                          <button
                            type="button"
                            onClick={() => openSingleModerationDialog(post._id, 'removed')}
                            className="inline-flex h-8 items-center rounded-lg border border-rose-200/60 bg-rose-50/80 px-2.5 text-xs font-medium text-rose-700"
                          >
                            Kaldir
                          </button>
                          <Link
                            to={`/${lang}/posts/${post._id}`}
                            className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs font-medium !text-white/90 transition hover:border-white/20 hover:!text-white"
                          >
                            Detay
                          </Link>
                        </div>
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
        open={Boolean(dialogState)}
        title={dialogState?.title}
        description={dialogState?.description}
        confirmLabel={
          dialogState?.visibility === 'visible'
            ? 'Geri Yukle'
            : dialogState?.visibility === 'hidden'
              ? 'Gizle'
              : 'Kaldir'
        }
        confirmTone={dialogState?.visibility === 'removed' ? 'danger' : 'default'}
        reasonLabel="Moderator notu"
        reasonPlaceholder="Islem kaydi icin istege bagli not"
        isProcessing={isSubmittingAction}
        onCancel={() => {
          if (!isSubmittingAction) {
            setDialogState(null)
          }
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
