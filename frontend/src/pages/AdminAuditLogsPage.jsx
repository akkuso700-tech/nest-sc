import { useEffect, useState } from 'react'
import { getAdminAuditLogs } from '../services/adminService.js'
import { getFullName } from '../utils/social.js'

const initialFilters = {
  q: '',
  action: '',
  actor: '',
  targetKind: 'all',
  targetId: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
  limit: 15,
}

function MetadataCell({ metadata }) {
  const entries = Object.entries(metadata || {})
  if (!entries.length) return <span className="text-zinc-400">Ek veri yok</span>

  return (
    <details className="group max-w-[300px]">
      <summary className="cursor-pointer list-none text-xs font-semibold text-blue-600">
        {entries.length} alanı görüntüle
      </summary>
      <dl className="mt-2 space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[88px_1fr] gap-2 text-[11px]">
            <dt className="truncate font-semibold text-zinc-500" title={key}>{key}</dt>
            <dd className="break-words text-zinc-700">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

function AdminAuditLogsPage() {
  const [filters, setFilters] = useState(initialFilters)
  const [draftFilters, setDraftFilters] = useState(initialFilters)
  const [state, setState] = useState({
    items: [],
    pagination: null,
    isLoading: true,
    error: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadLogs() {
      setState({
        items: [],
        pagination: null,
        isLoading: true,
        error: '',
      })

      try {
        const payload = await getAdminAuditLogs(filters)

        if (cancelled) {
          return
        }

        setState({
          items: payload.logs,
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
          error: error.message || 'İşlem kayıtları yüklenemedi.',
        })
      }
    }

    loadLogs()

    return () => {
      cancelled = true
    }
  }, [filters])

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
        İşlem kayıtları yükleniyor...
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
    <div className="space-y-5">
      <form
        onSubmit={handleFilterSubmit}
        className="grid gap-3 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-4"
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
          placeholder="Ozet veya islem ara"
          className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
        />
        <input
          type="text"
          value={draftFilters.action}
          onChange={(event) =>
            setDraftFilters((currentFilters) => ({
              ...currentFilters,
              action: event.target.value,
            }))
          }
          placeholder="Islem anahtari"
          className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
        />
        <input
          type="text"
          value={draftFilters.actor}
          onChange={(event) =>
            setDraftFilters((currentFilters) => ({
              ...currentFilters,
              actor: event.target.value,
            }))
          }
          placeholder="Islemi yapan kisi"
          className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
        />
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
          <option value="report">rapor</option>
          <option value="system">sistem</option>
        </select>
        <input
          type="text"
          value={draftFilters.targetId}
          onChange={(event) =>
            setDraftFilters((currentFilters) => ({
              ...currentFilters,
              targetId: event.target.value,
            }))
          }
          placeholder="Tam hedef ID"
          className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
        />
        <input
          type="date"
          value={draftFilters.dateFrom}
          onChange={(event) =>
            setDraftFilters((currentFilters) => ({
              ...currentFilters,
              dateFrom: event.target.value,
            }))
          }
          className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
        />
        <input
          type="date"
          value={draftFilters.dateTo}
          onChange={(event) =>
            setDraftFilters((currentFilters) => ({
              ...currentFilters,
              dateTo: event.target.value,
            }))
          }
          className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
        />
        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white"
          >
            Uygula
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex-1 rounded-full border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700"
          >
            Sıfırla
          </button>
        </div>
      </form>

      <section className="rounded-[28px] border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-zinc-50 text-xs uppercase tracking-[0.18em] text-zinc-400">
              <tr>
                <th className="px-5 py-4">Zaman</th>
                <th className="px-5 py-4">İşlemi Yapan</th>
                <th className="px-5 py-4">İşlem</th>
                <th className="px-5 py-4">Hedef</th>
                <th className="px-5 py-4">Özet</th>
                <th className="px-5 py-4">Değişiklikler</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((log) => (
                <tr key={log._id} className="border-t border-zinc-100 align-top">
                  <td className="px-5 py-4 text-sm text-zinc-600">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-sm text-zinc-600">
                    {getFullName(log.actor)} @{log.actor?.username}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-white">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-zinc-600">
                    <div>{log.targetKind}</div>
                    {log.targetId ? (
                      <div className="mt-1 break-all text-xs text-zinc-400">
                        {log.targetId}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-sm text-zinc-600">
                    {log.summary || '-'}
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-500"><MetadataCell metadata={log.metadata} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {state.pagination ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
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
                Önceki
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
      </section>
    </div>
  )
}

export default AdminAuditLogsPage
