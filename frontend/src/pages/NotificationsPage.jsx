import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationsService.js'
import {
  connectSocketClient,
  disconnectSocketClient,
} from '../services/socketClient.js'
import { formatNotificationContent, formatRelativeTime, getFullName } from '../utils/social.js'

function DotsIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TrashIcon({ className = 'size-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function normalizeId(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value.$oid) {
    return value.$oid
  }

  return value.toString?.() || ''
}

function buildNotificationRoute(notification, lang) {
  const actor = notification?.actor || {}
  const actorId = normalizeId(actor._id || actor.id)
  const actorUsername = actor.username || ''
  const entityKind = notification?.entityKind || 'system'
  const entityId = normalizeId(notification?.entityId)
  const postId = normalizeId(notification?.targetPostId) || (entityKind === 'post' ? entityId : '')
  const commentId = normalizeId(notification?.targetCommentId) || (entityKind === 'comment' ? entityId : '')
  const conversationId = normalizeId(notification?.targetConversationId)

  if (notification?.type === 'follow' && actorUsername) {
    return `/${lang}/u/${actorUsername}`
  }

  if (notification?.type === 'message' || entityKind === 'message') {
    const params = new URLSearchParams()

    if (conversationId) {
      params.set('conversationId', conversationId)
    }

    if (actorId) {
      params.set('recipientId', actorId)
    }

    if (actorUsername) {
      params.set('username', actorUsername)
    }

    const fullName = getFullName(actor)
    if (fullName) {
      params.set('name', fullName)
    }

    if (actor?.avatarUrl) {
      params.set('avatarUrl', actor.avatarUrl)
    }

    const queryString = params.toString()
    return `/${lang}/messages${queryString ? `?${queryString}` : ''}`
  }

  if (postId) {
    const params = new URLSearchParams()

    if (commentId) {
      params.set('commentId', commentId)
    }

    const queryString = params.toString()
    return `/${lang}/posts/${postId}${queryString ? `?${queryString}` : ''}`
  }

  if (actorUsername) {
    return `/${lang}/u/${actorUsername}`
  }

  return `/${lang}/notifications`
}

