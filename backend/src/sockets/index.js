const { Server } = require('socket.io')
const { z } = require('zod')
const { env } = require('../config/env')
const { User } = require('../models/User')
const { Notification } = require('../models/Notification')
const { AppError } = require('../utils/AppError')
const { parseCookieHeader } = require('../utils/cookies')
const { verifyAccessToken } = require('../utils/tokens')
const {
  createMessageAndNotify,
  markConversationAsRead,
} = require('../services/messagingService')

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

    socket.on('disconnect', async () => {
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
