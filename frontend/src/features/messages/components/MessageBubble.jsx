import { useState, useRef, useMemo, useEffect } from 'react'
import AudioMessagePlayer from '../../../components/media/AudioMessagePlayer.jsx'
import { LinkPreviewCard } from '../../../components/media/LinkPreviewCard.jsx'
import MediaGallery from '../../posts/MediaGallery.jsx'
import { formatClockTime, getFullName } from '../../../utils/social.js'
import { resolveMediaUrl } from '../../../utils/media.js'
import {
  CheckIcon,
  CopyIcon,
  MoreIcon,
  PencilIcon,
  ReplyIcon,
  SmileIcon,
  TrashIcon,
} from '../../../pages/MessagesPageIcons.jsx'
import { QUICK_REACTION_EMOJIS, renderFormattedMessageText } from '../utils/messagesHelpers.jsx'

export default function MessageBubble({
  message,
  isMine,
  isMenuOpen,
  isEditing,
  editingText,
  isHighlighted,
  activePeer,
  user,
  onEditChange,
  onEditCancel,
  onEditSave,
  onOpenMenu,
  onCopy,
  onReply,
  onDelete,
  onStartEdit,
  onReport,
  onOpenMedia,
  onScrollToMessage,
  onToggleReaction,
  isMobileViewport = false,
  t,
}) {
  const showSeen = isMine && Boolean(message.readAt)
  const messageId = message._id || message.id
  const [showHeartBurst, setShowHeartBurst] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const menuButtonRef = useRef(null)
  const [openUpwards, setOpenUpwards] = useState(false)

  const replySenderName = useMemo(() => {
    if (!message.replyTo) return ''
    const replySenderId = message.replyTo.sender?._id || message.replyTo.sender
    if (replySenderId && replySenderId?.toString() === user?.id?.toString()) {
      return t('common.you', { defaultValue: 'Siz' })
    }
    return getFullName(activePeer) || t('common.unknownUser')
  }, [message.replyTo, activePeer, user, t])

  const groupedReactions = useMemo(() => {
    const list = Array.isArray(message.reactions) ? message.reactions : []
    const map = {}
    list.forEach((r) => {
      const emoji = r.emoji
      if (!emoji) return
      if (!map[emoji]) {
        map[emoji] = { emoji, count: 0, hasMine: false }
      }
      map[emoji].count += 1
      const reactionUserId = r.user?._id || r.user
      if (reactionUserId && String(reactionUserId) === String(user?.id)) {
        map[emoji].hasMine = true
      }
    })
    return Object.values(map)
  }, [message.reactions, user?.id])

  useEffect(() => {
    if (isMenuOpen && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpwards(spaceBelow < 240 && rect.top > 200)
    }
  }, [isMenuOpen])

  const handleBubbleClick = (event) => {
    if (isMobileViewport) {
      event.stopPropagation()
      setShowReactionPicker((prev) => !prev)
    }
  }

  const handleDoubleClick = (event) => {
    event.stopPropagation()
    setShowHeartBurst(true)
    setTimeout(() => setShowHeartBurst(false), 900)
    onToggleReaction?.(messageId, '❤️')
  }

  const handleSelectEmoji = (emoji) => {
    setShowReactionPicker(false)
    if (emoji === '❤️') {
      setShowHeartBurst(true)
      setTimeout(() => setShowHeartBurst(false), 900)
    }
    onToggleReaction?.(messageId, emoji)
  }

  useEffect(() => {
    if (!showReactionPicker) return

    function handleOutsideClick(event) {
      if (
        !event.target.closest?.('[data-reaction-picker="true"]') &&
        !event.target.closest?.('[data-reaction-btn="true"]')
      ) {
        setShowReactionPicker(false)
      }
    }

    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [showReactionPicker])

  return (
    <div
      id={`msg-${messageId}`}
      className={`group/msg flex transition-all duration-500 rounded-2xl p-1 ${
        isHighlighted ? 'bg-primary/20 ring-2 ring-primary/40' : ''
      } ${isMine ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex max-w-[min(88%,620px)] items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        <div
          onClick={handleBubbleClick}
          onDoubleClick={handleDoubleClick}
          className={`relative select-none rounded-lg px-4 py-3 shadow-sm transition cursor-pointer ${
            isMine
              ? 'bg-primary text-inverse'
              : 'border border-border bg-card text-text'
          } ${groupedReactions.length ? 'mb-2.5' : ''}`}
          title={isMobileViewport ? t('messages.addReaction', { defaultValue: 'Tepki ekle' }) : t('messages.doubleTapToLike', { defaultValue: 'Beğenmek için çift tıkla' })}
        >
          {/* Floating Heart Burst Animation */}
          {showHeartBurst ? (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <span className="animate-ping absolute text-4xl opacity-80 select-none">❤️</span>
              <span className="animate-bounce text-3xl select-none">❤️</span>
            </div>
          ) : null}

          {/* Quick Reaction Emoji Picker Popup */}
          {showReactionPicker ? (
            <div
              data-reaction-picker="true"
              onClick={(e) => e.stopPropagation()}
              className={`absolute z-40 flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-xl backdrop-blur-md transition-all -top-12 animate-in fade-in zoom-in-95 duration-150 max-w-[calc(100vw-40px)] ${
                isMine ? 'right-0' : 'left-0'
              }`}
            >
              {QUICK_REACTION_EMOJIS.map((emoji) => {
                const isSelected = groupedReactions.some((g) => g.emoji === emoji && g.hasMine)
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectEmoji(emoji)}
                    className={`grid size-8 place-items-center rounded-full text-base transition-transform hover:scale-130 active:scale-95 cursor-pointer ${
                      isSelected ? 'bg-primary/20 scale-110' : 'hover:bg-secondary'
                    }`}
                  >
                    <span>{emoji}</span>
                  </button>
                )
              })}
            </div>
          ) : null}

          {message.replyTo ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onScrollToMessage(message.replyTo.id || message.replyTo._id)
              }}
              className={`mb-2.5 block w-full rounded-md border-l-3 border-primary px-2.5 py-1.5 text-left transition ${
                isMine
                  ? 'bg-black/15 text-inverse/90 hover:bg-black/25'
                  : 'bg-secondary/80 text-text/90 hover:bg-secondary'
              }`}
            >
              <p className="text-[11px] font-semibold opacity-90">{replySenderName}</p>
              <p className="truncate text-xs opacity-80">
                {message.replyTo.text || (message.replyTo.media?.length ? `[${t('messages.mediaPreview')}]` : '')}
              </p>
            </button>
          ) : null}

          {isEditing ? (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <textarea
                rows={2}
                value={editingText}
                onChange={(event) => onEditChange(event.target.value)}
                className="min-h-[76px] w-full resize-none rounded-2xl border border-border bg-secondary px-3 py-2 text-sm leading-6 text-text outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onEditCancel}
                  className="rounded-full px-3 py-1.5 text-xs font-medium opacity-80 transition hover:opacity-100"
                >
                  {t('common.cancel', { defaultValue: t('profile.photoActions.cancel') })}
                </button>
                <button
                  type="button"
                  onClick={onEditSave}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    isMine
                      ? 'bg-card text-text'
                      : 'bg-primary text-inverse'
                  }`}
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : message.text ? (
            <p className="text-base leading-6">{renderFormattedMessageText(message.text, isMine)}</p>
          ) : null}

          {message.linkPreview ? (
            <LinkPreviewCard preview={message.linkPreview} isMine={isMine} />
          ) : null}

          {(message.media || []).some((item) => item.type === 'audio' || /\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(item?.url || ''))) ? (
            <div className="py-1" onClick={(e) => e.stopPropagation()}>
              {(message.media || [])
                .filter((item) => item.type === 'audio' || /\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(item?.url || '')))
                .map((audioItem, idx) => (
                  <AudioMessagePlayer
                    key={audioItem.url || idx}
                    src={audioItem.url}
                    duration={audioItem.durationSeconds || 0}
                    isMine={isMine}
                  />
                ))}
            </div>
          ) : null}

          {(message.media || []).filter((item) => item.type !== 'audio' && !/\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(item?.url || ''))).length ? (
            <div onClick={(e) => e.stopPropagation()}>
              <MediaGallery
                items={(message.media || []).filter((item) => item.type !== 'audio' && !/\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(item?.url || '')))}
                className={`max-w-[200px] sm:max-w-[236px] ${
                  message.text || (message.media || []).some((item) => item.type === 'audio' || /\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(item?.url || '')))
                    ? 'mt-3'
                    : 'mt-0'
                }`}
                interactive
                onItemClick={(_, index) =>
                  onOpenMedia(
                    (message.media || []).filter((item) => item.type !== 'audio' && !/\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(item?.url || ''))),
                    index,
                  )
                }
              />
            </div>
          ) : null}

          <div
            className={`mt-2 flex items-center justify-end gap-2 text-[11px] ${
              isMine ? 'text-[rgb(var(--color-text-inverse)/0.7)]' : 'text-soft'
            }`}
          >
            <span>{formatClockTime(message.createdAt)}</span>
            {isMine ? (
              <span className="inline-flex items-center gap-1">
                <CheckIcon double={showSeen} />
                <span>{showSeen ? t('messages.seen') : t('messages.sent')}</span>
              </span>
            ) : null}
          </div>

          {/* Reaction Badges */}
          {groupedReactions.length > 0 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute -bottom-3 flex flex-wrap items-center gap-1 z-10 ${
                isMine ? 'right-2' : 'left-2'
              }`}
            >
              {groupedReactions.map((g) => (
                <button
                  key={g.emoji}
                  type="button"
                  onClick={() => onToggleReaction?.(messageId, g.emoji)}
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer ${
                    g.hasMine
                      ? 'border-primary/40 bg-card text-text ring-1 ring-primary/30'
                      : 'border-border bg-card/95 text-text backdrop-blur-xs hover:bg-secondary'
                  }`}
                  title={g.hasMine ? t('messages.reactions') : t('messages.addReaction')}
                >
                  <span className="text-xs leading-none">{g.emoji}</span>
                  {g.count > 1 ? (
                    <span className="text-[10px] font-bold leading-none opacity-80">{g.count}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Action buttons (Smile reaction button & 3-dots menu) */}
        <div className="relative flex items-center shrink-0" data-message-menu-shell="true">
          <button
            type="button"
            data-reaction-btn="true"
            onClick={() => setShowReactionPicker((curr) => !curr)}
            className="grid size-8 place-items-center rounded-full text-muted transition opacity-0 group-hover/msg:opacity-100 hover:bg-secondary hover:text-text cursor-pointer focus:opacity-100"
            aria-label={t('messages.addReaction', { defaultValue: 'Tepki ekle' })}
            title={t('messages.addReaction', { defaultValue: 'Tepki ekle' })}
          >
            <SmileIcon className="size-4" />
          </button>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={onOpenMenu}
            className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text cursor-pointer"
            aria-label={t('messages.messageActions')}
            title={t('messages.messageActions')}
          >
            <MoreIcon className="size-4" />
          </button>

          {isMenuOpen ? (
            <div className={`absolute z-40 w-[180px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.22)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${
              openUpwards ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
            } ${
              isMine ? 'right-0' : 'left-0'
            }`}>
              <button
                type="button"
                onClick={() => {
                  onOpenMenu()
                  setShowReactionPicker(true)
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary cursor-pointer"
              >
                <SmileIcon />
                <span>{t('messages.addReaction', { defaultValue: 'Tepki ekle' })}</span>
              </button>

              <button
                type="button"
                onClick={onReply}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary cursor-pointer"
              >
                <ReplyIcon />
                <span>{t('messages.reply')}</span>
              </button>

              <button
                type="button"
                onClick={onCopy}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary cursor-pointer"
              >
                <CopyIcon />
                <span>{t('messages.copy')}</span>
              </button>

              {isMine ? (
                <>
                  <button
                    type="button"
                    onClick={onStartEdit}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary cursor-pointer"
                  >
                    <PencilIcon />
                    <span>{t('messages.edit')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:hover:bg-zinc-900 cursor-pointer"
                  >
                    <TrashIcon />
                    <span>{t('messages.delete')}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onReport({ kind: 'message', id: message._id || message.id })}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:hover:bg-zinc-900 cursor-pointer"
                >
                  <MoreIcon />
                  <span>{t('messages.report')}</span>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
