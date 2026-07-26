import { useEffect, useMemo, useState } from 'react'
import {
  getAdminSignupContractsSettings,
  updateAdminSignupContractsSettings,
} from '../services/adminService.js'

const languageOptions = [
  { code: 'tr', label: 'Turkce' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Espanol' },
]

const contractKinds = [
  { key: 'terms', label: 'Kosullari' },
  { key: 'cookies', label: 'Cerez Politikasi' },
  { key: 'privacy', label: 'Gizlilik Ilkesi' },
]

function createEmptyContractLanguage() {
  return {
    terms: { title: '', body: '' },
    cookies: { title: '', body: '' },
    privacy: { title: '', body: '' },
  }
}

function normalizeContracts(contracts = {}) {
  const nextContracts = {}
  const knownLanguages = new Set(languageOptions.map((item) => item.code))

  Object.entries(contracts || {}).forEach(([language, value]) => {
    const languageValue = value && typeof value === 'object' ? value : {}
    knownLanguages.add(language)
    nextContracts[language] = {
      terms: {
        title: String(languageValue.terms?.title || ''),
        body: String(languageValue.terms?.body || ''),
      },
      cookies: {
        title: String(languageValue.cookies?.title || ''),
        body: String(languageValue.cookies?.body || ''),
      },
      privacy: {
        title: String(languageValue.privacy?.title || ''),
        body: String(languageValue.privacy?.body || ''),
      },
    }
  })

  knownLanguages.forEach((language) => {
    if (!nextContracts[language]) {
      nextContracts[language] = createEmptyContractLanguage()
    }
  })

  return nextContracts
}

function AdminContractsSettingsPage() {
  const [state, setState] = useState({
    contracts: {},
    activeLanguage: 'tr',
    isLoading: true,
    isSaving: false,
    error: '',
    message: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: '',
      }))

      try {
        const payload = await getAdminSignupContractsSettings()

        if (cancelled) {
          return
        }

        const contracts = normalizeContracts(payload.contracts || {})
        const languageKeys = Object.keys(contracts)
        const activeLanguage = languageKeys[0] || 'tr'

        setState((current) => ({
          ...current,
          contracts,
          activeLanguage,
          isLoading: false,
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
          error: error.message || 'Sozlesme ayarlari yuklenemedi.',
        }))
      }
    }

    loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  const availableLanguages = useMemo(() => {
    const languageMap = new Map(languageOptions.map((item) => [item.code, item.label]))
    const keys = Object.keys(state.contracts)

    return keys.map((code) => ({
      code,
      label: languageMap.get(code) || code.toUpperCase(),
    }))
  }, [state.contracts])

  const activeContracts = state.contracts[state.activeLanguage] || createEmptyContractLanguage()

  function updateContractField(kindKey, fieldKey, value) {
    setState((current) => ({
      ...current,
      message: '',
      error: '',
      contracts: {
        ...current.contracts,
        [current.activeLanguage]: {
          ...(current.contracts[current.activeLanguage] || createEmptyContractLanguage()),
          [kindKey]: {
            ...((current.contracts[current.activeLanguage] || createEmptyContractLanguage())[kindKey] || {
              title: '',
              body: '',
            }),
            [fieldKey]: value,
          },
        },
      },
    }))
  }

  async function handleSave() {
    let missingLanguage = ''

    Object.entries(state.contracts).some(([language, languageContracts]) =>
      contractKinds.some((kind) => {
        const section = languageContracts[kind.key]
        const hasMissingValue = !String(section?.title || '').trim() || !String(section?.body || '').trim()

        if (hasMissingValue) {
          missingLanguage = language
        }

        return hasMissingValue
      }),
    )

    if (missingLanguage) {
      setState((current) => ({
        ...current,
        activeLanguage: missingLanguage,
        error: `${missingLanguage.toUpperCase()} dilindeki tum baslik ve metin alanlarini doldurman gerekiyor.`,
        message: '',
      }))
      return
    }

    setState((current) => ({
      ...current,
      isSaving: true,
      error: '',
      message: '',
    }))

    try {
      const payload = await updateAdminSignupContractsSettings(state.contracts)
      const contracts = normalizeContracts(payload.contracts || {})

      setState((current) => ({
        ...current,
        contracts,
        isSaving: false,
        error: '',
        message: payload.message || 'Sozlesmeler guncellendi.',
      }))
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: error.message || 'Sozlesmeler kaydedilemedi.',
        message: '',
      }))
    }
  }

  if (state.isLoading) {
    return (
      <section className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
        Sozlesme ayarlari yukleniyor...
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-950">Uyelik Sozlesmeleri</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Kayit adimi popup metinlerini dil bazli olarak buradan yonetebilirsin.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableLanguages.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() =>
                setState((current) => ({
                  ...current,
                  activeLanguage: language.code,
                  error: '',
                  message: '',
                }))
              }
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                state.activeLanguage === language.code
                  ? 'bg-zinc-950 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {language.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {contractKinds.map((kind) => {
          const section = activeContracts[kind.key] || { title: '', body: '' }

          return (
            <article key={kind.key} className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-zinc-950">{kind.label}</h3>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Baslik</span>
                <input
                  value={section.title}
                  onChange={(event) => updateContractField(kind.key, 'title', event.target.value)}
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Metin</span>
                <textarea
                  value={section.body}
                  onChange={(event) => updateContractField(kind.key, 'body', event.target.value)}
                  rows={6}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
                />
              </label>
            </article>
          )
        })}
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-500">
            Aktif dil: <span className="font-semibold text-zinc-900">{state.activeLanguage.toUpperCase()}</span>
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={state.isSaving}
            className="h-11 min-w-[140px] rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {state.isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
        {state.error ? <p className="mt-3 text-sm text-rose-600">{state.error}</p> : null}
        {state.message ? <p className="mt-3 text-sm text-emerald-600">{state.message}</p> : null}
      </section>
    </div>
  )
}

export default AdminContractsSettingsPage
