import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAvatarByKey } from '../../services/anonymousService.js'

export function RoomJoinApprovalModal({
  isOpen,
  onClose,
  room,
  onApprove,
  onReject,
}) {
  const { t } = useTranslation()
  const [processingId, setProcessingId] = useState(null)

  if (!isOpen || !room) return null

  const pendingRequests = Array.isArray(room.pendingRequests) ? room.pendingRequests : []

  async function handleAction(actionFn, requesterAnonymousId) {
    if (!actionFn || processingId) return
    setProcessingId(requesterAnonymousId)
    try {
      await actionFn(requesterAnonymousId)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card p-5 text-text shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">🔒</span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-text truncate">
                {room.name}
              </h3>
              <p className="text-[11px] text-muted">
                {t('lounge.approval.subtitle', {
                  count: pendingRequests.length,
                  defaultValue: `${pendingRequests.length} kişi odaya katılım onayı bekliyor`,
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Kapat' })}
            className="rounded-full p-1.5 text-muted hover:bg-secondary hover:text-text shrink-0"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List of pending requests */}
        <div className="my-4 max-h-80 overflow-y-auto space-y-2.5 pr-1">
          {pendingRequests.length === 0 ? (
            <div className="py-8 text-center text-muted text-xs">
              <span className="text-3xl mb-2 inline-block">✨</span>
              <p>{t('lounge.approval.empty', { defaultValue: 'Bekleyen katılım isteği bulunmuyor.' })}</p>
            </div>
          ) : (
            pendingRequests.map((req) => {
              const avatar = getAvatarByKey(req.avatarKey)
              const isProcessing = processingId === req.anonymousId

              return (
                <div
                  key={req.anonymousId}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/40 hover:bg-secondary/70 transition-all gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="size-9 rounded-md flex items-center justify-center text-base shadow-sm shrink-0"
                      style={{ background: avatar.bgStyle }}
                    >
                      {avatar.emoji}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-text truncate block">
                        {req.alias}
                      </span>
                      <span className="text-[10px] text-muted block">
                        {req.requestedAt
                          ? new Date(req.requestedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAction(onApprove, req.anonymousId)}
                      className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] flex items-center gap-1 disabled:opacity-40 shadow-xs transition-all"
                      title={t('lounge.approval.approve', { defaultValue: 'Onayla' })}
                    >
                      <span>✓</span>
                      <span>{t('lounge.approval.approve', { defaultValue: 'Onayla' })}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAction(onReject, req.anonymousId)}
                      className="px-2.5 py-1.5 rounded-md bg-secondary hover:bg-red-500/10 hover:text-red-500 border border-border text-muted font-bold text-[11px] flex items-center gap-1 disabled:opacity-40 transition-all"
                      title={t('lounge.approval.reject', { defaultValue: 'Reddet' })}
                    >
                      <span>✕</span>
                      <span>{t('lounge.approval.reject', { defaultValue: 'Reddet' })}</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border bg-secondary/80 text-xs font-semibold text-text hover:bg-secondary"
          >
            {t('common.close', { defaultValue: 'Kapat' })}
          </button>
        </div>
      </div>
    </div>
  )
}
