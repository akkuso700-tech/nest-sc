const express = require('express')
const { authenticate, authenticateOptional } = require('../middlewares/authenticate')
const {
  generateRandomAlias,
  getOrCreateAnonymousProfile,
  updateAnonymousProfile,
  listRooms,
  createCustomRoom,
  joinRoomByAccessCode,
  deleteCustomRoom,
  getRoomMessages,
  saveRoomMessage,
  deleteRoomMessage,
  blockAnonymousUser,
  unblockAnonymousUser,
  getLoungeSummary,
  listDirectChats,
  getDirectChatMessages,
  deleteDirectChatForUser,
  saveDirectChatMessage,
  getOrCreateDirectChat,
  markDirectChatAsRead,
  requestRoomJoin,
  approveRoomJoin,
  rejectRoomJoin,
} = require('../services/anonymousService')
const {
  createUploadMiddleware,
  buildMediaItems,
  removeUploadedFiles,
} = require('../middlewares/uploadMedia')
const { AppError } = require('../utils/AppError')

const anonymousRouter = express.Router()
const uploadAnonymousMedia = createUploadMiddleware('anonymous', 4)

// GET /api/anonymous/profile - Get or init anonymous profile
anonymousRouter.get('/profile', authenticate, async (req, res, next) => {
  try {
    const profile = await getOrCreateAnonymousProfile(req.user)
    res.json({ success: true, profile })
  } catch (error) {
    next(error)
  }
})

