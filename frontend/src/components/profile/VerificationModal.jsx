import { useCallback, useEffect, useMemo, useState } from 'react'
import VerifiedBadge from '../common/VerifiedBadge.jsx'
import {
  createMyVerificationRequest,
  getMyVerificationRequest,
  updateMyVerificationRequest,
  withdrawMyVerificationRequest,
} from '../../services/usersService.js'

const categories = [
  ['individual', 'Bireysel'],
  ['creator', 'İçerik üreticisi'],
  ['business', 'İşletme'],
  ['organization', 'Kurum'],
  ['public_figure', 'Kamuya mal olmuş kişi'],
]

const statusCopy = {
  pending: ['Başvurunuz alındı', 'Başvurunuz yönetim ekibinin inceleme kuyruğunda.'],
  in_review: ['Başvurunuz inceleniyor', 'Bir yönetici verdiğiniz bilgileri değerlendiriyor.'],
  needs_info: ['Ek bilgi gerekiyor', 'İstenen bilgileri ekleyip başvurunuzu yeniden gönderin.'],
  approved: ['Profiliniz onaylandı', 'Mavi tik adınızın yanında görünür durumda.'],
  rejected: ['Başvurunuz reddedildi', 'Tekrar başvuru tarihi geldiğinde yeni başvuru oluşturabilirsiniz.'],
  revoked: ['Profil doğrulaması kaldırıldı', 'Yeni bir inceleme için tekrar başvurabilirsiniz.'],
  withdrawn: ['Başvuru geri çekildi', 'Hazır olduğunuzda yeniden başvurabilirsiniz.'],
}

