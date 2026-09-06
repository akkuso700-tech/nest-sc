import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ANONYMOUS_AVATARS, updateAnonymousProfile, randomizeAlias } from '../../services/anonymousService.js'

export function AnonymousProfileModal({ isOpen, onClose, currentProfile, onProfileUpdated }) {
  const { t } = useTranslation()
  const [alias, setAlias] = useState(currentProfile?.alias || '')
  const [avatarKey, setAvatarKey] = useState(currentProfile?.avatarKey || 'avatar-1')
  const [gender, setGender] = useState(currentProfile?.gender || 'unspecified')
  const [ageRange, setAgeRange] = useState(currentProfile?.ageRange || 'unspecified')
  const [status, setStatus] = useState(currentProfile?.status || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isRolling, setIsRolling] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [genderPickerOpen, setGenderPickerOpen] = useState(false)
  const [ageRangePickerOpen, setAgeRangePickerOpen] = useState(false)

  // Sync state whenever modal opens or currentProfile updates
  useEffect(() => {
    if (isOpen) {
      if (currentProfile) {
        setAlias(currentProfile.alias || '')
        setAvatarKey(currentProfile.avatarKey || 'avatar-1')
        setGender(currentProfile.gender || 'unspecified')
        setAgeRange(currentProfile.ageRange || 'unspecified')
        setStatus(currentProfile.status || '')
      }
      setErrorMsg('')
      setGenderPickerOpen(false)
      setAgeRangePickerOpen(false)
    }
  }, [isOpen, currentProfile])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (genderPickerOpen) {
          setGenderPickerOpen(false)
        } else if (ageRangePickerOpen) {
          setAgeRangePickerOpen(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, genderPickerOpen, ageRangePickerOpen, onClose])

  const GENDER_OPTIONS = [
    {
      value: 'unspecified',
      label: t('lounge.profileModal.unspecifiedGender', { defaultValue: 'Belirtmek İstemiyorum' }),
      icon: '🔒',
      desc: t('lounge.profileModal.unspecifiedGenderDesc', { defaultValue: 'Cinsiyet bilginiz gizli tutulur' }),
    },
    {
      value: 'female',
      label: t('lounge.profileModal.femaleGender', { defaultValue: 'Kadın' }),
      icon: '👩',
      desc: t('lounge.profileModal.femaleGenderDesc', { defaultValue: 'Radarda ve profilde Kadın olarak görünür' }),
    },
    {
      value: 'male',
      label: t('lounge.profileModal.maleGender', { defaultValue: 'Erkek' }),
      icon: '👨',
      desc: t('lounge.profileModal.maleGenderDesc', { defaultValue: 'Radarda ve profilde Erkek olarak görünür' }),
    },
  ]

  const AGE_RANGE_OPTIONS = [
    {
      value: 'unspecified',
      label: t('lounge.profileModal.unspecifiedAge', { defaultValue: 'Gizli' }),
      icon: '🔒',
      desc: t('lounge.profileModal.unspecifiedAgeDesc', { defaultValue: 'Yaş aralığınız profilinizde gizlenir' }),
    },
    {
      value: '18-24',
      label: t('lounge.profileModal.age1824', { defaultValue: '18 - 24 Yaş' }),
      icon: '🌱',
      desc: t('lounge.profileModal.age1824Desc', { defaultValue: 'Genç yetişkin yaş kategorisi' }),
    },
    {
      value: '25-34',
      label: t('lounge.profileModal.age2534', { defaultValue: '25 - 34 Yaş' }),
      icon: '⚡',
      desc: t('lounge.profileModal.age2534Desc', { defaultValue: 'Dinamik kariyer ve sosyal yaş aralığı' }),
    },
    {
      value: '35-44',
      label: t('lounge.profileModal.age3544', { defaultValue: '35 - 44 Yaş' }),
      icon: '🎯',
      desc: t('lounge.profileModal.age3544Desc', { defaultValue: 'Olgun ve tecrübeli yaş grubu' }),
    },
    {
      value: '45+',
      label: t('lounge.profileModal.age45Plus', { defaultValue: '45+ Yaş' }),
      icon: '🌟',
      desc: t('lounge.profileModal.age45PlusDesc', { defaultValue: 'Hayat tecrübesi yüksek yaş grubu' }),
    },
  ]

  const selectedGenderObj = GENDER_OPTIONS.find((g) => g.value === gender) || GENDER_OPTIONS[0]
  const selectedAgeObj = AGE_RANGE_OPTIONS.find((a) => a.value === ageRange) || AGE_RANGE_OPTIONS[0]

  if (!isOpen) return null

  async function handleRandomize() {
    setIsRolling(true)
    setErrorMsg('')
    try {
      const updated = await randomizeAlias()
      setAlias(updated.alias)
      if (onProfileUpdated) onProfileUpdated(updated)
    } catch (err) {
      setErrorMsg(err.message || t('lounge.profileModal.generateAliasError', { defaultValue: 'Rumuz üretilemedi.' }))
    } finally {
      setIsRolling(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setIsSaving(true)
    setErrorMsg('')
    try {
      const updated = await updateAnonymousProfile({
        alias,
        avatarKey,
        gender,
        ageRange,
        status,
      })
      if (onProfileUpdated) onProfileUpdated(updated)
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Profil kaydedilemedi.')
    } finally {
      setIsSaving(false)
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-md border border-border bg-card p-6 sm:p-7 text-text shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎭</span>
            <div>
              <h3 className="text-lg font-bold text-text">
                {t('lounge.profileModal.title', { defaultValue: 'Anonim Kimliğini Düzenle' })}
              </h3>
              <p className="text-xs text-muted">
                {t('lounge.profileModal.subtitle', {
                  defaultValue: 'Gizli sohbette diğer kullanıcılara böyle görünürsünüz.',
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Kapat' })}
            className="rounded-full p-2 text-muted hover:bg-secondary hover:text-text transition-colors"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              {t('lounge.profileModal.aliasLabel', { defaultValue: 'Anonim Rumuz (Takma Ad)' })}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                maxLength={30}
                required
                className="flex-1 rounded-md border border-border bg-secondary px-3.5 py-2.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
                placeholder={t('lounge.profileModal.aliasPlaceholder', { defaultValue: 'Örn: SessizGezgin#421' })}
              />
              <button
                type="button"
                onClick={handleRandomize}
                disabled={isRolling}
                className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3.5 py-2 text-xs font-medium text-text hover:bg-secondary-hover transition-colors disabled:opacity-50"
                title={t('lounge.profileModal.refresh', { defaultValue: 'Yeni Rumuz Üret' })}
              >
                <span>{isRolling ? '...' : '🎲'}</span>
                <span>{t('lounge.profileModal.refresh', { defaultValue: 'Yenile' })}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-2">
              {t('lounge.profileModal.avatarSelect', { defaultValue: 'Anonim Avatar Seç' })}
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1.5 rounded-md border border-border bg-secondary">
              {ANONYMOUS_AVATARS.map((av) => {
                const isSelected = avatarKey === av.key
                return (
                  <button
                    key={av.key}
                    type="button"
                    onClick={() => setAvatarKey(av.key)}
                    className={`flex flex-col items-center justify-center p-2 rounded-md transition-all ${
                      isSelected
                        ? 'ring-2 ring-primary scale-105 shadow'
                        : 'hover:bg-card opacity-80 hover:opacity-100'
                    }`}
                  >
                    <span
                      className="size-10 rounded-md flex items-center justify-center text-xl shadow-sm"
                      style={{ background: av.bgStyle }}
                    >
                      {av.emoji}
                    </span>
                    <span className="text-[10px] text-muted truncate max-w-full mt-1">
                      {av.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Cinsiyet Pop-up Tetikleyici */}
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                {t('lounge.profileModal.genderLabel', { defaultValue: 'Cinsiyet' })}
              </label>
              <button
                type="button"
                onClick={() => setGenderPickerOpen(true)}
                className="w-full flex items-center justify-between rounded-md border border-border bg-secondary px-3.5 py-2.5 text-xs text-text hover:bg-secondary-hover hover:border-primary/50 transition-all text-left shadow-sm group"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="text-sm">{selectedGenderObj.icon}</span>
                  <span className="font-medium text-text">{selectedGenderObj.label}</span>
                </span>
                <span className="text-muted group-hover:text-primary transition-colors text-[10px]">
                  ▼
                </span>
              </button>
            </div>

            {/* Yaş Aralığı Pop-up Tetikleyici */}
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                {t('lounge.profileModal.ageLabel', { defaultValue: 'Yaş Aralığı' })}
              </label>
              <button
                type="button"
                onClick={() => setAgeRangePickerOpen(true)}
                className="w-full flex items-center justify-between rounded-md border border-border bg-secondary px-3.5 py-2.5 text-xs text-text hover:bg-secondary-hover hover:border-primary/50 transition-all text-left shadow-sm group"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="text-sm">{selectedAgeObj.icon}</span>
                  <span className="font-medium text-text">{selectedAgeObj.label}</span>
                </span>
                <span className="text-muted group-hover:text-primary transition-colors text-[10px]">
                  ▼
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              {t('lounge.profileModal.statusLabel', { defaultValue: 'Ruh Hali / Durum Mesajı' })}
            </label>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              maxLength={80}
              placeholder={t('lounge.profileModal.statusPlaceholder', { defaultValue: 'Örn: Kahve eşliğinde sohbet ☕' })}
              className="w-full rounded-md border border-border bg-secondary px-3.5 py-2.5 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-secondary px-4 py-2.5 text-xs font-medium text-text hover:bg-secondary-hover transition-colors"
            >
              {t('common.cancel', { defaultValue: 'Vazgeç' })}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-primary px-5 py-2.5 text-xs font-semibold !text-white shadow-md hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving
                ? '...'
                : t('lounge.profileModal.saveBtn', { defaultValue: 'Kaydet' })}
            </button>
          </div>
        </form>
      </div>

      {/* Cinsiyet Seçimi Profesyonel Pop-up Modalı */}
      {genderPickerOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGenderPickerOpen(false)
          }}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚧️</span>
                <div>
                  <h4 className="text-sm font-bold text-text">
                    {t('lounge.profileModal.genderPickerTitle', { defaultValue: 'Cinsiyet Seçimi' })}
                  </h4>
                  <p className="text-[11px] text-muted">
                    {t('lounge.profileModal.genderLabel', { defaultValue: 'Cinsiyet' })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGenderPickerOpen(false)}
                aria-label={t('common.close', { defaultValue: 'Kapat' })}
                className="rounded-full p-1.5 text-muted hover:bg-secondary hover:text-text transition-colors"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {GENDER_OPTIONS.map((opt) => {
                const isSelected = gender === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setGender(opt.value)
                      setGenderPickerOpen(false)
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-md border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border bg-secondary/70 text-text hover:bg-secondary hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-8 rounded-md bg-card flex items-center justify-center text-base border border-border shadow-xs">
                        {opt.icon}
                      </span>
                      <div>
                        <p className="text-xs font-bold">{opt.label}</p>
                        <p className="text-[10px] text-muted">{opt.desc}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="size-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setGenderPickerOpen(false)}
                className="w-full rounded-md bg-secondary py-2 text-xs font-semibold text-text hover:bg-secondary-hover transition-colors"
              >
                {t('common.close', { defaultValue: 'Kapat' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yaş Aralığı Seçimi Profesyonel Pop-up Modalı */}
      {ageRangePickerOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAgeRangePickerOpen(false)
          }}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎂</span>
                <div>
                  <h4 className="text-sm font-bold text-text">
                    {t('lounge.profileModal.agePickerTitle', { defaultValue: 'Yaş Aralığı Seçimi' })}
                  </h4>
                  <p className="text-[11px] text-muted">
                    {t('lounge.profileModal.ageLabel', { defaultValue: 'Yaş Aralığı' })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAgeRangePickerOpen(false)}
                aria-label={t('common.close', { defaultValue: 'Kapat' })}
                className="rounded-full p-1.5 text-muted hover:bg-secondary hover:text-text transition-colors"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {AGE_RANGE_OPTIONS.map((opt) => {
                const isSelected = ageRange === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setAgeRange(opt.value)
                      setAgeRangePickerOpen(false)
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-md border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border bg-secondary/70 text-text hover:bg-secondary hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-8 rounded-md bg-card flex items-center justify-center text-base border border-border shadow-xs">
                        {opt.icon}
                      </span>
                      <div>
                        <p className="text-xs font-bold">{opt.label}</p>
                        <p className="text-[10px] text-muted">{opt.desc}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="size-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setAgeRangePickerOpen(false)}
                className="w-full rounded-md bg-secondary py-2 text-xs font-semibold text-text hover:bg-secondary-hover transition-colors"
              >
                {t('common.close', { defaultValue: 'Kapat' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}
