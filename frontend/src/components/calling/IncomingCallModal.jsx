import { useTranslation } from 'react-i18next'
import UserAvatar from '../common/UserAvatar.jsx'
import VerifiedBadge from '../common/VerifiedBadge.jsx'
import { getFullName } from '../../utils/social.js'

export default function IncomingCallModal({
  incomingCall,
  onAccept,
  onDecline,
}) {
  const { t } = useTranslation()

  if (!incomingCall) return null

  const { callType, caller } = incomingCall
  const isVideo = callType === 'video'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-[28px] border border-border bg-card p-6 shadow-2xl transition-all dark:shadow-black/60">
        {/* Pulsing glow behind avatar */}
        <div className="relative mx-auto mb-4 flex size-28 items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/20 opacity-75 duration-1000" />
          <span className="absolute inline-flex size-24 animate-pulse rounded-full bg-primary/30 duration-700" />
          <UserAvatar
            user={caller}
            className="size-20 shrink-0 shadow-lg ring-4 ring-card"
            textClassName="text-xl font-bold"
          />
        </div>

        {/* Caller Info */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 font-semibold text-lg text-text">
            <span>{getFullName(caller)}</span>
            <VerifiedBadge user={caller} size="xs" />
          </div>
          <p className="text-xs text-muted">@{caller.username}</p>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-1 text-xs font-medium text-primary">
            {isVideo ? (
              <>
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 10 4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4z" />
                  <rect width="14" height="12" x="1" y="6" rx="2" />
                </svg>
                <span>{t('calling.incomingVideo', { defaultValue: 'Gelen Görüntülü Arama' })}</span>
              </>
            ) : (
              <>
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>{t('calling.incomingVoice', { defaultValue: 'Gelen Sesli Arama' })}</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-center gap-8">
          {/* Decline Button */}
          <button
            type="button"
            onClick={onDecline}
            className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
            aria-label={t('calling.decline', { defaultValue: 'Reddet' })}
          >
            <span className="grid size-14 place-items-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/30 transition-transform group-hover:scale-105 active:scale-95">
              <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m18 6-12 12M6 6l12 12" />
              </svg>
            </span>
            <span className="text-xs font-medium text-muted group-hover:text-rose-600">
              {t('calling.decline', { defaultValue: 'Reddet' })}
            </span>
          </button>

          {/* Accept Button */}
          <button
            type="button"
            onClick={onAccept}
            className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
            aria-label={t('calling.accept', { defaultValue: 'Yanıtla' })}
          >
            <span className="grid size-14 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-transform group-hover:scale-105 active:scale-95 animate-pulse">
              {isVideo ? (
                <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 10 4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4z" />
                  <rect width="14" height="12" x="1" y="6" rx="2" />
                </svg>
              ) : (
                <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              )}
            </span>
            <span className="text-xs font-medium text-muted group-hover:text-emerald-600">
              {t('calling.accept', { defaultValue: 'Yanıtla' })}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
