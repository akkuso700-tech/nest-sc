import { useEffect, useState } from 'react'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ConfirmActionDialog from '../components/feedback/ConfirmActionDialog.jsx'
import {
  getAdminReports,
  updateAdminReportStatus,
} from '../services/adminService.js'
import { getFullName } from '../utils/social.js'

const initialFilters = {
  status: 'all',
  targetKind: 'all',
  page: 1,
  limit: 12,
}

function AdminReportsPage() {
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

    async function loadReports() {
      setState({
        items: [],
        pagination: null,
        isLoading: true,
        error: '',
      })

      try {
        const payload = await getAdminReports(filters)

        if (cancelled) {
          return
        }

        setState({
          items: payload.reports,
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
          error: error.message || 'Raporlar yuklenemedi.',
        })
      }
    }

    loadReports()

    return () => {
      cancelled = true
    }
  }, [filters])

  function handleStatusUpdate(reportId, status) {
    setDialogState({
      reportId,
      status,
      title:
        status === 'in_review'
          ? 'Raporu incelemeye al'
          : status === 'resolved'
            ? 'Bu raporu cozumle'
            : 'Bu raporu reddet',
      description:
        status === 'in_review'
          ? 'Bu durum raporun aktif olarak incelendigini gosterir.'
          : status === 'resolved'
            ? 'Moderasyon karari tamamlandiginda bu secenegi kullan.'
            : 'Bu rapor icin ek islem gerekmiyorsa bu secenegi kullan.',
    })
  }

  async function confirmStatusUpdate(resolutionNote) {
    if (!dialogState) {
      return
    }

    setIsSubmittingAction(true)

    try {
      const payload = await updateAdminReportStatus(dialogState.reportId, {
        status: dialogState.status,
        resolutionNote,
      })

      setState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) =>
          item._id === dialogState.reportId ? payload.report : item,
        ),
      }))
      setToast({ message: payload.message, tone: 'success' })
      setDialogState(null)
    } catch (error) {
      setToast({
        message: error.message || 'Rapor durumu guncellenemedi.',
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
        Raporlar yukleniyor...
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
          className="grid gap-3 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-[0.9fr_0.9fr_auto_auto]"
        >
          <select
            value={draftFilters.status}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                status: event.target.value,
              }))
            }
            className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tum durumlar</option>
            <option value="open">acik</option>
            <option value="in_review">incelemede</option>
            <option value="resolved">cozuldu</option>
            <option value="dismissed">reddedildi</option>
          </select>
          <select
            value={draftFilters.targetKind}
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                targetKind: event.target.value,
              }))
            }
            className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tum hedefler</option>
            <option value="user">kullanici</option>
            <option value="post">gonderi</option>
            <option value="comment">yorum</option>
            <option value="message">mesaj</option>
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

        {state.items.map((report) => (
          <article
            key={report._id}
            className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-950">
                  {getFullName(report.reporter)}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  @{report.reporter?.username} - {new Date(report.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {report.targetKind}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    report.status === 'open'
                      ? 'bg-rose-100 text-rose-700'
                      : report.status === 'in_review'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {report.status}
                </span>
              </div>
            </div>

            <p className="mt-4 text-sm font-medium text-zinc-800">{report.reason}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {report.details || 'Ek aciklama girilmedi.'}
            </p>
            <p className="mt-2 text-xs text-zinc-400">Hedef ID: {report.targetId}</p>
            {report.resolutionNote ? (
              <p className="mt-2 text-xs text-zinc-500">
                Cozum notu: {report.resolutionNote}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => handleStatusUpdate(report._id, 'in_review')}
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700"
              >
                Incelemeye Al
              </button>
              <button
                type="button"
                onClick={() => handleStatusUpdate(report._id, 'resolved')}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
              >
                Cozumle
              </button>
              <button
                type="button"
                onClick={() => handleStatusUpdate(report._id, 'dismissed')}
                className="rounded-full border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700"
              >
                Reddet
              </button>
            </div>
          </article>
        ))}

        {!state.items.length ? (
          <div className="rounded-[28px] border border-dashed border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
            Henuz rapor bulunmuyor.
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
          dialogState?.status === 'in_review'
            ? 'Incelemeye Al'
            : dialogState?.status === 'resolved'
              ? 'Cozumle'
              : 'Reddet'
        }
        confirmTone={dialogState?.status === 'dismissed' ? 'danger' : 'default'}
        reasonLabel="Cozum notu"
        reasonPlaceholder="Rapor kaydi icin istege bagli not"
        isProcessing={isSubmittingAction}
        onCancel={() => {
          if (!isSubmittingAction) {
            setDialogState(null)
          }
        }}
        onConfirm={confirmStatusUpdate}
      />

      <ActionToast
        toast={toast}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </>
  )
}

export default AdminReportsPage