// PUT /api/anonymous/profile - Update avatar, alias, ageRange, gender, status
anonymousRouter.put('/profile', authenticate, async (req, res, next) => {
  try {
    const profile = await updateAnonymousProfile(req.user._id, req.body)
    res.json({ success: true, profile })
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/profile/randomize - Generate new alias
anonymousRouter.post('/profile/randomize', authenticate, async (req, res, next) => {
  try {
    const newAlias = generateRandomAlias()
    const profile = await updateAnonymousProfile(req.user._id, { alias: newAlias })
    res.json({ success: true, profile, alias: newAlias })
  } catch (error) {
    next(error)
  }
})

// GET /api/anonymous/summary - Summary stats (rooms, active) for guests and users
anonymousRouter.get('/summary', authenticateOptional, async (req, res, next) => {
  try {
    const summary = await getLoungeSummary()
    res.json({ success: true, summary })
  } catch (error) {
    next(error)
  }
})

// GET /api/anonymous/rooms - List all rooms (public + user's private rooms)
anonymousRouter.get('/rooms', authenticateOptional, async (req, res, next) => {
  try {
    const rooms = await listRooms(req.user)
    res.json({ success: true, rooms })
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/rooms - Create a custom room (requires auth)
anonymousRouter.post('/rooms', authenticate, async (req, res, next) => {
  try {
    const { name, topic, icon, color, isPrivate } = req.body
    const room = await createCustomRoom(req.user, { name, topic, icon, color, isPrivate })
    res.status(201).json({ success: true, room })
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/rooms/join-private - Join a private room with access code
anonymousRouter.post('/rooms/join-private', authenticate, async (req, res, next) => {
  try {
    const { accessCode } = req.body
    const room = await joinRoomByAccessCode(req.user, accessCode)
    res.json({ success: true, room })
  } catch (error) {
    next(error)
  }
})

// GET /api/anonymous/rooms/:id/messages - Get recent room messages (public or private with auth)
anonymousRouter.get('/rooms/:id/messages', authenticateOptional, async (req, res, next) => {
  try {
    const { id } = req.params
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const messages = await getRoomMessages(id, req.user, limit)
    res.json({ success: true, messages })
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/rooms/:id/request-join - Request to join a private room
anonymousRouter.post('/rooms/:id/request-join', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await requestRoomJoin(req.user, id)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/rooms/:id/approve-join - Approve user join request (creator/admin only)
anonymousRouter.post('/rooms/:id/approve-join', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const { requesterAnonymousId } = req.body
    const result = await approveRoomJoin(req.user, id, requesterAnonymousId)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/rooms/:id/reject-join - Reject user join request (creator/admin only)
anonymousRouter.post('/rooms/:id/reject-join', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const { requesterAnonymousId } = req.body
    const result = await rejectRoomJoin(req.user, id, requesterAnonymousId)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/upload - Upload media (image, audio) for anonymous lounge
anonymousRouter.post('/upload', authenticate, uploadAnonymousMedia, async (req, res, next) => {
  try {
    const files = req.files || []
    if (files.length === 0) {
      throw new AppError('Hiçbir dosya yüklenmedi.', 400)
    }

    const media = await buildMediaItems(files)
    if (!media || media.length === 0) {
      throw new AppError('Dosya işlenemedi.', 400)
    }

    if (req.body?.durationSeconds && media[0]) {
      media[0].durationSeconds = Number(req.body.durationSeconds) || 0
    }

    res.status(201).json({ success: true, media })
  } catch (error) {
    if (req.files?.length) {
      await removeUploadedFiles(req.files)
    }
    next(error)
  }
})

// POST /api/anonymous/rooms/:id/messages - Post message to room (requires auth)
anonymousRouter.post('/rooms/:id/messages', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const { text, media } = req.body
    if ((!text || !text.trim()) && (!Array.isArray(media) || media.length === 0)) {
      throw new AppError('Mesaj metni veya medya gereklidir.', 400)
    }

    const message = await saveRoomMessage({
      roomId: id,
      user: req.user,
      text: text || '',
      media: Array.isArray(media) ? media : [],
    })

    res.status(201).json({ success: true, message })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/anonymous/rooms/:id - Delete custom room (owner only)
anonymousRouter.delete('/rooms/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await deleteCustomRoom(req.user, id)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/anonymous/messages/:id - Delete own room message
anonymousRouter.delete('/messages/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await deleteRoomMessage(req.user, id)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/block - Block an anonymous user
anonymousRouter.post('/block', authenticate, async (req, res, next) => {
  try {
    const { targetAnonymousId } = req.body
    const result = await blockAnonymousUser(req.user, targetAnonymousId)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/unblock - Unblock an anonymous user
anonymousRouter.post('/unblock', authenticate, async (req, res, next) => {
  try {
    const { targetAnonymousId } = req.body
    const result = await unblockAnonymousUser(req.user, targetAnonymousId)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// GET /api/anonymous/blocked - List blocked anonymous IDs
anonymousRouter.get('/blocked', authenticate, async (req, res, next) => {
  try {
    const blocked = req.user.anonymousProfile?.blockedAnonymousIds || []
    res.json({ success: true, blockedAnonymousIds: blocked })
  } catch (error) {
    next(error)
  }
})

// GET /api/anonymous/direct-chats - List all persistent direct chats of the user
anonymousRouter.get('/direct-chats', authenticate, async (req, res, next) => {
  try {
    const chats = await listDirectChats(req.user)
    res.json({ success: true, chats })
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/direct-chats - Get or create a direct chat with target anonymous user
anonymousRouter.post('/direct-chats', authenticate, async (req, res, next) => {
  try {
    const { targetAnonymousId, targetProfileData } = req.body
    const chat = await getOrCreateDirectChat(req.user, targetAnonymousId, targetProfileData)
    res.status(201).json({ success: true, chat })
  } catch (error) {
    next(error)
  }
})

// GET /api/anonymous/direct-chats/:chatKey/messages - Get persistent message history of direct chat
anonymousRouter.get('/direct-chats/:chatKey/messages', authenticate, async (req, res, next) => {
  try {
    const { chatKey } = req.params
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const messages = await getDirectChatMessages(req.user, chatKey, limit)
    res.json({ success: true, messages })
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/direct-chats/:chatKey/messages - Send message to direct chat
anonymousRouter.post('/direct-chats/:chatKey/messages', authenticate, async (req, res, next) => {
  try {
    const { chatKey } = req.params
    const { text, media } = req.body
    const message = await saveDirectChatMessage({
      chatKey,
      user: req.user,
      text: text || '',
      media: Array.isArray(media) ? media : [],
    })
    res.status(201).json({ success: true, message })
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/direct-chats/:chatKey/read - Mark direct chat as read
anonymousRouter.post('/direct-chats/:chatKey/read', authenticate, async (req, res, next) => {
  try {
    const { chatKey } = req.params
    const result = await markDirectChatAsRead(req.user, chatKey)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/anonymous/direct-chats/:chatKey - Remove/hide direct chat from user's view
anonymousRouter.delete('/direct-chats/:chatKey', authenticate, async (req, res, next) => {
  try {
    const { chatKey } = req.params
    const result = await deleteDirectChatForUser(req.user, chatKey)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

module.exports = { anonymousRouter }
