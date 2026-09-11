import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getAvatarByKey, kickRoomMember, banRoomMember } from '../../services/anonymousService.js'

export function AnonymousRoomMembersModal({
  isOpen,
  onClose,
  room,
  currentUser,
  currentAnonProfile,
  socket,
  onMemberKicked,
  onMemberBanned,
}) {
  const { t } = useTranslation()
  const [members, setMembers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionProcessingId, setActionProcessingId] = useState(null)
  const [confirmBanUser, setConfirmBanUser] = useState(null)

  const isHost = Boolean(
    room &&
      (room.createdBy === (currentUser?.id || currentUser?._id) ||
        room.creatorAlias === currentAnonProfile?.alias ||
        currentUser?.role === 'admin'),
  )

  useEffect(() => {
    if (!isOpen || !room) return

    let isMounted = true
    setIsLoading(true)

    function loadMembers() {
      if (socket?.connected) {
        socket.emit('anon:get_room_members', { roomId: room.id }, (res) => {
          if (!isMounted) return
          setIsLoading(false)
          if (res?.success && Array.isArray(res.members)) {
            setMembers(res.members)
          }
        })
      } else {
        setIsLoading(false)
      }
    }

    loadMembers()

    function handleMemberRemoved({ roomId, targetAnonymousId }) {
      if (roomId === room.id) {
        setMembers((prev) => prev.filter((m) => m.anonymousId !== targetAnonymousId))
      }
    }

    if (socket) {
      socket.on('anon:member_removed', handleMemberRemoved)
    }

    return () => {
      isMounted = false
      if (socket) {
        socket.off('anon:member_removed', handleMemberRemoved)
      }
    }
  }, [isOpen, room, socket])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (confirmBanUser) {
          setConfirmBanUser(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, confirmBanUser, onClose])

  if (!isOpen || !room) return null

  async function handleKick(targetAnonymousId) {
    if (actionProcessingId) return
    setActionProcessingId(targetAnonymousId)
    try {
      if (socket?.connected) {
        socket.emit('anon:kick_room_member', {
          roomId: room.id,
          targetAnonymousId,
        }, (res) => {
          if (res?.success) {
            setMembers((prev) => prev.filter((m) => m.anonymousId !== targetAnonymousId))
            if (onMemberKicked) onMemberKicked(targetAnonymousId)
          }
        })
      } else {
        await kickRoomMember(room.id, targetAnonymousId)
        setMembers((prev) => prev.filter((m) => m.anonymousId !== targetAnonymousId))
        if (onMemberKicked) onMemberKicked(targetAnonymousId)
      }
    } catch (err) {
      console.error('Kick member error:', err)
    } finally {
      setActionProcessingId(null)
    }
  }

  async function handleBan(targetAnonymousId) {
    if (actionProcessingId) return
    setActionProcessingId(targetAnonymousId)
    try {
      if (socket?.connected) {
        socket.emit('anon:ban_room_member', {
          roomId: room.id,
          targetAnonymousId,
        }, (res) => {
          if (res?.success) {
            setMembers((prev) => prev.filter((m) => m.anonymousId !== targetAnonymousId))
            if (onMemberBanned) onMemberBanned(targetAnonymousId)
          }
        })
      } else {
        await banRoomMember(room.id, targetAnonymousId)
        setMembers((prev) => prev.filter((m) => m.anonymousId !== targetAnonymousId))
        if (onMemberBanned) onMemberBanned(targetAnonymousId)
      }
    } catch (err) {
      console.error('Ban member error:', err)
    } finally {
      setActionProcessingId(null)
      setConfirmBanUser(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card p-5 text-text shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">👥</span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-text truncate">
                {t('lounge.roomMembers.title', { defaultValue: 'Oda Üyeleri' })}
              </h3>
              <p className="text-[11px] text-muted truncate">
                {room.name} • {members.length || room.activeCount || 1} {t('lounge.roomMembers.countLabel', { defaultValue: 'kişi odada' })}
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

        {/* Member List */}
        <div className="my-4 max-h-80 overflow-y-auto space-y-2.5 pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-muted text-xs">
              <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
              <p>{t('common.loading', { defaultValue: 'Yükleniyor...' })}</p>
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-muted text-xs">
              <span className="text-3xl mb-2 inline-block">💬</span>
              <p>{t('lounge.roomMembers.empty', { defaultValue: 'Odada başka aktif üye bulunmuyor.' })}</p>
            </div>
          ) : (
            members.map((member) => {
              const avatar = getAvatarByKey(member.avatarKey)
              const isMe = member.anonymousId === currentAnonProfile?.anonymousId
              const isMemberHost = member.isHost
              const isProcessing = actionProcessingId === member.anonymousId

              const genderLabel =
                member.gender === 'female'
                  ? t('lounge.profileModal.femaleGender', { defaultValue: 'Kadın' })
                  : member.gender === 'male'
                    ? t('lounge.profileModal.maleGender', { defaultValue: 'Erkek' })
                    : null

              const ageLabel =
                member.ageRange && member.ageRange !== 'unspecified'
                  ? member.ageRange
                  : null

              return (
                <div
                  key={member.anonymousId}
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-text truncate">
                          {member.alias}
                        </span>
                        {isMe && (
                          <span className="text-[9px] font-semibold bg-secondary px-1.5 py-0.2 rounded border border-border text-muted shrink-0">
                            {t('common.you', { defaultValue: 'Sen' })}
                          </span>
                        )}
                        {isMemberHost && (
                          <span className="text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded shrink-0">
                            👑 {t('lounge.roomMembers.hostBadge', { defaultValue: 'Yönetici' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-muted truncate">
                        {genderLabel && <span>{genderLabel}</span>}
                        {genderLabel && ageLabel && <span>•</span>}
                        {ageLabel && <span>{ageLabel}</span>}
                        {!genderLabel && !ageLabel && member.status && (
                          <span className="truncate">{member.status}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Host Action Buttons (Only visible to Host and not on host themselves) */}
                  {isHost && !isMemberHost && !isMe && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleKick(member.anonymousId)}
                        className="px-2 py-1 rounded-md bg-secondary hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 border border-border text-muted font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition-all disabled:opacity-40"
                        title={t('lounge.roomMembers.kickBtn', { defaultValue: 'Odadan Çıkar' })}
                      >
                        <span>🚪</span>
                        <span>{t('lounge.roomMembers.kickBtn', { defaultValue: 'Odadan Çıkar' })}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setConfirmBanUser(member)}
                        className="px-2 py-1 rounded-md bg-secondary hover:bg-red-500/10 hover:text-red-500 border border-border text-muted font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition-all disabled:opacity-40"
                        title={t('lounge.roomMembers.banBtn', { defaultValue: 'Girişini Engelle' })}
                      >
                        <span>🚫</span>
                        <span>{t('lounge.roomMembers.banBtn', { defaultValue: 'Girişini Engelle' })}</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Confirmation Dialog for Banning */}
        {confirmBanUser && (
          <div className="p-3.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs mb-3 animate-in fade-in duration-100">
            <p className="font-bold text-red-500">
              {t('lounge.roomMembers.confirmBanTitle', { defaultValue: 'Odaya Girişini Engelle' })}
            </p>
            <p className="mt-1 text-[11px] text-text">
              <strong>{confirmBanUser.alias}</strong> {t('lounge.roomMembers.confirmBanDesc', { defaultValue: 'kullanıcısının bu odaya tekrar girmesini engellemek istediğinize emin misiniz?' })}
            </p>
            <div className="mt-2.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBanUser(null)}
                className="px-2.5 py-1 rounded border border-border bg-secondary text-text text-[11px]"
              >
                {t('common.cancel', { defaultValue: 'İptal' })}
              </button>
              <button
                type="button"
                onClick={() => handleBan(confirmBanUser.anonymousId)}
                className="px-2.5 py-1 rounded bg-red-600 text-white font-bold text-[11px] hover:bg-red-700"
              >
                {t('lounge.roomMembers.banBtn', { defaultValue: 'Girişini Engelle' })}
              </button>
            </div>
          </div>
        )}

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
