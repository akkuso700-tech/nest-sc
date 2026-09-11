import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createAnonymousRoom } from '../../services/anonymousService.js'

const ROOM_ICONS = ['💬', '☕', '🔥', '🎮', '🎧', '🌙', '🍿', '💡', '✨', '🚀']
const ROOM_COLORS = [
  { key: 'purple', label: 'Mor', hex: '#9333ea' },
  { key: 'cyan', label: 'Mavi', hex: '#06b6d4' },
  { key: 'emerald', label: 'Yeşil', hex: '#10b981' },
  { key: 'rose', label: 'Pembe', hex: '#f43f5e' },
  { key: 'amber', label: 'Turuncu', hex: '#f59e0b' },
]

export function AnonymousRoomCreateModal({ isOpen, onClose, onRoomCreated }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [icon, setIcon] = useState('💬')
  const [color, setColor] = useState('purple')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const newRoom = await createAnonymousRoom({
        name,
        topic,
        icon,
        color,
        isPrivate,
      })
      if (onRoomCreated) onRoomCreated(newRoom)
      onClose()
    } catch (err) {
      setErrorMsg(err.message || t('common.error', { defaultValue: 'Oda oluşturulamadı.' }))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-md border border-border bg-card p-6 text-text shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚪</span>
            <h3 className="text-base sm:text-lg font-bold">
              {t('lounge.roomModal.title', { defaultValue: 'Yeni Anonim Oda Aç' })}
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
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              {t('lounge.roomModal.nameLabel', { defaultValue: 'Oda Başlığı' })}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              required
              placeholder={t('lounge.roomModal.namePlaceholder', { defaultValue: 'Örn: Hafta Sonu Oyun Sohbeti' })}
              className="w-full rounded-md border border-border bg-secondary px-3.5 py-2.5 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              {t('lounge.roomModal.topicLabel', { defaultValue: 'Konu / Açıklama (Opsiyonel)' })}
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={120}
              placeholder={t('lounge.roomModal.topicPlaceholder', { defaultValue: 'Örn: Steam, RPG oyunları ve öneriler' })}
              className="w-full rounded-md border border-border bg-secondary px-3.5 py-2.5 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              {t('lounge.roomModal.iconLabel', { defaultValue: 'Oda Simgesi' })}
            </label>
            <div className="flex flex-wrap gap-2">
              {ROOM_ICONS.map((emojiIcon) => (
                <button
                  key={emojiIcon}
                  type="button"
                  onClick={() => setIcon(emojiIcon)}
                  className={`size-9 rounded-md flex items-center justify-center text-lg transition-all ${
                    icon === emojiIcon
                      ? 'bg-primary text-white ring-2 ring-primary scale-110'
                      : 'bg-secondary hover:bg-secondary-hover'
                  }`}
                >
                  {emojiIcon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              {t('lounge.roomModal.colorLabel', { defaultValue: 'Tema Rengi' })}
            </label>
            <div className="flex gap-2.5">
              {ROOM_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setColor(c.key)}
                  style={{ backgroundColor: c.hex }}
                  className={`size-7 rounded-full transition-all ${
                    color === c.key ? 'ring-4 ring-primary scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={t('lounge.roomModal.color_' + c.key, { defaultValue: c.label })}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">
              {t('lounge.roomModal.privacyLabel', { defaultValue: 'Oda Gizliliği' })}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`flex items-center gap-2 rounded-md border p-2.5 text-left transition-all ${
                  !isPrivate
                    ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                    : 'border-border bg-secondary text-muted hover:text-text'
                }`}
              >
                <span className="text-base">🌐</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight">
                    {t('lounge.roomModal.publicTitle', { defaultValue: 'Herkese Açık' })}
                  </div>
                  <div className="text-[10px] text-muted truncate">
                    {t('lounge.roomModal.publicSub', { defaultValue: 'Tüm gölge kullanıcıları' })}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`flex items-center gap-2 rounded-md border p-2.5 text-left transition-all ${
                  isPrivate
                    ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                    : 'border-border bg-secondary text-muted hover:text-text'
                }`}
              >
                <span className="text-base">🔒</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight">
                    {t('lounge.roomModal.privateTitle', { defaultValue: 'Gizli Oda' })}
                  </div>
                  <div className="text-[10px] text-muted truncate">
                    {t('lounge.roomModal.privateSub', { defaultValue: 'Sadece kod/link ile' })}
                  </div>
                </div>
              </button>
            </div>
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
              disabled={isSubmitting}
              className="rounded-md bg-primary px-5 py-2 text-xs font-semibold !text-white shadow-md hover:bg-primary-hover disabled:opacity-50"
            >
              {isSubmitting
                ? '...'
                : t('lounge.roomModal.createBtn', { defaultValue: 'Oda Oluştur' })}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
