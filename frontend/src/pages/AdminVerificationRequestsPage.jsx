import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ActionToast from '../components/feedback/ActionToast.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import {
  getAdminVerificationRequests,
  updateAdminVerificationRequestStatus,
} from '../services/adminService.js'
import { getFullName } from '../utils/social.js'

const statusLabels = {
  pending: 'Bekliyor',
  in_review: 'İnceleniyor',
  needs_info: 'Ek bilgi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  revoked: 'Kaldırıldı',
}

export default function AdminVerificationRequestsPage() {
  const { lang = 'tr' } = useParams()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState({ q: searchParams.get('q') || '', status: 'all', category: 'all', page: 1, limit: 20 })
  const [state, setState] = useState({ loading: true, items: [], pagination: null, error: '' })
  const [selected, setSelected] = useState(null)
  const [decision, setDecision] = useState({ status: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'success' })

  const loadRequests = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const payload = await getAdminVerificationRequests(filters)
      setState({ loading: false, items: payload.requests, pagination: payload.pagination, error: '' })
      setSelected((current) => payload.requests.find((item) => item._id === current?._id) || null)
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Başvurular yüklenemedi.' }))
    }
  }, [filters])

  useEffect(() => { loadRequests() }, [loadRequests])

  async function submitDecision() {
    if (!selected || !decision.status) return
    setSaving(true)
    try {
      const payload = await updateAdminVerificationRequestStatus(selected._id, decision)
      setToast({ message: payload.message, tone: 'success' })
      setDecision({ status: '', note: '' })
      await loadRequests()
    } catch (error) {
      setToast({ message: error.message || 'Karar kaydedilemedi.', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const needsNote = ['needs_info', 'rejected'].includes(decision.status)
  const actionable = selected?.isActive && !['approved', 'rejected', 'revoked'].includes(selected?.status)

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <form onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, page: 1 })) }} className="grid gap-3 md:grid-cols-[1fr_190px_190px_auto]">
          <input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value, page: 1 }))} placeholder="Ad, kullanıcı adı veya e-posta" className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-zinc-500" />
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
            <option value="all">Tüm durumlar</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value, page: 1 }))} className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
            <option value="all">Tüm kategoriler</option>
            <option value="individual">Bireysel</option>
            <option value="creator">İçerik üreticisi</option>
            <option value="business">İşletme</option>
            <option value="organization">Kurum</option>
            <option value="public_figure">Kamuya mal olmuş kişi</option>
          </select>
          <button type="button" onClick={() => setFilters({ q: '', status: 'all', category: 'all', page: 1, limit: 20 })} className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Temizle</button>
        </form>
      </section>

      {state.error ? <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4"><strong>{state.pagination?.totalItems || 0} başvuru</strong></div>
          {state.loading ? <p className="p-5 text-sm text-zinc-500">Yükleniyor...</p> : null}
          {!state.loading && !state.items.length ? <p className="p-5 text-sm text-zinc-500">Bu filtrelerde başvuru yok.</p> : null}
          <div className="divide-y divide-zinc-100">
            {state.items.map((request) => (
              <button key={request._id} type="button" onClick={() => { setSelected(request); setDecision({ status: '', note: '' }) }} className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-zinc-50 ${selected?._id === request._id ? 'bg-sky-50' : ''}`}>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-zinc-950">{getFullName(request.user)} <VerifiedBadge user={request.user} /></p>
                  <p className="truncate text-xs text-zinc-500">@{request.user?.username} · {request.category}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700">{statusLabels[request.status] || request.status}</span>
                  <p className="mt-1 text-[11px] text-zinc-400">{new Date(request.submittedAt).toLocaleDateString('tr-TR')}</p>
                </div>
              </button>
            ))}
          </div>
          {state.pagination?.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-zinc-100 p-4 text-sm">
              <button disabled={!state.pagination.hasPrevPage} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border px-3 py-2 disabled:opacity-40">Önceki</button>
              <span>{state.pagination.page} / {state.pagination.totalPages}</span>
              <button disabled={!state.pagination.hasNextPage} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border px-3 py-2 disabled:opacity-40">Sonraki</button>
            </div>
          ) : null}
        </div>

        <aside className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm xl:sticky xl:top-24 xl:self-start">
          {!selected ? <p className="text-sm text-zinc-500">İncelemek için bir başvuru seçin.</p> : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Başvuru detayı</p>
                <h2 className="mt-2 text-xl font-bold">{getFullName(selected.user)}</h2>
                <Link to={`/${lang}/admin/users/${selected.user?._id}`} className="text-sm text-sky-600 hover:underline">@{selected.user?.username}</Link>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">{selected.statement}</div>
              <div>
                <p className="text-xs font-bold uppercase text-zinc-400">Kanıt bağlantıları</p>
                <div className="mt-2 space-y-2">{selected.evidenceLinks?.length ? selected.evidenceLinks.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer" className="block truncate text-sm text-sky-600 hover:underline">{link}</a>) : <span className="text-sm text-zinc-400">Bağlantı eklenmemiş.</span>}</div>
              </div>
              {actionable ? (
                <div className="space-y-3 border-t border-zinc-100 pt-5">
                  <select value={decision.status} onChange={(event) => setDecision({ status: event.target.value, note: '' })} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
                    <option value="">Karar seçin</option>
                    {selected.status !== 'in_review' ? <option value="in_review">İncelemeye al</option> : null}
                    <option value="needs_info">Ek bilgi iste</option>
                    <option value="approved">Onayla</option>
                    <option value="rejected">Reddet</option>
                  </select>
                  <textarea rows={4} value={decision.note} onChange={(event) => setDecision((current) => ({ ...current, note: event.target.value }))} placeholder={needsNote ? 'Gerekçe zorunludur' : 'İç not (isteğe bağlı)'} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm" />
                  <button type="button" onClick={submitDecision} disabled={saving || !decision.status || (needsNote && !decision.note.trim())} className="w-full rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{saving ? 'Kaydediliyor...' : 'Kararı kaydet'}</button>
                </div>
              ) : <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500">Bu başvuru sonuçlandırılmış.</p>}
            </div>
          )}
        </aside>
      </section>
      <ActionToast toast={toast} onClose={() => setToast({ message: '', tone: 'success' })} />
    </div>
  )
}
