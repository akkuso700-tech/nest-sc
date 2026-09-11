const { AnonymousRoom } = require('../models/AnonymousRoom')
const { User } = require('../models/User')
const { Notification } = require('../models/Notification')
const { sendEmail } = require('../services/emailService')
const { buildShadowMessageNotificationEmail } = require('../templates/shadowMessageNotificationEmail')
const { env } = require('../config/env')
const {
  getOrCreateAnonymousProfile,
  saveRoomMessage,
  deleteRoomMessage,
  deleteCustomRoom,
  blockAnonymousUser,
  getDirectChatKey,
  getOrCreateDirectChat,
  saveDirectChatMessage,
  deleteDirectChatForUser,
  markDirectChatAsRead,
  joinRoomByAccessCode,
  requestRoomJoin,
  approveRoomJoin,
  rejectRoomJoin,
  kickRoomMember,
  banRoomMember,
} = require('../services/anonymousService')

// In-memory state for anonymous realtime interactions
// anonymousId -> { socketId, userId, userDoc, alias, avatarKey, gender, ageRange, status, activeRoomId, directSessionId, blockedAnonymousIds }
const activeAnonUsers = new Map()
// userId -> anonymousId
const userToAnonMap = new Map()
// Queue for Omegle-style quick match: [anonymousId, ...]
const quickMatchQueue = []
// active direct sessions: sessionId -> { p1: anonymousId, p2: anonymousId, p1Revealed: bool, p2Revealed: bool, messageCount: number }
const activeDirectSessions = new Map()

function getOrCreateActiveSession(sessionId) {
  let session = activeDirectSessions.get(sessionId)
  if (!session) {
    const parts = String(sessionId).split('_')
    session = {
      sessionId,
      p1: parts[0] || '',
      p2: parts[1] || '',
      p1Revealed: false,
      p2Revealed: false,
      messageCount: 0,
    }
    activeDirectSessions.set(sessionId, session)
  }
  return session
}

function getCleanAnonUserList(currentAnonId) {
  const currentUserData = activeAnonUsers.get(currentAnonId)
  const myBlocked = currentUserData?.blockedAnonymousIds || []

  const list = []
  for (const [anonId, data] of activeAnonUsers.entries()) {
    if (anonId === currentAnonId) continue
    if (myBlocked.includes(anonId)) continue
    if (Array.isArray(data.blockedAnonymousIds) && data.blockedAnonymousIds.includes(currentAnonId)) continue

    list.push({
      anonymousId: anonId,
      alias: data.alias,
      avatarKey: data.avatarKey,
      gender: data.gender,
      ageRange: data.ageRange,
      status: data.status,
      isBusy: Boolean(data.directSessionId),
    })
  }
  return list
}