function NotificationsPage() {
  const { lang } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { isAuthenticated, status } = useAuth()
  const [notificationsState, setNotificationsState] = useState({
    items: [],
    isLoading: true,
    error: '',
    unreadOnly: false,
  })
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!openMenuId) {
      return undefined
    }

    function handleClickOutside(event) {
      if (!event.target.closest('[data-notification-menu]')) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationsState({
        items: [],
        isLoading: false,
        error: '',
        unreadOnly: false,
      })
      return
    }

    let cancelled = false

    async function loadNotifications() {
      setNotificationsState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: '',
      }))

      try {
        const payload = await getNotifications({
          unreadOnly: notificationsState.unreadOnly,
          limit: 50,
        })

        if (cancelled) {
          return
        }

        setNotificationsState((currentState) => ({
          ...currentState,
          items: payload.notifications || [],
          isLoading: false,
          error: '',
        }))
      } catch (error) {
        if (cancelled) {
          return
        }

        setNotificationsState((currentState) => ({
          ...currentState,
          items: [],
          isLoading: false,
          error: error.message || t('notificationsPage.errors.load'),
        }))
      }
    }

    loadNotifications()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, notificationsState.unreadOnly, t])

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    const socket = connectSocketClient()

    function handleNotificationNew(notification) {
      setNotificationsState((currentState) => ({
        ...currentState,
        items: [notification, ...currentState.items],
      }))
    }

    function handleNotificationRead(notification) {
      setNotificationsState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) =>
          item._id === notification._id ? notification : item,
        ),
      }))
    }

    function handleNotificationReadAll(payload) {
      setNotificationsState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) => ({
          ...item,
          readAt: item.readAt || payload.readAt,
        })),
      }))
    }

    socket.on('notification:new', handleNotificationNew)
    socket.on('notification:read', handleNotificationRead)
    socket.on('notification:read:all', handleNotificationReadAll)

    return () => {
      socket.off('notification:new', handleNotificationNew)
      socket.off('notification:read', handleNotificationRead)
      socket.off('notification:read:all', handleNotificationReadAll)
      disconnectSocketClient()
    }
  }, [isAuthenticated])

  if (status === 'loading') {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${lang}/login`} replace />
  }

  async function handleMarkRead(notificationId) {
    try {
      const payload = await markNotificationRead(notificationId)

      setNotificationsState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) =>
          item._id === notificationId ? payload.notification : item,
        ),
      }))
    } catch (error) {
      setNotificationsState((currentState) => ({
        ...currentState,
        error: error.message || t('notificationsPage.errors.markRead'),
      }))
    }
  }

  async function handleMarkAllRead() {
    setIsMarkingAll(true)

    try {
      const payload = await markAllNotificationsRead()

      setNotificationsState((currentState) => ({
        ...currentState,
        items: currentState.items.map((item) => ({
          ...item,
          readAt: item.readAt || payload.readAt,
        })),
      }))
    } catch (error) {
      setNotificationsState((currentState) => ({
        ...currentState,
        error: error.message || t('notificationsPage.errors.markAll'),
      }))
    } finally {
      setIsMarkingAll(false)
    }
  }

  async function handleDeleteNotification(notificationId) {
    setDeletingId(notificationId)
    try {
      await deleteNotification(notificationId)

      setNotificationsState((currentState) => ({
        ...currentState,
        items: currentState.items.filter((item) => item._id !== notificationId),
      }))
    } catch (error) {
      setNotificationsState((currentState) => ({
        ...currentState,
        error: error.message || t('notificationsPage.errors.delete'),
      }))
    } finally {
      setDeletingId(null)
    }
  }

  function handleOpenNotification(notification) {
    if (!notification) return

    if (!notification.readAt) {
      handleMarkRead(notification._id)
    }

    const targetRoute = buildNotificationRoute(notification, lang)
    navigate(targetRoute)
  }

  return (
    <>
      <Seo
        title={`My Social 1 - ${t('pages.notifications')}`}
        description={t('notificationsPage.seoDescription')}
      />

      <SocialLayout
        pageTitle={t('pages.notifications')}
        activeKey="notifications"
        showDesktopPageHeader={false}
        initialSidebarOpen={false}
      >
        <section className="rounded-lg border border-border bg-card p-0 shadow-sm md:p-6">
          <div className="flex flex-row justify-between gap-4 p-3 md:items-center">
            <div>
              <h1 className="text-md font-semibold tracking-tight text-text">
                {t('notificationsPage.title')}
              </h1>
            
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setNotificationsState((currentState) => ({
                    ...currentState,
                    unreadOnly: !currentState.unreadOnly,
                  }))
                }
                className={`rounded-lg border px-3 py-2 text-xs font-regular ${
                  notificationsState.unreadOnly
                    ? 'border-border-strong bg-primary text-inverse'
                    : 'border-border bg-card text-text hover:bg-secondary'
                }`}
              >
                {notificationsState.unreadOnly
                  ? t('notificationsPage.filters.unreadOnly')
                  : t('notificationsPage.filters.all')}
              </button>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="rounded-lg border border-border px-3 py-2 text-xs font-regular text-text transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMarkingAll
                  ? t('notificationsPage.actions.marking')
                  : t('notificationsPage.actions.markAllRead')}
              </button>
            </div>
          </div>

          {notificationsState.error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {notificationsState.error}
            </div>
          ) : null}

          <div className="space-y-0 md:mt-5 md:space-y-3">
            {notificationsState.isLoading ? (
              <div className="rounded-3xl border border-border bg-secondary px-4 py-5 text-sm text-muted">
                {t('notificationsPage.loading')}
              </div>
            ) : null}

            {!notificationsState.isLoading && !notificationsState.items.length ? (
              <div className="rounded-3xl border border-dashed border-border bg-secondary px-4 py-5 text-sm text-muted">
                {t('notificationsPage.empty')}
              </div>
            ) : null}

            {notificationsState.items.map((notification) => {
              const actor = notification.actor || {}
              const isUnread = !notification.readAt
              const content = formatNotificationContent(notification, t)

              return (
                <article
                  key={notification._id}
                  className={`border px-4 py-4 transition md:rounded-lg ${
                    isUnread
                      ? 'border-border bg-secondary text-text'
                      : 'border-border bg-card text-text'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(notification)}
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left transition hover:bg-secondary/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      aria-label={t('notificationsPage.actions.open')}
                    >
                      <UserAvatar
                        user={actor}
                        className={`size-11 shrink-0 ${
                          isUnread ? 'bg-card text-text' : 'bg-primary text-inverse'
                        }`}
                        textClassName="text-sm font-semibold"
                        imageClassName="object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">
                            {content.title}
                          </p>
                          <span className={isUnread ? 'text-xs text-muted' : 'text-xs text-soft'}>
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted">{content.body}</p>
                        <p className={`mt-2 text-xs ${isUnread ? 'text-muted' : 'text-soft'}`}>
                          {actor.username
                            ? <span className="flex items-center gap-1">@{actor.username} - {getFullName(actor)} <VerifiedBadge user={actor} size="xs" /></span>
                            : t('notificationsPage.systemActor')}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleMarkRead(notification._id)
                          }}
                          className="rounded-lg bg-card px-3 py-2 text-xs font-regular text-text transition hover:bg-secondary"
                        >
                          {t('notificationsPage.actions.markRead')}
                        </button>
                      ) : (
                        <span className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                          {t('notificationsPage.readLabel')}
                        </span>
                      )}

                      <div className="relative" data-notification-menu>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setOpenMenuId(openMenuId === notification._id ? null : notification._id)
                          }}
                          className="grid size-8 place-items-center rounded-lg border border-border bg-card text-text transition hover:bg-secondary focus:outline-none"
                          aria-label={t('notificationsPage.actions.moreOptions')}
                          title={t('notificationsPage.actions.moreOptions')}
                        >
                          <DotsIcon className="size-4" />
                        </button>

                        {openMenuId === notification._id ? (
                          <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-32 rounded-xl border border-border bg-card p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
                            <button
                              type="button"
                              disabled={deletingId === notification._id}
                              onClick={(event) => {
                                event.stopPropagation()
                                setOpenMenuId(null)
                                handleDeleteNotification(notification._id)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-secondary disabled:opacity-50"
                            >
                              <TrashIcon className="size-3.5" />
                              {deletingId === notification._id
                                ? t('notificationsPage.actions.deleting')
                                : t('notificationsPage.actions.delete')}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </SocialLayout>
    </>
  )
}

export default NotificationsPage
