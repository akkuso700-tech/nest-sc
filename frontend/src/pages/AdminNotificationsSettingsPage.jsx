import { useEffect, useMemo, useState } from 'react'
import {
  getAdminSignupNotificationSettings,
  updateAdminSignupNotificationSettings,
} from '../services/adminService.js'

function AdminNotificationsSettingsPage() {
  const [state, setState] = useState({
    emails: [],
    draftEmail: '',
    isLoading: true,
    isSaving: false,
    message: '',
    error: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadNotificationEmails() {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: '',
        message: '',
      }))

      try {
        const payload = await getAdminSignupNotificationSettings()

        if (cancelled) {
          return
        }

        setState((current) => ({
          ...current,
          emails: payload.emails || [],
          isLoading: false,
          isSaving: false,
          error: '',
          message: '',
        }))
      } catch (error) {
        if (cancelled) {
          return
        }

        setState((current) => ({
          ...current,
          isLoading: false,
          error: error.message || 'Bildirim e-posta listesi yuklenemedi.',
          message: '',
        }))
      }
    }

    loadNotificationEmails()

    return () => {
      cancelled = true
    }
  }, [])

  const normalizedEmails = useMemo(
    () => state.emails.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean),
    [state.emails],
  )

  function setDraftEmail(value) {
    setState((current) => ({
      ...current,
      draftEmail: value,
      error: '',
      message: '',
    }))
  }

  function addEmail() {
    const candidate = state.draftEmail.trim().toLowerCase()

    if (!candidate) {
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      setState((current) => ({
        ...current,
        error: `Gecersiz e-posta: ${candidate}`,
        message: '',
      }))
      return
    }

    if (normalizedEmails.includes(candidate)) {
      setState((current) => ({
        ...current,
        draftEmail: '',
        message: '',
        error: '',
      }))
      return
    }

    setState((current) => ({
      ...current,
      emails: [...current.emails, candidate],
      draftEmail: '',
      error: '',
      message: '',
    }))
  }

  function removeEmail(emailToRemove) {
    setState((current) => ({
      ...current,
      emails: current.emails.filter((email) => email !== emailToRemove),
      error: '',
      message: '',
    }))
  }

  async function saveEmails() {
    setState((current) => ({
      ...current,
      isSaving: true,
      error: '',
      message: '',
    }))

    try {
      const payload = await updateAdminSignupNotificationSettings(normalizedEmails)
      setState((current) => ({
        ...current,
        emails: payload.emails || [],
        isSaving: false,
        error: '',
        message: payload.message || 'Bildirim e-posta listesi guncellendi.',
      }))
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: error.message || 'Bildirim e-posta listesi guncellenemedi.',
        message: '',
      }))
    }
  }

  return (
    <section className="rounded-lg bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_48%,#312e81_100%)] border border-white/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <h2 className="text-lg font-semibold text-white">Yeni Üyelik Bildirim E-postaları</h2>
     

      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <input
          value={state.draftEmail}
          onChange={(event) => setDraftEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addEmail()
            }
          }}
          disabled={state.isLoading || state.isSaving}
          placeholder="ornek@nest-sc.com"
          className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-4 pr-4 text-sm text-white/70 outline-none transition placeholder:text-slate-400 focus:border-white/20 focus:bg-white/10"
        />
        <button
          type="button"
          onClick={addEmail}
          disabled={state.isLoading || state.isSaving}
          className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 cursor-pointer transition hover:border-white/20 hover:text-white"
        >
          Ekle
        </button>
        <button
          type="button"
          onClick={saveEmails}
          disabled={state.isLoading || state.isSaving}
          className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 cursor-pointer transition hover:border-white/20 hover:text-white"
        >
          {state.isSaving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>

      <div className="mt-5 ">
        <h3 className="text-sm font-semibold text-white">Kayıtlı E-posta Adresleri</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.isLoading ? (
            <span className="text-sm text-zinc-500">Yukleniyor...</span>
          ) : normalizedEmails.length ? (
            normalizedEmails.map((email) => (
              <div
                key={email}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white"
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  disabled={state.isSaving}
                  className="rounded-lg border cursor-pointer border-rose-400 px-2 py-0.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Sil
                </button>
              </div>
            ))
          ) : (
            <span className="text-sm text-zinc-500">Kayitli e-posta yok.</span>
          )}
        </div>
      </div>

      {state.error ? <p className="mt-3 text-sm text-rose-600">{state.error}</p> : null}
      {state.message ? <p className="mt-3 text-sm text-emerald-600">{state.message}</p> : null}
    </section>
  )
}

export default AdminNotificationsSettingsPage
