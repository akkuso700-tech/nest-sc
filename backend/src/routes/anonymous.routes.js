const express = require('express')
const { authenticate, authenticateOptional } = require('../middlewares/authenticate')
const {
  generateRandomAlias,
  getOrCreateAnonymousProfile,
  updateAnonymousProfile,
  listRooms,
  createCustomRoom,
  deleteCustomRoom,
  getRoomMessages,
  saveRoomMessage,
  deleteRoomMessage,
  blockAnonymousUser,
  unblockAnonymousUser,
  getLoungeSummary,
} = require('../services/anonymousService')
const { AppError } = require('../utils/AppError')

const anonymousRouter = express.Router()

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

// GET /api/anonymous/rooms - List all rooms (public)
anonymousRouter.get('/rooms', authenticateOptional, async (req, res, next) => {
  try {
    const rooms = await listRooms()
    res.json({ success: true, rooms })
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/rooms - Create a custom room (requires auth)
anonymousRouter.post('/rooms', authenticate, async (req, res, next) => {
  try {
    const { name, topic, icon, color } = req.body
    const room = await createCustomRoom(req.user, { name, topic, icon, color })
    res.status(201).json({ success: true, room })
  } catch (error) {
    next(error)
  }
})

// GET /api/anonymous/rooms/:id/messages - Get recent room messages (public)
anonymousRouter.get('/rooms/:id/messages', authenticateOptional, async (req, res, next) => {
  try {
    const { id } = req.params
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const messages = await getRoomMessages(id, limit)
    res.json({ success: true, messages })
  } catch (error) {
    next(error)
  }
})

// POST /api/anonymous/rooms/:id/messages - Post message to room (requires auth)
anonymousRouter.post('/rooms/:id/messages', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const { text } = req.body
    if (!text || !text.trim()) {
      throw new AppError('Mesaj metni boş olamaz.', 400)
    }

    const message = await saveRoomMessage({
      roomId: id,
      user: req.user,
      text,
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

module.exports = { anonymousRouter }