function registerAnonymousSockets(io, socket) {
  const userId = socket.user?._id?.toString()

  // 1. JOIN LOUNGE
  socket.on('anon:join_lounge', async (payload, ack) => {
    try {
      if (!socket.user) return

      const profile = await getOrCreateAnonymousProfile(socket.user)
      const anonId = profile.anonymousId

      const userData = {
        socketId: socket.id,
        userId,
        userDoc: socket.user,
        alias: profile.alias,
        avatarKey: profile.avatarKey,
        gender: profile.gender,
        ageRange: profile.ageRange,
        status: profile.status,
        blockedAnonymousIds: profile.blockedAnonymousIds || [],
        activeRoomId: null,
        directSessionId: null,
      }

      activeAnonUsers.set(anonId, userData)
      userToAnonMap.set(userId, anonId)
      socket.join('lounge_global')

      const onlineList = getCleanAnonUserList(anonId)

      // Broadcast to other lounge members
      socket.to('lounge_global').emit('anon:user_joined', {
        anonymousId: anonId,
        alias: profile.alias,
        avatarKey: profile.avatarKey,
        gender: profile.gender,
        ageRange: profile.ageRange,
        status: profile.status,
      })

      if (typeof ack === 'function') {
        ack({
          success: true,
          profile,
          onlineUsers: onlineList,
        })
      }
    } catch (err) {
      console.error('anon:join_lounge error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 2. LEAVE LOUNGE
  socket.on('anon:leave_lounge', () => {
    const anonId = userToAnonMap.get(userId)
    if (anonId && activeAnonUsers.has(anonId)) {
      activeAnonUsers.delete(anonId)
      userToAnonMap.delete(userId)
      socket.leave('lounge_global')
      io.to('lounge_global').emit('anon:user_left', { anonymousId: anonId })
    }
  })

  // 3. JOIN A THEMATIC ROOM
  socket.on('anon:join_room', async ({ roomId }, ack) => {
    try {
      if (!roomId) return

      const room = await AnonymousRoom.findById(roomId)
      if (!room) {
        if (typeof ack === 'function') ack({ success: false, error: 'Oda bulunamadı.' })
        return
      }

      const anonId = userToAnonMap.get(userId)
      if (Array.isArray(room.bannedAnonymousIds) && anonId && room.bannedAnonymousIds.includes(anonId)) {
        if (typeof ack === 'function') ack({ success: false, error: 'Bu odaya girişiniz engellenmiştir.' })
        return
      }

      if (room.isPrivate) {
        const isOwner = room.createdBy && room.createdBy.toString() === userId
        const isAdmin = socket.user?.role === 'admin'
        const isAllowed = anonId && Array.isArray(room.allowedAnonymousIds) && room.allowedAnonymousIds.includes(anonId)
        if (!isOwner && !isAdmin && !isAllowed) {
          if (typeof ack === 'function') ack({ success: false, error: 'Bu gizli odaya erişim izniniz yok.' })
          return
        }
      }

      const roomKey = `anon_room:${roomId}`
      socket.join(roomKey)

      if (anonId && activeAnonUsers.has(anonId)) {
        activeAnonUsers.get(anonId).activeRoomId = roomId
      }

      // Update room active count
      room.activeCount = (room.activeCount || 0) + 1
      await room.save()

      io.to(roomKey).emit('anon:room_count_changed', {
        roomId,
        activeCount: room.activeCount,
      })

      if (typeof ack === 'function') {
        ack({ success: true, activeCount: room.activeCount })
      }
    } catch (err) {
      console.error('anon:join_room error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 3.1 JOIN A PRIVATE ROOM BY ACCESS CODE
  socket.on('anon:join_room_by_code', async ({ accessCode }, ack) => {
    try {
      if (!accessCode || !socket.user) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz istek.' })
        return
      }

      const room = await joinRoomByAccessCode(socket.user, accessCode)
      const roomKey = `anon_room:${room.id}`
      socket.join(roomKey)

      const anonId = userToAnonMap.get(userId)
      if (anonId && activeAnonUsers.has(anonId)) {
        activeAnonUsers.get(anonId).activeRoomId = room.id
      }

      const updated = await AnonymousRoom.findByIdAndUpdate(
        room.id,
        { $inc: { activeCount: 1 } },
        { new: true },
      )

      io.to(roomKey).emit('anon:room_count_changed', {
        roomId: room.id,
        activeCount: updated ? updated.activeCount : 1,
      })

      if (typeof ack === 'function') {
        ack({ success: true, room, activeCount: updated ? updated.activeCount : 1 })
      }
    } catch (err) {
      console.error('anon:join_room_by_code error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 3.2 REQUEST JOIN PRIVATE ROOM
  socket.on('anon:request_room_join', async ({ roomId }, ack) => {
    try {
      if (!socket.user || !roomId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz istek.' })
        return
      }

      const result = await requestRoomJoin(socket.user, roomId)

      if (result.isPending && result.creatorUserId) {
        // 1. Notify creator via lounge socket if online
        const creatorAnonId = userToAnonMap.get(result.creatorUserId)
        const creatorData = creatorAnonId ? activeAnonUsers.get(creatorAnonId) : null
        if (creatorData && creatorData.socketId) {
          io.to(creatorData.socketId).emit('anon:room_join_requested', {
            roomId: result.roomId,
            roomName: result.roomName,
            requester: result.requester,
          })
        }

        // 2. In-app notification to creator (if enabled)
        void (async () => {
          try {
            const creatorUser = await User.findById(result.creatorUserId)
            if (!creatorUser || creatorUser.accountStatus === 'suspended') return

            if (creatorUser.preferences?.inAppNotifications?.shadowMessages) {
              const notification = await Notification.create({
                user: creatorUser._id,
                actor: null,
                type: 'shadow_message',
                entityKind: 'shadow_message',
                entityId: result.roomId,
                title: 'Gölge Modu Katılım İsteği',
                body: `${result.requester.alias}, "${result.roomName}" gizli odanıza katılmak istiyor.`,
              })

              io.to(`user:${creatorUser._id}`).emit('notification:new', {
                ...(notification.toObject ? notification.toObject() : notification),
              })
            }
          } catch (notifErr) {
            console.error('Room request in-app notification error:', notifErr)
          }
        })()
      }

      if (typeof ack === 'function') ack(result)
    } catch (err) {
      console.error('anon:request_room_join error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 3.3 APPROVE ROOM JOIN REQUEST
  socket.on('anon:approve_room_join', async ({ roomId, requesterAnonymousId }, ack) => {
    try {
      if (!socket.user || !roomId || !requesterAnonymousId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz istek.' })
        return
      }

      const result = await approveRoomJoin(socket.user, roomId, requesterAnonymousId)

      // 1. Add requester's socket to the room channel so they receive messages instantly
      const requesterData = activeAnonUsers.get(requesterAnonymousId)
      if (requesterData && requesterData.socketId) {
        const requesterSocket = io.sockets.sockets.get(requesterData.socketId)
        if (requesterSocket) {
          requesterSocket.join(`anon_room:${roomId}`)
          if (requesterData) {
            requesterData.activeRoomId = roomId
          }
        }
        // 2. Notify requester that they've been approved
        io.to(requesterData.socketId).emit('anon:room_request_approved', {
          roomId: result.roomId,
          roomName: result.roomName,
        })
      }

      // 3. In-app notification to requester (if enabled)
      if (result.requesterUserId) {
        void (async () => {
          try {
            const requesterUser = await User.findById(result.requesterUserId)
            if (!requesterUser || requesterUser.accountStatus === 'suspended') return

            if (requesterUser.preferences?.inAppNotifications?.shadowMessages) {
              const notification = await Notification.create({
                user: requesterUser._id,
                actor: null,
                type: 'shadow_message',
                entityKind: 'shadow_message',
                entityId: result.roomId,
                title: 'Gölge Modu',
                body: `"${result.roomName}" gizli odasına katılım isteğiniz onaylandı! 🎉`,
              })

              io.to(`user:${requesterUser._id}`).emit('notification:new', {
                ...(notification.toObject ? notification.toObject() : notification),
              })
            }
          } catch (notifErr) {
            console.error('Room approval in-app notification error:', notifErr)
          }
        })()
      }

      if (typeof ack === 'function') ack(result)
    } catch (err) {
      console.error('anon:approve_room_join error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 3.4 REJECT ROOM JOIN REQUEST
  socket.on('anon:reject_room_join', async ({ roomId, requesterAnonymousId }, ack) => {
    try {
      if (!socket.user || !roomId || !requesterAnonymousId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz istek.' })
        return
      }

      const result = await rejectRoomJoin(socket.user, roomId, requesterAnonymousId)

      // Optionally notify requester
      const requesterData = activeAnonUsers.get(requesterAnonymousId)
      if (requesterData && requesterData.socketId) {
        io.to(requesterData.socketId).emit('anon:room_request_rejected', {
          roomId: result.roomId,
        })
      }

      if (typeof ack === 'function') ack(result)
    } catch (err) {
      console.error('anon:reject_room_join error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 3.4 GET ROOM MEMBERS
  socket.on('anon:get_room_members', async ({ roomId }, ack) => {
    try {
      if (!roomId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Oda ID belirtilmedi.' })
        return
      }
      const room = await AnonymousRoom.findById(roomId)
      if (!room) {
        if (typeof ack === 'function') ack({ success: false, error: 'Oda bulunamadı.' })
        return
      }

      const members = []
      const seenAnonIds = new Set()

      for (const [anonId, data] of activeAnonUsers.entries()) {
        if (data.activeRoomId === roomId) {
          const isHost = Boolean(room.createdBy && data.userId && room.createdBy.toString() === data.userId.toString())
          members.push({
            anonymousId: anonId,
            alias: data.alias || 'Anonim',
            avatarKey: data.avatarKey || 'avatar-1',
            gender: data.gender || 'unspecified',
            ageRange: data.ageRange || 'unspecified',
            status: data.status || '',
            isHost,
          })
          seenAnonIds.add(anonId)
        }
      }

      // If current user is viewing the room, ensure they are in the list
      const myAnonId = userToAnonMap.get(userId)
      if (myAnonId && !seenAnonIds.has(myAnonId)) {
        const myData = activeAnonUsers.get(myAnonId)
        if (myData) {
          members.push({
            anonymousId: myAnonId,
            alias: myData.alias || 'Anonim',
            avatarKey: myData.avatarKey || 'avatar-1',
            gender: myData.gender || 'unspecified',
            ageRange: myData.ageRange || 'unspecified',
            status: myData.status || '',
            isHost: Boolean(room.createdBy && myData.userId && room.createdBy.toString() === myData.userId.toString()),
          })
          seenAnonIds.add(myAnonId)
        }
      }

      const isHostUser = Boolean(room.createdBy && room.createdBy.toString() === userId) || socket.user?.role === 'admin'

      if (typeof ack === 'function') {
        ack({
          success: true,
          roomId,
          members,
          isHost: isHostUser,
        })
      }
    } catch (err) {
      console.error('anon:get_room_members error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 3.5 KICK ROOM MEMBER (Host/Admin only)
  socket.on('anon:kick_room_member', async ({ roomId, targetAnonymousId }, ack) => {
    try {
      if (!socket.user || !roomId || !targetAnonymousId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz parametre.' })
        return
      }

      const result = await kickRoomMember(socket.user, roomId, targetAnonymousId)

      // Disconnect target socket from room channel and reset activeRoomId
      const targetData = activeAnonUsers.get(targetAnonymousId)
      if (targetData) {
        if (targetData.activeRoomId === roomId) {
          targetData.activeRoomId = null
        }
        if (targetData.socketId) {
          const targetSocket = io.sockets.sockets.get(targetData.socketId)
          if (targetSocket) {
            targetSocket.leave(`anon_room:${roomId}`)
          }
          io.to(targetData.socketId).emit('anon:kicked_from_room', {
            roomId,
            message: 'Oda yöneticisi tarafından odadan çıkarıldınız.',
          })
        }
      }

      // Broadcast updated count & removed member to room channel
      io.to(`anon_room:${roomId}`).emit('anon:room_count_changed', {
        roomId,
        activeCount: result.activeCount,
      })
      io.to(`anon_room:${roomId}`).emit('anon:member_removed', {
        roomId,
        targetAnonymousId,
      })

      if (typeof ack === 'function') ack(result)
    } catch (err) {
      console.error('anon:kick_room_member error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 3.6 BAN ROOM MEMBER (Host/Admin only)
  socket.on('anon:ban_room_member', async ({ roomId, targetAnonymousId }, ack) => {
    try {
      if (!socket.user || !roomId || !targetAnonymousId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz parametre.' })
        return
      }

      const result = await banRoomMember(socket.user, roomId, targetAnonymousId)

      // Disconnect target socket from room channel and reset activeRoomId
      const targetData = activeAnonUsers.get(targetAnonymousId)
      if (targetData) {
        if (targetData.activeRoomId === roomId) {
          targetData.activeRoomId = null
        }
        if (targetData.socketId) {
          const targetSocket = io.sockets.sockets.get(targetData.socketId)
          if (targetSocket) {
            targetSocket.leave(`anon_room:${roomId}`)
          }
          io.to(targetData.socketId).emit('anon:banned_from_room', {
            roomId,
            message: 'Bu odaya girişiniz oda yöneticisi tarafından engellendi.',
          })
        }
      }

      // Broadcast updated count & removed member to room channel
      io.to(`anon_room:${roomId}`).emit('anon:room_count_changed', {
        roomId,
        activeCount: result.activeCount,
      })
      io.to(`anon_room:${roomId}`).emit('anon:member_removed', {
        roomId,
        targetAnonymousId,
      })

      if (typeof ack === 'function') ack(result)
    } catch (err) {
      console.error('anon:ban_room_member error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 4. LEAVE ROOM
  socket.on('anon:leave_room', async ({ roomId }) => {
    if (!roomId) return
    const roomKey = `anon_room:${roomId}`
    socket.leave(roomKey)

    const anonId = userToAnonMap.get(userId)
    if (anonId && activeAnonUsers.has(anonId)) {
      activeAnonUsers.get(anonId).activeRoomId = null
    }

    try {
      const room = await AnonymousRoom.findByIdAndUpdate(
        roomId,
        { $inc: { activeCount: -1 } },
        { new: true },
      )
      if (room && room.activeCount < 0) {
        room.activeCount = 0
        await room.save()
      }
      io.to(roomKey).emit('anon:room_count_changed', {
        roomId,
        activeCount: room ? Math.max(0, room.activeCount) : 0,
      })
    } catch (err) {
      console.error('anon:leave_room error:', err)
    }
  })

  // 5. SEND MESSAGE TO ROOM
  socket.on('anon:send_room_message', async ({ roomId, text, media }, ack) => {
    try {
      if (!socket.user) {
        if (typeof ack === 'function') ack({ success: false, error: 'Oturum açmalısınız.' })
        return
      }
      const hasText = Boolean(text && text.trim())
      const hasMedia = Array.isArray(media) && media.length > 0

      if (!roomId || (!hasText && !hasMedia)) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz mesaj veya medya.' })
        return
      }

      const room = await AnonymousRoom.findById(roomId)
      if (!room) {
        if (typeof ack === 'function') ack({ success: false, error: 'Oda bulunamadı.' })
        return
      }

      const myAnonId = userToAnonMap.get(userId)
      if (Array.isArray(room.bannedAnonymousIds) && myAnonId && room.bannedAnonymousIds.includes(myAnonId)) {
        if (typeof ack === 'function') ack({ success: false, error: 'Bu odaya girişiniz engellenmiştir.' })
        return
      }

      const savedMessage = await saveRoomMessage({
        roomId,
        user: socket.user,
        text: text || '',
        media: hasMedia ? media : [],
      })

      io.to(`anon_room:${roomId}`).emit('anon:new_room_message', savedMessage)

      if (typeof ack === 'function') ack({ success: true, message: savedMessage })
    } catch (err) {
      console.error('anon:send_room_message error:', err)
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 6. DIRECT CHAT REQUEST (1-to-1)
  socket.on('anon:direct_request', ({ targetAnonymousId }, ack) => {
    try {
      const senderAnonId = userToAnonMap.get(userId)
      if (!senderAnonId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Lounge oturumunuz yok.' })
        return
      }

      const senderData = activeAnonUsers.get(senderAnonId)
      const targetData = activeAnonUsers.get(targetAnonymousId)

      if (!targetData) {
        if (typeof ack === 'function') ack({ success: false, error: 'Kullanıcı şu an çevrimdışı.' })
        return
      }

      if (targetData.directSessionId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Kullanıcı şu an başka bir sohbette.' })
        return
      }

      const senderBlocked = senderData.blockedAnonymousIds || []
      const targetBlocked = targetData.blockedAnonymousIds || []
      if (senderBlocked.includes(targetAnonymousId) || targetBlocked.includes(senderAnonId)) {
        if (typeof ack === 'function') ack({ success: false, error: 'Bu kullanıcı şu an istek kabul etmiyor.' })
        return
      }

      // Send incoming request to target socket
      io.to(targetData.socketId).emit('anon:incoming_direct_request', {
        from: {
          anonymousId: senderAnonId,
          alias: senderData.alias,
          avatarKey: senderData.avatarKey,
          gender: senderData.gender,
          ageRange: senderData.ageRange,
          status: senderData.status,
        },
      })

      if (typeof ack === 'function') ack({ success: true })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 7. DIRECT CHAT ACCEPT
  socket.on('anon:direct_accept', async ({ requesterAnonymousId }, ack) => {
    try {
      const myAnonId = userToAnonMap.get(userId)
      const myData = activeAnonUsers.get(myAnonId)
      const requesterData = activeAnonUsers.get(requesterAnonymousId)

      if (!myData || !requesterData) {
        if (typeof ack === 'function') ack({ success: false, error: 'Kullanıcı artık çevrimdışı.' })
        return
      }

      // Persist or fetch direct chat in database
      const chat = await getOrCreateDirectChat(socket.user, requesterAnonymousId, requesterData)
      const sessionId = chat.chatKey

      const session = getOrCreateActiveSession(sessionId)
      session.p1 = requesterAnonymousId
      session.p2 = myAnonId

      myData.directSessionId = sessionId
      requesterData.directSessionId = sessionId

      const sessionRoom = `anon_direct:${sessionId}`
      socket.join(sessionRoom)
      const requesterSocket = io.sockets.sockets.get(requesterData.socketId)
      if (requesterSocket) {
        requesterSocket.join(sessionRoom)
      }

      // Notify both
      socket.emit('anon:direct_started', {
        sessionId,
        chatKey: sessionId,
        partner: {
          anonymousId: requesterAnonymousId,
          alias: requesterData.alias,
          avatarKey: requesterData.avatarKey,
          gender: requesterData.gender,
          ageRange: requesterData.ageRange,
          status: requesterData.status,
        },
      })

      if (requesterSocket) {
        requesterSocket.emit('anon:direct_started', {
          sessionId,
          chatKey: sessionId,
          partner: {
            anonymousId: myAnonId,
            alias: myData.alias,
            avatarKey: myData.avatarKey,
            gender: myData.gender,
            ageRange: myData.ageRange,
            status: myData.status,
          },
        })
      }

      // Notify lounge that these two are busy
      io.to('lounge_global').emit('anon:user_status_changed', {
        anonymousId: myAnonId,
        isBusy: true,
      })
      io.to('lounge_global').emit('anon:user_status_changed', {
        anonymousId: requesterAnonymousId,
        isBusy: true,
      })

      if (typeof ack === 'function') ack({ success: true, sessionId })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 7.1 JOIN DIRECT CHAT ROOM (When opening existing chat from list)
  socket.on('anon:join_direct', async ({ sessionId, chatKey }, ack) => {
    try {
      const targetKey = chatKey || sessionId
      if (!targetKey) return
      const myAnonId = userToAnonMap.get(userId)
      if (!myAnonId) return

      const sessionRoom = `anon_direct:${targetKey}`
      socket.join(sessionRoom)

      getOrCreateActiveSession(targetKey)

      const myData = activeAnonUsers.get(myAnonId)
      if (myData) {
        myData.directSessionId = targetKey
      }

      // Mark unread messages as read upon entering chat
      if (socket.user) {
        await markDirectChatAsRead(socket.user, targetKey)
        io.to(sessionRoom).emit('anon:messages_read', {
          sessionId: targetKey,
          chatKey: targetKey,
          readBy: myAnonId,
          readAt: new Date().toISOString(),
        })
      }

      if (typeof ack === 'function') ack({ success: true, targetKey })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 7.2 MARK MESSAGES READ EXPLICITLY
  socket.on('anon:mark_messages_read', async ({ sessionId, chatKey }, ack) => {
    try {
      const targetKey = chatKey || sessionId
      if (!targetKey || !socket.user) return
      const myAnonId = userToAnonMap.get(userId)
      if (!myAnonId) return

      await markDirectChatAsRead(socket.user, targetKey)

      io.to(`anon_direct:${targetKey}`).emit('anon:messages_read', {
        sessionId: targetKey,
        chatKey: targetKey,
        readBy: myAnonId,
        readAt: new Date().toISOString(),
      })

      if (typeof ack === 'function') ack({ success: true })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 8. DIRECT CHAT REJECT
  socket.on('anon:direct_reject', ({ requesterAnonymousId }) => {
    const requesterData = activeAnonUsers.get(requesterAnonymousId)
    if (requesterData) {
      io.to(requesterData.socketId).emit('anon:direct_rejected', {
        by: userToAnonMap.get(userId),
      })
    }
  })

  // 9. DIRECT MESSAGE
  socket.on('anon:send_direct_message', async ({ sessionId, text, media }, ack) => {
    try {
      if (!socket.user) {
        if (typeof ack === 'function') ack({ success: false, error: 'Oturum açmalısınız.' })
        return
      }

      const myAnonId = userToAnonMap.get(userId)
      const myData = activeAnonUsers.get(myAnonId)
      if (!myData) return

      const cleanText = typeof text === 'string' ? text.trim().slice(0, 1000) : ''
      const cleanMedia = Array.isArray(media) ? media : []

      if (!cleanText && cleanMedia.length === 0) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz mesaj veya medya.' })
        return
      }

      // Check partner presence for delivery & read status
      const parts = String(sessionId).split('_')
      const partnerAnonId = parts.find((p) => p !== myAnonId)
      const partnerData = partnerAnonId ? activeAnonUsers.get(partnerAnonId) : null

      let msgStatus = 'sent'
      if (partnerData) {
        if (partnerData.directSessionId === sessionId) {
          msgStatus = 'read'
        } else {
          msgStatus = 'delivered'
        }
      }

      // Persist to MongoDB with real delivery status
      const savedMsg = await saveDirectChatMessage({
        chatKey: sessionId,
        user: socket.user,
        text: cleanText,
        media: cleanMedia,
        status: msgStatus,
      })

      const session = getOrCreateActiveSession(sessionId)
      session.messageCount = (session.messageCount || 0) + 1
      savedMsg.totalMessageCount = session.messageCount

      io.to(`anon_direct:${sessionId}`).emit('anon:new_direct_message', savedMsg)

      // Notify partner directly if online in lounge
      if (partnerData && partnerData.socketId) {
        io.to(partnerData.socketId).emit('anon:direct_message_notification', {
          sessionId,
          message: savedMsg,
        })
      }

      // Check partner preferences for site-wide in-app and email notifications
      if (partnerAnonId) {
        void (async () => {
          try {
            const partnerUser = await User.findOne({ 'anonymousProfile.anonymousId': partnerAnonId })
            if (!partnerUser || partnerUser.accountStatus === 'suspended') return

            // 1. Site-wide In-App Notification (Normal profil bildirimlerine yansıma)
            if (partnerUser.preferences?.inAppNotifications?.shadowMessages) {
              const isInCurrentDirectChat = partnerData && partnerData.directSessionId === sessionId
              if (!isInCurrentDirectChat) {
                const previewSnippet = cleanText
                  ? (cleanText.length > 80 ? cleanText.slice(0, 80) + '...' : cleanText)
                  : 'Yeni bir medya gönderdi.'

                const notification = await Notification.create({
                  user: partnerUser._id,
                  actor: null,
                  type: 'shadow_message',
                  entityKind: 'shadow_message',
                  entityId: savedMsg.id || null,
                  targetChatKey: sessionId,
                  title: 'Gölge Modu',
                  body: `${myData.alias}: ${previewSnippet}`,
                })

                io.to(`user:${partnerUser._id}`).emit('notification:new', {
                  ...(notification.toObject ? notification.toObject() : notification),
                  targetChatKey: sessionId,
                })
              }
            }

            // 2. Email Notification (Gölge Modu E-posta Bildirimi)
            if (partnerUser.preferences?.emailNotifications?.shadowMessages && partnerUser.email) {
              const userRoom = `user:${partnerUser._id}`
              const activeUserSockets = io.sockets?.adapter?.rooms?.get(userRoom)?.size || 0
              const isPartnerOnline = activeUserSockets > 0 || Boolean(partnerData)

              if (!isPartnerOnline) {
                const throttleMs = 5 * 60 * 1000 // 5 minutes debounce/throttle
                const lastSent = partnerUser.lastShadowMessageEmailSentAt
                  ? new Date(partnerUser.lastShadowMessageEmailSentAt).getTime()
                  : 0

                if (Date.now() - lastSent > throttleMs) {
                  partnerUser.lastShadowMessageEmailSentAt = new Date()
                  await partnerUser.save()

                  const clientUrl = env.clientUrl || 'https://my-social-web.onrender.com'
                  const actionUrl = `${clientUrl}/tr/lounge?chat=${sessionId}`
                  const emailData = buildShadowMessageNotificationEmail({
                    recipientName: partnerUser.firstName || partnerUser.username,
                    senderAlias: myData.alias,
                    messageCount: 1,
                    previewText: cleanText || 'Yeni bir medya gönderdi.',
                    actionUrl,
                  })

                  sendEmail({
                    to: partnerUser.email,
                    subject: emailData.subject,
                    html: emailData.html,
                    text: emailData.text,
                  }).catch((mailErr) => {
                    console.warn('[ShadowEmail] Failed to send email notification:', mailErr.message)
                  })
                }
              }
            }
          } catch (notifErr) {
            console.warn('[AnonymousSocket] Notification dispatch error:', notifErr.message)
          }
        })()
      }

      if (typeof ack === 'function') ack({ success: true, message: savedMsg })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 9.1 ANONYMOUS 1-ON-1 VOICE CALL SIGNALING
  socket.on('anon:call_start', ({ sessionId, offer }) => {
    try {
      const session = getOrCreateActiveSession(sessionId)
      if (!session) return

      const myAnonId = userToAnonMap.get(userId)
      const myData = activeAnonUsers.get(myAnonId)
      if (!myData) return

      socket.to(`anon_direct:${sessionId}`).emit('anon:incoming_call', {
        sessionId,
        callerAnonId: myAnonId,
        callerAlias: myData.alias,
        callerAvatar: myData.avatarKey,
        offer,
      })
    } catch (err) {
      console.error('anon:call_start error:', err)
    }
  })

  socket.on('anon:call_answer', ({ sessionId, answer }) => {
    try {
      const session = getOrCreateActiveSession(sessionId)
      if (!session) return

      socket.to(`anon_direct:${sessionId}`).emit('anon:call_answered', {
        sessionId,
        answer,
      })
    } catch (err) {
      console.error('anon:call_answer error:', err)
    }
  })

  socket.on('anon:call_ice_candidate', ({ sessionId, candidate }) => {
    try {
      const session = getOrCreateActiveSession(sessionId)
      if (!session) return

      socket.to(`anon_direct:${sessionId}`).emit('anon:call_ice_candidate', {
        sessionId,
        candidate,
      })
    } catch (err) {
      console.error('anon:call_ice_candidate error:', err)
    }
  })

  socket.on('anon:call_end', ({ sessionId, reason }) => {
    try {
      const session = getOrCreateActiveSession(sessionId)
      if (!session) return

      io.to(`anon_direct:${sessionId}`).emit('anon:call_ended', {
        sessionId,
        reason: reason || 'ended',
      })
    } catch (err) {
      console.error('anon:call_end error:', err)
    }
  })

  // 10. REVEAL IDENTITY (Maskeyi Düşür)
  socket.on('anon:reveal_identity_request', ({ sessionId }) => {
    const session = getOrCreateActiveSession(sessionId)
    if (!session) return

    const myAnonId = userToAnonMap.get(userId)
    if (session.p1 === myAnonId) {
      session.p1Revealed = true
    } else if (session.p2 === myAnonId) {
      session.p2Revealed = true
    }

    const sessionRoom = `anon_direct:${sessionId}`

    // If both revealed!
    if (session.p1Revealed && session.p2Revealed) {
      const p1Data = activeAnonUsers.get(session.p1)
      const p2Data = activeAnonUsers.get(session.p2)

      io.to(sessionRoom).emit('anon:identities_fully_revealed', {
        partner1: {
          anonymousId: session.p1,
          username: p1Data?.userDoc?.username,
          firstName: p1Data?.userDoc?.firstName,
          avatarUrl: p1Data?.userDoc?.avatarUrl,
        },
        partner2: {
          anonymousId: session.p2,
          username: p2Data?.userDoc?.username,
          firstName: p2Data?.userDoc?.firstName,
          avatarUrl: p2Data?.userDoc?.avatarUrl,
        },
      })
    } else {
      // Notify partner that this user has requested / agreed to reveal
      socket.to(sessionRoom).emit('anon:partner_reveal_requested', {
        byAnonymousId: myAnonId,
      })
    }
  })

  // 11. LEAVE DIRECT CHAT (Back to rooms/chats list, DOES NOT delete chat or wipe messages)
  socket.on('anon:leave_direct', ({ sessionId }) => {
    const myAnonId = userToAnonMap.get(userId)
    const myData = activeAnonUsers.get(myAnonId)
    if (myData) {
      myData.directSessionId = null
      io.to('lounge_global').emit('anon:user_status_changed', {
        anonymousId: myAnonId,
        isBusy: false,
      })
    }
    if (sessionId) {
      socket.leave(`anon_direct:${sessionId}`)
    }
  })

  // 11.1 DELETE DIRECT CHAT (Remove from user's list)
  socket.on('anon:delete_direct_chat', async ({ chatKey, sessionId }, ack) => {
    try {
      const targetKey = chatKey || sessionId
      if (!socket.user || !targetKey) return
      await deleteDirectChatForUser(socket.user, targetKey)
      socket.leave(`anon_direct:${targetKey}`)
      const myAnonId = userToAnonMap.get(userId)
      const myData = activeAnonUsers.get(myAnonId)
      if (myData && myData.directSessionId === targetKey) {
        myData.directSessionId = null
      }
      if (typeof ack === 'function') ack({ success: true, targetKey })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 12. QUICK MATCH (Rastgele Eşleş)
  socket.on('anon:quick_match', async (payload, ack) => {
    const myAnonId = userToAnonMap.get(userId)
    const myData = activeAnonUsers.get(myAnonId)

    if (!myData) {
      if (typeof ack === 'function') ack({ success: false, error: 'Lounge oturumunuz yok.' })
      return
    }

    if (myData.directSessionId) {
      if (typeof ack === 'function') ack({ success: false, error: 'Zaten bir sohbettesiniz.' })
      return
    }

    // Filter queue to remove disconnected or busy
    while (quickMatchQueue.length > 0) {
      const candidateId = quickMatchQueue.shift()
      if (candidateId === myAnonId) continue

      const candidateData = activeAnonUsers.get(candidateId)
      if (candidateData && !candidateData.directSessionId) {
        const candidateBlocked = candidateData.blockedAnonymousIds || []
        const myBlocked = myData.blockedAnonymousIds || []
        if (candidateBlocked.includes(myAnonId) || myBlocked.includes(candidateId)) {
          continue
        }

        // MATCH FOUND!
        const sessionId = getDirectChatKey(myAnonId, candidateId)
        await getOrCreateDirectChat(socket.user, candidateId, candidateData)

        const session = getOrCreateActiveSession(sessionId)
        session.p1 = candidateId
        session.p2 = myAnonId

        myData.directSessionId = sessionId
        candidateData.directSessionId = sessionId

        const sessionRoom = `anon_direct:${sessionId}`
        socket.join(sessionRoom)
        const candidateSocket = io.sockets.sockets.get(candidateData.socketId)
        if (candidateSocket) {
          candidateSocket.join(sessionRoom)
        }

        socket.emit('anon:direct_started', {
          sessionId,
          chatKey: sessionId,
          partner: {
            anonymousId: candidateId,
            alias: candidateData.alias,
            avatarKey: candidateData.avatarKey,
            gender: candidateData.gender,
            ageRange: candidateData.ageRange,
            status: candidateData.status,
          },
        })

        if (candidateSocket) {
          candidateSocket.emit('anon:direct_started', {
            sessionId,
            chatKey: sessionId,
            partner: {
              anonymousId: myAnonId,
              alias: myData.alias,
              avatarKey: myData.avatarKey,
              gender: myData.gender,
              ageRange: myData.ageRange,
              status: myData.status,
            },
          })
        }

        io.to('lounge_global').emit('anon:user_status_changed', {
          anonymousId: myAnonId,
          isBusy: true,
        })
        io.to('lounge_global').emit('anon:user_status_changed', {
          anonymousId: candidateId,
          isBusy: true,
        })

        if (typeof ack === 'function') ack({ success: true, matched: true, sessionId })
        return
      }
    }

    // No one available, join queue
    if (!quickMatchQueue.includes(myAnonId)) {
      quickMatchQueue.push(myAnonId)
    }

    if (typeof ack === 'function') ack({ success: true, matched: false, inQueue: true })
  })

  // 13. CANCEL QUICK MATCH
  socket.on('anon:cancel_quick_match', () => {
    const myAnonId = userToAnonMap.get(userId)
    const idx = quickMatchQueue.indexOf(myAnonId)
    if (idx !== -1) {
      quickMatchQueue.splice(idx, 1)
    }
  })

  // 14. DELETE ROOM MESSAGE
  socket.on('anon:delete_room_message', async ({ messageId, roomId }, ack) => {
    try {
      if (!socket.user || !messageId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz parametre.' })
        return
      }
      const result = await deleteRoomMessage(socket.user, messageId)
      const targetRoomId = roomId || result.roomId
      if (targetRoomId) {
        io.to(`anon_room:${targetRoomId}`).emit('anon:room_message_deleted', {
          messageId,
          roomId: targetRoomId,
        })
      }
      if (typeof ack === 'function') ack({ success: true, messageId })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 15. DELETE CUSTOM ROOM
  socket.on('anon:delete_room', async ({ roomId }, ack) => {
    try {
      if (!socket.user || !roomId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz parametre.' })
        return
      }
      await deleteCustomRoom(socket.user, roomId)
      io.to('lounge_global').emit('anon:room_deleted', { roomId })
      io.to(`anon_room:${roomId}`).emit('anon:current_room_deleted', { roomId })
      if (typeof ack === 'function') ack({ success: true, roomId })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 16. BLOCK ANONYMOUS USER
  socket.on('anon:block_user', async ({ targetAnonymousId }, ack) => {
    try {
      if (!socket.user || !targetAnonymousId) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz parametre.' })
        return
      }
      const myAnonId = userToAnonMap.get(userId)
      const myData = activeAnonUsers.get(myAnonId)
      const result = await blockAnonymousUser(socket.user, targetAnonymousId)
      if (myData) {
        myData.blockedAnonymousIds = result.blockedAnonymousIds
      }

      // If in active direct session with target, terminate it immediately
      if (myData && myData.directSessionId) {
        const session = activeDirectSessions.get(myData.directSessionId)
        if (session && (session.p1 === targetAnonymousId || session.p2 === targetAnonymousId)) {
          const partnerData = activeAnonUsers.get(targetAnonymousId)
          io.to(`anon_direct:${myData.directSessionId}`).emit('anon:direct_ended', {
            by: myAnonId,
            reason: 'blocked',
          })
          if (partnerData) partnerData.directSessionId = null
          myData.directSessionId = null
          activeDirectSessions.delete(session.sessionId)
        }
      }

      if (typeof ack === 'function') ack({ success: true, targetAnonymousId })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // ON DISCONNECT CLEANUP
  socket.on('disconnect', () => {
    const myAnonId = userToAnonMap.get(userId)
    if (!myAnonId) return

    const myData = activeAnonUsers.get(myAnonId)
    if (myData) {
      // Remove from quick match queue
      const qIdx = quickMatchQueue.indexOf(myAnonId)
      if (qIdx !== -1) quickMatchQueue.splice(qIdx, 1)

      // Direct sessions are persistent in MongoDB - do NOT destroy session or messages on disconnect!
      if (myData.directSessionId) {
        myData.directSessionId = null
      }

      // Leave room if in one
      if (myData.activeRoomId) {
        AnonymousRoom.findByIdAndUpdate(
          myData.activeRoomId,
          { $inc: { activeCount: -1 } },
        ).catch(() => {})
      }

      activeAnonUsers.delete(myAnonId)
      userToAnonMap.delete(userId)

      io.to('lounge_global').emit('anon:user_left', { anonymousId: myAnonId })
    }
  })
}

function endDirectSession(sessionId, io) {
  const session = activeDirectSessions.get(sessionId)
  if (!session) return

  const p1Data = activeAnonUsers.get(session.p1)
  const p2Data = activeAnonUsers.get(session.p2)

  if (p1Data) {
    p1Data.directSessionId = null
    io.to('lounge_global').emit('anon:user_status_changed', {
      anonymousId: session.p1,
      isBusy: false,
    })
  }
  if (p2Data) {
    p2Data.directSessionId = null
    io.to('lounge_global').emit('anon:user_status_changed', {
      anonymousId: session.p2,
      isBusy: false,
    })
  }

  io.to(`anon_direct:${sessionId}`).emit('anon:direct_ended', { sessionId })
  activeDirectSessions.delete(sessionId)
}

module.exports = {
  registerAnonymousSockets,
}
