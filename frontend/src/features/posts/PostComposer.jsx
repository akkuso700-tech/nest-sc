import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getFullName } from '../../utils/social.js'
import { resolveMediaUrl } from '../../utils/media.js'
import { getTrendingTopics, uploadLoopVideoDirect } from '../../services/postsService.js'
import { searchUsers } from '../../services/usersService.js'
import { getConversations } from '../../services/messagesService.js'
import UserAvatar from '../../components/common/UserAvatar.jsx'
import { compressImageToFile, formatBytes } from '../../utils/imageUpload.js'
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from '../../hooks/useMediaQuery.js'
import {
  CalendarIcon,
  ChevronDownIcon,
  PhotoIcon,
  PostTypeIcon,
  StoryIcon,
  VideoIcon,
} from './PostComposerIcons.jsx'

const MAX_IMAGE_FILES = 4
const COMPOSER_TEXTAREA_MIN_HEIGHT = 92
const COMPOSER_TEXTAREA_MAX_HEIGHT = 92
const POST_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024
const POST_VIDEO_MAX_BYTES = 18 * 1024 * 1024
const LOOP_VIDEO_MAX_BYTES = 100 * 1024 * 1024
const LOOP_VIDEO_MAX_DURATION_SECONDS = 90
const STORY_VIDEO_MAX_DURATION_SECONDS = 15
const STORY_MENTION_PATTERN = /^[\p{L}\p{N}_]{3,40}$/u
const TITLE_MAX_LENGTH = 80

function logUploadPerf(payload) {
  try {
    console.info('[upload-perf]', JSON.stringify(payload))
  } catch {
    console.info('[upload-perf]', payload)
  }
}

function createPreviewItems(files) {
  return files.map((file) => ({
    id: `${file.name}-${file.lastModified}`,
    url: URL.createObjectURL(file),
    type: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
  }))
}

