import { useState, useEffect } from 'react'

export const MESSAGE_IMAGE_MAX_BYTES = 1.2 * 1024 * 1024
export const MESSAGE_VIDEO_MAX_BYTES = 12 * 1024 * 1024
export const QUICK_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥']

export function getConversationPeer(conversation) {
  return conversation?.participants?.[0] || null
}

export function findConversationIdForPeer(conversations, target) {
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

export function createPreviewItems(files) {
  return files.map((file) => ({
    id: `${file.name}-${file.lastModified}`,
    url: URL.createObjectURL(file),
    type: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
  }))
}

export function useIsMobileViewport() {
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

export function formatPresence(lastLoginAt, t, lang = 'tr') {
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

export function renderFormattedMessageText(text = '', isMine = false) {
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
