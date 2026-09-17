export const MAX_IMAGE_FILES = 4
export const COMPOSER_TEXTAREA_MIN_HEIGHT = 96
export const COMPOSER_TEXTAREA_MAX_HEIGHT = 260
export const POST_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024
export const POST_VIDEO_MAX_BYTES = 18 * 1024 * 1024
export const LOOP_VIDEO_MAX_BYTES = 100 * 1024 * 1024
export const LOOP_VIDEO_MAX_DURATION_SECONDS = 90
export const STORY_VIDEO_MAX_DURATION_SECONDS = 15
export const STORY_MENTION_PATTERN = /^[\p{L}\p{N}_]{3,40}$/u
export const TITLE_MAX_LENGTH = 80

export function logUploadPerf(payload) {
  try {
    console.info('[upload-perf]', JSON.stringify(payload))
  } catch {
    console.info('[upload-perf]', payload)
  }
}

export function createPreviewItems(files, posters = new Map()) {
  return files.map((file) => ({
    id: `${file.name}-${file.lastModified}`,
    url: URL.createObjectURL(file),
    posterUrl: posters.get(`${file.name}-${file.lastModified}`) || '',
    type: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
  }))
}

export function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = Number(video.duration || 0)
      URL.revokeObjectURL(objectUrl)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Video bilgileri okunamadi.'))
    }
    video.src = objectUrl
  })
}

export function syncTextareaHeight(element, minHeight = COMPOSER_TEXTAREA_MIN_HEIGHT) {
  if (!element) {
    return
  }

  element.style.height = 'auto'
  const nextHeight = Math.max(element.scrollHeight, minHeight)
  element.style.height = `${nextHeight}px`
  element.style.overflowY = 'hidden'
}

export function parseDelimitedValues(value = '') {
  return [...new Set(`${value}`.split(',').map((item) => item.trim()).filter(Boolean))]
}

export function getTextareaMinHeight(isMobileFullscreen = false) {
  return isMobileFullscreen ? 140 : COMPOSER_TEXTAREA_MIN_HEIGHT
}

export function getCurrentScheduleDefaults() {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset()
  const localNow = new Date(now.getTime() - timezoneOffset * 60 * 1000)
  const isoString = localNow.toISOString()

  return {
    date: isoString.slice(0, 10),
    time: isoString.slice(11, 16),
  }
}

export function triggerNativePicker(input) {
  if (!input) {
    return
  }

  if (typeof input.showPicker === 'function') {
    input.showPicker()
    return
  }

  input.focus()
  input.click()
}

export function normalizeTopicValue(value = '') {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, '')
}

export function getActiveTokenContext(text = '', caretPosition = 0) {
  const safeCaret = Math.max(0, Math.min(caretPosition, text.length))
  let tokenStart = safeCaret - 1

  while (tokenStart >= 0 && !/\s/u.test(text[tokenStart])) {
    tokenStart -= 1
  }

  tokenStart += 1

  let tokenEnd = safeCaret

  while (tokenEnd < text.length && !/\s/u.test(text[tokenEnd])) {
    tokenEnd += 1
  }

  const token = text.slice(tokenStart, tokenEnd)
  const trigger = token[0]

  if (!['#', '@'].includes(trigger) || !/^[#@][\p{L}\p{N}_]*$/u.test(token)) {
    return null
  }

  return {
    trigger,
    query: token.slice(1),
    start: tokenStart,
    end: tokenEnd,
  }
}

export function measureSuggestionAnchor(textarea, value, caretPosition) {
  if (!textarea || typeof window === 'undefined') {
    return { left: 16, top: 112, width: 320 }
  }

  const computed = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  const textareaRect = textarea.getBoundingClientRect()
  const paddingLeft = Number.parseFloat(computed.paddingLeft || '0')
  const paddingTop = Number.parseFloat(computed.paddingTop || '0')
  const lineHeight = Number.parseFloat(computed.lineHeight || '28')

  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordBreak = 'break-word'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.font = computed.font
  mirror.style.letterSpacing = computed.letterSpacing
  mirror.style.lineHeight = computed.lineHeight
  mirror.style.padding = computed.padding
  mirror.style.width = `${textareaRect.width}px`
  mirror.style.border = computed.border
  mirror.style.boxSizing = computed.boxSizing
  mirror.style.left = '-9999px'
  mirror.style.top = '0'
  mirror.textContent = value.slice(0, caretPosition)
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const markerLeft = marker.offsetLeft
  const markerTop = marker.offsetTop
  document.body.removeChild(mirror)

  const popupWidth = Math.min(320, window.innerWidth - 32)
  const popupEstimatedHeight = 260

  let left = textareaRect.left + paddingLeft + markerLeft
  if (left + popupWidth > window.innerWidth - 16) {
    left = Math.max(16, window.innerWidth - popupWidth - 16)
  }
  if (left < 16) {
    left = 16
  }

  let top = textareaRect.top + paddingTop + markerTop + lineHeight + 6
  if (top + popupEstimatedHeight > window.innerHeight - 16) {
    const topAbove = textareaRect.top + paddingTop + markerTop - popupEstimatedHeight - 6
    if (topAbove > 16) {
      top = topAbove
    }
  }

  return { left, top, width: popupWidth }
}
