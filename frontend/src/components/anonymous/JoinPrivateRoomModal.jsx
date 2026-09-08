import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { joinPrivateAnonymousRoom } from '../../services/anonymousService.js'

export function JoinPrivateRoomModal({ isOpen, onClose, onRoomJoined }) {
  const { t } = useTranslation()
  const [accessCode, setAccessCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    const clean = accessCode.trim().toUpperCase()
    if (!clean) return

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const room = await joinPrivateAnonymousRoom(clean)
      if (onRoomJoined) onRoomJoined(room)
      onClose()
    } catch (err) {
      setErrorMsg(
        err.message ||
          t('lounge.joinPrivate.error', {
            defaultValue: 'Gizli odaya katılınamadı. Kodu kontrol edin.',
          }),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-6 text-text shadow-2xl">
        <div className="flex items-center justify-between pb-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔑</span>
            <h3 className="text-base font-bold text-text">
              {t('lounge.joinPrivate.title', { defaultValue: 'Gizli Odaya Katıl' })}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Kapat' })}
            className="rounded-full p-1.5 text-muted hover:bg-secondary hover:text-text"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3.5 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-500">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              {t('lounge.joinPrivate.codeLabel', { defaultValue: '6 Haneli Oda Kodu' })}
            </label>
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              maxLength={12}
              autoFocus
              placeholder="Örn: K7X9P2"
              className="w-full text-center tracking-widest font-mono text-base font-bold rounded-md border border-border bg-secondary px-3.5 py-2.5 text-text placeholder:text-muted placeholder:font-normal focus:border-primary focus:outline-none"
            />
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              {t('lounge.joinPrivate.hint', {
                defaultValue: 'Oda kurucusundan aldığınız katılım kodunu girerek odaya erişebilirsiniz.',
              })}
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-secondary px-4 py-2 text-xs text-text hover:bg-secondary-hover"
            >
              {t('common.cancel', { defaultValue: 'İptal' })}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !accessCode.trim()}
              className="rounded-md bg-primary px-5 py-2 text-xs font-semibold !text-white shadow-md hover:bg-primary-hover disabled:opacity-50"
            >
              {isSubmitting
                ? '...'
                : t('lounge.joinPrivate.joinBtn', { defaultValue: 'Odaya Gir' })}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
