function getCurrentOrigin(fallbackOrigin = '') {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return fallbackOrigin || 'https://nest-sc.com'
}

function truncateText(value, maxLength = 140) {
  const safeValue = `${value || ''}`.trim()

  if (safeValue.length <= maxLength) {
    return safeValue
  }

  return `${safeValue.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function toWellFormedText(value) {
  const text = `${value || ''}`

  if (typeof text.toWellFormed === 'function') {
    return text.toWellFormed()
  }

  let result = ''

  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index)

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = text.charCodeAt(index + 1)

      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        result += text[index] + text[index + 1]
        index += 1
      } else {
        result += '\ufffd'
      }
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      result += '\ufffd'
    } else {
      result += text[index]
    }
  }

  return result
}

function encode(value) {
  return encodeURIComponent(toWellFormedText(value))
}

export function buildPostShareUrl({ postId, slug = '', lang = 'tr', origin }) {
  if (!postId) {
    return ''
  }

  const safeLang = `${lang || 'tr'}`.trim() || 'tr'
  const safeOrigin = getCurrentOrigin(origin)

  const safeSlug = `${slug || ''}`.trim()
  const path = safeSlug ? `/${safeLang}/posts/${postId}/${encode(safeSlug)}` : `/${safeLang}/posts/${postId}`
  return new URL(path, safeOrigin).toString()
}

export function buildPostSharePayload({ post, postId, lang = 'tr', origin }) {
  const shareUrl = buildPostShareUrl({ postId, slug: post?.slug || '', lang, origin })
  const authorName =
    `${post?.author?.firstName || ''} ${post?.author?.lastName || ''}`.trim() ||
    post?.author?.username ||
    'Nest Social'
  const snippet = truncateText(post?.text || post?.content || '', 120)
  const title = authorName
  const text = snippet ? `${authorName}: ${snippet}` : authorName

  return {
    url: shareUrl,
    title,
    text,
  }
}

export function buildShareTargets({ url, text = '' }) {
  const encodedUrl = encode(url)
  const encodedText = encode(text)
  const combinedText = encode(text ? `${text} ${url}` : url)

  return {
    whatsapp: `https://wa.me/?text=${combinedText}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
  }
}

export function isMobileShareSupported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  if (typeof navigator.share !== 'function') {
    return false
  }

  const viewportMobile = window.matchMedia?.('(max-width: 767px)')?.matches
  const uaMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
    navigator.userAgent || '',
  )

  return Boolean(viewportMobile || uaMobile)
}

function isShareCancellationError(error) {
  const errorName = `${error?.name || ''}`.toLowerCase()
  const errorMessage = `${error?.message || ''}`.toLowerCase()

  if (errorName === 'aborterror' || errorName === 'cancellederror') {
    return true
  }

  if (errorName === 'notallowederror') {
    return (
      errorMessage.includes('cancel') ||
      errorMessage.includes('dismiss') ||
      errorMessage.includes('aborted')
    )
  }

  return (
    errorMessage.includes('share canceled') ||
    errorMessage.includes('share cancelled') ||
    errorMessage.includes('user cancelled') ||
    errorMessage.includes('user canceled') ||
    errorMessage.includes('dismissed')
  )
}

export async function shareWithNative(payload) {
  if (!isMobileShareSupported()) {
    return { status: 'unsupported' }
  }

  try {
    await navigator.share({
      title: payload?.title || '',
      text: payload?.text || '',
      url: payload?.url || '',
    })

    return { status: 'shared' }
  } catch (error) {
    if (isShareCancellationError(error)) {
      return { status: 'cancelled' }
    }

    return { status: 'error', error }
  }
}

export async function copyTextToClipboard(value) {
  const text = `${value || ''}`

  if (!text) {
    throw new Error('No text to copy.')
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable.')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('Copy command failed.')
  }

  return true
}
