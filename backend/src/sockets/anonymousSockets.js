const { AnonymousRoom } = require('../models/AnonymousRoom')
const {
  getOrCreateAnonymousProfile,
  saveRoomMessage,
  deleteRoomMessage,
  deleteCustomRoom,
  blockAnonymousUser,
} = require('../services/anonymousService')

// In-memory state for anonymous realtime interactions
// anonymousId -> { socketId, userId, userDoc, alias, avatarKey, gender, ageRange, status, activeRoomId, directSessionId, blockedAnonymousIds }
const activeAnonUsers = new Map()
// userId -> anonymousId
const userToAnonMap = new Map()
// Queue for Omegle-style quick match: [anonymousId, ...]
const quickMatchQueue = []
// active direct sessions: sessionId -> { p1: anonymousId, p2: anonymousId, p1Revealed: bool, p2Revealed: bool }
const activeDirectSessions = new Map()

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
      const roomKey = `anon_room:${roomId}`
      socket.join(roomKey)

      const anonId = userToAnonMap.get(userId)
      if (anonId && activeAnonUsers.has(anonId)) {
        activeAnonUsers.get(anonId).activeRoomId = roomId
      }

      // Update room active count
      const room = await AnonymousRoom.findByIdAndUpdate(
        roomId,
        { $inc: { activeCount: 1 } },
        { new: true },
      )

      io.to(roomKey).emit('anon:room_count_changed', {
        roomId,
        activeCount: room ? room.activeCount : 1,
      })

      if (typeof ack === 'function') {
        ack({ success: true, activeCount: room ? room.activeCount : 1 })
      }
    } catch (err) {
      console.error('anon:join_room error:', err)
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
  socket.on('anon:send_room_message', async ({ roomId, text }, ack) => {
    try {
      if (!socket.user) {
        if (typeof ack === 'function') ack({ success: false, error: 'Oturum açmalısınız.' })
        return
      }
      if (!roomId || !text || !text.trim()) {
        if (typeof ack === 'function') ack({ success: false, error: 'Geçersiz mesaj.' })
        return
      }

      const savedMessage = await saveRoomMessage({
        roomId,
        user: socket.user,
        text,
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
  socket.on('anon:direct_accept', ({ requesterAnonymousId }, ack) => {
    try {
      const myAnonId = userToAnonMap.get(userId)
      const myData = activeAnonUsers.get(myAnonId)
      const requesterData = activeAnonUsers.get(requesterAnonymousId)

      if (!myData || !requesterData) {
        if (typeof ack === 'function') ack({ success: false, error: 'Kullanıcı artık çevrimdışı.' })
        return
      }

      const sessionId = `direct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      activeDirectSessions.set(sessionId, {
        p1: requesterAnonymousId,
        p2: myAnonId,
        p1Revealed: false,
        p2Revealed: false,
        messageCount: 0,
      })

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
  socket.on('anon:send_direct_message', ({ sessionId, text }, ack) => {
    try {
      const session = activeDirectSessions.get(sessionId)
      if (!session) {
        if (typeof ack === 'function') ack({ success: false, error: 'Sohbet oturumu sonlanmış.' })
        return
      }

      const myAnonId = userToAnonMap.get(userId)
      const myData = activeAnonUsers.get(myAnonId)
      if (!myData) return

      session.messageCount = (session.messageCount || 0) + 1

      const msg = {
        id: `dir_msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sessionId,
        senderAnonymousId: myAnonId,
        senderAlias: myData.alias,
        senderAvatar: myData.avatarKey,
        text: text.trim().slice(0, 1000),
        createdAt: new Date().toISOString(),
        totalMessageCount: session.messageCount,
      }

      io.to(`anon_direct:${sessionId}`).emit('anon:new_direct_message', msg)

      if (typeof ack === 'function') ack({ success: true, message: msg })
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message })
    }
  })

  // 10. REVEAL IDENTITY (Maskeyi Düşür)
  socket.on('anon:reveal_identity_request', ({ sessionId }) => {
    const session = activeDirectSessions.get(sessionId)
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

  // 11. LEAVE DIRECT CHAT
  socket.on('anon:leave_direct', ({ sessionId }) => {
    endDirectSession(sessionId, io)
  })

  // 12. QUICK MATCH (Rastgele Eşleş)
  socket.on('anon:quick_match', (payload, ack) => {
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
        const sessionId = `direct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        activeDirectSessions.set(sessionId, {
          p1: candidateId,
          p2: myAnonId,
          p1Revealed: false,
          p2Revealed: false,
          messageCount: 0,
        })

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

      // End direct session if in one
      if (myData.directSessionId) {
        endDirectSession(myData.directSessionId, io)
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
