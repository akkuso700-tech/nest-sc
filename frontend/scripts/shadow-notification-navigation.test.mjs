import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildNotificationRoute,
  formatNotificationContent,
  normalizeId,
} from '../src/utils/social.js'

test('normalizeId handles string, ObjectId-like object, and null values safely', () => {
  assert.equal(normalizeId(null), '')
  assert.equal(normalizeId(undefined), '')
  assert.equal(normalizeId('661234abcd5678'), '661234abcd5678')
  assert.equal(normalizeId({ $oid: '661234abcd5678' }), '661234abcd5678')
  assert.equal(normalizeId({ toString: () => 'custom_id_123' }), 'custom_id_123')
})

test('buildNotificationRoute routes shadow_message with targetChatKey directly to Lounge chat', () => {
  const notification = {
    _id: 'notif-1',
    type: 'shadow_message',
    entityKind: 'shadow_message',
    entityId: 'msg-999',
    targetChatKey: 'anon_direct_alice_bob',
    title: 'Gölge Modu',
    body: 'Gölge Ninja: Merhaba!',
  }

  const routeTr = buildNotificationRoute(notification, 'tr')
  assert.equal(routeTr, '/tr/hidden-profile?chat=anon_direct_alice_bob')

  const routeEn = buildNotificationRoute(notification, 'en')
  assert.equal(routeEn, '/en/hidden-profile?chat=anon_direct_alice_bob')
})

test('buildNotificationRoute routes shadow_message with special characters properly URI-encoded', () => {
  const notification = {
    _id: 'notif-2',
    type: 'shadow_message',
    entityKind: 'shadow_message',
    targetChatKey: 'chat key with spaces & symbols#123',
  }

  const route = buildNotificationRoute(notification, 'tr')
  assert.equal(
    route,
    '/tr/hidden-profile?chat=chat%20key%20with%20spaces%20%26%20symbols%23123',
  )
})

test('buildNotificationRoute routes shadow room notification to Lounge room', () => {
  const notification = {
    _id: 'notif-3',
    type: 'shadow_message',
    entityKind: 'shadow_message',
    entityId: 'room-abc-123',
    title: 'Gölge Modu Katılım İsteği',
  }

  const route = buildNotificationRoute(notification, 'tr')
  assert.equal(route, '/tr/hidden-profile?room=room-abc-123')
})

test('buildNotificationRoute falls back cleanly to /hidden-profile when no specific key provided', () => {
  const notification = {
    _id: 'notif-4',
    type: 'shadow_message',
    entityKind: 'shadow_message',
  }

  const route = buildNotificationRoute(notification, 'tr')
  assert.equal(route, '/tr/hidden-profile')
})

test('buildNotificationRoute maintains expected behavior for normal mode notifications', () => {
  // Follow notification
  const followNotif = {
    type: 'follow',
    actor: { username: 'testuser' },
  }
  assert.equal(buildNotificationRoute(followNotif, 'tr'), '/tr/u/testuser')

  // Direct Message notification
  const messageNotif = {
    type: 'message',
    targetConversationId: 'conv-123',
    actor: { id: 'user-456', username: 'janedoe' },
  }
  const msgRoute = buildNotificationRoute(messageNotif, 'tr')
  assert.match(msgRoute, /^\/tr\/messages\?/)
  assert.match(msgRoute, /conversationId=conv-123/)
  assert.match(msgRoute, /recipientId=user-456/)
  assert.match(msgRoute, /username=janedoe/)

  // Post notification
  const postNotif = {
    type: 'like',
    entityKind: 'post',
    targetPostId: 'post-789',
  }
  assert.equal(buildNotificationRoute(postNotif, 'tr'), '/tr/posts/post-789')
})

test('formatNotificationContent handles shadow_message format correctly', () => {
  const notif = {
    type: 'shadow_message',
    title: 'Gölge Modu',
    body: 'Gölge Gezgin: Selam',
  }
  const formatted = formatNotificationContent(notif)
  assert.equal(formatted.title, 'Gölge Modu')
  assert.equal(formatted.body, 'Gölge Gezgin: Selam')

  // Default fallback if fields are omitted
  const fallback = formatNotificationContent({ type: 'shadow_message' })
  assert.equal(fallback.title, 'Gölge Modu')
  assert.equal(fallback.body, 'Gölge modunda yeni bir mesajınız var.')

  // Aggregated notification with unreadCount > 1
  const aggregated = formatNotificationContent({
    type: 'shadow_message',
    title: 'Gölge Modu',
    body: 'Gölge Gezgin: Yeni mesaj',
    unreadCount: 4,
  })
  assert.equal(aggregated.title, 'Gölge Modu • 4 yeni mesaj')
  assert.equal(aggregated.unreadCount, 4)
})

test('simulated normal mode to shadow mode notification click matches direct chat correctly', () => {
  // 1. Notification arrived from backend socket while user is in normal mode
  const backendNotification = {
    _id: '661000000000000000000001',
    user: '660000000000000000000002',
    actor: null,
    type: 'shadow_message',
    entityKind: 'shadow_message',
    entityId: '662000000000000000000003', // savedMsg id
    targetChatKey: 'anon_direct_session_alpha_beta',
    title: 'Gölge Modu',
    body: 'Gölge Kartal#456: Yeni mesaj',
    readAt: null,
    createdAt: new Date().toISOString(),
  }

  // 2. User clicks notification in top navbar dropdown or notifications page
  const targetUrl = buildNotificationRoute(backendNotification, 'tr')
  assert.equal(targetUrl, '/tr/hidden-profile?chat=anon_direct_session_alpha_beta')

  // 3. Lounge page extracts URL query parameter
  const searchPart = targetUrl.split('?')[1]
  const queryParams = new URLSearchParams(searchPart)
  const chatParam = queryParams.get('chat')
  assert.equal(chatParam, 'anon_direct_session_alpha_beta')

  // 4. Lounge page matches targetChat against directChats list
  const sampleDirectChats = [
    {
      sessionId: 'anon_direct_other_user',
      chatKey: 'anon_direct_other_user',
      partner: { alias: 'Gölge Kurt#111' },
    },
    {
      sessionId: 'anon_direct_session_alpha_beta',
      chatKey: 'anon_direct_session_alpha_beta',
      partner: { alias: 'Gölge Kartal#456' },
    },
  ]

  const matchedChat = sampleDirectChats.find(
    (c) => c.chatKey === chatParam || c.sessionId === chatParam,
  )
  assert.ok(matchedChat, 'Direct chat must be found in lounge directChats list')
  assert.equal(matchedChat.partner.alias, 'Gölge Kartal#456')
})