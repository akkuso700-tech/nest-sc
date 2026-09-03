const crypto = require('crypto')
const { Server } = require('socket.io')
const { z } = require('zod')
const { env } = require('../config/env')
const { User } = require('../models/User')
const { Notification } = require('../models/Notification')
const { CallLog } = require('../models/CallLog')
const { AppError } = require('../utils/AppError')
const { parseCookieHeader } = require('../utils/cookies')
const { verifyAccessToken, serializeUser } = require('../utils/tokens')
const {
  createMessageAndNotify,
  markConversationAsRead,
} = require('../services/messagingService')

const initiateCallSchema = z.object({
  recipientId: z.string().min(1),
  conversationId: z.string().optional().nullable(),
  callType: z.enum(['voice', 'video']),
})

const callActionSchema = z.object({
  callId: z.string().min(1),
})

const callRejectSchema = z.object({
  callId: z.string().min(1),
  reason: z.string().optional(),
})

const callSignalSchema = z.object({
  callId: z.string().min(1),
  to: z.string().min(1),
  data: z.any(),
})

const callToggleMediaSchema = z.object({
  callId: z.string().min(1),
  isMuted: z.boolean().optional(),
  isVideoOff: z.boolean().optional(),
})

const newMessageSchema = z.object({
  recipientId: z.string().min(1),
  text: z.string().trim().min(1).max(5000),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(['image', 'video', 'audio']),
        durationSeconds: z.number().optional(),
      }),
    )
    .optional(),
  replyToId: z.string().min(1).optional().nullable(),
})

const markReadSchema = z.object({
  conversationId: z.string().min(1),
})

const notificationReadSchema = z.object({
  notificationId: z.string().min(1),
})

async function socketAuth(socket, next) {
  try {
    const cookieMap = parseCookieHeader(socket.handshake.headers.cookie)
    const authToken = socket.handshake.auth?.token
    const bearerHeader = socket.handshake.headers.authorization
    const headerToken = bearerHeader?.startsWith('Bearer ')
      ? bearerHeader.slice(7)
      : null
    const accessToken = authToken || headerToken || cookieMap.accessToken

    if (!accessToken) {
      next(new Error('Socket authentication required.'))
      return
    }

    const payload = verifyAccessToken(accessToken)
    const user = await User.findById(payload.sub)

    if (!user) {
      next(new Error('Socket user not found.'))
      return
    }

    if (user.accountStatus === 'suspended') {
      next(new Error('Your account is suspended.'))
      return
    }

    socket.user = user
    next()
  } catch (error) {
    next(error)
  }
}

function resolveSocketAck(acknowledgment, payload) {
  if (typeof acknowledgment === 'function') {
    acknowledgment(payload)
  }
}

const onlineUsers = new Map()
const activeCalls = new Map()
const userActiveCall = new Map()

function initSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
  })

  io.use(socketAuth)

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString()
    const userRoom = `user:${userId}`
    socket.join(userRoom)

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set())
    }
    const userSockets = onlineUsers.get(userId)
    const isFirstConnection = userSockets.size === 0
    userSockets.add(socket.id)

    if (isFirstConnection) {
      io.emit('user:status', { userId, isOnline: true })
    }

    // Yeni bağlanan kullanıcıya mevcut tüm online kullanıcı listesini gönder
    socket.emit('users:online', Array.from(onlineUsers.keys()))

    socket.on('new_message', async (payload, acknowledgment) => {
      try {
        const parsedPayload = newMessageSchema.parse(payload)
        const { serializedMessage } = await createMessageAndNotify({
          sender: socket.user,
          recipientId: parsedPayload.recipientId,
          text: parsedPayload.text,
          media: parsedPayload.media || [],
          replyToId: parsedPayload.replyToId || null,
          io,
        })

        resolveSocketAck(acknowledgment, { ok: true, message: serializedMessage })
      } catch (error) {
        resolveSocketAck(acknowledgment, { ok: false, message: error.message })
      }
    })

    socket.on('messages_read', async (payload, acknowledgment) => {
      try {
        const parsedPayload = markReadSchema.parse(payload)
        const eventPayload = await markConversationAsRead({
          conversationId: parsedPayload.conversationId,
          userId: socket.user._id,
          io,
        })

        resolveSocketAck(acknowledgment, { ok: true, ...eventPayload })
      } catch (error) {
        resolveSocketAck(acknowledgment, { ok: false, message: error.message })
      }
    })

    socket.on('notification:read', async (payload, acknowledgment) => {
      try {
        const parsedPayload = notificationReadSchema.parse(payload)
        const notification = await Notification.findOneAndUpdate(
          {
            _id: parsedPayload.notificationId,
            user: socket.user._id,
          },
          { readAt: new Date() },
          { returnDocument: 'after' },
        )

        if (!notification) {
          throw new AppError('Notification not found.', 404)
        }

        io.to(userRoom).emit('notification:read', notification)

        resolveSocketAck(acknowledgment, { ok: true, notification })
      } catch (error) {
        resolveSocketAck(acknowledgment, { ok: false, message: error.message })
      }
    })

    socket.on('typing:start', (payload) => {
      try {
        if (payload?.recipientId) {
          io.to(`user:${payload.recipientId}`).emit('typing:start', {
            conversationId: payload.conversationId || null,
            userId: socket.user._id,
          })
        }
      } catch {
        // Ignore
      }
    })

    socket.on('typing:stop', (payload) => {
      try {
        if (payload?.recipientId) {
          io.to(`user:${payload.recipientId}`).emit('typing:stop', {
            conversationId: payload.conversationId || null,
            userId: socket.user._id,
          })
        }
      } catch {
        // Ignore
      }
    })

    socket.on('call:initiate', async (payload, acknowledgment) => {
      try {
        const parsedPayload = initiateCallSchema.parse(payload)
        const callerId = socket.user._id.toString()
        const recipientId = parsedPayload.recipientId.toString()

        if (callerId === recipientId) {
          resolveSocketAck(acknowledgment, { ok: false, message: 'Cannot call yourself.' })
          return
        }

        const recipient = await User.findById(recipientId)
        if (!recipient) {
          resolveSocketAck(acknowledgment, { ok: false, code: 'NOT_FOUND', message: 'User not found.' })
          return
        }

        if (recipient.accountStatus === 'suspended') {
          resolveSocketAck(acknowledgment, { ok: false, code: 'SUSPENDED', message: 'User is suspended.' })
          return
        }

        const recipientBlockedCaller = recipient.blockedUserIds?.some((id) => id.toString() === callerId)
        const callerBlockedRecipient = socket.user.blockedUserIds?.some((id) => id.toString() === recipientId)
        if (recipientBlockedCaller || callerBlockedRecipient) {
          resolveSocketAck(acknowledgment, { ok: false, code: 'BLOCKED', message: 'Call cannot be completed.' })
          return
        }

        const isVoice = parsedPayload.callType === 'voice'
        const isVideo = parsedPayload.callType === 'video'

        if (isVoice && recipient.preferences?.calling?.voiceCallEnabled === false) {
          resolveSocketAck(acknowledgment, {
            ok: false,
            code: 'VOICE_DISABLED',
            message: 'Recipient has disabled voice calls.',
          })
          return
        }

        if (isVideo && recipient.preferences?.calling?.videoCallEnabled === false) {
          resolveSocketAck(acknowledgment, {
            ok: false,
            code: 'VIDEO_DISABLED',
            message: 'Recipient has disabled video calls.',
          })
          return
        }

        if (userActiveCall.has(recipientId)) {
          resolveSocketAck(acknowledgment, {
            ok: false,
            code: 'BUSY',
            message: 'User is currently on another call.',
          })
          return
        }

        const recipientSockets = onlineUsers.get(recipientId)
        if (!recipientSockets || recipientSockets.size === 0) {
          resolveSocketAck(acknowledgment, {
            ok: false,
            code: 'OFFLINE',
            message: 'User is currently offline.',
          })
          return
        }

        if (userActiveCall.has(callerId)) {
          const prevCallId = userActiveCall.get(callerId)
          const prevCall = activeCalls.get(prevCallId)
          if (prevCall) {
            activeCalls.delete(prevCallId)
            userActiveCall.delete(prevCall.callerId)
            userActiveCall.delete(prevCall.recipientId)
            io.to(`user:${prevCall.callerId}`).emit('call:ended', { callId: prevCallId })
            io.to(`user:${prevCall.recipientId}`).emit('call:ended', { callId: prevCallId })
          }
        }

        const callId = crypto.randomUUID()
        const callSession = {
          callId,
          callerId,
          recipientId,
          conversationId: parsedPayload.conversationId || null,
          callType: parsedPayload.callType,
          status: 'ringing',
          startedAt: Date.now(),
          connectedAt: null,
        }

        activeCalls.set(callId, callSession)
        userActiveCall.set(callerId, callId)
        userActiveCall.set(recipientId, callId)

        CallLog.create({
          callId,
          caller: callerId,
          recipient: recipientId,
          conversation: parsedPayload.conversationId || null,
          callType: parsedPayload.callType,
          status: 'ringing',
          startedAt: new Date(callSession.startedAt),
        }).catch(() => {})

        io.to(`user:${recipientId}`).emit('call:incoming', {
          callId,
          caller: serializeUser(socket.user),
          conversationId: parsedPayload.conversationId || null,
          callType: parsedPayload.callType,
        })

        resolveSocketAck(acknowledgment, {
          ok: true,
          callId,
          callSession,
        })
      } catch (error) {
        resolveSocketAck(acknowledgment, { ok: false, message: error.message })
      }
    })

    socket.on('call:accept', (payload, acknowledgment) => {
      try {
        const parsedPayload = callActionSchema.parse(payload)
        const call = activeCalls.get(parsedPayload.callId)
        if (!call) {
          resolveSocketAck(acknowledgment, { ok: false, message: 'Call session not found.' })
          return
        }

        if (call.recipientId !== userId) {
          resolveSocketAck(acknowledgment, { ok: false, message: 'Unauthorized.' })
          return
        }

        call.status = 'connected'
        call.connectedAt = Date.now()

        CallLog.updateOne(
          { callId: call.callId },
          { status: 'connected', connectedAt: new Date(call.connectedAt) },
        ).catch(() => {})

        io.to(`user:${call.callerId}`).emit('call:accepted', { callId: call.callId })
        io.to(`user:${call.recipientId}`).emit('call:accepted', { callId: call.callId })

        resolveSocketAck(acknowledgment, { ok: true })
      } catch (error) {
        resolveSocketAck(acknowledgment, { ok: false, message: error.message })
      }
    })

    socket.on('call:reject', (payload, acknowledgment) => {
      try {
        const parsedPayload = callRejectSchema.parse(payload)
        const call = activeCalls.get(parsedPayload.callId)
        if (call) {
          activeCalls.delete(call.callId)
          userActiveCall.delete(call.callerId)
          userActiveCall.delete(call.recipientId)

          const reason = parsedPayload.reason || 'declined'
          const statusReason = reason === 'busy' ? 'busy' : 'declined'

          CallLog.updateOne(
            { callId: call.callId },
            { status: statusReason, endedAt: new Date() },
          ).catch(() => {})

          io.to(`user:${call.callerId}`).emit('call:rejected', {
            callId: call.callId,
            reason,
          })
          io.to(`user:${call.recipientId}`).emit('call:ended', {
            callId: call.callId,
            reason,
          })
        }
        resolveSocketAck(acknowledgment, { ok: true })
      } catch (error) {
        resolveSocketAck(acknowledgment, { ok: false, message: error.message })
      }
    })

    socket.on('call:signal', (payload) => {
      try {
        const parsedPayload = callSignalSchema.parse(payload)
        const call = activeCalls.get(parsedPayload.callId)
        if (!call) return

        if (call.callerId !== userId && call.recipientId !== userId) return

        io.to(`user:${parsedPayload.to}`).emit('call:signal', {
          callId: parsedPayload.callId,
          from: userId,
          data: parsedPayload.data,
        })
      } catch {
        // Ignore
      }
    })

    socket.on('call:toggle_media', (payload) => {
      try {
        const parsedPayload = callToggleMediaSchema.parse(payload)
        const call = activeCalls.get(parsedPayload.callId)
        if (!call) return

        if (call.callerId !== userId && call.recipientId !== userId) return
        const targetUserId = call.callerId === userId ? call.recipientId : call.callerId

        io.to(`user:${targetUserId}`).emit('call:media_toggled', {
          callId: call.callId,
          from: userId,
          isMuted: parsedPayload.isMuted,
          isVideoOff: parsedPayload.isVideoOff,
        })
      } catch {
        // Ignore
      }
    })

    socket.on('call:end', async (payload, acknowledgment) => {
      try {
        const parsedPayload = callActionSchema.parse(payload)
        const call = activeCalls.get(parsedPayload.callId)
        if (call) {
          activeCalls.delete(call.callId)
          userActiveCall.delete(call.callerId)
          userActiveCall.delete(call.recipientId)

          const durationSeconds = call.connectedAt
            ? Math.max(0, Math.round((Date.now() - call.connectedAt) / 1000))
            : 0

          const finalStatus = call.status === 'connected' ? 'completed' : 'missed'
          CallLog.updateOne(
            { callId: call.callId },
            {
              status: finalStatus,
              durationSec: durationSeconds,
              endedAt: new Date(),
            },
          ).catch(() => {})

          io.to(`user:${call.callerId}`).emit('call:ended', {
            callId: call.callId,
            durationSeconds,
          })
          io.to(`user:${call.recipientId}`).emit('call:ended', {
            callId: call.callId,
            durationSeconds,
          })

          try {
            const isCaller = call.callerId === userId
            const otherUserId = isCaller ? call.recipientId : call.callerId
            const minutes = Math.floor(durationSeconds / 60)
            const seconds = durationSeconds % 60
            const formattedDuration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

            let callLogText = ''
            if (call.status === 'connected') {
              callLogText = call.callType === 'video'
                ? `📹 Görüntülü görüşme (${formattedDuration})`
                : `📞 Sesli arama (${formattedDuration})`
            } else if (call.status === 'ringing') {
              callLogText = call.callType === 'video'
                ? '📹 Cevapsız görüntülü arama'
                : '📵 Cevapsız sesli arama'
            }

            if (callLogText) {
              await createMessageAndNotify({
                sender: socket.user,
                recipientId: otherUserId,
                text: callLogText,
                media: [],
                io,
              })
            }
          } catch {
            // Non-critical call log save
          }
        }

        resolveSocketAck(acknowledgment, { ok: true })
      } catch (error) {
        resolveSocketAck(acknowledgment, { ok: false, message: error.message })
      }
    })

    socket.on('disconnect', async () => {
      if (userActiveCall.has(userId)) {
        const callId = userActiveCall.get(userId)
        const call = activeCalls.get(callId)
        if (call) {
          activeCalls.delete(callId)
          userActiveCall.delete(call.callerId)
          userActiveCall.delete(call.recipientId)

          CallLog.updateOne(
            { callId },
            {
              status: call.status === 'connected' ? 'completed' : 'failed',
              endedAt: new Date(),
            },
          ).catch(() => {})

          io.to(`user:${call.callerId}`).emit('call:ended', { callId, reason: 'disconnected' })
          io.to(`user:${call.recipientId}`).emit('call:ended', { callId, reason: 'disconnected' })
        }
      }

      const currentSockets = onlineUsers.get(userId)
      if (currentSockets) {
        currentSockets.delete(socket.id)
        if (currentSockets.size === 0) {
          onlineUsers.delete(userId)
          const lastLoginAt = new Date()
          io.emit('user:status', { userId, isOnline: false, lastLoginAt })
          try {
            await User.findByIdAndUpdate(userId, { lastLoginAt })
          } catch {
            // Best effort
          }
        }
      }
    })
  })

  return io
}

module.exports = { initSocketServer }
