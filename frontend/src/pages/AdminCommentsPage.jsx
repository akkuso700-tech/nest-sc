import { useEffect, useState } from 'react'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ConfirmActionDialog from '../components/feedback/ConfirmActionDialog.jsx'
import {
  getAdminComments,
  updateAdminCommentModeration,
} from '../services/adminService.js'
import { getFullName } from '../utils/social.js'

const initialFilters = {
  q: '',
  visibility: 'all',
  page: 1,
  limit: 12,
}

function AdminCommentsPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [draftFilters, setDraftFilters] = useState(initialFilters)
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

    async function loadComments() {
      setState({
        items: [],
        pagination: null,
        isLoading: true,
        error: '',
      })

      try {
        const payload = await getAdminComments(filters)

        if (cancelled) {
          return
        }

        setState({
          items: payload.comments,
          pagination: payload.pagination,
          isLoading: false,
          error: '',
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setState({
          items: [],
          pagination: null,
          isLoading: false,
          error: error.message || 'Yorumlar yuklenemedi.',
        })
      }
    }

    loadComments()

    return () => {
      cancelled = true
    }
  }, [filters])

  function handleModeration(commentId, visibility) {
    setDialogState({
      commentId,
      visibility,
      title:
        visibility === 'visible'
          ? 'Bu yorumu geri yukle'
          : visibility === 'hidden'
            ? 'Bu yorumu gizle'
            : 'Bu yorumu kaldir',
      description:
        visibility === 'visible'
          ? 'Bu yorum yeniden normal kullanici gorunumunde yer alacak.'
          : visibility === 'hidden'
            ? 'Bu yorum admin kayitlarinda kalir ama normal kullanicilardan gizlenir.'
            : 'Bu yorum normal kullanicilar icin kaldirildi olarak isaretlenir.',
    })
  }

  async function confirmModeration(reason) {
    if (!dialogState) {
      return
    }

    setIsSubmittingAction(true)

    try {
      const payload = await updateAdminCommentModeration(dialogState.commentId, {
        visibility: dialogState.visibility,
        reason,
      })

      setState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) =>
          item._id === dialogState.commentId ? payload.comment : item,
        ),
      }))
      setToast({ message: payload.message, tone: 'success' })
      setDialogState(null)
    } catch (error) {
      setToast({
        message: error.message || 'Yorum moderasyonu tamamlanamadi.',
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

  if (state.isLoading) {
    return (
      <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
        Yorumlar yukleniyor...
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-600 shadow-sm">
        {state.error}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-5">
        <form
          onSubmit={handleFilterSubmit}
          className="grid gap-3 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-[1.2fr_0.8fr_auto_auto]"
        >
          <input
            type="text"
            value={draftFilters.q}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                q: event.target.value,
              }))
            }
            placeholder="Yorum metni veya yazar ara"
            className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
          />
          <select
            value={draftFilters.visibility}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                visibility: event.target.value,
              }))
            }
            className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tum moderasyon durumlari</option>
            <option value="visible">gorunur</option>
            <option value="hidden">gizli</option>
            <option value="removed">kaldirildi</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white"
          >
            Uygula
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-full border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700"
          >
            Sifirla
          </button>
        </form>

        {state.items.map((comment) => (
          <article
            key={comment._id}
            className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-950">
                  {getFullName(comment.author)}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  @{comment.author?.username} - {new Date(comment.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  Gonderi: {comment.post?.text || 'Sadece medya iceren gonderi'}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  (comment.moderation?.visibility || 'visible') === 'visible'
                    ? 'bg-emerald-100 text-emerald-700'
                    : (comment.moderation?.visibility || 'visible') === 'hidden'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-rose-100 text-rose-700'
                }`}
              >
                {comment.moderation?.visibility || 'visible'}
              </span>
            </div>

            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-700">
              {comment.text || 'Sadece medya iceren yorum'}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => handleModeration(comment._id, 'visible')}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
              >
                Geri Yukle
              </button>
              <button
                type="button"
                onClick={() => handleModeration(comment._id, 'hidden')}
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700"
              >
                Gizle
              </button>
              <button
                type="button"
                onClick={() => handleModeration(comment._id, 'removed')}
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700"
              >
                Kaldir
              </button>
            </div>
          </article>
        ))}

        {!state.items.length ? (
          <div className="rounded-[28px] border border-dashed border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
            Henuz yorum bulunmuyor.
          </div>
        ) : null}

        {state.pagination ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-zinc-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-zinc-500">
              Sayfa {state.pagination.page} / {state.pagination.totalPages} - Toplam {state.pagination.totalItems}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changePage(state.pagination.page - 1)}
                disabled={!state.pagination.hasPrevPage}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Onceki
              </button>
              <button
                type="button"
                onClick={() => changePage(state.pagination.page + 1)}
                disabled={!state.pagination.hasNextPage}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Sonraki
              </button>
            </div>
          </div>
        ) : null}
      </div>

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

export default AdminCommentsPage
