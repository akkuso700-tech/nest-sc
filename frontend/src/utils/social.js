export function getFullName(user) {
  if (!user) {
    return 'Guest User'
  }

  if (user.fullName) {
    return user.fullName
  }

  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'Member'
}

export function getAvatarLabel(user) {
  const baseValue = getFullName(user)

  return baseValue
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function formatRelativeTime(value) {
  if (!value) {
    return 'now'
  }

  const date = value instanceof Date ? value : new Date(value)
  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(diffInSeconds)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (absoluteSeconds < 60) {
    return rtf.format(diffInSeconds, 'second')
  }

  if (absoluteSeconds < 60 * 60) {
    return rtf.format(Math.round(diffInSeconds / 60), 'minute')
  }

  if (absoluteSeconds < 60 * 60 * 24) {
    return rtf.format(Math.round(diffInSeconds / 3600), 'hour')
  }

  if (absoluteSeconds < 60 * 60 * 24 * 7) {
    return rtf.format(Math.round(diffInSeconds / 86400), 'day')
  }

  return date.toLocaleDateString()
}

export function formatClockTime(value) {
  const date = value instanceof Date ? value : new Date(value)

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatLocation(location) {
  if (!location) {
    return 'No location yet'
  }

  const parts = [location.city, location.country].filter(Boolean)
  return parts.length ? parts.join(', ') : 'No location yet'
}
