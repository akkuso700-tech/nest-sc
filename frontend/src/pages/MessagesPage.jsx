import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ReportDialog from '../components/feedback/ReportDialog.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import Seo from '../components/seo/Seo.jsx'
import MediaGallery from '../features/posts/MediaGallery.jsx'
import AudioMessagePlayer from '../components/media/AudioMessagePlayer.jsx'
import { LinkPreviewCard } from '../components/media/LinkPreviewCard.jsx'
import SocialLayout from '../layouts/SocialLayout.jsx'
import {
  blockConversation,
  deleteMessage,
  getConversationMessages,
  getConversations,
  hideConversation,
  markConversationRead,
  sendMessage,
  updateMessage,
  toggleMessageReaction,
} from '../services/messagesService.js'
import { connectSocketClient, disconnectSocketClient } from '../services/socketClient.js'
import { useAuth } from '../store/AuthContext.jsx'
import { formatClockTime, getFullName } from '../utils/social.js'
import { resolveMediaUrl } from '../utils/media.js'
import { compressImageToFile, formatBytes } from '../utils/imageUpload.js'
import { playMessageNotificationSound } from '../utils/notificationSound.js'
import {
  BackIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  HeartIcon,
  InfoIcon,
  MessageIcon,
  MicrophoneIcon,
  MoreIcon,
  PencilIcon,
  PhotoIcon,
  PlayIcon,
  PlusIcon,
  ReplyIcon,
  SearchIcon,
  SendIcon,
  SmileIcon,
  TrashIcon,
  VideoIcon,
} from './MessagesPageIcons.jsx'

const MESSAGE_IMAGE_MAX_BYTES = 1.2 * 1024 * 1024
const MESSAGE_VIDEO_MAX_BYTES = 12 * 1024 * 1024

function getConversationPeer(conversation) {
  return conversation?.participants?.[0] || null
}

function findConversationIdForPeer(conversations, target) {
  if (!target) {
    return ''
  }

  const matchedConversation = conversations.find((conversation) => {
    const peer = getConversationPeer(conversation)

    return (
      (target._id && peer?._id?.toString?.() === target._id?.toString?.()) ||
      (target.id && peer?._id?.toString?.() === target.id?.toString?.()) ||
      (target.username && peer?.username === target.username)
    )
  })

  return matchedConversation?.id || ''
}

function createPreviewItems(files) {
  return files.map((file) => ({
    id: `${file.name}-${file.lastModified}`,
    url: URL.createObjectURL(file),
    type: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
  }))
}

function useIsMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )

  useEffect(() => {
    function handleResize() {
      setIsMobileViewport(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return isMobileViewport
}

function formatPresence(lastLoginAt, t, lang = 'tr') {
  if (!lastLoginAt) {
    return t('messages.presence.offline', { defaultValue: 'Çevrimdışı' })
  }

  const date = new Date(lastLoginAt)
  if (isNaN(date.getTime())) {
    return t('messages.presence.offline', { defaultValue: 'Çevrimdışı' })
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 60 * 1000) {
    return t('messages.presence.justNow', { defaultValue: 'Az önce aktifti' })
  }

  const minutes = Math.floor(diffMs / (60 * 1000))
  if (minutes < 60) {
    return t('messages.presence.minutesAgo', {
      count: minutes,
      defaultValue: `${minutes} dakika önce aktifti`,
    })
  }

  const timeLocale =
    lang === 'tr' ? 'tr-TR' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : 'en-US'
  const timeStr = date.toLocaleTimeString(timeLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const isToday =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()

  if (isToday) {
    return t('messages.presence.todayAt', {
      time: timeStr,
      defaultValue: `Bugün ${timeStr}'de aktifti`,
    })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate()

  if (isYesterday) {
    return t('messages.presence.yesterdayAt', {
      time: timeStr,
      defaultValue: `Dün ${timeStr}'de aktifti`,
    })
  }

  const isSameYear = now.getFullYear() === date.getFullYear()
  if (isSameYear) {
    const dateStr = date.toLocaleDateString(timeLocale, {
      day: 'numeric',
      month: 'long',
    })
    return t('messages.presence.dateAt', {
      date: dateStr,
      time: timeStr,
      defaultValue: `${dateStr} ${timeStr}'de aktifti`,
    })
  }

  const fullDateStr = date.toLocaleDateString(timeLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return t('messages.presence.dateOnly', {
    date: fullDateStr,
    defaultValue: `${fullDateStr}'de aktifti`,
  })
}

function MediaLightbox({ items = [], activeIndex = 0, onClose, onNavigate, t }) {
  const activeMedia = items[activeIndex] || null
  const [isZoomed, setIsZoomed] = useState(false)

  useEffect(() => {
    setIsZoomed(false)
  }, [activeIndex])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (items.length <= 1) {
        return
      }

      if (event.key === 'ArrowLeft') {
        onNavigate(-1)
      }

      if (event.key === 'ArrowRight') {
        onNavigate(1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [items.length, onClose, onNavigate])

  if (!activeMedia?.url) {
    return null
  }

  const mediaUrl = resolveMediaUrl(activeMedia.url)
  const canNavigate = items.length > 1
  const activeCounterLabel = `${activeIndex + 1} / ${items.length}`

  return (
    <div className="fixed inset-0 z-[110] bg-black/88 px-4 py-4 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
        <div className="rounded-full bg-white/12 px-3 py-2 text-sm font-medium text-white">
          {activeCounterLabel}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={mediaUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="grid size-11 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.downloadMedia')}
            title={t('messages.downloadMedia')}
            onClick={(event) => event.stopPropagation()}
          >
            <DownloadIcon />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.closeMedia')}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="flex h-full items-center justify-center gap-3" onClick={(event) => event.stopPropagation()}>
        {canNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            className="hidden md:grid size-12 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.previousMedia')}
          >
            <ChevronIcon direction="left" />
          </button>
        ) : null}

        <div className="relative flex max-h-full max-w-full flex-1 items-center justify-center overflow-auto">
          {activeMedia.type === 'video' ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-[24px] bg-black"
            />
          ) : (
            <img
              src={mediaUrl}
              alt={t('messages.mediaAlt')}
              onClick={() => setIsZoomed((current) => !current)}
              className={`max-h-full max-w-full rounded-[24px] object-contain transition duration-300 ${
                isZoomed ? 'cursor-zoom-out scale-[1.35]' : 'cursor-zoom-in scale-100'
              }`}
            />
          )}

          {!isZoomed && !activeMedia.type?.includes('video') ? (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white">
              {t('messages.clickToZoom')}
            </div>
          ) : null}
        </div>

        {canNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate(1)}
            className="hidden md:grid size-12 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.nextMedia')}
          >
            <ChevronIcon direction="right" />
          </button>
        ) : null}
      </div>

      {canNavigate ? (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-white">
          {items.map((item, index) => (
            <button
              key={`${item.url}-${index}`}
              type="button"
              onClick={() => onNavigate(index - activeIndex)}
              className={`size-2.5 rounded-full transition ${
                index === activeIndex ? 'bg-white' : 'bg-white/35'
              }`}
              aria-label={t('messages.mediaNumber', { number: index + 1 })}
            />
          ))}
        </div>
      ) : null}

      {canNavigate ? (
        <div className="absolute inset-x-0 bottom-20 flex justify-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            className="grid size-11 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.previousMedia')}
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            className="grid size-11 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label={t('messages.nextMedia')}
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

const QUICK_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥']

function renderFormattedMessageText(text = '', isMine = false) {
  if (!text) return null

  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi
  const parts = []
  let lastIndex = 0
  let match

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    const url = match[0]
    parts.push(
      <a
        key={`url-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`underline break-all font-medium transition-opacity hover:opacity-80 ${
          isMine ? 'text-inverse underline-offset-2' : 'text-primary underline-offset-2'
        }`}
      >
        {url}
      </a>,
    )
    lastIndex = match.index + url.length
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts
}

function MessageBubble({
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

function MessagesPage() {
  const { lang } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const { isAuthenticated, status, user } = useAuth()
  const isMobileViewport = useIsMobileViewport()
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const textareaRef = useRef(null)
  const messagesViewportRef = useRef(null)
  const composerRef = useRef(null)
  const mobileSwipeRef = useRef({
    startX: 0,
    startY: 0,
    tracking: false,
  })
  const [conversationsState, setConversationsState] = useState({ items: [], isLoading: true, error: '' })
  const [activeConversationId, setActiveConversationId] = useState('')
  const [messagesState, setMessagesState] = useState({ items: [], isLoading: false, error: '' })
  const [replyingToMessage, setReplyingToMessage] = useState(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false)
  const [highlightedMessageId, setHighlightedMessageId] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isOptimizingMedia, setIsOptimizingMedia] = useState(false)
  const [messageFiles, setMessageFiles] = useState([])
  const [messagePreviews, setMessagePreviews] = useState([])
  const [sendError, setSendError] = useState('')
  const [reportTarget, setReportTarget] = useState(null)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [messageSearchValue, setMessageSearchValue] = useState('')
  const [showMessageSearch, setShowMessageSearch] = useState(false)
  const [showConversationSearchOverlay, setShowConversationSearchOverlay] = useState(false)
  const [showChatMenu, setShowChatMenu] = useState(false)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [openConversationMenuId, setOpenConversationMenuId] = useState('')
  const [openMessageMenuId, setOpenMessageMenuId] = useState('')
  const [editingMessageId, setEditingMessageId] = useState('')
  const [editingMessageText, setEditingMessageText] = useState('')
  const [isPeerTyping, setIsPeerTyping] = useState(false)
  const [typingUsersMap, setTypingUsersMap] = useState({})
  const typingTimeoutsRef = useRef({})
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())
  const [lastLoginAtMap, setLastLoginAtMap] = useState({})
  const [presenceTick, setPresenceTick] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const peerTypingTimeoutRef = useRef(null)
  const myTypingTimeoutRef = useRef(null)
  const isMeTypingRef = useRef(false)
  const lastTypingEmitTimeRef = useRef(0)
  const [toast, setToast] = useState(null)
  const [lightboxMedia, setLightboxMedia] = useState(null)
  const [mobileComposerHeight, setMobileComposerHeight] = useState(60)
  const [mobileKeyboardOffset, setMobileKeyboardOffset] = useState(0)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioStreamRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const recordingStartTimeRef = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setPresenceTick((prev) => prev + 1)
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const urlRecipientId = searchParams.get('recipientId') || ''
  const urlUsername = searchParams.get('username') || ''
  const urlName = searchParams.get('name') || ''
  const urlAvatarUrl = searchParams.get('avatarUrl') || ''

  const composeTarget = useMemo(() => {
    if (!urlRecipientId && !urlUsername) {
      return null
    }
    return {
      _id: urlRecipientId,
      id: urlRecipientId,
      username: urlUsername,
      fullName: urlName || urlUsername || t('common.unknownUser'),
      firstName: urlName || urlUsername || t('common.unknownUser'),
      avatarUrl: urlAvatarUrl,
    }
  }, [urlRecipientId, urlUsername, urlName, urlAvatarUrl, t])

  const activeConversation = useMemo(
    () =>
      conversationsState.items.find(
        (conversation) => conversation.id === activeConversationId,
      ) || null,
    [activeConversationId, conversationsState.items],
  )

  const activePeer = useMemo(() => {
    return getConversationPeer(activeConversation) || composeTarget
  }, [activeConversation, composeTarget])

  const activePeerId = activePeer?._id?.toString() || activePeer?.id?.toString() || ''
  const activePeerIdRef = useRef(activePeerId)
  useEffect(() => {
    activePeerIdRef.current = activePeerId
  }, [activePeerId])

  const isActivePeerOnline = Boolean(activePeerId && onlineUserIds.has(activePeerId))

  useEffect(
    () => () => {
      messagePreviews.forEach((item) => URL.revokeObjectURL(item.url))
    },
    [messagePreviews],
  )

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileKeyboardOffset(0)
      return undefined
    }

    const visualViewport = window.visualViewport

    function updateMobileViewportMetrics() {
      const layoutHeight = window.innerHeight
      const visibleHeight = visualViewport?.height ?? layoutHeight
      const offsetTop = visualViewport?.offsetTop ?? 0
      const keyboardOffset = Math.max(0, layoutHeight - visibleHeight - offsetTop)

      setMobileKeyboardOffset(keyboardOffset)
    }

    updateMobileViewportMetrics()

    visualViewport?.addEventListener('resize', updateMobileViewportMetrics)
    visualViewport?.addEventListener('scroll', updateMobileViewportMetrics)
    window.addEventListener('resize', updateMobileViewportMetrics)

    return () => {
      visualViewport?.removeEventListener('resize', updateMobileViewportMetrics)
      visualViewport?.removeEventListener('scroll', updateMobileViewportMetrics)
      window.removeEventListener('resize', updateMobileViewportMetrics)
    }
  }, [isMobileViewport])

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileComposerHeight(60)
      return undefined
    }

    const composerElement = composerRef.current

    if (!composerElement) {
      return undefined
    }

    function updateComposerHeight() {
      setMobileComposerHeight(composerElement.getBoundingClientRect().height)
    }

    updateComposerHeight()

    const resizeObserver = new ResizeObserver(updateComposerHeight)
    resizeObserver.observe(composerElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isMobileViewport, sendError, isOptimizingMedia, isSending, uploadProgress, messagePreviews.length])

  useEffect(() => {
    if (!isAuthenticated) {
      setConversationsState({ items: [], isLoading: false, error: '' })
      return undefined
    }

    let cancelled = false

    async function loadConversations() {
      setConversationsState((currentState) => ({ ...currentState, isLoading: true, error: '' }))

      try {
        const payload = await getConversations()
        if (cancelled) return

        setConversationsState({ items: payload.conversations || [], isLoading: false, error: '' })
      } catch (error) {
        if (cancelled) return
        setConversationsState({
          items: [],
          isLoading: false,
          error: error.message || t('messages.errors.conversationsLoadFailed'),
        })
      }
    }

    loadConversations()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, t])

  useEffect(() => {
    if (composeTarget) {
      const matchedId = findConversationIdForPeer(conversationsState.items, composeTarget)
      if (matchedId) {
        setActiveConversationId(matchedId)
      } else {
        setActiveConversationId('')
      }
      if (isMobileViewport) {
        setMobileChatOpen(true)
      }
      return
    }

    if (!isMobileViewport && conversationsState.items.length && !activeConversationId) {
      setActiveConversationId(conversationsState.items[0].id)
    }
  }, [conversationsState.items, composeTarget, isMobileViewport])

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileChatOpen(Boolean(activeConversationId || composeTarget))
    }
  }, [activeConversationId, composeTarget, isMobileViewport])

  useEffect(() => {
    if (!activeConversationId || !isAuthenticated) {
      setMessagesState({ items: [], isLoading: false, error: '' })
      setHasMoreMessages(false)
      setReplyingToMessage(null)
      return
    }

    let cancelled = false

    async function loadMessages() {
      setMessagesState((currentState) => ({ ...currentState, isLoading: true, error: '' }))
      setReplyingToMessage(null)

      try {
        const payload = await getConversationMessages(activeConversationId, 50)

        if (cancelled) {
          return
        }

        setMessagesState({ items: payload.messages, isLoading: false, error: '' })
        setHasMoreMessages(Boolean(payload.hasMore))
        if (typeof document !== 'undefined' && document.hasFocus() && !document.hidden) {
          await markConversationRead(activeConversationId)
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        setMessagesState({
          items: [],
          isLoading: false,
          error: error.message || t('messages.errors.messagesLoadFailed'),
        })
        setHasMoreMessages(false)
      }
    }

    loadMessages()

    return () => {
      cancelled = true
    }
  }, [activeConversationId, isAuthenticated, t])

  async function handleLoadOlderMessages() {
    if (isLoadingOlderMessages || !hasMoreMessages || !messagesState.items.length || !activeConversationId) {
      return
    }

    const oldestMessage = messagesState.items[0]
    const oldestId = oldestMessage._id || oldestMessage.id

    const viewport = messagesViewportRef.current
    const prevScrollHeight = viewport ? viewport.scrollHeight : 0
    const prevScrollTop = viewport ? viewport.scrollTop : 0

    setIsLoadingOlderMessages(true)

    try {
      const payload = await getConversationMessages(activeConversationId, 50, oldestId)

      setMessagesState((currentState) => ({
        ...currentState,
        items: [...payload.messages, ...currentState.items],
      }))
      setHasMoreMessages(Boolean(payload.hasMore))

      if (viewport) {
        window.requestAnimationFrame(() => {
          const newScrollHeight = viewport.scrollHeight
          viewport.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop
        })
      }
    } catch {
      // Best-effort
    } finally {
      setIsLoadingOlderMessages(false)
    }
  }

  function handleMessagesScroll(event) {
    const { scrollTop } = event.currentTarget
    if (scrollTop < 80 && hasMoreMessages && !isLoadingOlderMessages) {
      handleLoadOlderMessages()
    }
  }

  function handleStartReply(message) {
    setReplyingToMessage(message)
    setOpenMessageMenuId('')
    textareaRef.current?.focus()
  }

  function handleCancelReply() {
    setReplyingToMessage(null)
  }

  function handleScrollToMessage(targetMessageId) {
    if (!targetMessageId) return
    const el = document.getElementById(`msg-${targetMessageId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedMessageId(targetMessageId)
      setTimeout(() => setHighlightedMessageId(''), 2000)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    const socket = connectSocketClient()

    async function refreshConversationList() {
      try {
        const payload = await getConversations()
        setConversationsState({ items: payload.conversations, isLoading: false, error: '' })
        const targetConversationId = findConversationIdForPeer(payload.conversations, composeTarget)

        if (targetConversationId) {
          setActiveConversationId(targetConversationId)
        } else if (!isMobileViewport) {
          setActiveConversationId((currentId) => currentId || payload.conversations[0]?.id || '')
        }
      } catch {
        // Realtime refresh is best-effort here.
      }
    }

    async function handleIncomingMessage(message) {
      const senderId = message?.sender?._id?.toString() || message?.sender?.toString() || ''
      if (senderId) {
        if (typingTimeoutsRef.current[senderId]) {
          clearTimeout(typingTimeoutsRef.current[senderId])
          delete typingTimeoutsRef.current[senderId]
        }
        setTypingUsersMap((prev) => {
          if (!prev[senderId]) return prev
          const next = { ...prev }
          delete next[senderId]
          return next
        })
        if (senderId === activePeerIdRef.current) {
          setIsPeerTyping(false)
        }
      }

      await refreshConversationList()

      if (message.conversationId !== activeConversationId) {
        return
      }

      setMessagesState((currentState) => {
        const exists = currentState.items.some(
          (item) => item._id === message.id || item.id === message.id,
        )

        if (exists) {
          return currentState
        }

        return {
          ...currentState,
          items: [
            ...currentState.items,
            {
              _id: message.id,
              conversation: message.conversationId,
              sender: message.sender,
              recipient: message.recipient,
              text: message.text,
              media: message.media || [],
              replyTo: message.replyTo || null,
              createdAt: message.createdAt,
              readAt: message.readAt,
            },
          ],
        }
      })

      if (message.recipient === user.id || (user?.id && message.sender !== user.id)) {
        playMessageNotificationSound()
        if (typeof document !== 'undefined' && document.hasFocus() && !document.hidden) {
          await markConversationRead(message.conversationId)
        }
      }
    }

    function handleMessagesRead(payload) {
      setMessagesState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) => {
          if (
            item.conversation?.toString?.() === payload.conversationId ||
            item.conversation === payload.conversationId
          ) {
            if (
              item.sender?.toString?.() === payload.userId ||
              item.sender === payload.userId
            ) {
              return item
            }

            return { ...item, readAt: payload.readAt }
          }

          return item
        }),
      }))
    }

    function handleMessageUpdated(payload) {
      setMessagesState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) =>
          (item._id?.toString?.() === payload.messageId?.toString?.() ||
            item.id?.toString?.() === payload.messageId?.toString?.())
            ? { ...item, text: payload.text }
            : item,
        ),
      }))
    }

    function handleMessageDeleted(payload) {
      setMessagesState((currentState) => ({
        ...currentState,
        items: currentState.items.filter(
          (item) =>
            item._id?.toString?.() !== payload.messageId?.toString?.() &&
            item.id?.toString?.() !== payload.messageId?.toString?.(),
        ),
      }))
    }

    function handlePeerTypingStart(payload) {
      if (!payload?.userId) return
      const typingUserId = payload.userId.toString()

      setTypingUsersMap((prev) => ({
        ...prev,
        [typingUserId]: true,
      }))

      if (typingTimeoutsRef.current[typingUserId]) {
        clearTimeout(typingTimeoutsRef.current[typingUserId])
      }

      typingTimeoutsRef.current[typingUserId] = setTimeout(() => {
        setTypingUsersMap((prev) => {
          const next = { ...prev }
          delete next[typingUserId]
          return next
        })
        if (typingUserId === activePeerIdRef.current) {
          setIsPeerTyping(false)
        }
      }, 4500)

      if (typingUserId === activePeerIdRef.current) {
        setIsPeerTyping(true)
      }
    }

    function handlePeerTypingStop(payload) {
      if (!payload?.userId) return
      const typingUserId = payload.userId.toString()

      if (typingTimeoutsRef.current[typingUserId]) {
        clearTimeout(typingTimeoutsRef.current[typingUserId])
        delete typingTimeoutsRef.current[typingUserId]
      }

      setTypingUsersMap((prev) => {
        const next = { ...prev }
        delete next[typingUserId]
        return next
      })

      if (typingUserId === activePeerIdRef.current) {
        setIsPeerTyping(false)
      }
    }

    function handleUsersOnline(userIds) {
      if (Array.isArray(userIds)) {
        setOnlineUserIds(new Set(userIds.map((id) => id.toString())))
      }
    }

    function handleUserStatus(payload) {
      if (payload?.userId) {
        const id = payload.userId.toString()
        setOnlineUserIds((prev) => {
          const next = new Set(prev)
          if (payload.isOnline) {
            next.add(id)
          } else {
            next.delete(id)
          }
          return next
        })

        if (!payload.isOnline && payload.lastLoginAt) {
          setLastLoginAtMap((prev) => ({
            ...prev,
            [id]: payload.lastLoginAt,
          }))
        }
      }
    }

    function handleMessageReaction(payload) {
      if (!payload?.messageId) return

      setMessagesState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) => {
          const itemId = item._id || item.id
          if (itemId?.toString() === payload.messageId?.toString()) {
            return {
              ...item,
              reactions: payload.reactions || [],
            }
          }
          return item
        }),
      }))
    }

    socket.on('new_message', handleIncomingMessage)
    socket.on('messages_read', handleMessagesRead)
    socket.on('message_updated', handleMessageUpdated)
    socket.on('message_deleted', handleMessageDeleted)
    socket.on('message:reaction', handleMessageReaction)
    socket.on('typing:start', handlePeerTypingStart)
    socket.on('typing:stop', handlePeerTypingStop)
    socket.on('users:online', handleUsersOnline)
    socket.on('user:status', handleUserStatus)

    return () => {
      socket.off('new_message', handleIncomingMessage)
      socket.off('messages_read', handleMessagesRead)
      socket.off('message_updated', handleMessageUpdated)
      socket.off('message_deleted', handleMessageDeleted)
      socket.off('message:reaction', handleMessageReaction)
      socket.off('typing:start', handlePeerTypingStart)
      socket.off('typing:stop', handlePeerTypingStop)
      socket.off('users:online', handleUsersOnline)
      socket.off('user:status', handleUserStatus)
      Object.values(typingTimeoutsRef.current).forEach((t) => clearTimeout(t))
      typingTimeoutsRef.current = {}
      disconnectSocketClient()
    }
  }, [activeConversationId, activePeer, composeTarget, isAuthenticated, isMobileViewport, user?.id])

  useEffect(() => {
    scrollMessagesToBottom()
  }, [messagesState.items, isPeerTyping])

  useEffect(() => {
    if (!isMobileViewport) {
      return
    }

    scrollMessagesToBottom()
  }, [isMobileViewport, mobileKeyboardOffset, mobileComposerHeight])

  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`
    textarea.style.overflowY = textarea.scrollHeight > 140 ? 'auto' : 'hidden'
  }, [messageDraft])

  useEffect(() => {
    setMessageSearchValue('')
    setShowMessageSearch(false)
    setShowConversationSearchOverlay(false)
    setShowChatMenu(false)
    setShowAttachmentMenu(false)
    setOpenConversationMenuId('')
    setOpenMessageMenuId('')
    setEditingMessageId('')
    setEditingMessageText('')
    setReplyingToMessage(null)
    setHighlightedMessageId('')
    setIsPeerTyping(false)
    isMeTypingRef.current = false
    cancelVoiceRecording()
    if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current)
    if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current)
  }, [activeConversationId])

  useEffect(() => {
    if (!activeConversationId || !isAuthenticated) {
      return undefined
    }

    async function handleWindowFocus() {
      if (typeof document !== 'undefined' && document.hasFocus() && !document.hidden) {
        try {
          await markConversationRead(activeConversationId)
        } catch {
          // Best-effort
        }
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleWindowFocus)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleWindowFocus)
    }
  }, [activeConversationId, isAuthenticated])

  useEffect(() => {
    if (!toast?.message) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 2400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      if (!target.closest('[data-message-menu-shell="true"]')) {
        setOpenMessageMenuId('')
      }

      if (!target.closest('[data-conversation-menu-shell="true"]')) {
        setOpenConversationMenuId('')
      }

      if (!target.closest('[data-attachment-menu-shell="true"]')) {
        setShowAttachmentMenu(false)
      }

      if (!target.closest('[data-conversation-search-shell="true"]')) {
        setShowConversationSearchOverlay(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const filteredConversations = useMemo(() => {
    const query = searchValue.trim().toLowerCase()

    if (!query) {
      return conversationsState.items
    }

    return conversationsState.items.filter((conversation) => {
      const peer = getConversationPeer(conversation)
      const text = `${getFullName(peer)} ${peer?.username || ''} ${conversation.lastMessagePreview || ''}`.toLowerCase()
      return text.includes(query)
    })
  }, [conversationsState.items, searchValue])
  const totalUnreadCount = useMemo(
    () =>
      conversationsState.items.reduce(
        (count, conversation) => count + (conversation.unreadCount || 0),
        0,
      ),
    [conversationsState.items],
  )

  const shouldShowMobileChat = !isMobileViewport || mobileChatOpen || Boolean(composeTarget)
  const activePeerLastLoginAt =
    (activePeerId && lastLoginAtMap[activePeerId]) || activePeer?.lastLoginAt || null
  const activePresenceLabel = useMemo(() => {
    if (isActivePeerOnline) {
      return t('messages.presence.online', { defaultValue: 'Çevrimiçi' })
    }
    return formatPresence(activePeerLastLoginAt, t, lang)
  }, [isActivePeerOnline, activePeerLastLoginAt, t, lang, presenceTick])
  const filteredMessages = useMemo(() => {
    const query = messageSearchValue.trim().toLowerCase()

    if (!query) {
      return messagesState.items
    }

    return messagesState.items.filter((message) => {
      const haystack = `${message.text || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [messageSearchValue, messagesState.items])
  const matchedMessagesCount = filteredMessages.length

  function scrollMessagesToBottom() {
    const viewport = messagesViewportRef.current

    if (!viewport) {
      return
    }

    window.requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight

      window.requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight
      })
    })
  }

  function replaceMessageFiles(nextFiles) {
    messagePreviews.forEach((item) => URL.revokeObjectURL(item.url))
    setMessageFiles(nextFiles)
    setMessagePreviews(createPreviewItems(nextFiles))
  }

  function upsertConversationAfterSend(messageItem) {
    const normalizedConversationId = messageItem.conversationId || messageItem.conversation || activeConversationId || ''
    const sentAt = messageItem.createdAt || new Date().toISOString()
    const sentPreview = messageItem.text?.trim() || (messageItem.media?.length ? t('messages.mediaPreview') : t('messages.noMessagesYet'))

    setConversationsState((currentState) => {
      const existingIndex = currentState.items.findIndex((conversation) => {
        if (normalizedConversationId && conversation.id === normalizedConversationId) {
          return true
        }

        const peer = getConversationPeer(conversation)
        return (
          (activePeer?._id && peer?._id?.toString?.() === activePeer._id?.toString?.()) ||
          (activePeer?.id && peer?._id?.toString?.() === activePeer.id?.toString?.()) ||
          (activePeer?.username && peer?.username === activePeer.username)
        )
      })

      if (existingIndex === -1) {
        return currentState
      }

      const nextItems = [...currentState.items]
      const matchedConversation = nextItems[existingIndex]

      nextItems[existingIndex] = {
        ...matchedConversation,
        id: normalizedConversationId || matchedConversation.id,
        lastMessageAt: sentAt,
        lastMessagePreview: sentPreview,
      }

      const [updatedConversation] = nextItems.splice(existingIndex, 1)
      nextItems.unshift(updatedConversation)

      return {
        ...currentState,
        items: nextItems,
      }
    })

    if (normalizedConversationId) {
      setActiveConversationId(normalizedConversationId)
    }

    if (searchParams.get('recipientId') || searchParams.get('username')) {
      navigate(`/${lang}/messages`, { replace: true })
    }
  }

  function openConversation(conversationId) {
    if (searchParams.get('recipientId') || searchParams.get('username')) {
      navigate(`/${lang}/messages`, { replace: true })
    }
    setActiveConversationId(conversationId)
    if (isMobileViewport) {
      setMobileChatOpen(true)
    }
  }

  function handleBackToInbox() {
    if (searchParams.get('recipientId') || searchParams.get('username')) {
      navigate(`/${lang}/messages`, { replace: true })
    }
    setMobileChatOpen(false)
    setActiveConversationId('')
    setMessagesState({ items: [], isLoading: false, error: '' })
  }

  function handleMobileTouchStart(event) {
    if (!isMobileViewport) {
      return
    }

    const touch = event.touches?.[0]

    if (!touch) {
      return
    }

    mobileSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: touch.clientX <= 28,
    }
  }

  function handleMobileTouchEnd(event) {
    if (!isMobileViewport || !mobileSwipeRef.current.tracking) {
      return
    }

    const touch = event.changedTouches?.[0]

    if (!touch) {
      return
    }

    const deltaX = touch.clientX - mobileSwipeRef.current.startX
    const deltaY = Math.abs(touch.clientY - mobileSwipeRef.current.startY)

    if (deltaX > 84 && deltaY < 40) {
      handleBackToInbox()
    }

    mobileSwipeRef.current.tracking = false
  }

  async function handleSelectImages(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''

    if (!files.length) {
      return
    }

    if (messageFiles.some((file) => file.type.startsWith('video/'))) {
      setSendError(t('messages.errors.mediaLimitMixed'))
      return
    }

    if (files.some((file) => !file.type.startsWith('image/'))) {
      setSendError(t('messages.errors.imageOnly'))
      return
    }

    if (messageFiles.length + files.length > 4) {
      setSendError(t('messages.errors.imageLimit'))
      return
    }

    setIsOptimizingMedia(true)
    setSendError('')

    try {
      const optimizedFiles = await Promise.all(
        files.map((file) =>
          compressImageToFile(file, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.72,
            type: 'image/webp',
            maxBytes: MESSAGE_IMAGE_MAX_BYTES,
            fileNamePrefix: 'message',
          }),
        ),
      )

      replaceMessageFiles([...messageFiles, ...optimizedFiles])
    } catch (error) {
      setSendError(error.message || t('messages.errors.imageOptimizeFailed'))
    } finally {
      setIsOptimizingMedia(false)
    }
  }

  function handleSelectVideo(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''

    if (!files.length) {
      return
    }

    const [videoFile] = files

    if (!videoFile.type.startsWith('video/')) {
      setSendError(t('messages.errors.videoOnly'))
      return
    }

    if (videoFile.size > MESSAGE_VIDEO_MAX_BYTES) {
      setSendError(t('messages.errors.videoTooLarge', { maxSize: formatBytes(MESSAGE_VIDEO_MAX_BYTES) }))
      return
    }

    if (messageFiles.length) {
      setSendError(t('messages.errors.removeMediaBeforeVideo'))
      return
    }

    setSendError('')
    replaceMessageFiles([videoFile])
  }

  function removePreview(previewId) {
    const nextFiles = messageFiles.filter(
      (file) => `${file.name}-${file.lastModified}` !== previewId,
    )

    setSendError('')
    replaceMessageFiles(nextFiles)
  }

  async function handleCopyMessage(message) {
    try {
      if (!message.text?.trim()) {
        setToast({ tone: 'error', message: t('messages.errors.noTextToCopy') })
        return
      }

      await navigator.clipboard.writeText(message.text)
      setToast({ tone: 'success', message: t('messages.copySuccess') })
      setOpenMessageMenuId('')
    } catch {
      setToast({ tone: 'error', message: t('messages.errors.copyFailed') })
    }
  }

  function handleStartEditMessage(message) {
    setEditingMessageId(message._id || message.id)
    setEditingMessageText(message.text || '')
    setOpenMessageMenuId('')
  }

  function handleCancelEditMessage() {
    setEditingMessageId('')
    setEditingMessageText('')
  }

  async function handleSaveEditedMessage(message) {
    const messageId = message._id || message.id
    const nextText = editingMessageText.trim()

    if (!nextText) {
      setToast({ tone: 'error', message: t('messages.errors.emptyMessage') })
      return
    }

    try {
      const response = await updateMessage(messageId, { text: nextText })

      setMessagesState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) =>
          (item._id || item.id) === messageId
            ? { ...item, text: response.messageItem.text }
            : item,
        ),
      }))

      setEditingMessageId('')
      setEditingMessageText('')
      setToast({ tone: 'success', message: t('messages.updateSuccess') })
    } catch (error) {
      setToast({ tone: 'error', message: error.message || t('messages.errors.updateFailed') })
    }
  }

  async function handleDeleteMessage(message) {
    const messageId = message._id || message.id

    try {
      await deleteMessage(messageId)
      setMessagesState((currentState) => ({
        ...currentState,
        items: currentState.items.filter((item) => (item._id || item.id) !== messageId),
      }))
      setOpenMessageMenuId('')
      if (editingMessageId === messageId) {
        setEditingMessageId('')
        setEditingMessageText('')
      }
      setToast({ tone: 'success', message: t('messages.deleteSuccess') })
    } catch (error) {
      setToast({ tone: 'error', message: error.message || t('messages.errors.deleteFailed') })
    }
  }

  async function handleMarkConversationRead(conversationId) {
    try {
      await markConversationRead(conversationId)
      setConversationsState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) =>
          item.id === conversationId ? { ...item, unreadCount: 0 } : item,
        ),
      }))
      setOpenConversationMenuId('')
      setToast({ tone: 'success', message: t('messages.markReadSuccess') })
    } catch (error) {
      setToast({ tone: 'error', message: error.message || t('messages.errors.actionFailed') })
    }
  }

  async function handleHideConversation(conversationId) {
    try {
      await hideConversation(conversationId)
      setConversationsState((currentState) => ({
        ...currentState,
        items: currentState.items.filter((item) => item.id !== conversationId),
      }))
      if (activeConversationId === conversationId) {
        setActiveConversationId('')
        setMessagesState({ items: [], isLoading: false, error: '' })
      }
      setOpenConversationMenuId('')
      setToast({ tone: 'success', message: t('messages.hideConversationSuccess') })
    } catch (error) {
      setToast({ tone: 'error', message: error.message || t('messages.errors.hideConversationFailed') })
    }
  }

  async function handleBlockConversation(conversationId) {
    try {
      await blockConversation(conversationId)
      setConversationsState((currentState) => ({
        ...currentState,
        items: currentState.items.filter((item) => item.id !== conversationId),
      }))
      if (activeConversationId === conversationId) {
        setActiveConversationId('')
        setMessagesState({ items: [], isLoading: false, error: '' })
      }
      setOpenConversationMenuId('')
      setToast({ tone: 'success', message: t('messages.blockSuccess') })
    } catch (error) {
      setToast({ tone: 'error', message: error.message || t('messages.errors.blockFailed') })
    }
  }

  function handleDraftChange(event) {
    const value = event.target.value
    setMessageDraft(value)

    const activePeerId = activePeer?._id || activePeer?.id
    if (!activePeerId || !isAuthenticated) {
      return
    }

    const socket = connectSocketClient()

    if (value.length === 0) {
      if (isMeTypingRef.current) {
        isMeTypingRef.current = false
        socket.emit('typing:stop', {
          recipientId: activePeerId,
          conversationId: activeConversationId || null,
        })
      }
      if (myTypingTimeoutRef.current) {
        clearTimeout(myTypingTimeoutRef.current)
      }
      return
    }

    const now = Date.now()
    if (!isMeTypingRef.current || now - lastTypingEmitTimeRef.current > 1500) {
      isMeTypingRef.current = true
      lastTypingEmitTimeRef.current = now
      socket.emit('typing:start', {
        recipientId: activePeerId,
        conversationId: activeConversationId || null,
      })
    }

    if (myTypingTimeoutRef.current) {
      clearTimeout(myTypingTimeoutRef.current)
    }

    myTypingTimeoutRef.current = setTimeout(() => {
      isMeTypingRef.current = false
      socket.emit('typing:stop', {
        recipientId: activePeerId,
        conversationId: activeConversationId || null,
      })
    }, 3000)
  }

  function formatVoiceDuration(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  function cleanupRecordingStreams() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop())
      audioStreamRef.current = null
    }
  }

  async function startVoiceRecording() {
    if (isRecordingVoice || isSending || isOptimizingMedia || !activePeer) {
      return
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setToast({
          tone: 'error',
          message: 'Tarayıcınız ses kaydını desteklemiyor.',
        })
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream

      let mimeType = 'audio/webm;codecs=opus'
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus'
        } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus'
        } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else {
          mimeType = ''
        }
      }

      const options = mimeType ? { mimeType } : {}
      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.start(200)
      recordingStartTimeRef.current = Date.now()
      setIsRecordingVoice(true)
      setRecordingDuration(0)

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
        setRecordingDuration(elapsed)
      }, 1000)
    } catch (error) {
      console.error('Microphone error:', error)
      setToast({
        tone: 'error',
        message:
          t('messages.microphonePermissionDenied', {
            defaultValue:
              'Mikrofon erişimi engellendi. Lütfen tarayıcı ayarlarından mikrofon iznini açın.',
          }),
      })
    }
  }

  function cancelVoiceRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    cleanupRecordingStreams()
    audioChunksRef.current = []
    setIsRecordingVoice(false)
    setRecordingDuration(0)
  }

  async function stopVoiceRecording(shouldSend = true) {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      cleanupRecordingStreams()
      setIsRecordingVoice(false)
      return
    }

    const duration = Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000))
    cleanupRecordingStreams()

    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || 'audio/webm'
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
      audioChunksRef.current = []
      setIsRecordingVoice(false)
      setRecordingDuration(0)

      if (shouldSend && audioBlob.size > 0 && activePeerId) {
        const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.${extension}`, {
          type: mimeType,
          lastModified: Date.now(),
        })

        await handleSendVoiceMessage(audioFile, duration)
      }
    }

    recorder.stop()
  }

  async function handleSendVoiceMessage(file, duration) {
    if (!activePeerId) return

    setIsSending(true)
    setSendError('')
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.set('recipientId', activePeerId)
      formData.set('text', '')
      formData.set('durationSeconds', String(duration))
      formData.append('media', file)

      if (replyingToMessage) {
        formData.set('replyToId', replyingToMessage._id || replyingToMessage.id)
      }

      const response = await sendMessage(formData, (progress) => {
        setUploadProgress(progress)
      })

      const sentMessage = response.messageItem
      setMessagesState((currentState) => ({
        ...currentState,
        items: [
          ...currentState.items,
          {
            _id: sentMessage.id || sentMessage._id,
            conversation: sentMessage.conversationId || sentMessage.conversation,
            sender: sentMessage.sender,
            recipient: sentMessage.recipient,
            text: sentMessage.text,
            media: sentMessage.media || [],
            replyTo: sentMessage.replyTo || null,
            createdAt: sentMessage.createdAt,
            readAt: sentMessage.readAt || null,
          },
        ],
      }))

      setReplyingToMessage(null)
      upsertConversationAfterSend(sentMessage)
      setIsSending(false)
      setUploadProgress(0)

      if (isMobileViewport) {
        window.requestAnimationFrame(() => {
          scrollMessagesToBottom()
        })
      }
    } catch (error) {
      setSendError(error.message || t('messages.errors.sendFailed'))
      setIsSending(false)
      setUploadProgress(0)
    }
  }

  async function handleSendMessage() {
    if (isOptimizingMedia || isSending) {
      return
    }

    const trimmedMessage = messageDraft.trim()
    const activePeerId = activePeer?._id || activePeer?.id

    if (!activePeerId || (!trimmedMessage && !messageFiles.length)) {
      return
    }

    if (myTypingTimeoutRef.current) {
      clearTimeout(myTypingTimeoutRef.current)
    }
    if (isMeTypingRef.current) {
      isMeTypingRef.current = false
      const socket = connectSocketClient()
      socket.emit('typing:stop', {
        recipientId: activePeerId,
        conversationId: activeConversationId || null,
      })
    }

    setIsSending(true)
    setSendError('')

    const replyToId = replyingToMessage ? (replyingToMessage._id || replyingToMessage.id) : null

    try {
      let payloadBody = { recipientId: activePeerId, text: trimmedMessage, media: [], replyToId }

      if (messageFiles.length) {
        const formData = new FormData()
        formData.set('recipientId', activePeerId)
        formData.set('text', trimmedMessage)
        if (replyToId) {
          formData.set('replyToId', replyToId)
        }
        messageFiles.forEach((file) => {
          formData.append('media', file)
        })
        payloadBody = formData
      }

      if (messageFiles.length) {
        setUploadProgress(0)
      }

      const response = await sendMessage(payloadBody, (percent) => {
        setUploadProgress(percent)
      })
      const payload = response.messageItem

      setMessagesState((currentState) => ({
        ...currentState,
        items: [
          ...currentState.items,
          {
            _id: payload.id || payload._id,
            conversation: payload.conversationId || payload.conversation,
            sender: payload.sender,
            recipient: payload.recipient,
            text: payload.text,
            media: payload.media || [],
            replyTo: payload.replyTo || null,
            createdAt: payload.createdAt,
            readAt: payload.readAt || null,
          },
        ],
      }))

      setMessageDraft('')
      setReplyingToMessage(null)
      replaceMessageFiles([])
      upsertConversationAfterSend(payload)
      setUploadProgress(0)
      setIsSending(false)

      if (isMobileViewport) {
        window.requestAnimationFrame(() => {
          textareaRef.current?.focus({ preventScroll: true })
          scrollMessagesToBottom()
        })
      }
    } catch (error) {
      setSendError(error.message || t('messages.errors.sendFailed'))
      setUploadProgress(0)
      setIsSending(false)
    }
  }

  async function handleToggleReaction(messageId, emoji) {
    if (!messageId || !emoji || !user?.id) return

    // Optimistic UI update
    setMessagesState((currentState) => ({
      ...currentState,
      items: currentState.items.map((item) => {
        const itemId = item._id || item.id
        if (itemId?.toString() === messageId.toString()) {
          const currentReactions = Array.isArray(item.reactions) ? [...item.reactions] : []
          const existingIdx = currentReactions.findIndex(
            (r) => String(r.user?._id || r.user) === String(user.id),
          )

          if (existingIdx > -1) {
            if (currentReactions[existingIdx].emoji === emoji) {
              currentReactions.splice(existingIdx, 1)
            } else {
              currentReactions[existingIdx] = {
                ...currentReactions[existingIdx],
                emoji,
              }
            }
          } else {
            currentReactions.push({
              user: user.id,
              emoji,
            })
          }

          return {
            ...item,
            reactions: currentReactions,
          }
        }
        return item
      }),
    }))

    try {
      await toggleMessageReaction(messageId, emoji)
    } catch (error) {
      console.error('Failed to toggle reaction:', error)
    }
  }

  function handleMessageKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  function handleNavigateLightbox(step) {
    setLightboxMedia((current) => {
      if (!current?.items?.length) {
        return current
      }

      const itemCount = current.items.length
      const nextIndex =
        typeof step === 'number' && Math.abs(step) === 1
          ? (current.index + step + itemCount) % itemCount
          : Math.max(0, Math.min(itemCount - 1, current.index + step))

      return {
        ...current,
        index: nextIndex,
      }
    })
  }

  const mobileMessagesViewportStyle = isMobileViewport
    ? { paddingBottom: `${mobileComposerHeight + mobileKeyboardOffset + 32}px` }
    : { paddingBottom: '24px' }

  const mobileComposerStyle = isMobileViewport
    ? {
        bottom: `${mobileKeyboardOffset}px`,
        paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
      }
    : undefined

  if (status === 'loading') {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${lang}/login`} replace />
  }

  return (
    <>
      <Seo
        title={t('messages.seoTitle')}
        description={t('messages.seoDescription')}
      />

      <SocialLayout
        pageTitle={t('nav.messages')}
        activeKey="messages"
        showDesktopPageHeader={false}
        initialSidebarOpen={false}
        desktopSidebarMode="drawer"
        fixedViewport
        hideMobileBottomBar={isMobileViewport && shouldShowMobileChat}
        mainClassName="h-full"
        mobileBleed
        mobileFlushTop
        hideHeaderOnMobile
      >
        <section className="h-full min-h-0 overflow-hidden border-y border-border bg-card shadow-sm md:rounded-lg md:border md:shadow-sm">
          <div className="grid h-full min-h-0 md:grid-cols-[340px_minmax(0,1fr)]">
            {(!isMobileViewport || !shouldShowMobileChat) ? (
              <aside className="flex h-full min-h-0 flex-col border-r border-border">
                {isMobileViewport ? (
                  <div className="sticky top-0 z-10 border-b border-border bg-card">
                    <div className="flex h-12 items-center gap-3 px-1">
                      <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
                        aria-label={t('messages.back')}
                      >
                        <BackIcon />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-text">
                            {t('messages.title')}
                          </p>
                          {totalUnreadCount ? (
                            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                              {totalUnreadCount}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-[11px] text-muted">
                          {totalUnreadCount
                            ? t('messages.unreadCount', { count: totalUnreadCount })
                            : t('messages.allConversationsHere')}
                        </p>
                      </div>

                      <div className="relative" data-conversation-search-shell="true">
                        <button
                          type="button"
                          onClick={() => setShowConversationSearchOverlay(true)}
                          className="grid size-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                          aria-label={t('messages.searchConversations')}
                        >
                          <SearchIcon />
                        </button>

                        {showConversationSearchOverlay ? (
                          <div className="fixed inset-0 z-[60] bg-white dark:bg-zinc-950">
                            <div className="flex h-12 items-center gap-3 border-b border-zinc-200 px-3 dark:border-zinc-800">
                              <button
                                type="button"
                                onClick={() => setShowConversationSearchOverlay(false)}
                                className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
                                aria-label={t('messages.closeSearch')}
                              >
                                <BackIcon />
                              </button>
                              <div className="flex h-9 flex-1 items-center gap-3 rounded-lg border border-border bg-secondary px-4">
                                <SearchIcon />
                                <input
                                  autoFocus
                                  type="text"
                                  value={searchValue}
                                  onChange={(event) => setSearchValue(event.target.value)}
                                  placeholder={t('messages.searchConversations')}
                                  className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-b border-border px-4 py-4">
                    <div className="rounded-lg border border-border bg-secondary px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-soft">
                          <SearchIcon />
                        </span>
                        <input
                          type="text"
                          value={searchValue}
                          onChange={(event) => setSearchValue(event.target.value)}
                          placeholder={t('messages.searchConversations')}
                          className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {conversationsState.error ? (
                  <div className="px-4 py-3 text-sm text-rose-600">{conversationsState.error}</div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto px-0 py-1">
                  {conversationsState.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <div
                          key={`conversation-skeleton-${index}`}
                          className="h-[78px] animate-pulse rounded-[24px] bg-secondary"
                        />
                      ))}
                    </div>
                  ) : null}

                  {!conversationsState.isLoading && !filteredConversations.length ? (
                    <div className="rounded-[24px] border border-dashed border-border px-4 py-5 text-sm text-muted">
                      {t('messages.emptyConversations')}
                    </div>
                  ) : null}

                  <div className="space-y-0.5">
                    {filteredConversations.map((conversation) => {
                      const peer = getConversationPeer(conversation)
                      const peerId = peer?._id?.toString() || peer?.id?.toString() || ''
                      const isPeerOnline = Boolean(peerId && onlineUserIds.has(peerId))
                      const isActive = conversation.id === activeConversationId && shouldShowMobileChat

                      return (
                        <div
                          key={conversation.id}
                          className={`flex items-center gap-2 border-b border-border px-2 py-2 transition ${
                            isActive
                              ? 'bg-secondary cursor-pointer text-text '
                              : 'hover:bg-secondary'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => openConversation(conversation.id)}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1 py-1 text-left"
                          >
                            <div className="relative shrink-0">
                              <UserAvatar
                                user={peer}
                                className={`size-13 ${
                                  isActive
                                    ? 'bg-[rgb(var(--color-card)/0.15)] text-inverse'
                                    : 'bg-primary text-inverse'
                                }`}
                                textClassName="text-sm font-semibold"
                              />
                              {isPeerOnline ? (
                                <span
                                  className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-card shadow-sm"
                                  title={t('messages.presence.online', { defaultValue: 'Çevrimiçi' })}
                                />
                              ) : null}
                              {conversation.unreadCount ? (
                                <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                                </span>
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="flex min-w-0 items-center gap-1 text-sm font-semibold"><span className="truncate">{getFullName(peer)}</span><VerifiedBadge user={peer} size="xs" /></p>
                                <span
                                  className={`shrink-0 text-[11px] ${
                                    isActive
                                      ? 'text-muted'
                                      : 'text-soft'
                                  }`}
                                >
                                  {conversation.lastMessageAt
                                    ? formatClockTime(conversation.lastMessageAt)
                                    : '--:--'}
                                </span>
                              </div>
                              <p
                                className={`mt-1 truncate text-sm ${
                                  isActive
                                    ? 'text-muted'
                                    : 'text-muted'
                                }`}
                              >
                                {typingUsersMap[peerId] ? (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                                    <span className="italic">{t('messages.typing', { defaultValue: 'Yazıyor...' })}</span>
                                    <span className="inline-flex items-center gap-0.5">
                                      <span className="size-1 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                                      <span className="size-1 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                                      <span className="size-1 rounded-full bg-emerald-500 animate-bounce" />
                                    </span>
                                  </span>
                                ) : (
                                  conversation.lastMessagePreview || t('messages.noMessagesYet')
                                )}
                              </p>
                            </div>
                          </button>

                          <div className="relative shrink-0" data-conversation-menu-shell="true">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenConversationMenuId((current) =>
                                  current === conversation.id ? '' : conversation.id,
                                )
                              }
                              className={`grid size-10 place-items-center cursor-pointer rounded-full transition ${
                                isActive
                                  ? 'text-muted hover:bg-[rgb(var(--color-card)/0.1)]'
                                  : 'text-soft hover:bg-secondary hover:text-text'
                              }`}
                              aria-label={t('messages.conversationActions')}
                            >
                              <MoreIcon />
                            </button>

                            {openConversationMenuId === conversation.id ? (
                              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[190px] overflow-hidden rounded-lg border border-border bg-card py-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                                <button
                                  type="button"
                                  onClick={() => handleMarkConversationRead(conversation.id)}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                                >
                                  <CheckIcon />
                                  <span>{t('messages.markRead')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleHideConversation(conversation.id)}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                                >
                                  <TrashIcon />
                                  <span>{t('messages.deleteConversation')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBlockConversation(conversation.id)}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:hover:bg-zinc-900"
                                >
                                  <InfoIcon />
                                  <span>{t('messages.block')}</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </aside>
            ) : null}

            {shouldShowMobileChat ? (
              <div
                className="flex h-full min-h-0 flex-col overflow-hidden bg-bg"
                onTouchStart={handleMobileTouchStart}
                onTouchEnd={handleMobileTouchEnd}
              >
                <div className="sticky top-0 z-10 border-b border-border bg-card">
                  {activePeer ? (
                    isMobileViewport ? (
                      <div className="relative h-12 px-1">
                        <div className="flex h-full items-center gap-3">
                          <button
                            type="button"
                            onClick={handleBackToInbox}
                            className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
                            aria-label={t('messages.backToInbox')}
                          >
                            <BackIcon />
                          </button>

                          <Link
                            to={`/${lang}/u/${activePeer.username}`}
                            className="flex min-w-0 flex-1 items-center gap-2.5"
                          >
                            <div className="relative shrink-0">
                              <UserAvatar
                                user={activePeer}
                                className="size-8 shrink-0 bg-primary text-inverse"
                                textClassName="text-xs font-semibold"
                              />
                              {isActivePeerOnline ? (
                                <span
                                  className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                                  title={t('messages.presence.online', { defaultValue: 'Çevrimiçi' })}
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-text">
                                <span className="flex items-center gap-1">{getFullName(activePeer)} <VerifiedBadge user={activePeer} size="xs" /></span>
                              </p>
                              <p className="truncate text-[11px] text-muted">
                                {isPeerTyping ? (
                                  <span className="text-primary font-medium inline-flex items-center gap-1">
                                    {t('messages.typing', { defaultValue: 'Yazıyor...' })}
                                    <span className="inline-flex gap-0.5">
                                      <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
                                      <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
                                      <span className="size-1 rounded-full bg-primary animate-bounce"></span>
                                    </span>
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 ${isActivePeerOnline ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                                    {isActivePeerOnline ? <span className="size-1.5 rounded-full bg-emerald-500 inline-block" /> : null}
                                    {activePresenceLabel}
                                  </span>
                                )}
                              </p>
                            </div>
                          </Link>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowChatMenu((current) => !current)}
                              className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
                              aria-label={t('messages.conversationActions')}
                            >
                              <MoreIcon />
                            </button>

                            {showChatMenu ? (
                              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[190px] overflow-hidden rounded-lg border border-border bg-card py-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleMarkConversationRead(activeConversationId)
                                    setShowChatMenu(false)
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                                >
                                  <CheckIcon />
                                  <span>{t('messages.markRead')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleHideConversation(activeConversationId)
                                    setShowChatMenu(false)
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                                >
                                  <TrashIcon />
                                  <span>{t('messages.deleteConversation')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleBlockConversation(activeConversationId)
                                    setShowChatMenu(false)
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:hover:bg-zinc-900"
                                >
                                  <InfoIcon />
                                  <span>{t('messages.block')}</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/${lang}/u/${activePeer.username}`}
                            className="flex min-w-0 flex-1 items-center gap-3 "
                          >
                            <div className="relative shrink-0">
                              <UserAvatar
                                user={activePeer}
                                className="size-12 shrink-0 bg-primary text-inverse"
                                textClassName="text-sm font-semibold"
                              />
                              {isActivePeerOnline ? (
                                <span
                                  className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full bg-emerald-500 ring-2 ring-card shadow-sm"
                                  title={t('messages.presence.online', { defaultValue: 'Çevrimiçi' })}
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-text">
                                <span className="flex items-center gap-1">{getFullName(activePeer)} <VerifiedBadge user={activePeer} size="xs" /></span>
                              </p>
                              <p className="truncate text-xs text-muted">
                                {isPeerTyping ? (
                                  <span className="text-primary font-medium inline-flex items-center gap-1">
                                    {t('messages.typing', { defaultValue: 'Yazıyor...' })}
                                    <span className="inline-flex gap-0.5">
                                      <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
                                      <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
                                      <span className="size-1 rounded-full bg-primary animate-bounce"></span>
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span>@{activePeer.username}</span>
                                    <span>•</span>
                                    <span className={`inline-flex items-center gap-1 ${isActivePeerOnline ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                                      {isActivePeerOnline ? <span className="size-1.5 rounded-full bg-emerald-500 inline-block" /> : null}
                                      {activePresenceLabel}
                                    </span>
                                  </span>
                                )}
                              </p>
                            </div>
                          </Link>

                          <button
                            type="button"
                            onClick={() => setShowMessageSearch((current) => !current)}
                            className={`grid size-11 cursor-pointer place-items-center rounded-full transition ${
                              showMessageSearch
                                ? 'bg-primary text-inverse'
                                : 'text-muted hover:bg-secondary hover:text-text'
                            }`}
                            aria-label={t('messages.searchMessages')}
                            title={t('messages.searchMessages')}
                          >
                            <SearchIcon />
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowChatMenu((current) => !current)}
                              className={`grid size-11 place-items-center cursor-pointer rounded-full transition ${
                                showChatMenu
                                ? 'bg-primary text-inverse'
                                : 'text-muted hover:bg-secondary hover:text-text'
                              }`}
                              aria-label={t('messages.conversationDetails')}
                              title={t('messages.conversationDetails')}
                            >
                              <InfoIcon />
                            </button>

                            {showChatMenu ? (
                              <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-[280px] rounded-[24px] border border-border bg-card p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                                <div className="flex items-center gap-3 rounded-[20px] bg-secondary p-3">
                                  <UserAvatar
                                    user={activePeer}
                                    className="size-12 shrink-0 bg-primary text-inverse"
                                    textClassName="text-sm font-semibold"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-text">
                                      <span className="flex items-center gap-1">{getFullName(activePeer)} <VerifiedBadge user={activePeer} size="xs" /></span>
                                    </p>
                                    <p className="truncate text-xs text-muted">
                                      @{activePeer.username}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 space-y-2 text-sm text-muted">
                                  <div className="rounded-[18px] border border-border px-3 py-2">
                                    {t('messages.lastMessage')}{' '}
                                    <span className="font-medium text-text">
                                      {activeConversation?.lastMessageAt
                                        ? formatClockTime(activeConversation.lastMessageAt)
                                        : '--:--'}
                                    </span>
                                  </div>
                                  <div className="rounded-[18px] border border-border px-3 py-2">
                                    {t('messages.visibleMessages')}{' '}
                                    <span className="font-medium text-text">
                                      {matchedMessagesCount}
                                    </span>
                                  </div>
                                  <Link
                                    to={`/${lang}/u/${activePeer.username}`}
                                    className="flex items-center justify-between rounded-[18px] px-3 py-2 transition hover:bg-secondary"
                                    onClick={() => setShowChatMenu(false)}
                                  >
                                    <span>{t('messages.viewProfile')}</span>
                                    <span className="text-zinc-400">→</span>
                                  </Link>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {showMessageSearch ? (
                          <div className="rounded-[22px] border border-border bg-secondary px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-soft">
                                <SearchIcon />
                              </span>
                              <input
                                autoFocus
                                type="text"
                                value={messageSearchValue}
                                onChange={(event) => setMessageSearchValue(event.target.value)}
                                placeholder={t('messages.searchThisConversation')}
                                className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
                              />
                              <span className="text-[11px] text-soft">
                                {matchedMessagesCount}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted">
                      {t('messages.selectConversation')}
                    </div>
                  )}
                </div>

                <div
                  ref={messagesViewportRef}
                  onScroll={handleMessagesScroll}
                  className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 ${isMobileViewport ? 'pb-4' : ''}`}
                  style={mobileMessagesViewportStyle}
                >
                  {hasMoreMessages ? (
                    <div className="flex justify-center pb-3">
                      <button
                        type="button"
                        onClick={handleLoadOlderMessages}
                        disabled={isLoadingOlderMessages}
                        className="rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-medium text-muted transition hover:bg-card hover:text-text disabled:opacity-50"
                      >
                        {isLoadingOlderMessages
                          ? t('messages.loadingOlderMessages')
                          : t('messages.loadOlderMessages')}
                      </button>
                    </div>
                  ) : null}

                  {messagesState.error ? (
                    <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30">
                      {messagesState.error}
                    </div>
                  ) : null}

                  {messagesState.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={`message-skeleton-${index}`}
                          className={`h-16 animate-pulse rounded-[24px] ${
                            index % 2 === 0
                              ? 'mr-auto w-[72%] bg-white dark:bg-zinc-900'
                              : 'ml-auto w-[60%] bg-zinc-200 dark:bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}

                  {!messagesState.isLoading && !messagesState.items.length && activePeer ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="max-w-sm rounded-lg border border-border bg-card px-5 py-6 text-center text-sm text-muted">
                        {t('messages.emptyChat')}
                      </div>
                    </div>
                  ) : null}

                  {!messagesState.isLoading &&
                  Boolean(messageSearchValue.trim()) &&
                  !filteredMessages.length ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="max-w-sm rounded-lg border border-border bg-card px-5 py-6 text-center text-sm text-muted">
                        {t('messages.noSearchResults')}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    {filteredMessages.map((message) => {
                      const isMine =
                        message.sender?.toString?.() === user.id || message.sender === user.id

                      return (
                        <MessageBubble
                          key={message._id || `${message.sender}-${message.createdAt}`}
                          message={message}
                          isMine={isMine}
                          isMenuOpen={openMessageMenuId === (message._id || message.id)}
                          isEditing={editingMessageId === (message._id || message.id)}
                          editingText={editingMessageText}
                          isHighlighted={highlightedMessageId === (message._id || message.id)}
                          activePeer={activePeer}
                          user={user}
                          onEditChange={setEditingMessageText}
                          onEditCancel={handleCancelEditMessage}
                          onEditSave={() => handleSaveEditedMessage(message)}
                          onOpenMenu={() =>
                            setOpenMessageMenuId((current) =>
                              current === (message._id || message.id)
                                ? ''
                                : message._id || message.id,
                            )
                          }
                          onCopy={() => handleCopyMessage(message)}
                          onReply={() => handleStartReply(message)}
                          onDelete={() => handleDeleteMessage(message)}
                          onStartEdit={() => handleStartEditMessage(message)}
                          onReport={setReportTarget}
                          onScrollToMessage={handleScrollToMessage}
                          onToggleReaction={handleToggleReaction}
                          isMobileViewport={isMobileViewport}
                          t={t}
                          onOpenMedia={(items, index) =>
                            setLightboxMedia({
                              items,
                              index,
                            })
                          }
                        />
                      )
                    })}

                    {isPeerTyping ? (
                      <div className="flex items-end gap-2 justify-start transition-all duration-300">
                        <UserAvatar
                          user={activePeer}
                          className="size-7 shrink-0 bg-primary text-inverse"
                          textClassName="text-[10px] font-semibold"
                        />
                        <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 shadow-sm flex items-center gap-2">
                          <span className="text-xs font-medium text-text">
                            {t('messages.typing', { defaultValue: 'Yazıyor...' })}
                          </span>
                          <div className="flex items-center gap-1 py-0.5">
                            <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                            <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                            <span className="size-1.5 rounded-full bg-primary animate-bounce" />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div
                  ref={composerRef}
                  className={`border-t border-border bg-card px-4 ${
                    isMobileViewport
                      ? 'fixed inset-x-0 z-20 py-[7px]'
                      : 'py-2 md:sticky md:bottom-0'
                  }`}
                  style={mobileComposerStyle}
                >
                  {replyingToMessage ? (
                    <div className={`${isMobileViewport ? 'mx-1 mb-2 mt-1' : 'mb-2'} flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="text-primary font-semibold shrink-0">
                          <ReplyIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-text truncate block">
                            {t('messages.replyingTo', {
                              name:
                                (replyingToMessage.sender === user?.id || replyingToMessage.sender?._id === user?.id)
                                  ? t('common.you', { defaultValue: 'Siz' })
                                  : getFullName(activePeer),
                            })}
                          </span>
                          <p className="truncate text-muted text-[11px]">
                            {replyingToMessage.text || (replyingToMessage.media?.length ? `[${t('messages.mediaPreview')}]` : '')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelReply}
                        className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text shrink-0"
                        aria-label={t('messages.cancelReply')}
                        title={t('messages.cancelReply')}
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ) : null}

                  {sendError ? (
                    <div className={`${isMobileViewport ? 'mx-1 mb-2 mt-2' : 'mb-3'} rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30`}>
                      {sendError}
                    </div>
                  ) : null}
                  {isOptimizingMedia ? (
                    <div className={`${isMobileViewport ? 'mx-1 mb-2 mt-2' : 'mb-3'} rounded-2xl border border-border bg-secondary px-4 py-2 text-xs text-muted`}>
                      {t('messages.optimizingMedia')}
                    </div>
                  ) : null}

                  {isSending && messageFiles.length > 0 ? (
                    <div className={`${isMobileViewport ? 'mx-1 mb-2 mt-2' : 'mb-3'} rounded-2xl border border-border bg-secondary p-3 shadow-sm transition-all duration-300`}>
                      <div className="flex items-center justify-between text-xs font-medium text-text mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <span>{t('messages.uploadingMedia', { defaultValue: 'Medyalar yükleniyor...' })}</span>
                        </div>
                        <span className="font-semibold text-primary">%{uploadProgress}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
                          style={{ width: `${Math.max(4, uploadProgress)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {messagePreviews.length ? (
                    <div className={`${isMobileViewport ? 'absolute bottom-[calc(100%+8px)] left-2 right-2 z-10 flex overflow-x-auto rounded-[18px] border border-border bg-[rgb(var(--color-card)/0.96)] px-2 py-2 shadow-lg backdrop-blur' : 'mb-3 flex flex-wrap gap-2'}`}>
                      {messagePreviews.map((item) => (
                        <div
                          key={item.id}
                          className="relative h-16 w-16 overflow-hidden rounded-[16px] border border-border bg-secondary"
                        >
                          {item.type === 'video' ? (
                            <video
                              src={item.url}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={item.url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          )}
                          {isSending ? (
                            <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-[1px]">
                              <span className="text-[11px] font-bold text-white">%{uploadProgress}</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => removePreview(item.id)}
                              className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/72 text-white transition hover:bg-black/85"
                              aria-label={t('messages.removeMedia')}
                              title={t('messages.removeMedia')}
                            >
                              <CloseIcon />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className={`rounded-lg border border-border bg-secondary shadow-sm transition mb-2 focus-within:border-border-strong focus-within:bg-card ${isMobileViewport ? 'min-h-[46px] px-3 py-0' : 'px-3 py-0'}`}>
                    <div className="flex min-h-[42px] items-end gap-2">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleSelectImages}
                        className="hidden"
                      />
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleSelectVideo}
                        className="hidden"
                      />

                      <div className="relative flex items-center gap-1 pb-1" data-attachment-menu-shell="true">
                        <button
                          type="button"
                          onClick={() => setShowAttachmentMenu((current) => !current)}
                          disabled={!activePeer || isSending || isOptimizingMedia || isRecordingVoice}
                          className={`grid place-items-center rounded-full text-muted transition hover:bg-secondary-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40 ${
                            isMobileViewport ? 'size-8' : 'size-11'
                          }`}
                          aria-label={t('messages.addMedia')}
                          title={t('messages.addMedia')}
                        >
                          <PlusIcon />
                        </button>

                        {showAttachmentMenu ? (
                          <div className="absolute bottom-[calc(100%+10px)] left-0 z-20 w-[180px] overflow-hidden rounded-[20px] border border-border bg-card py-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAttachmentMenu(false)
                                imageInputRef.current?.click()
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                            >
                              <PhotoIcon />
                              <span>{t('messages.photo')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAttachmentMenu(false)
                                videoInputRef.current?.click()
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                            >
                              <VideoIcon />
                              <span>{t('messages.video')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAttachmentMenu(false)
                                startVoiceRecording()
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text transition hover:bg-secondary"
                            >
                              <MicrophoneIcon />
                              <span>{t('messages.voiceMessage', { defaultValue: 'Sesli mesaj' })}</span>
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {isRecordingVoice ? (
                        <div className="flex flex-1 items-center justify-between gap-2 py-1.5 min-h-[42px] px-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="relative flex size-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                              <span className="relative inline-flex rounded-full size-3 bg-rose-500" />
                            </span>
                            <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                              {formatVoiceDuration(recordingDuration)}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-0.5 rounded-full bg-rose-500/60 animate-pulse" />
                              <span className="h-4 w-0.5 rounded-full bg-rose-500 animate-pulse [animation-delay:-0.2s]" />
                              <span className="h-3 w-0.5 rounded-full bg-rose-500/80 animate-pulse [animation-delay:-0.4s]" />
                              <span className="h-5 w-0.5 rounded-full bg-rose-500 animate-pulse" />
                              <span className="h-2.5 w-0.5 rounded-full bg-rose-500/70 animate-pulse [animation-delay:-0.1s]" />
                            </div>
                            <span className="text-xs text-muted truncate hidden sm:inline">
                              {t('messages.recordingVoice', { defaultValue: 'Ses kaydediliyor...' })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={cancelVoiceRecording}
                              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title={t('messages.cancelRecording', { defaultValue: 'İptal' })}
                            >
                              <TrashIcon className="size-3.5" />
                              <span className="hidden sm:inline">{t('messages.cancelRecording', { defaultValue: 'İptal' })}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => stopVoiceRecording(true)}
                              className="grid size-8 place-items-center rounded-full bg-primary text-inverse shadow-md shadow-primary/25 hover:bg-primary-hover active:scale-95 transition cursor-pointer"
                              title={t('messages.sendVoice', { defaultValue: 'Gönder' })}
                            >
                              <SendIcon className="size-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <textarea
                            ref={textareaRef}
                            rows={1}
                            value={messageDraft}
                            onChange={handleDraftChange}
                            onKeyDown={handleMessageKeyDown}
                            disabled={!activePeer || isOptimizingMedia}
                            placeholder={t('messages.placeholder')}
                            className={`max-h-[140px] flex-1 resize-none overflow-y-auto bg-transparent px-2 text-sm leading-6 text-text outline-none placeholder:text-muted disabled:cursor-not-allowed ${
                              isMobileViewport ? 'min-h-[24px] py-[10px]' : 'min-h-[44px] py-2'
                            }`}
                          />

                          {!messageDraft.trim() && !messageFiles.length ? (
                            <button
                              type="button"
                              onClick={startVoiceRecording}
                              disabled={!activePeer || isSending || isOptimizingMedia}
                              className={`grid place-items-center rounded-full transition-all duration-200 bg-secondary text-text hover:bg-primary hover:text-inverse cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                                isMobileViewport ? 'size-9 mb-1' : 'size-10 mb-1'
                              }`}
                              aria-label={t('messages.recordVoice', { defaultValue: 'Sesli mesaj kaydet' })}
                              title={t('messages.recordVoice', { defaultValue: 'Sesli mesaj kaydet' })}
                            >
                              <MicrophoneIcon className={isMobileViewport ? 'size-4.5' : 'size-5'} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onPointerDown={(event) => {
                                if (isMobileViewport) {
                                  event.preventDefault()
                                }
                              }}
                              onMouseDown={(event) => {
                                if (isMobileViewport) {
                                  event.preventDefault()
                                }
                              }}
                              onTouchStart={(event) => {
                                if (isMobileViewport) {
                                  event.preventDefault()
                                }
                              }}
                              onClick={handleSendMessage}
                              disabled={
                                !activePeer ||
                                isSending ||
                                isOptimizingMedia ||
                                (!messageDraft.trim() && !messageFiles.length)
                              }
                              className={`grid place-items-center rounded-full transition-all duration-200 ${
                                !activePeer ||
                                isSending ||
                                isOptimizingMedia ||
                                (!messageDraft.trim() && !messageFiles.length)
                                  ? 'cursor-not-allowed bg-secondary-hover text-soft opacity-60'
                                  : 'bg-primary text-inverse shadow-md shadow-primary/25 hover:scale-105 active:scale-95 hover:bg-primary-hover'
                              } ${isMobileViewport ? 'size-9 mb-1' : 'size-10 mb-1'}`}
                              aria-label={t('messages.sendMessage')}
                              title={t('messages.sendMessage')}
                            >
                              <SendIcon className={isMobileViewport ? 'size-4.5' : 'size-5'} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            ) : null}
          </div>
        </section>
      </SocialLayout>

      <ReportDialog
        open={Boolean(reportTarget)}
        targetKind={reportTarget?.kind}
        targetId={reportTarget?.id}
        title={t('messages.reportMessage')}
        onClose={() => setReportTarget(null)}
      />
      <MediaLightbox
        items={lightboxMedia?.items || []}
        activeIndex={lightboxMedia?.index || 0}
        onClose={() => setLightboxMedia(null)}
        onNavigate={handleNavigateLightbox}
        t={t}
      />
      <ActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

export default MessagesPage
