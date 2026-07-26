import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import Seo from '../components/seo/Seo.jsx'
import SocialLayout from '../layouts/SocialLayout.jsx'
import { getMyReports } from '../services/reportService.js'
import { useAuth } from '../store/AuthContext.jsx'

const initialFilters = {
  status: 'all',
  targetKind: 'all',
  page: 1,
  limit: 12,
}

function getStatusClasses(status) {
  if (status === 'open') {
    return 'bg-rose-100 text-rose-700'
  }

  if (status === 'in_review') {
    return 'bg-amber-100 text-amber-700'
  }

  return 'bg-emerald-100 text-emerald-700'
}

function MyReportsPage() {
  const { lang } = useParams()
  const { isAuthenticated, status } = useAuth()
  const [filters, setFilters] = useState(initialFilters)
  const [draftFilters, setDraftFilters] = useState(initialFilters)
  const [state, setState] = useState({
    items: [],
    pagination: null,
    isLoading: true,
    error: '',
  })

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    let cancelled = false

    async function loadReports() {
      setState({
        items: [],
        pagination: null,
        isLoading: true,
        error: '',
      })

      try {
        const payload = await getMyReports(filters)

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
          error: error.message || 'Your reports could not be loaded.',
        })
      }
    }

    loadReports()

    return () => {
      cancelled = true
    }
  }, [filters, isAuthenticated])

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

  if (status === 'loading') {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${lang}/login`} replace />
  }

  return (
    <>
      <Seo
        title="My Social 1 Â· My Reports"
        description="Track the moderation status of the reports you have submitted."
      />

      <SocialLayout pageTitle="My Reports" activeKey="reports">
        <div className="space-y-5">
          <form
            onSubmit={handleFilterSubmit}
            className="grid gap-3 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_auto_auto]"
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
              <option value="all">All statuses</option>
              <option value="open">open</option>
              <option value="in_review">in_review</option>
              <option value="resolved">resolved</option>
              <option value="dismissed">dismissed</option>
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
              <option value="all">All targets</option>
              <option value="user">user</option>
              <option value="post">post</option>
              <option value="comment">comment</option>
              <option value="message">message</option>
            </select>

            <button
              type="submit"
              className="rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-full border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700"
            >
              Reset
            </button>
          </form>

          {state.isLoading ? (
            <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
              Loading your reports...
            </div>
          ) : null}

          {state.error ? (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-600 shadow-sm">
              {state.error}
            </div>
          ) : null}

          {state.items.map((report) => (
            <article
              key={report._id}
              className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">
                    {report.reason}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {new Date(report.createdAt).toLocaleString()} Â· Target {report.targetKind}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                    {report.targetKind}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(report.status)}`}
                  >
                    {report.status}
                  </span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-600">
                {report.details || 'No extra details provided.'}
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-zinc-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Target ID
                  </p>
                  <p className="mt-2 break-all text-sm text-zinc-700">{report.targetId}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Reviewed By
                  </p>
                  <p className="mt-2 text-sm text-zinc-700">
                    {report.reviewedBy
                      ? `${report.reviewedBy.firstName || ''} ${report.reviewedBy.lastName || ''} @${report.reviewedBy.username}`
                      : 'Not reviewed yet'}
                  </p>
                </div>
              </div>

              {report.resolutionNote ? (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Resolution Note
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {report.resolutionNote}
                  </p>
                </div>
              ) : null}
            </article>
          ))}

          {!state.isLoading && !state.items.length && !state.error ? (
            <div className="rounded-[28px] border border-dashed border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
              You have not submitted any reports yet.
            </div>
          ) : null}

          {state.pagination ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-zinc-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-sm text-zinc-500">
                Page {state.pagination.page} of {state.pagination.totalPages} Â· Total {state.pagination.totalItems}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => changePage(state.pagination.page - 1)}
                  disabled={!state.pagination.hasPrevPage}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => changePage(state.pagination.page + 1)}
                  disabled={!state.pagination.hasNextPage}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </SocialLayout>
    </>
  )
}

export default MyReportsPage
