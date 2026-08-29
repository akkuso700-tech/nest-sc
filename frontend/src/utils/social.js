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

export function formatNotificationContent(notification, t) {
  if (!notification) {
    return { title: '', body: '' }
  }

  const actor = notification.actor || {}
  const name = actor.firstName || getFullName(actor) || actor.username || (t ? t('notificationsPage.systemActor') : 'System')
  const type = notification.type
  const entityKind = notification.entityKind
  const rawTitle = (notification.title || '').toLowerCase()

  if (type === 'message') {
    return {
      title: t ? t('notificationsPage.types.message.title', { defaultValue: notification.title }) : notification.title,
      body: t ? t('notificationsPage.types.message.body', { name, defaultValue: `${name} sent you a new message.` }) : notification.body,
    }
  }

  if (type === 'follow') {
    return {
      title: t ? t('notificationsPage.types.follow.title', { defaultValue: notification.title }) : notification.title,
      body: t ? t('notificationsPage.types.follow.body', { name, defaultValue: `${name} started following you.` }) : notification.body,
    }
  }

  if (type === 'comment') {
    return {
      title: t ? t('notificationsPage.types.comment.title', { defaultValue: notification.title }) : notification.title,
      body: t ? t('notificationsPage.types.comment.body', { name, defaultValue: `${name} commented on your post.` }) : notification.body,
    }
  }

  if (type === 'like') {
    if (entityKind === 'comment' || rawTitle.includes('comment') || rawTitle.includes('yorum')) {
      return {
        title: t ? t('notificationsPage.types.likeComment.title', { defaultValue: notification.title }) : notification.title,
        body: t ? t('notificationsPage.types.likeComment.body', { name, defaultValue: `${name} liked your comment.` }) : notification.body,
      }
    }
    return {
      title: t ? t('notificationsPage.types.likePost.title', { defaultValue: notification.title }) : notification.title,
      body: t ? t('notificationsPage.types.likePost.body', { name, defaultValue: `${name} liked your post.` }) : notification.body,
    }
  }

  if (type === 'share') {
    if (entityKind === 'comment' || rawTitle.includes('comment') || rawTitle.includes('yorum')) {
      return {
        title: t ? t('notificationsPage.types.shareComment.title', { defaultValue: notification.title }) : notification.title,
        body: t ? t('notificationsPage.types.shareComment.body', { name, defaultValue: `${name} shared your comment.` }) : notification.body,
      }
    }
    return {
      title: t ? t('notificationsPage.types.sharePost.title', { defaultValue: notification.title }) : notification.title,
      body: t ? t('notificationsPage.types.sharePost.body', { name, defaultValue: `${name} shared your post.` }) : notification.body,
    }
  }

  if (type === 'mention') {
    return {
      title: t ? t('notificationsPage.types.mention.title', { defaultValue: notification.title }) : notification.title,
      body: t ? t('notificationsPage.types.mention.body', { name, defaultValue: `${name} mentioned you.` }) : notification.body,
    }
  }

  if (type === 'admin') {
    if (rawTitle.includes('onaylandı') || rawTitle.includes('onaylandi') || rawTitle.includes('approved')) {
      return {
        title: t ? t('notificationsPage.types.adminApproved.title', { defaultValue: notification.title }) : notification.title,
        body: t ? t('notificationsPage.types.adminApproved.body', { defaultValue: notification.body }) : notification.body,
      }
    }
    if (rawTitle.includes('sonuçlandı') || rawTitle.includes('sonuclandi') || rawTitle.includes('rejected')) {
      return {
        title: t ? t('notificationsPage.types.adminRejected.title', { defaultValue: notification.title }) : notification.title,
        body: t ? t('notificationsPage.types.adminRejected.body', { defaultValue: notification.body }) : notification.body,
      }
    }
    if (rawTitle.includes('inceleniyor') || rawTitle.includes('review')) {
      return {
        title: t ? t('notificationsPage.types.adminReview.title', { defaultValue: notification.title }) : notification.title,
        body: t ? t('notificationsPage.types.adminReview.body', { defaultValue: notification.body }) : notification.body,
      }
    }
    if (rawTitle.includes('kaldırıldı') || rawTitle.includes('kaldirildi')) {
      return {
        title: t ? t('notificationsPage.types.adminRemoved.title', { defaultValue: notification.title }) : notification.title,
        body: t ? t('notificationsPage.types.adminRemoved.body', { defaultValue: notification.body }) : notification.body,
      }
    }
  }

  return {
    title: notification.title || (t ? t('notificationsPage.fallbackTitle') : 'Notification'),
    body: notification.body || '',
  }
}