function requestToForm(request) {
  return {
    category: request?.category || 'individual',
    statement: request?.statement || '',
    evidenceLinks: (request?.evidenceLinks || []).join('\n'),
    termsAccepted: false,
  }
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export default function VerificationModal({ open, user, onClose }) {
  const [state, setState] = useState({ loading: false, request: null, canApply: false, error: '' })
  const [form, setForm] = useState(requestToForm(null))
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', tone: 'success' })

  const loadRequest = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const payload = await getMyVerificationRequest()
      setState({ loading: false, request: payload.request, canApply: payload.canApply, error: '' })
      if (payload.request?.status === 'needs_info') setForm(requestToForm(payload.request))
      if (!payload.request) setForm(requestToForm(null))
    } catch (error) {
      setState({ loading: false, request: null, canApply: false, error: error.message || 'Başvuru bilgileri yüklenemedi.' })
    }
  }, [])

  useEffect(() => {
    if (!open) return undefined
    loadRequest()
    setFeedback({ message: '', tone: 'success' })

    return undefined
  }, [loadRequest, open])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, submitting])

  const evidenceLinks = useMemo(
    () => form.evidenceLinks.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    [form.evidenceLinks],
  )
  const isAdditionalInfo = state.request?.status === 'needs_info'
  const canShowForm = isAdditionalInfo || state.canApply
  const currentCopy = state.request ? statusCopy[state.request.status] : null

  async function handleSubmit(event) {
    event.preventDefault()
    if (evidenceLinks.length > 5) {
      setFeedback({ message: 'En fazla 5 bağlantı ekleyebilirsiniz.', tone: 'error' })
      return
    }

    setSubmitting(true)
    setFeedback({ message: '', tone: 'success' })
    try {
      const payload = isAdditionalInfo
        ? await updateMyVerificationRequest({
            category: form.category,
            statement: form.statement,
            evidenceLinks,
          })
        : await createMyVerificationRequest({
            category: form.category,
            statement: form.statement,
            evidenceLinks,
            termsAccepted: form.termsAccepted,
          })
      setFeedback({ message: payload.message, tone: 'success' })
      await loadRequest()
    } catch (error) {
      setFeedback({ message: error.message || 'Başvuru gönderilemedi.', tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWithdraw() {
    setSubmitting(true)
    setFeedback({ message: '', tone: 'success' })
    try {
      const payload = await withdrawMyVerificationRequest()
      setFeedback({ message: payload.message, tone: 'success' })
      await loadRequest()
    } catch (error) {
      setFeedback({ message: error.message || 'Başvuru geri çekilemedi.', tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-zinc-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={() => { if (!submitting) onClose() }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-modal-title"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[30px] border border-border bg-card shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:rounded-[30px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-500 dark:bg-sky-950/40">
              <VerifiedBadge user={{ verification: { isVerified: true } }} size="md" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-500">Profil doğrulama</p>
              <h2 id="verification-modal-title" className="mt-1 text-xl font-bold text-text">Mavi Tik Başvurusu</h2>
              <p className="mt-1 truncate text-sm text-muted">@{user?.username || 'profil'} · Ücretsiz başvurunuzu yönetin.</p>
            </div>
          </div>
          <button type="button" autoFocus onClick={onClose} disabled={submitting} className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted transition hover:text-text disabled:opacity-40" aria-label="Pencereyi kapat">
            <CloseIcon />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm leading-6 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
            Başvuru ücretsizdir ancak onay otomatik değildir. Yönetim ekibi profil bilgilerinizi ve sunduğunuz bağlantıları inceler. Kimlik belgesi yüklemeyin.
          </div>

          {state.loading ? <div className="py-10 text-center text-sm text-muted">Başvuru bilgileri yükleniyor...</div> : null}
          {state.error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

          {!state.loading && currentCopy ? (
            <div className="mt-5 rounded-2xl border border-border bg-secondary/60 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase text-primary">{state.request.status}</span>
                  <h3 className="mt-3 text-lg font-bold text-text">{currentCopy[0]}</h3>
                  <p className="mt-1 text-sm text-muted">{currentCopy[1]}</p>
                </div>
                {state.request.status === 'pending' ? (
                  <button type="button" onClick={handleWithdraw} disabled={submitting} className="rounded-full border border-rose-200 bg-card px-4 py-2 text-xs font-bold text-rose-600 disabled:opacity-40">Geri çek</button>
                ) : null}
              </div>
              {state.request.requestedInformation ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">İstenen bilgi: {state.request.requestedInformation}</p> : null}
              {state.request.rejectionReason ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Ret nedeni: {state.request.rejectionReason}</p> : null}
              {state.request.resubmissionAllowedAt ? <p className="mt-3 text-xs text-muted">Tekrar başvuru tarihi: {new Date(state.request.resubmissionAllowedAt).toLocaleDateString('tr-TR')}</p> : null}
            </div>
          ) : null}

          {!state.loading && canShowForm ? (
            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-text">{isAdditionalInfo ? 'Başvuruyu güncelle' : 'Başvuru bilgileri'}</h3>
                <p className="mt-1 text-sm text-muted">Doğru, güncel ve doğrulanabilir bilgiler paylaşın.</p>
              </div>
              <label className="block text-sm font-semibold text-text">Hesap türü
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-border bg-secondary px-4 font-normal outline-none focus:border-primary">
                  {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-text">Başvuru açıklaması
                <textarea required minLength={40} maxLength={1000} rows={5} value={form.statement} onChange={(event) => setForm((current) => ({ ...current, statement: event.target.value }))} className="mt-2 w-full resize-y rounded-xl border border-border bg-secondary px-4 py-3 font-normal outline-none focus:border-primary" placeholder="Profilinizi ve hesabın gerçekliğinin nasıl doğrulanabileceğini en az 40 karakterle açıklayın." />
                <span className="mt-1 block text-right text-xs font-normal text-muted">{form.statement.length}/1000</span>
              </label>
              <label className="block text-sm font-semibold text-text">Web sitesi ve sosyal medya bağlantıları
                <textarea rows={4} value={form.evidenceLinks} onChange={(event) => setForm((current) => ({ ...current, evidenceLinks: event.target.value }))} className="mt-2 w-full resize-y rounded-xl border border-border bg-secondary px-4 py-3 font-normal outline-none focus:border-primary" placeholder={'Her satıra bir HTTPS bağlantısı\nhttps://...'} />
                <span className="mt-1 block text-xs font-normal text-muted">En fazla 5 HTTPS bağlantısı ekleyebilirsiniz.</span>
              </label>
              {!isAdditionalInfo ? (
                <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4 text-sm text-text">
                  <input required type="checkbox" checked={form.termsAccepted} onChange={(event) => setForm((current) => ({ ...current, termsAccepted: event.target.checked }))} className="mt-1 size-4" />
                  <span>Bilgilerin doğru olduğunu ve başvurunun ücretsiz fakat onayın garanti olmadığını kabul ediyorum.</span>
                </label>
              ) : null}
              {feedback.message ? <div className={`rounded-xl border p-3 text-sm ${feedback.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{feedback.message}</div> : null}
              <button type="submit" disabled={submitting || form.statement.trim().length < 40 || (!isAdditionalInfo && !form.termsAccepted)} className="w-full rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? 'Gönderiliyor...' : isAdditionalInfo ? 'Ek bilgileri gönder' : 'Ücretsiz başvuruyu gönder'}
              </button>
            </form>
          ) : feedback.message ? (
            <div className={`mt-5 rounded-xl border p-3 text-sm ${feedback.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{feedback.message}</div>
          ) : null}

          {!state.loading && !canShowForm && !currentCopy && !state.error ? (
            <div className="py-8 text-center text-sm text-muted">Şu anda yeni başvuru oluşturulamıyor.</div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