function readVideoDuration(file) {
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

function syncTextareaHeight(element, maxHeight = COMPOSER_TEXTAREA_MAX_HEIGHT) {
  if (!element) {
    return
  }

  element.style.height = `${COMPOSER_TEXTAREA_MIN_HEIGHT}px`
  const nextHeight = Math.min(
    Math.max(element.scrollHeight, COMPOSER_TEXTAREA_MIN_HEIGHT),
    maxHeight,
  )
  element.style.height = `${nextHeight}px`
  element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function parseDelimitedValues(value = '') {
  return [...new Set(`${value}`.split(',').map((item) => item.trim()).filter(Boolean))]
}

function getTextareaMaxHeight(isMobileFullscreen = false) {
  if (!isMobileFullscreen || typeof window === 'undefined') {
    return COMPOSER_TEXTAREA_MAX_HEIGHT
  }

  return Math.max(220, window.innerHeight - 260)
}

function getCurrentScheduleDefaults() {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset()
  const localNow = new Date(now.getTime() - timezoneOffset * 60 * 1000)
  const isoString = localNow.toISOString()

  return {
    date: isoString.slice(0, 10),
    time: isoString.slice(11, 16),
  }
}

function triggerNativePicker(input) {
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

function normalizeTopicValue(value = '') {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, '')
}

function getActiveTokenContext(text = '', caretPosition = 0) {
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

function renderHighlightedDraft(text = '') {
  if (!text) {
    return '\u200b'
  }

  const parts = text.split(/(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_]+)/gu)

  return parts.map((part, index) => {
    if (!part) {
      return null
    }

    const isTag = /^(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_]+)$/u.test(part)

    return (
      <Fragment key={`${part}-${index}`}>
        {isTag ? <span className="font-medium text-primary">{part}</span> : part}
      </Fragment>
    )
  })
}

function measureSuggestionAnchor(textarea, value, caretPosition) {
  if (!textarea || typeof window === 'undefined') {
    return { left: 0, top: 112 }
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

  const left = Math.min(
    Math.max(marker.offsetLeft + paddingLeft, 0),
    Math.max(textareaRect.width - 240, 0),
  )
  const top = marker.offsetTop + paddingTop + lineHeight + 6 - textarea.scrollTop

  document.body.removeChild(mirror)

  return {
    left,
    top: Math.max(top, lineHeight + 10),
  }
}

function PostComposer({
  user,
  onSubmit,
  isSubmitting = false,
  defaultExpanded = false,
  hideCollapsed = false,
  initialMediaIntent = '',
  initialComposerType = '',
  allowStoryOption = true,
  allowLoopOption = true,
  onExpandedChange = null,
  groupName = '',
  groupCoverImageUrl = '',
}) {
  const { t } = useTranslation()
  const composerRef = useRef(null)
  const plannerRef = useRef(null)
  const privacyMenuRef = useRef(null)
  const dismissMenuRef = useRef(null)
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const textareaRef = useRef(null)
  const highlightScrollRef = useRef(null)
  const dateInputRef = useRef(null)
  const timeInputRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [title, setTitle] = useState('')
  const [privacy, setPrivacy] = useState('public')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [publishToLoop, setPublishToLoop] = useState(false)
  const [composerType, setComposerType] = useState(() => {
    if (allowStoryOption && `${initialComposerType || ''}`.trim().toLowerCase() === 'story') {
      return 'story'
    }

    return 'post'
  })
  const [previewItems, setPreviewItems] = useState([])
  const [submitError, setSubmitError] = useState('')
  const [isOptimizingMedia, setIsOptimizingMedia] = useState(false)
  const [isExpanded, setIsExpanded] = useState(Boolean(defaultExpanded))
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false)
  const [showDismissMenu, setShowDismissMenu] = useState(false)
  const [showPlanner, setShowPlanner] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [directUploadProgress, setDirectUploadProgress] = useState(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [storyMusicTitle, setStoryMusicTitle] = useState('')
  const [storyMusicArtist, setStoryMusicArtist] = useState('')
  const [storyStickerText, setStoryStickerText] = useState('')
  const [storyMentionText, setStoryMentionText] = useState('')
  const [storyLinkUrl, setStoryLinkUrl] = useState('')
  const [storyLinkLabel, setStoryLinkLabel] = useState('')
  const [trendSuggestions, setTrendSuggestions] = useState([])
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [recentConversationUsernames, setRecentConversationUsernames] = useState([])
  const [tokenContext, setTokenContext] = useState(null)
  const [suggestionPosition, setSuggestionPosition] = useState({ left: 0, top: 112 })
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const isMobileViewport = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const [mobileKeyboardInset, setMobileKeyboardInset] = useState(0)
  const [openVideoOnExpand, setOpenVideoOnExpand] = useState(false)
  const isStoryComposer = composerType === 'story'
  const isMobileFullscreen = isExpanded && isMobileViewport
  const isDesktopModal = isExpanded && !isMobileViewport
  const isOverlayComposer = isMobileFullscreen || isDesktopModal
  const hasVideoSelection = selectedFiles.some((file) => file.type.startsWith('video/'))
  const isGroupComposer = Boolean(`${groupName || ''}`.trim())
  const resolvedGroupCoverUrl = resolveMediaUrl(groupCoverImageUrl || '')
  const handledMobileMediaIntentRef = useRef('')
  const isDirectUploading = Number.isFinite(directUploadProgress)
  const isComposerBusy = isSubmitting || isOptimizingMedia || isDirectUploading

  useEffect(() => {
    syncTextareaHeight(textareaRef.current, getTextareaMaxHeight(isMobileFullscreen))
  }, [draft, isExpanded, isMobileFullscreen])

  useEffect(
    () => () => {
      previewItems.forEach((item) => URL.revokeObjectURL(item.url))
    },
    [previewItems],
  )

  useEffect(() => {
    if (!isExpanded) {
      return
    }

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      syncTextareaHeight(textareaRef.current, getTextareaMaxHeight(isMobileFullscreen))
    })
  }, [isExpanded, isMobileFullscreen])

  useEffect(() => {
    if (defaultExpanded) {
      setIsExpanded(true)
    }
  }, [defaultExpanded])

  useEffect(() => {
    if (typeof onExpandedChange === 'function') {
      onExpandedChange(isExpanded)
    }
  }, [isExpanded, onExpandedChange])

  useEffect(() => {
    if (!isOverlayComposer || typeof document === 'undefined') {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOverlayComposer])

  useEffect(() => {
    if (!isExpanded || !openVideoOnExpand) {
      return
    }

    setOpenVideoOnExpand(false)
    requestAnimationFrame(() => {
      videoInputRef.current?.click()
    })
  }, [isExpanded, openVideoOnExpand])

  useEffect(() => {
    if (!isMobileFullscreen || typeof window === 'undefined' || !window.visualViewport) {
      setMobileKeyboardInset(0)
      return undefined
    }

    const viewport = window.visualViewport
    const syncKeyboardInset = () => {
      const inset = Math.max(
        0,
        Math.round(window.innerHeight - (viewport.height + viewport.offsetTop)),
      )
      setMobileKeyboardInset(inset)
    }

    syncKeyboardInset()
    viewport.addEventListener('resize', syncKeyboardInset)
    viewport.addEventListener('scroll', syncKeyboardInset)

    return () => {
      viewport.removeEventListener('resize', syncKeyboardInset)
      viewport.removeEventListener('scroll', syncKeyboardInset)
      setMobileKeyboardInset(0)
    }
  }, [isMobileFullscreen])

  useEffect(() => {
    const normalizedType = `${initialComposerType || ''}`.trim().toLowerCase()
    if (allowStoryOption && normalizedType === 'story') {
      setComposerType('story')
      setPublishToLoop(false)
      return
    }

    if (normalizedType === 'post') {
      setComposerType('post')
    }
  }, [allowStoryOption, initialComposerType])

  useEffect(() => {
    if (!allowLoopOption) {
      setPublishToLoop(false)
    }
  }, [allowLoopOption])

  useEffect(() => {
    const normalizedIntent = `${initialMediaIntent || ''}`.trim().toLowerCase()

    if (!normalizedIntent) {
      handledMobileMediaIntentRef.current = ''
      return
    }

    if (!isMobileFullscreen || normalizedIntent !== 'video') {
      return
    }

    if (handledMobileMediaIntentRef.current === normalizedIntent) {
      return
    }

    handledMobileMediaIntentRef.current = normalizedIntent
    requestAnimationFrame(() => {
      videoInputRef.current?.click()
    })
  }, [initialMediaIntent, isMobileFullscreen])

  useEffect(() => {
    if (!showPlanner || (scheduledDate && scheduledTime)) {
      return
    }

    const defaults = getCurrentScheduleDefaults()
    setScheduledDate(defaults.date)
    setScheduledTime(defaults.time)
  }, [scheduledDate, scheduledTime, showPlanner])

  const handleComposerOverlayClose = useCallback(() => {
    if (title.trim() || draft.trim() || selectedFiles.length) {
      setShowDismissMenu(true)
      return
    }

    setShowDismissMenu(false)
    setShowPlanner(false)
    setShowPrivacyMenu(false)
    setIsExpanded(false)
  }, [draft, selectedFiles.length, title])

  useEffect(() => {
    if (!isDesktopModal || typeof document === 'undefined') {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleComposerOverlayClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleComposerOverlayClose, isDesktopModal])

  useEffect(() => {
    function handlePointerDown(event) {
      const clickedInsideComposer = composerRef.current?.contains(event.target)
      const clickedInsidePlanner = plannerRef.current?.contains(event.target)
      const clickedInsidePrivacyMenu = privacyMenuRef.current?.contains(event.target)
      const clickedInsideDismissMenu = dismissMenuRef.current?.contains(event.target)

      if (!clickedInsidePrivacyMenu) {
        setShowPrivacyMenu(false)
      }

      if (!clickedInsideDismissMenu) {
        setShowDismissMenu(false)
      }

      if (clickedInsideComposer || clickedInsidePlanner || clickedInsidePrivacyMenu || clickedInsideDismissMenu) {
        return
      }

      setShowPlanner(false)

      if (!title.trim() && !draft.trim() && !selectedFiles.length) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [draft, selectedFiles.length, title])

  useEffect(() => {
    if (!isExpanded || trendSuggestions.length) {
      return
    }

    let cancelled = false

    async function loadTrendSuggestions() {
      try {
        const payload = await getTrendingTopics({ limit: 20 })

        if (cancelled) {
          return
        }

        setTrendSuggestions(payload.topics || [])
      } catch {
        if (!cancelled) {
          setTrendSuggestions([])
        }
      }
    }

    loadTrendSuggestions()

    return () => {
      cancelled = true
    }
  }, [isExpanded, trendSuggestions.length])

  useEffect(() => {
    if (!isExpanded || recentConversationUsernames.length || !user) {
      return
    }

    let cancelled = false

    async function loadRecentConversations() {
      try {
        const payload = await getConversations(12)

        if (cancelled) {
          return
        }

        const usernames = (payload.conversations || [])
          .map((conversation) => conversation.otherParticipant?.username || conversation.recipient?.username)
          .filter(Boolean)

        setRecentConversationUsernames([...new Set(usernames)])
      } catch {
        if (!cancelled) {
          setRecentConversationUsernames([])
        }
      }
    }

    loadRecentConversations()

    return () => {
      cancelled = true
    }
  }, [isExpanded, recentConversationUsernames.length, user])

  useEffect(() => {
    if (tokenContext?.trigger !== '@') {
      setMentionSuggestions([])
      return
    }

    let cancelled = false
    const timeoutId = setTimeout(async () => {
      try {
        const payload = await searchUsers(tokenContext.query, 6)

        if (!cancelled) {
          setMentionSuggestions(payload.users || [])
        }
      } catch {
        if (!cancelled) {
          setMentionSuggestions([])
        }
      }
    }, 120)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [tokenContext?.query, tokenContext?.trigger])

  const activeSuggestions = useMemo(() => {
    if (!tokenContext || tokenContext.query.length < 2) {
      return []
    }

    if (tokenContext.trigger === '#') {
      const normalizedQuery = normalizeTopicValue(tokenContext.query)

      return trendSuggestions
        .filter((trend) => {
          const normalizedLabel = normalizeTopicValue(trend.label.replace(/^#/, ''))

          if (!normalizedQuery) {
            return true
          }

          return normalizedLabel.startsWith(normalizedQuery)
        })
        .slice(0, 6)
        .map((trend) => ({
          kind: 'hashtag',
          key: trend.key || trend.label,
          label: trend.label,
          meta: t('composer.trendPostCount', {
            count: trend.postCount,
            defaultValue: '{{count}} posts',
          }),
        }))
    }

    return [...mentionSuggestions]
      .sort((left, right) => {
        const leftIsFollowing = left.viewerState?.isFollowing ? 1 : 0
        const rightIsFollowing = right.viewerState?.isFollowing ? 1 : 0

        if (rightIsFollowing !== leftIsFollowing) {
          return rightIsFollowing - leftIsFollowing
        }

        const leftRecentIndex = recentConversationUsernames.indexOf(left.username)
        const rightRecentIndex = recentConversationUsernames.indexOf(right.username)
        const leftHasRecent = leftRecentIndex === -1 ? Number.POSITIVE_INFINITY : leftRecentIndex
        const rightHasRecent = rightRecentIndex === -1 ? Number.POSITIVE_INFINITY : rightRecentIndex

        if (leftHasRecent !== rightHasRecent) {
          return leftHasRecent - rightHasRecent
        }

        return (left.username || '').localeCompare(right.username || '')
      })
      .map((mentionedUser) => ({
        kind: 'mention',
        key: mentionedUser.id || mentionedUser._id || mentionedUser.username,
        label: `@${mentionedUser.username}`,
        meta: getFullName(mentionedUser),
        user: mentionedUser,
        badge: mentionedUser.viewerState?.isFollowing
          ? 'Takipte'
          : recentConversationUsernames.includes(mentionedUser.username)
            ? 'Son sohbet'
            : 'Kullanici',
      }))
  }, [mentionSuggestions, recentConversationUsernames, t, tokenContext, trendSuggestions])

  useEffect(() => {
    setActiveSuggestionIndex(0)
  }, [activeSuggestions.length, tokenContext?.query, tokenContext?.trigger])

  function syncTokenContext(value, caretPosition = textareaRef.current?.selectionStart || 0) {
    const nextContext = getActiveTokenContext(value, caretPosition)
    setTokenContext(nextContext)

    if (!nextContext || nextContext.query.length < 2) {
      return
    }

    setSuggestionPosition(measureSuggestionAnchor(textareaRef.current, value, caretPosition))
  }

  function replaceFiles(nextFiles) {
    const includesVideo = nextFiles.some((file) => file.type.startsWith('video/'))
    previewItems.forEach((item) => URL.revokeObjectURL(item.url))
    setSelectedFiles(nextFiles)
    setPreviewItems(createPreviewItems(nextFiles))
    if (isStoryComposer) {
      setPublishToLoop(false)
      return
    }

    setPublishToLoop(allowLoopOption ? includesVideo : false)
  }

  function resetComposer() {
    setTitle('')
    setDraft('')
    setPrivacy('public')
    replaceFiles([])
    setSubmitError('')
    setSubmitSuccess('')
    setShowPlanner(false)
    setShowPrivacyMenu(false)
    setShowDismissMenu(false)
    setIsExpanded(false)
    const defaults = getCurrentScheduleDefaults()
    setScheduledDate(defaults.date)
    setScheduledTime(defaults.time)
    setTokenContext(null)
    setPublishToLoop(false)
    setStoryMusicTitle('')
    setStoryMusicArtist('')
    setStoryStickerText('')
    setStoryMentionText('')
    setStoryLinkUrl('')
    setStoryLinkLabel('')
    setComposerType(
      allowStoryOption && `${initialComposerType || ''}`.trim().toLowerCase() === 'story'
        ? 'story'
        : 'post',
    )
  }

  function handleExpand() {
    setIsExpanded(true)
    setSubmitSuccess('')
  }

  function handleCollapsedAction(action) {
    if (action === 'loopVideo') {
      setComposerType('post')
      setPublishToLoop(Boolean(allowLoopOption))
      setOpenVideoOnExpand(true)
      setIsExpanded(true)
      setSubmitSuccess('')
      return
    }

    if (action === 'post') {
      setComposerType('post')
      handleExpand()
      return
    }

    if (action === 'story' && allowStoryOption) {
      setComposerType('story')
      setIsExpanded(true)
      setSubmitSuccess('')
    }
  }

  function handleDismissChoice(choice) {
    if (choice === 'discard') {
      resetComposer()
      return
    }

    setShowDismissMenu(false)
  }

  function applySuggestion(suggestion) {
    if (!tokenContext || !suggestion) {
      return
    }

    const nextToken =
      suggestion.kind === 'mention'
        ? `@${suggestion.user?.username || suggestion.label.replace(/^@/, '')}`
        : suggestion.label.startsWith('#')
          ? suggestion.label
          : `#${suggestion.label}`
    const nextValue = `${draft.slice(0, tokenContext.start)}${nextToken} ${draft.slice(tokenContext.end)}`
    const nextCaretPosition = tokenContext.start + nextToken.length + 1

    setDraft(nextValue)
    setTokenContext(null)

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition)
      syncTextareaHeight(textareaRef.current, getTextareaMaxHeight(isMobileFullscreen))
    })
  }

  async function handleImageSelection(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''

    if (!files.length) {
      return
    }

    if (!isStoryComposer && selectedFiles.some((file) => file.type.startsWith('video/'))) {
      setSubmitError('You can upload either up to 4 images or 1 video.')
      return
    }

    if (files.some((file) => !file.type.startsWith('image/'))) {
      setSubmitError('Only image files can be added here.')
      return
    }

    if (!isStoryComposer && selectedFiles.length + files.length > MAX_IMAGE_FILES) {
      setSubmitError(
        t('composer.postMaxImagesError', {
          defaultValue: 'You can upload up to 4 images in a post.',
        }),
      )
      return
    }

    setIsOptimizingMedia(true)
    setSubmitError('')

    try {
      const filesToOptimize = isStoryComposer ? files.slice(0, 1) : files
      const optimizedFiles = await Promise.all(
        filesToOptimize.map((file) =>
          compressImageToFile(file, {
            maxWidth: 1440,
            maxHeight: 1440,
            quality: 0.74,
            type: 'image/webp',
            maxBytes: POST_IMAGE_MAX_BYTES,
            fileNamePrefix: 'post',
          }),
        ),
      )

      setIsExpanded(true)
      if (isStoryComposer) {
        replaceFiles([optimizedFiles[0]])
      } else {
        replaceFiles([...selectedFiles, ...optimizedFiles].slice(0, MAX_IMAGE_FILES))
      }
    } catch (error) {
      setSubmitError(error.message || 'Images could not be optimized.')
    } finally {
      setIsOptimizingMedia(false)
    }
  }

  async function handleVideoSelection(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''

    if (!files.length) {
      return
    }

    const [videoFile] = files

    if (!videoFile.type.startsWith('video/')) {
      setSubmitError('Only video files can be added here.')
      return
    }

    const maxVideoBytes = !isStoryComposer && allowLoopOption
      ? LOOP_VIDEO_MAX_BYTES
      : POST_VIDEO_MAX_BYTES

    if (videoFile.size > maxVideoBytes) {
      setSubmitError(
        t('composer.videoTooLargeError', {
          maxSize: formatBytes(maxVideoBytes),
          defaultValue: 'Video is too large. Max allowed: {{maxSize}}.',
        }),
      )
      return
    }

    try {
      const durationSeconds = await readVideoDuration(videoFile)
      const maxDurationSeconds = isStoryComposer
        ? STORY_VIDEO_MAX_DURATION_SECONDS
        : allowLoopOption
          ? LOOP_VIDEO_MAX_DURATION_SECONDS
          : 0
      if (maxDurationSeconds && durationSeconds > maxDurationSeconds + 0.25) {
        setSubmitError(`Video en fazla ${maxDurationSeconds} saniye olabilir.`)
        return
      }
    } catch {
      // Server-side FFmpeg validation remains authoritative.
    }

    if (!isStoryComposer && selectedFiles.length) {
      setSubmitError('Remove existing media before adding a video.')
      return
    }

    setSubmitError('')
    setIsExpanded(true)
    replaceFiles([videoFile])
  }

  function handleRemovePreview(previewId) {
    const nextFiles = selectedFiles.filter(
      (file) => `${file.name}-${file.lastModified}` !== previewId,
    )

    setSubmitError('')
    replaceFiles(nextFiles)
  }

  function handleTogglePlanner() {
    if (isStoryComposer) {
      return
    }

    setIsExpanded(true)
    setSubmitSuccess('')
    setShowPlanner((currentValue) => !currentValue)
  }

  function handlePrivacySelect(nextPrivacy) {
    setPrivacy(nextPrivacy)
    setShowPrivacyMenu(false)
  }

  function buildScheduleDateTimeValue() {
    if (!scheduledDate || !scheduledTime) {
      return null
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`)

    if (Number.isNaN(scheduledAt.getTime())) {
      return null
    }

    return scheduledAt.toISOString()
  }

  function buildStoryMetaInput() {
    if (!isStoryComposer) {
      return null
    }

    const musicTitle = storyMusicTitle.trim()
    const musicArtist = storyMusicArtist.trim()
    const stickers = parseDelimitedValues(storyStickerText).slice(0, 8)
    const mentions = parseDelimitedValues(storyMentionText)
      .map((item) => item.replace(/^@/, '').toLowerCase())
      .filter((item) => STORY_MENTION_PATTERN.test(item))
      .slice(0, 20)
    const linkUrl = storyLinkUrl.trim()
    const linkLabel = storyLinkLabel.trim()

    if (linkUrl) {
      try {
        const parsed = new URL(linkUrl)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setSubmitError('Link https:// veya http:// ile baslamali.')
          return null
        }
      } catch {
        setSubmitError('Gecerli bir link adresi gir.')
        return null
      }
    }

    const storyMeta = {}

    if (musicTitle || musicArtist) {
      storyMeta.music = {
        title: musicTitle,
        artist: musicArtist,
      }
    }

    if (stickers.length) {
      storyMeta.stickers = stickers
    }

    if (mentions.length) {
      storyMeta.mentions = mentions
    }

    if (linkUrl) {
      storyMeta.link = {
        url: linkUrl,
        label: linkLabel,
      }
    }

    return Object.keys(storyMeta).length ? storyMeta : null
  }

  async function handleSubmit(event, mode = 'publish') {
    event.preventDefault()
    const submitStartMs = Date.now()

    if (isOptimizingMedia || isDirectUploading) {
      return
    }

    if (!title.trim() && !draft.trim() && !selectedFiles.length) {
      return
    }

    if (isStoryComposer && !selectedFiles.length) {
      setSubmitError('Hikaye icin gorsel veya video secmelisin.')
      return
    }

    if (isStoryComposer && selectedFiles.length > 1) {
      setSubmitError(t('composer.storySingleMediaError', { defaultValue: 'Story can only be shared with a single media item.' }))
      return
    }

    const isScheduled = mode === 'schedule'
    const scheduledFor = isScheduled ? buildScheduleDateTimeValue() : null

    if (isScheduled && !scheduledFor) {
      setSubmitError(t('composer.scheduleDateTimeError', { defaultValue: 'Select a valid date and time for scheduling.' }))
      return
    }

    setSubmitError('')
    setSubmitSuccess('')

    const storyMeta = buildStoryMetaInput()
    if (isStoryComposer && storyLinkUrl.trim() && !storyMeta) {
      return
    }

    try {
      const contentType = isStoryComposer
        ? 'story'
        : allowLoopOption && publishToLoop
          ? 'loop'
          : 'post'

      let payload = {
        title: title.trim(),
        text: draft.trim(),
        privacy,
        contentType,
        publishMode: isScheduled ? 'schedule' : 'publish',
        scheduledFor: scheduledFor || undefined,
        ...(isStoryComposer && storyMeta ? { storyMeta } : {}),
      }

      const directLoopFile = contentType === 'loop' && selectedFiles.length === 1 && selectedFiles[0].type.startsWith('video/')
        ? selectedFiles[0]
        : null
      let directLoopUpload = null

      if (directLoopFile) {
        setDirectUploadProgress(0)
        try {
          directLoopUpload = await uploadLoopVideoDirect(directLoopFile, {
            onProgress: setDirectUploadProgress,
          })
        } finally {
          setDirectUploadProgress(null)
        }
      }

      if (directLoopUpload) {
        payload.loopUpload = directLoopUpload
      } else if (selectedFiles.length) {
        const formData = new FormData()
        formData.set('title', title.trim())
        formData.set('text', draft.trim())
        formData.set('privacy', privacy)
        formData.set('contentType', contentType)
        formData.set('publishMode', isScheduled ? 'schedule' : 'publish')
        if (scheduledFor) {
          formData.set('scheduledFor', scheduledFor)
        }
        if (isStoryComposer && storyMeta) {
          formData.set('storyMeta', JSON.stringify(storyMeta))
        }
        selectedFiles.forEach((file) => {
          formData.append('media', file)
        })
        payload = formData
      }

      const response = await onSubmit(payload)
      const submitDurationMs = Date.now() - submitStartMs
      const successMessage =
        response?.message ||
        (isScheduled
          ? t('home.postScheduled', { defaultValue: 'Post scheduled.' })
          : isStoryComposer
            ? t('home.storyPublished', { defaultValue: 'Story published.' })
            : t('home.postPublished', { defaultValue: 'Post published.' }))

      resetComposer()
      setSubmitSuccess(successMessage)
      logUploadPerf({
        flow: 'create_post',
        ok: true,
        mode,
        contentType,
        mediaCount: selectedFiles.length,
        durationMs: submitDurationMs,
        mediaBytes: selectedFiles.reduce((sum, file) => sum + Number(file?.size || 0), 0),
      })
    } catch (error) {
      setSubmitError(error.message || t('home.postPublishFailed', { defaultValue: 'Post action could not be completed.' }))
      logUploadPerf({
        flow: 'create_post',
        ok: false,
        mode,
        mediaCount: selectedFiles.length,
        durationMs: Date.now() - submitStartMs,
        errorMessage: error.message || 'Post action could not be completed.',
      })
    }
  }

  const fullName = getFullName(user)
  const audienceLabel =
    privacy === 'private'
      ? t('composer.audience.onlyMe', { defaultValue: 'Only me' })
      : privacy === 'followers'
        ? t('common.followers', { defaultValue: 'Followers' })
        : t('common.everyone', { defaultValue: 'Everyone' })

  return (
    <form
      ref={composerRef}
      onSubmit={handleSubmit}
      className={
        isMobileFullscreen
          ? 'fixed inset-0 z-[120] flex h-[100dvh] flex-col overflow-hidden bg-card text-text animate-[composer-sheet-in_0.24s_ease-out] md:static md:z-auto'
          : isDesktopModal
            ? 'relative z-[1] w-full'
          : `overflow-visible rounded-lg border border-border bg-card text-text shadow-sm transition-all duration-300 ${
              isExpanded ? 'p-5' : 'p-3'
            }`
      }
    >
      {!isExpanded ? (
        hideCollapsed ? null : (
          isMobileViewport ? (
            <button
              type="button"
              onClick={handleExpand}
              className="flex w-full items-center gap-3 rounded-[24px] text-left transition hover:bg-secondary"
            >
              <UserAvatar
                user={user}
                className="size-11 shrink-0 text-sm font-semibold"
                textClassName="text-sm font-semibold"
              />
              <div className="flex-1 rounded-lg border border-border bg-secondary px-5 py-3 text-sm text-soft transition">
                {t('home.postPrompt', { defaultValue: 'What would you like to share today?' })}
              </div>
            </button>
          ) : (
            <div className="flex w-full items-center gap-3 rounded-[24px]">
              <UserAvatar
                user={user}
                className="size-11 shrink-0 text-sm font-semibold"
                textClassName="text-sm font-semibold"
              />
              <button
                type="button"
                onClick={() => handleCollapsedAction('post')}
                className="flex-1 cursor-pointer rounded-lg border border-border bg-secondary px-5 py-3 text-left text-sm text-soft transition hover:bg-secondary-hover"
              >
                {t('home.postPrompt', { defaultValue: 'What would you like to share today?' })}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCollapsedAction('post')}
                  className="grid size-11 cursor-pointer place-items-center rounded-full border border-border bg-card text-text transition hover:bg-secondary"
                  aria-label={t('common.createMenu.post', { defaultValue: 'Post' })}
                  title={t('common.createMenu.post', { defaultValue: 'Post' })}
                >
                  <PostTypeIcon />
                </button>
                {allowLoopOption ? (
                  <button
                    type="button"
                    onClick={() => handleCollapsedAction('loopVideo')}
                    className="grid size-11 cursor-pointer place-items-center rounded-full border border-border bg-card text-text transition hover:bg-secondary"
                    aria-label={t('common.createMenu.loopVideo', { defaultValue: 'Loop video' })}
                    title={t('common.createMenu.loopVideo', { defaultValue: 'Loop video' })}
                  >
                    <VideoIcon />
                  </button>
                ) : null}
                {allowStoryOption ? (
                  <button
                    type="button"
                    onClick={() => handleCollapsedAction('story')}
                    className="grid size-11 cursor-pointer place-items-center rounded-full border border-border bg-card text-text transition hover:bg-secondary"
                    aria-label={t('common.createMenu.story', { defaultValue: 'Story' })}
                    title={t('common.createMenu.story', { defaultValue: 'Story' })}
                  >
                    <StoryIcon />
                  </button>
                ) : null}
              </div>
            </div>
          )
        )
      ) : isMobileFullscreen ? (
        <>
          <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-card px-3">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-base font-semibold text-text">
                {isStoryComposer
                  ? t('composer.createStory', { defaultValue: 'Create story' })
                  : t('composer.createPost', { defaultValue: 'Create content' })}
              </p>
              {!isGroupComposer ? (
                <div ref={privacyMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPrivacyMenu((currentValue) => !currentValue)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition ${
                      showPrivacyMenu
                        ? 'border-border-strong bg-primary text-inverse'
                        : 'border-border bg-secondary text-muted hover:bg-secondary-hover'
                    }`}
                  >
                    <span>{audienceLabel}</span>
                    <ChevronDownIcon className={`size-4 transition ${showPrivacyMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showPrivacyMenu ? (
                    <div className="dropdown-pop absolute left-0 top-[calc(100%+6px)] z-30 w-[170px] rounded-2xl border border-border bg-card p-2 shadow-[0_20px_46px_rgba(15,23,42,0.2)]">
                      {[
                        { value: 'public', label: t('common.everyone', { defaultValue: 'Everyone' }) },
                        { value: 'followers', label: t('common.followers', { defaultValue: 'Followers' }) },
                        { value: 'private', label: t('composer.audience.onlyMe', { defaultValue: 'Only me' }) },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handlePrivacySelect(option.value)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                            privacy === option.value
                              ? 'bg-secondary text-text'
                              : 'text-muted hover:bg-nav-hover hover:text-text'
                          }`}
                        >
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div ref={dismissMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowDismissMenu((currentValue) => !currentValue)}
                className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-muted transition hover:bg-secondary-hover hover:text-text"
                aria-label={t('common.close', { defaultValue: 'Close' })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-4">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>

              {showDismissMenu ? (
                <div className="dropdown-pop absolute right-0 top-[calc(100%+8px)] z-40 w-[220px] rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
                  <button
                    type="button"
                    onClick={() => handleDismissChoice('discard')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <span>{t('composer.discard', { defaultValue: 'Discard' })}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                      <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissChoice('continue')}
                    className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text transition hover:bg-secondary"
                  >
                    <span>{t('composer.continueEditing', { defaultValue: 'Continue editing' })}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="subtle-scrollbar flex-1 overflow-y-auto px-3 pb-[170px] pt-4">
            {isGroupComposer ? (
              <div className="mb-3 flex items-start gap-3 rounded-xl border border-border bg-secondary/35 p-3">
                <div className="shrink-0">
                  {resolvedGroupCoverUrl ? (
                    <div className="relative h-14 w-20">
                      <img
                        src={resolvedGroupCoverUrl}
                        alt={groupName}
                        className="h-14 w-20 rounded-lg object-cover"
                      />
                      <div className="absolute -bottom-2 -right-2 rounded-full ring-2 ring-card">
                        <UserAvatar
                          user={user}
                          className="size-8 shrink-0 text-[11px] font-semibold"
                          textClassName="text-[11px] font-semibold"
                        />
                      </div>
                    </div>
                  ) : (
                    <UserAvatar
                      user={user}
                      className="size-12 shrink-0 text-sm font-semibold"
                      textClassName="text-sm font-semibold"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{groupName}</p>
                  <p className="truncate font-semibold text-text">{fullName}</p>
                  <p className="truncate text-sm text-muted">@{user?.username}</p>
                </div>
              </div>
            ) : null}
            <div className="mb-3 flex items-center gap-2 border-b border-border bg-secondary/55 py-2">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, TITLE_MAX_LENGTH))}
                placeholder={t('composer.titlePlaceholder', { defaultValue: 'Baslik ekle' })}
                className="w-full bg-transparent text-base font-medium text-text outline-none placeholder:text-soft"
              />
              <span className="shrink-0 text-xs text-muted">{title.length}/{TITLE_MAX_LENGTH}</span>
            </div>
            <div className="relative">
              <div
                aria-hidden="true"
                ref={highlightScrollRef}
                className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-[17px] leading-7 text-text"
              >
                <div>{renderHighlightedDraft(draft)}</div>
              </div>

              {!draft ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 text-[17px] leading-7 text-soft">
                  {t('home.postPrompt', { defaultValue: 'What would you like to share today?' })}
                </div>
              ) : null}

              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  setSubmitSuccess('')
                  syncTokenContext(event.target.value, event.target.selectionStart)
                }}
                onScroll={(event) => {
                  if (highlightScrollRef.current) {
                    highlightScrollRef.current.scrollTop = event.currentTarget.scrollTop
                  }
                }}
                onClick={(event) => syncTokenContext(draft, event.currentTarget.selectionStart)}
                onKeyUp={(event) => syncTokenContext(draft, event.currentTarget.selectionStart)}
                onSelect={(event) => syncTokenContext(draft, event.currentTarget.selectionStart)}
                onKeyDown={(event) => {
                  if (!activeSuggestions.length) {
                    return
                  }

                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActiveSuggestionIndex((currentValue) =>
                      Math.min(currentValue + 1, activeSuggestions.length - 1),
                    )
                    return
                  }

                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActiveSuggestionIndex((currentValue) =>
                      Math.max(currentValue - 1, 0),
                    )
                    return
                  }

                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    applySuggestion(activeSuggestions[activeSuggestionIndex])
                    return
                  }

                  if (event.key === 'Escape') {
                    setTokenContext(null)
                  }
                }}
                className="relative z-[1] h-[48vh] min-h-[140px] w-full resize-none overflow-y-auto border-none bg-transparent text-base leading-7 text-transparent outline-none"
                style={{ caretColor: 'rgb(var(--color-text))' }}
              />

              {activeSuggestions.length ? (
                <div
                  className="dropdown-pop absolute z-30 w-full overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
                  style={{
                    left: `${Math.max(suggestionPosition.left - 8, 0)}px`,
                    top: `${suggestionPosition.top}px`,
                    maxWidth: 'calc(100vw - 24px)',
                  }}
                >
                  <div className="border-b border-border-soft px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      {tokenContext?.trigger === '@'
                        ? t('composer.mentionSuggestions', { defaultValue: 'User suggestions' })
                        : t('composer.hashtagSuggestions', { defaultValue: 'Hashtag suggestions' })}
                  </div>
                  <div className="max-h-64 overflow-y-auto py-2">
                    {activeSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.key}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySuggestion(suggestion)}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                          index === activeSuggestionIndex ? 'bg-nav-active' : 'hover:bg-secondary'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {suggestion.kind === 'mention' ? (
                            <UserAvatar
                              user={suggestion.user}
                              className="size-9 shrink-0 text-[11px] font-semibold"
                              textClassName="text-[11px] font-semibold"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-primary">{suggestion.label}</p>
                            <p className="mt-1 text-xs text-muted">{suggestion.meta}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                          {suggestion.kind === 'mention' ? suggestion.badge : 'Trend'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {previewItems.length ? (
              <div className="subtle-scrollbar -mx-1 mt-4 overflow-x-auto pb-1">
                <div className="flex min-w-max gap-3 px-1">
                  {previewItems.map((item) => (
                    <div
                      key={item.id}
                      className="relative w-[55vw] max-w-[300px] shrink-0 overflow-hidden rounded-[20px] border border-border bg-secondary"
                    >
                      {item.type === 'video' ? (
                        <video
                          src={resolveMediaUrl(item.url)}
                          controls
                          playsInline
                          preload="metadata"
                          className="aspect-[4/3] w-full bg-black object-contain"
                        />
                      ) : (
                        <img
                          src={resolveMediaUrl(item.url)}
                          alt={item.name}
                          className="aspect-[4/3] w-full object-cover"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemovePreview(item.id)}
                        className="absolute  right-3 top-3 grid size-8 place-items-center rounded-full bg-black/70 text-white"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                          <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {submitError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {submitError}
              </div>
            ) : null}

            {isDirectUploading ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
                Video doğrudan medya sunucusuna yükleniyor: %{Math.max(0, Math.min(100, directUploadProgress || 0))}
              </div>
            ) : null}

            {submitSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                {submitSuccess}
              </div>
            ) : null}

            <div className="">
              {isStoryComposer ? (
                <div className="mt-3 grid gap-2 rounded-2xl border border-border bg-secondary/60 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={storyMusicTitle}
                      onChange={(event) => setStoryMusicTitle(event.target.value)}
                            placeholder={t('composer.storyMusicTitle', { defaultValue: 'Music title' })}
                      className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                    />
                    <input
                      type="text"
                      value={storyMusicArtist}
                      onChange={(event) => setStoryMusicArtist(event.target.value)}
                            placeholder={t('composer.storyMusicArtist', { defaultValue: 'Artist' })}
                      className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                    />
                  </div>
                  <input
                    type="text"
                    value={storyStickerText}
                    onChange={(event) => setStoryStickerText(event.target.value)}
                          placeholder={t('composer.storyStickers', { defaultValue: 'Stickers (comma separated: promo, new)' })}
                    className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                  />
                  <input
                    type="text"
                    value={storyMentionText}
                    onChange={(event) => setStoryMentionText(event.target.value)}
                          placeholder={t('composer.storyMentions', { defaultValue: '@mentions (comma separated: ali, ayse)' })}
                    className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="url"
                      value={storyLinkUrl}
                      onChange={(event) => setStoryLinkUrl(event.target.value)}
                      placeholder={t('composer.storyLink', { defaultValue: 'Link (https://...)' })}
                      className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                    />
                    <input
                      type="text"
                      value={storyLinkLabel}
                      onChange={(event) => setStoryLinkLabel(event.target.value)}
                      placeholder={t('composer.storyLinkLabel', { defaultValue: 'Link label (optional)' })}
                      className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="fixed inset-x-0 z-30 border-t border-border bg-card px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2"
            style={mobileKeyboardInset ? { bottom: `${mobileKeyboardInset}px` } : { bottom: 0 }}
          >
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelection}
              className="hidden"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoSelection}
              className="hidden"
            />

            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isComposerBusy}
                className="grid size-10 place-items-center rounded-full border border-border text-text transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={t('composer.addPhoto', { defaultValue: 'Add photo' })}
              >
                <PhotoIcon />
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={isComposerBusy}
                className="grid size-10 place-items-center rounded-full border border-border text-text transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={t('composer.addVideo', { defaultValue: 'Add video' })}
              >
                <VideoIcon />
              </button>
              <span className="text-xs text-soft">
                {isOptimizingMedia
                  ? t('composer.optimizingMedia', { defaultValue: 'Optimizing media...' })
                  : t('composer.postMediaLimit', { defaultValue: 'Up to 4 images or 1 video' })}
              </span>
            </div>
            {isStoryComposer ? (
              <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-text">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                {t('composer.publishAsStory', { defaultValue: 'Will be shared as a story' })}
              </span>
            ) : hasVideoSelection && allowLoopOption ? (
              <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-text">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                {t('composer.publishAsLoop', { defaultValue: 'Will be shared as loop video' })}
              </span>
            ) : null}

            <div className="grid grid-cols-2 items-center justify-between gap-2">
              {!isStoryComposer ? (
              <div ref={plannerRef} className="relative">
                <button
                  type="button"
                  onClick={handleTogglePlanner}
                  className={`flex w-full justify-between items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    showPlanner
                      ? 'border-border-strong bg-primary text-inverse'
                      : 'border-border text-text hover:bg-secondary'
                  }`}
                >
                  <CalendarIcon />
                        <span>{t('common.schedule', { defaultValue: 'Schedule' })}</span>
                  <ChevronDownIcon className={`size-4 transition ${showPlanner ? 'rotate-180' : ''}`} />
                </button>

                  {showPlanner ? (
                    <div className="dropdown-pop absolute bottom-[calc(100%+10px)] left-0 z-40 w-[min(360px,calc(100vw-24px))] rounded-[20px] border border-border bg-card p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-text">{t('composer.scheduleTitle', { defaultValue: 'Schedule' })}</p>
                          <p className="mt-1 text-xs text-muted">{t('composer.scheduleSubtitle', { defaultValue: 'Select date and time for your post.' })}</p>
                        </div>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted">
                              {t('composer.defaultNow', { defaultValue: 'Default: now' })}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <label className="space-y-2 text-sm text-muted">
                              <span className="font-medium text-text">{t('composer.date', { defaultValue: 'Date' })}</span>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => triggerNativePicker(dateInputRef.current)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              triggerNativePicker(dateInputRef.current)
                            }
                          }}
                          className="rounded-2xl border border-border bg-secondary transition focus-within:border-border-strong focus-within:bg-card"
                        >
                          <input
                            ref={dateInputRef}
                            type="date"
                            value={scheduledDate}
                            onChange={(event) => setScheduledDate(event.target.value)}
                            onFocus={() => triggerNativePicker(dateInputRef.current)}
                            className="w-full cursor-pointer rounded-2xl bg-transparent px-4 py-3 text-text outline-none"
                          />
                        </div>
                      </label>

                      <label className="space-y-2 text-sm text-muted">
                              <span className="font-medium text-text">{t('composer.time', { defaultValue: 'Time' })}</span>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => triggerNativePicker(timeInputRef.current)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              triggerNativePicker(timeInputRef.current)
                            }
                          }}
                          className="rounded-2xl border border-border bg-secondary transition focus-within:border-border-strong focus-within:bg-card"
                        >
                          <input
                            ref={timeInputRef}
                            type="time"
                            value={scheduledTime}
                            onChange={(event) => setScheduledTime(event.target.value)}
                            onFocus={() => triggerNativePicker(timeInputRef.current)}
                            className="w-full cursor-pointer rounded-2xl bg-transparent px-4 py-3 text-text outline-none"
                          />
                        </div>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => handleSubmit(event, 'schedule')}
                      disabled={isComposerBusy || (!title.trim() && !draft.trim() && !selectedFiles.length)}
                      className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-secondary-hover disabled:text-soft"
                    >
                      {isSubmitting
                        ? t('composer.scheduling', { defaultValue: 'Scheduling...' })
                        : t('common.schedule', { defaultValue: 'Schedule' })}
                    </button>
                  </div>
                ) : null}
              </div>
              ) : null}

                <button
                  type="submit"
                  disabled={isComposerBusy || (!title.trim() && !draft.trim() && !selectedFiles.length)}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-secondary-hover disabled:text-soft"
                >
                  {isSubmitting
                    ? t('composer.sharing', { defaultValue: 'Sharing...' })
                    : t('common.share', { defaultValue: 'Share' })}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 z-[260] hidden items-center justify-center p-4 md:flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={handleComposerOverlayClose}
            aria-label={t('composer.closeOverlay', { defaultValue: 'Close composer popup' })}
          />
          <div className="relative z-99 flex max-h-[82vh] w-full max-w-[720px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[0_30px_90px_rgba(15,23,42,0.38)] animate-[dropdown-pop_0.24s_ease-out]">
            <div className="shrink-0 border-b border-border bg-card px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3 flex-row">
                  <div className="shrink-0">
                    {isGroupComposer && resolvedGroupCoverUrl ? (
                      <div className="relative h-14 w-20">
                        <img
                          src={resolvedGroupCoverUrl}
                          alt={groupName}
                          className="h-14 w-20 rounded-lg object-cover"
                        />
                        <div className="absolute -bottom-2 -right-2 rounded-full ring-2 ring-card">
                          <UserAvatar
                            user={user}
                            className="size-8 shrink-0 text-[11px] font-semibold"
                            textClassName="text-[11px] font-semibold"
                          />
                        </div>
                      </div>
                    ) : (
                      <UserAvatar
                        user={user}
                        className="size-12 shrink-0 text-sm font-semibold"
                        textClassName="text-sm font-semibold"
                      />
                    )}
                  </div>
                  <div>
                    {isGroupComposer ? (
                      <p className="text-sm font-semibold text-text">{groupName}</p>
                    ) : null}
                    <p className="font-semibold text-text">{fullName}</p>
                    <p className="text-sm text-muted">@{user?.username}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {!isGroupComposer ? (
                    <div ref={privacyMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPrivacyMenu((currentValue) => !currentValue)}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                          showPrivacyMenu
                            ? 'border-border-strong bg-primary text-inverse'
                            : 'border-border bg-secondary text-muted hover:bg-secondary-hover'
                        }`}
                      >
                        <span>{audienceLabel}</span>
                        <ChevronDownIcon className={`size-4 transition ${showPrivacyMenu ? 'rotate-180' : ''}`} />
                      </button>

                      {showPrivacyMenu ? (
                        <div className="dropdown-pop text-sm absolute right-0 top-[calc(100%+4px)] z-20 w-30 rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                          {[
                            { value: 'public', label: t('common.everyone', { defaultValue: 'Everyone' }) },
                            { value: 'followers', label: t('common.followers', { defaultValue: 'Followers' }) },
                            { value: 'private', label: t('composer.audience.onlyMe', { defaultValue: 'Only me' }) },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handlePrivacySelect(option.value)}
                              className={`flex w-full items-center justify-between rounded-lg cursor-pointer px-3 py-2.5 text-sm transition ${
                                privacy === option.value
                                  ? 'bg-secondary text-text'
                                  : 'text-muted hover:bg-nav-hover hover:text-text'
                              }`}
                            >
                              <span>{option.label}</span>
                              {privacy === option.value ? <span className="text-xs font-semibold"> </span> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div ref={dismissMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDismissMenu((currentValue) => !currentValue)}
                      className="inline-flex cursor-pointer size-9 items-center justify-center rounded-full border border-border bg-secondary text-muted transition hover:bg-secondary-hover hover:text-text"
                      aria-label={t('common.close', { defaultValue: 'Close' })}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-4">
                        <path d="m6 6 12 12M18 6 6 18" />
                      </svg>
                    </button>

                    {showDismissMenu ? (
                      <div className="dropdown-pop absolute right-0 top-[calc(100%+8px)] z-30 w-[220px] rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
                        <button
                          type="button"
                          onClick={() => handleDismissChoice('discard')}
                          className="flex w-full items-center cursor-pointer justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <span>{t('composer.discard', { defaultValue: 'Discard' })}</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                            <path d="m6 6 12 12M18 6 6 18" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissChoice('continue')}
                          className="mt-1 flex w-full items-center cursor-pointer justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text transition hover:bg-secondary"
                        >
                          <span>{t('composer.continueEditing', { defaultValue: 'Continue editing' })}</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
                </div>
              </div>
            </div>

            <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-1 flex items-center gap-2  border-b border-border bg-secondary/55  py-2">
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, TITLE_MAX_LENGTH))}
                  placeholder={t('composer.titlePlaceholder', { defaultValue: 'Baslik ekle' })}
                  className="w-full bg-transparent text-base font-medium text-text outline-none placeholder:text-soft"
                />
                <span className="shrink-0 text-xs text-muted">{title.length}/{TITLE_MAX_LENGTH}</span>
              </div>
              <div className="relative">
                <div
                  aria-hidden="true"
                  ref={highlightScrollRef}
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-[15px] leading-7 text-text"
                >
                  <div>{renderHighlightedDraft(draft)}</div>
                </div>

                {!draft ? (
                  <div className="pointer-events-none absolute inset-x-0 top-0 text-[15px] leading-7 text-soft">
                    {t('home.postPrompt', { defaultValue: 'What would you like to share today?' })}
                  </div>
                ) : null}

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    setSubmitSuccess('')
                    syncTokenContext(event.target.value, event.target.selectionStart)
                  }}
                  onScroll={(event) => {
                    if (highlightScrollRef.current) {
                      highlightScrollRef.current.scrollTop = event.currentTarget.scrollTop
                    }
                  }}
                  onClick={(event) => syncTokenContext(draft, event.currentTarget.selectionStart)}
                  onKeyUp={(event) => syncTokenContext(draft, event.currentTarget.selectionStart)}
                  onSelect={(event) => syncTokenContext(draft, event.currentTarget.selectionStart)}
                  onKeyDown={(event) => {
                    if (!activeSuggestions.length) {
                      return
                    }

                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setActiveSuggestionIndex((currentValue) =>
                        Math.min(currentValue + 1, activeSuggestions.length - 1),
                      )
                      return
                    }

                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setActiveSuggestionIndex((currentValue) =>
                        Math.max(currentValue - 1, 0),
                      )
                      return
                    }

                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      applySuggestion(activeSuggestions[activeSuggestionIndex])
                      return
                    }

                    if (event.key === 'Escape') {
                      setTokenContext(null)
                    }
                  }}
                  className="relative z-[1] h-[92px] w-full resize-none overflow-y-auto border-none bg-transparent text-[15px] leading-7 text-transparent outline-none [scrollbar-gutter:stable]"
                  style={{ caretColor: 'rgb(var(--color-text))' }}
                />

              {activeSuggestions.length ? (
                  <div
                    className="dropdown-pop absolute z-20 w-full max-w-[320px] overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
                    style={{
                      left: `${suggestionPosition.left}px`,
                      top: `${suggestionPosition.top}px`,
                    }}
                  >
                    <div className="border-b border-border-soft px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      {tokenContext?.trigger === '@'
                        ? t('composer.mentionSuggestions', { defaultValue: 'User suggestions' })
                        : t('composer.hashtagSuggestions', { defaultValue: 'Hashtag suggestions' })}
                    </div>
                    <div className="max-h-64 overflow-y-auto py-2">
                      {activeSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.key}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applySuggestion(suggestion)}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                            index === activeSuggestionIndex
                              ? 'bg-nav-active'
                              : 'hover:bg-secondary'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {suggestion.kind === 'mention' ? (
                              <UserAvatar
                                user={suggestion.user}
                                className="size-9 shrink-0 text-[11px] font-semibold"
                                textClassName="text-[11px] font-semibold"
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-primary">
                                {suggestion.label}
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                {suggestion.meta}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                            {suggestion.kind === 'mention' ? suggestion.badge : 'Trend'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {previewItems.length ? (
                <div className="mt-1 grid gap-3 sm:grid-cols-2">
                  {previewItems.map((item) => (
                    <div
                      key={item.id}
                      className="relative overflow-hidden rounded-lg border border-border bg-secondary"
                    >
                      {item.type === 'video' ? (
                        <video
                          src={resolveMediaUrl(item.url)}
                          controls
                          playsInline
                          preload="metadata"
                          className="aspect-[16/10] w-full bg-black object-contain"
                        />
                      ) : (
                        <img
                          src={resolveMediaUrl(item.url)}
                          alt={item.name}
                          className="aspect-[16/10] w-full object-cover"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemovePreview(item.id)}
                        className="absolute right-3 cursor-pointer top-3 grid size-8 place-items-center rounded-full bg-black/70 text-white"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                          <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {submitError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                  {submitError}
                </div>
              ) : null}

              {isDirectUploading ? (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
                  Video doğrudan medya sunucusuna yükleniyor: %{Math.max(0, Math.min(100, directUploadProgress || 0))}
                </div>
              ) : null}

              {submitSuccess ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {submitSuccess}
                </div>
              ) : null}

            </div>

            <div className="shrink-0 border-t border-border bg-card px-5 py-3">
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelection}
                      className="hidden"
                    />
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelection}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isComposerBusy}
                      className="grid size-11 cursor-pointer place-items-center rounded-full border border-border text-text transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={t('composer.addPhoto', { defaultValue: 'Add photo' })}
                    >
                      <PhotoIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={isComposerBusy}
                      className="grid size-11 cursor-pointer place-items-center rounded-full border border-border text-text transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={t('composer.addVideo', { defaultValue: 'Add video' })}
                    >
                      <VideoIcon />
                    </button>
                    <span className="text-xs text-soft">
                      {isOptimizingMedia
                        ? t('composer.optimizingMedia', { defaultValue: 'Optimizing media...' })
                        : isStoryComposer
                          ? t('composer.storyMediaLimit', { defaultValue: '1 image or 1 video (max 15s)' })
                          : t('composer.postMediaLimit', { defaultValue: 'Up to 4 images or 1 video' })}
                    </span>
                    {isStoryComposer ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-text">
                        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                        {t('composer.publishAsStory', { defaultValue: 'Will be shared as a story' })}
                      </span>
                    ) : hasVideoSelection && allowLoopOption ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-text">
                        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                        {t('composer.publishAsLoop', { defaultValue: 'Will be shared as loop video' })}
                      </span>
                    ) : null}

                    {isStoryComposer ? (
                      <div className="w-full max-w-[680px] space-y-2 rounded-2xl border border-border bg-secondary/60 p-3">
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            type="text"
                            value={storyMusicTitle}
                            onChange={(event) => setStoryMusicTitle(event.target.value)}
                            placeholder={t('composer.storyMusicTitle', { defaultValue: 'Music title' })}
                            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                          />
                          <input
                            type="text"
                            value={storyMusicArtist}
                            onChange={(event) => setStoryMusicArtist(event.target.value)}
                            placeholder={t('composer.storyMusicArtist', { defaultValue: 'Artist' })}
                            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                          />
                        </div>
                        <input
                          type="text"
                          value={storyStickerText}
                          onChange={(event) => setStoryStickerText(event.target.value)}
                          placeholder={t('composer.storyStickers', { defaultValue: 'Stickers (comma separated: promo, new)' })}
                          className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                        />
                        <input
                          type="text"
                          value={storyMentionText}
                          onChange={(event) => setStoryMentionText(event.target.value)}
                          placeholder={t('composer.storyMentions', { defaultValue: '@mentions (comma separated: ali, ayse)' })}
                          className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                        />
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            type="url"
                            value={storyLinkUrl}
                            onChange={(event) => setStoryLinkUrl(event.target.value)}
                            placeholder={t('composer.storyLink', { defaultValue: 'Link (https://...)' })}
                            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                          />
                          <input
                            type="text"
                            value={storyLinkLabel}
                            onChange={(event) => setStoryLinkLabel(event.target.value)}
                            placeholder={t('composer.storyLinkLabel', { defaultValue: 'Link label (optional)' })}
                            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isStoryComposer ? (
                    <div ref={plannerRef} className="relative">
                      <button
                        type="button"
                        onClick={handleTogglePlanner}
                        className={`inline-flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition ${
                          showPlanner
                            ? 'border-border-strong bg-primary text-inverse'
                            : 'border-border text-text hover:bg-secondary'
                        }`}
                      >
                        <CalendarIcon />
                        <span>{t('common.schedule', { defaultValue: 'Schedule' })}</span>
                        <ChevronDownIcon className={`size-4 transition ${showPlanner ? 'rotate-180' : ''}`} />
                      </button>

                      {showPlanner ? (
                        <div className="dropdown-pop absolute bottom-[calc(100%+12px)] right-0 z-20 w-[320px] rounded-[24px] border border-border bg-card p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-text">{t('composer.scheduleTitle', { defaultValue: 'Schedule' })}</p>
                              <p className="mt-1 text-xs text-muted">
                                {t('composer.scheduleSubtitle', { defaultValue: 'Select date and time for your post.' })}
                              </p>
                            </div>
                            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted">
                              {t('composer.defaultNow', { defaultValue: 'Default: now' })}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3">
                            <label className="space-y-2 text-sm text-muted">
                              <span className="font-medium text-text">{t('composer.date', { defaultValue: 'Date' })}</span>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => triggerNativePicker(dateInputRef.current)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    triggerNativePicker(dateInputRef.current)
                                  }
                                }}
                                className="rounded-2xl border border-border bg-secondary transition focus-within:border-border-strong focus-within:bg-card"
                              >
                                <input
                                  ref={dateInputRef}
                                  type="date"
                                  value={scheduledDate}
                                  onChange={(event) => setScheduledDate(event.target.value)}
                                  onFocus={() => triggerNativePicker(dateInputRef.current)}
                                  className="w-full cursor-pointer rounded-2xl bg-transparent px-4 py-3 text-text outline-none"
                                />
                              </div>
                            </label>

                            <label className="space-y-2 text-sm text-muted">
                              <span className="font-medium text-text">{t('composer.time', { defaultValue: 'Time' })}</span>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => triggerNativePicker(timeInputRef.current)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    triggerNativePicker(timeInputRef.current)
                                  }
                                }}
                                className="rounded-2xl border border-border bg-secondary transition focus-within:border-border-strong focus-within:bg-card"
                              >
                                <input
                                  ref={timeInputRef}
                                  type="time"
                                  value={scheduledTime}
                                  onChange={(event) => setScheduledTime(event.target.value)}
                                  onFocus={() => triggerNativePicker(timeInputRef.current)}
                                  className="w-full cursor-pointer rounded-2xl bg-transparent px-4 py-3 text-text outline-none"
                                />
                              </div>
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={(event) => handleSubmit(event, 'schedule')}
                            disabled={isComposerBusy || (!title.trim() && !draft.trim() && !selectedFiles.length)}
                            className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-secondary-hover disabled:text-soft"
                          >
                            {isSubmitting
                              ? t('composer.scheduling', { defaultValue: 'Scheduling...' })
                              : t('common.schedule', { defaultValue: 'Schedule' })}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isComposerBusy || (!title.trim() && !draft.trim() && !selectedFiles.length)}
                      className="rounded-lg cursor-pointer bg-primary px-10 py-2 text-sm font-semibold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-secondary-hover disabled:text-soft"
                    >
                      {isSubmitting
                        ? t('composer.sharing', { defaultValue: 'Sharing...' })
                        : t('common.share', { defaultValue: 'Share' })}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

export default PostComposer
