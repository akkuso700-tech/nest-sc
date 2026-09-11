const crypto = require('crypto')
const { User } = require('../models/User')
const { AnonymousRoom } = require('../models/AnonymousRoom')
const { AnonymousMessage } = require('../models/AnonymousMessage')
const { AnonymousDirectChat } = require('../models/AnonymousDirectChat')
const { AppError } = require('../utils/AppError')

const ADJECTIVES = [
  'Gizemli',
  'Sessiz',
  'Kozmik',
  'Mavi',
  'Cesur',
  'Gölge',
  'Sakin',
  'Kutup',
  'Parlak',
  'Hızlı',
  'Derin',
  'Uzak',
  'Gece',
  'Uçarı',
  'Sonsuz',
  'Gizli',
  'Yıldız',
  'Efsanevi',
  'Neon',
  'Şanslı',
]

const NOUNS = [
  'Gezgin',
  'Kuş',
  'Kurt',
  'Panda',
  'Yolcu',
  'Gölge',
  'Kedi',
  'Kaptan',
  'Rüzgar',
  'Avcı',
  'Pilot',
  'Şahin',
  'Gözcü',
  'Kaşif',
  'Sfenks',
  'Dalgıç',
  'Tilki',
  'Kartal',
]

function generateRandomAlias() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const tag = Math.floor(100 + Math.random() * 900)
  return `${adj}${noun}#${tag}`
}

function getAnonymousId(userId) {
  // Deterministic 12-char anonymous hash unique to the user, masking their real MongoDB ObjectId
  return crypto.createHash('sha256').update(`anon_${userId.toString()}`).digest('hex').slice(0, 12)
}

function serializeAnonymousProfile(user) {
  const profile = user.anonymousProfile || {}
  return {
    anonymousId: getAnonymousId(user._id),
    alias: profile.alias || 'GizemliGezgin#100',
    avatarKey: profile.avatarKey || 'avatar-1',
    gender: profile.gender || 'unspecified',
    ageRange: profile.ageRange || 'unspecified',
    status: profile.status || '',
    hasConfigured: Boolean(profile.hasConfigured),
    isOnlineInLounge: Boolean(profile.isOnlineInLounge),
    blockedAnonymousIds: Array.isArray(profile.blockedAnonymousIds) ? profile.blockedAnonymousIds : [],
    lastActiveAt: profile.lastActiveAt || null,
  }
}

async function getOrCreateAnonymousProfile(user) {
  const anonId = getAnonymousId(user._id)
  let needsSave = false

  if (!user.anonymousProfile || !user.anonymousProfile.alias) {
    user.anonymousProfile = {
      alias: generateRandomAlias(),
      anonymousId: anonId,
      avatarKey: `avatar-${Math.floor(1 + Math.random() * 8)}`,
      gender: 'unspecified',
      ageRange: 'unspecified',
      status: 'Yeni katıldım 🌟',
      hasConfigured: false,
      isOnlineInLounge: true,
      lastActiveAt: new Date(),
    }
    needsSave = true
  } else if (!user.anonymousProfile.anonymousId) {
    user.anonymousProfile.anonymousId = anonId
    needsSave = true
  }

  if (needsSave) {
    await user.save()
  }
  return serializeAnonymousProfile(user)
}

async function updateAnonymousProfile(userId, { alias, avatarKey, gender, ageRange, status }) {
  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('Kullanıcı bulunamadı.', 404)
  }

  if (!user.anonymousProfile) {
    user.anonymousProfile = {}
  }

  if (alias && typeof alias === 'string') {
    const trimmed = alias.trim()
    if (trimmed.length >= 3 && trimmed.length <= 30) {
      user.anonymousProfile.alias = trimmed
    }
  }

  if (avatarKey && typeof avatarKey === 'string') {
    user.anonymousProfile.avatarKey = avatarKey.trim()
  }

  if (gender && ['unspecified', 'female', 'male'].includes(gender)) {
    user.anonymousProfile.gender = gender
  }

  if (ageRange && ['unspecified', '18-24', '25-34', '35-44', '45+'].includes(ageRange)) {
    user.anonymousProfile.ageRange = ageRange
  }

  if (status !== undefined && typeof status === 'string') {
    user.anonymousProfile.status = status.trim().slice(0, 80)
  }

  user.anonymousProfile.hasConfigured = true
  user.anonymousProfile.lastActiveAt = new Date()
  await user.save()

  return serializeAnonymousProfile(user)
}

const DEFAULT_ROOMS = [
  {
    name: 'Gece Kuşları',
    topic: 'Uykusu kaçanlar, geceye fısıldayanlar ve dertleşenler',
    icon: '🦉',
    color: 'purple',
    isSystem: true,
  },
  {
    name: 'Geyik & Muhabbet',
    topic: 'Günün stresini atmalık, samimi ve serbest sohbet',
    icon: '☕',
    color: 'cyan',
    isSystem: true,
  },
  {
    name: 'İtiraf & Sırlar',
    topic: 'İçini dök, kim olduğunu kimse bilmesin',
    icon: '🎭',
    color: 'rose',
    isSystem: true,
  },
  {
    name: 'Teknoloji & Gelecek',
    topic: 'Yazılım, yapay zeka, bilim, oyun ve ilginç fikirler',
    icon: '🚀',
    color: 'emerald',
    isSystem: true,
  },
]

async function seedDefaultRoomsIfNeeded() {
  const count = await AnonymousRoom.countDocuments({ isSystem: true })
  if (count === 0) {
    await AnonymousRoom.insertMany(DEFAULT_ROOMS)
  }
}

function generateRoomAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function listRooms(user = null) {
  await seedDefaultRoomsIfNeeded()

  const rooms = await AnonymousRoom.find({}).sort({ isSystem: -1, activeCount: -1, createdAt: -1 }).lean()

  let userAnonId = null
  let userIdStr = null
  let isAdmin = false
  if (user && user._id) {
    userAnonId = getAnonymousId(user._id)
    userIdStr = user._id.toString()
    isAdmin = user.role === 'admin'
  }

  return rooms.map((room) => {
    const isOwner = Boolean(userIdStr && room.createdBy && room.createdBy.toString() === userIdStr)
    const isAllowed = !room.isPrivate || (userAnonId && Array.isArray(room.allowedAnonymousIds) && room.allowedAnonymousIds.includes(userAnonId))
    const isMember = Boolean(isOwner || isAllowed || isAdmin)
    const isPending = Boolean(userAnonId && Array.isArray(room.pendingRequests) && room.pendingRequests.some((r) => r.anonymousId === userAnonId))

    const pendingRequests = (isOwner || isAdmin) && Array.isArray(room.pendingRequests)
      ? room.pendingRequests.map((r) => ({
          anonymousId: r.anonymousId,
          alias: r.alias,
          avatarKey: r.avatarKey,
          gender: r.gender || 'unspecified',
          ageRange: r.ageRange || 'unspecified',
          requestedAt: r.requestedAt,
        }))
      : []

    return {
      id: room._id.toString(),
      name: room.name,
      topic: room.topic,
      icon: room.icon,
      color: room.color,
      isSystem: Boolean(room.isSystem),
      isPrivate: Boolean(room.isPrivate),
      accessCode: (isOwner || isAdmin || isMember) ? (room.accessCode || null) : null,
      createdBy: room.createdBy ? room.createdBy.toString() : null,
      creatorAlias: room.creatorAlias,
      activeCount: Number(room.activeCount || 0),
      createdAt: room.createdAt,
      isMember,
      isOwner,
      isPending,
      pendingRequests,
    }
  })
}

async function createCustomRoom(user, { name, topic, icon, color, isPrivate }) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    throw new AppError('Oda adı en az 2 karakter olmalıdır.', 400)
  }

  const alias = user.anonymousProfile?.alias || 'Anonim'
  const isPriv = Boolean(isPrivate)
  let accessCode = null

  if (isPriv) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateRoomAccessCode()
      const exists = await AnonymousRoom.findOne({ accessCode: candidate })
      if (!exists) {
        accessCode = candidate
        break
      }
    }
    if (!accessCode) {
      accessCode = generateRoomAccessCode()
    }
  }

  const anonProfile = await getOrCreateAnonymousProfile(user)

  const room = await AnonymousRoom.create({
    name: name.trim().slice(0, 50),
    topic: (topic || '').trim().slice(0, 120),
    icon: (icon || '💬').trim().slice(0, 10),
    color: ['purple', 'cyan', 'emerald', 'rose', 'amber'].includes(color) ? color : 'purple',
    isSystem: false,
    isPrivate: isPriv,
    accessCode: accessCode,
    allowedAnonymousIds: isPriv ? [anonProfile.anonymousId] : [],
    createdBy: user._id,
    creatorAlias: alias,
    activeCount: 1,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours later
  })

  return {
    id: room._id.toString(),
    name: room.name,
    topic: room.topic,
    icon: room.icon,
    color: room.color,
    isSystem: false,
    isPrivate: Boolean(room.isPrivate),
    accessCode: room.accessCode || null,
    createdBy: user._id.toString(),
    creatorAlias: room.creatorAlias,
    activeCount: 1,
    createdAt: room.createdAt,
    isMember: true,
    isOwner: true,
    isPending: false,
    pendingRequests: [],
  }
}

async function joinRoomByAccessCode(user, accessCode) {
  if (!accessCode || typeof accessCode !== 'string') {
    throw new AppError('Geçerli bir oda kodu giriniz.', 400)
  }

  const cleanCode = accessCode.trim().toUpperCase()
  const room = await AnonymousRoom.findOne({ accessCode: cleanCode })
  if (!room) {
    throw new AppError('Bu koda ait gizli oda bulunamadı veya süresi dolmuş.', 404)
  }

  const anonProfile = await getOrCreateAnonymousProfile(user)
  const anonId = anonProfile.anonymousId

  if (!room.allowedAnonymousIds) {
    room.allowedAnonymousIds = []
  }
  if (!room.allowedAnonymousIds.includes(anonId)) {
    room.allowedAnonymousIds.push(anonId)
    await room.save()
  }

  const userIdStr = user._id.toString()
  const isOwner = room.createdBy && room.createdBy.toString() === userIdStr
  return {
    id: room._id.toString(),
    name: room.name,
    topic: room.topic,
    icon: room.icon,
    color: room.color,
    isSystem: Boolean(room.isSystem),
    isPrivate: Boolean(room.isPrivate),
    accessCode: room.accessCode || null,
    createdBy: room.createdBy ? room.createdBy.toString() : null,
    creatorAlias: room.creatorAlias,
    activeCount: Number(room.activeCount || 0),
    createdAt: room.createdAt,
    isMember: true,
    isOwner: Boolean(isOwner),
    isPending: false,
    pendingRequests: [],
  }
}

async function getRoomMessages(roomId, user = null, limit = 50) {
  const room = await AnonymousRoom.findById(roomId).lean()
  if (!room) {
    throw new AppError('Oda bulunamadı.', 404)
  }

  if (room.isPrivate) {
    let authorized = false
    if (user && user._id) {
      const anonId = getAnonymousId(user._id)
      const isOwner = room.createdBy && room.createdBy.toString() === user._id.toString()
      const isAdmin = user.role === 'admin'
      const isAllowed = Array.isArray(room.allowedAnonymousIds) && room.allowedAnonymousIds.includes(anonId)
      if (isOwner || isAdmin || isAllowed) {
        authorized = true
      }
    }
    if (!authorized) {
      throw new AppError('Bu gizli odaya erişim izniniz yok. Lütfen katılma isteği gönderin.', 403)
    }
  }

  const messages = await AnonymousMessage.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return messages.reverse().map((msg) => ({
    id: msg._id.toString(),
    roomId: msg.roomId?.toString(),
    senderAnonymousId: msg.senderAnonymousId,
    senderAlias: msg.senderAlias,
    senderAvatar: msg.senderAvatar,
    text: msg.text,
    media: Array.isArray(msg.media) ? msg.media : [],
    createdAt: msg.createdAt,
  }))
}

async function saveRoomMessage({ roomId, user, text, media = [] }) {
  const room = await AnonymousRoom.findById(roomId).lean()
  if (!room) {
    throw new AppError('Oda bulunamadı.', 404)
  }

  if (room.isPrivate) {
    const anonId = getAnonymousId(user._id)
    const isOwner = room.createdBy && room.createdBy.toString() === user._id.toString()
    const isAdmin = user.role === 'admin'
    const isAllowed = Array.isArray(room.allowedAnonymousIds) && room.allowedAnonymousIds.includes(anonId)
    if (!isOwner && !isAdmin && !isAllowed) {
      throw new AppError('Bu gizli odaya mesaj göndermek için önce onay almalısınız.', 403)
    }
  }

  const cleanText = typeof text === 'string' ? text.trim().slice(0, 1000) : ''
  const cleanMedia = Array.isArray(media) ? media : []

  if (!cleanText && cleanMedia.length === 0) {
    throw new AppError('Mesaj metni veya medya gereklidir.', 400)
  }

  const profile = await getOrCreateAnonymousProfile(user)

  const message = await AnonymousMessage.create({
    roomId,
    senderAnonymousId: profile.anonymousId,
    senderAlias: profile.alias,
    senderAvatar: profile.avatarKey,
    text: cleanText,
    media: cleanMedia,
  })

  return {
    id: message._id.toString(),
    roomId: roomId.toString(),
    senderAnonymousId: profile.anonymousId,
    senderAlias: profile.alias,
    senderAvatar: profile.avatarKey,
    text: message.text,
    media: message.media || [],
    createdAt: message.createdAt,
  }
}

async function requestRoomJoin(user, roomId) {
  const room = await AnonymousRoom.findById(roomId)
  if (!room) {
    throw new AppError('Oda bulunamadı.', 404)
  }
  if (!room.isPrivate) {
    return { success: true, isMember: true, message: 'Bu oda herkese açık.' }
  }

  const profile = await getOrCreateAnonymousProfile(user)
  const anonId = profile.anonymousId

  if (Array.isArray(room.bannedAnonymousIds) && room.bannedAnonymousIds.includes(anonId)) {
    throw new AppError('Bu odaya girişiniz engellenmiştir.', 403)
  }

  const isOwner = room.createdBy && room.createdBy.toString() === user._id.toString()
  const isAdmin = user.role === 'admin'
  const isMember = Boolean(isOwner || isAdmin || (Array.isArray(room.allowedAnonymousIds) && room.allowedAnonymousIds.includes(anonId)))

  if (isMember) {
    return { success: true, isMember: true, message: 'Zaten bu odanın üyesisiniz.' }
  }

  if (!Array.isArray(room.pendingRequests)) {
    room.pendingRequests = []
  }

  const alreadyPending = room.pendingRequests.some((r) => r.anonymousId === anonId)
  if (alreadyPending) {
    return { success: true, isPending: true, message: 'Katılım isteğiniz zaten onay bekliyor.' }
  }

  const requestItem = {
    anonymousId: anonId,
    alias: profile.alias,
    avatarKey: profile.avatarKey,
    gender: profile.gender || 'unspecified',
    ageRange: profile.ageRange || 'unspecified',
    requestedAt: new Date(),
  }
  room.pendingRequests.push(requestItem)
  await room.save()

  return {
    success: true,
    isPending: true,
    roomId: room._id.toString(),
    roomName: room.name,
    creatorUserId: room.createdBy ? room.createdBy.toString() : null,
    requester: requestItem,
  }
}

async function approveRoomJoin(user, roomId, requesterAnonymousId) {
  if (!requesterAnonymousId || typeof requesterAnonymousId !== 'string') {
    throw new AppError('Geçersiz katılım isteği.', 400)
  }

  const room = await AnonymousRoom.findById(roomId)
  if (!room) {
    throw new AppError('Oda bulunamadı.', 404)
  }

  const isOwner = room.createdBy && room.createdBy.toString() === user._id.toString()
  const isAdmin = user.role === 'admin'
  if (!isOwner && !isAdmin) {
    throw new AppError('Yalnızca oda kurucusu katılım isteklerini onaylayabilir.', 403)
  }

  if (!Array.isArray(room.allowedAnonymousIds)) {
    room.allowedAnonymousIds = []
  }
  if (!room.allowedAnonymousIds.includes(requesterAnonymousId)) {
    room.allowedAnonymousIds.push(requesterAnonymousId)
  }

  if (Array.isArray(room.pendingRequests)) {
    room.pendingRequests = room.pendingRequests.filter((r) => r.anonymousId !== requesterAnonymousId)
  }
  await room.save()

  const requesterUser = await User.findOne({ 'anonymousProfile.anonymousId': requesterAnonymousId })

  return {
    success: true,
    roomId: room._id.toString(),
    roomName: room.name,
    requesterAnonymousId,
    requesterUserId: requesterUser ? requesterUser._id.toString() : null,
    pendingRequests: room.pendingRequests,
  }
}

async function rejectRoomJoin(user, roomId, requesterAnonymousId) {
  if (!requesterAnonymousId || typeof requesterAnonymousId !== 'string') {
    throw new AppError('Geçersiz katılım isteği.', 400)
  }

  const room = await AnonymousRoom.findById(roomId)
  if (!room) {
    throw new AppError('Oda bulunamadı.', 404)
  }

  const isOwner = room.createdBy && room.createdBy.toString() === user._id.toString()
  const isAdmin = user.role === 'admin'
  if (!isOwner && !isAdmin) {
    throw new AppError('Yalnızca oda kurucusu katılım isteklerini reddedebilir.', 403)
  }

  if (Array.isArray(room.pendingRequests)) {
    room.pendingRequests = room.pendingRequests.filter((r) => r.anonymousId !== requesterAnonymousId)
    await room.save()
  }

  return {
    success: true,
    roomId: room._id.toString(),
    requesterAnonymousId,
    pendingRequests: room.pendingRequests,
  }
}

async function kickRoomMember(user, roomId, targetAnonymousId) {
  if (!targetAnonymousId || typeof targetAnonymousId !== 'string') {
    throw new AppError('Geçersiz kullanıcı.', 400)
  }

  const room = await AnonymousRoom.findById(roomId)
  if (!room) {
    throw new AppError('Oda bulunamadı.', 404)
  }

  const isOwner = Boolean(user && room.createdBy && room.createdBy.toString() === user._id.toString())
  const isAdmin = Boolean(user && user.role === 'admin')
  if (!isOwner && !isAdmin) {
    throw new AppError('Yalnızca oda yöneticisi üyeleri çıkarabilir.', 403)
  }

  if (Array.isArray(room.allowedAnonymousIds)) {
    room.allowedAnonymousIds = room.allowedAnonymousIds.filter((id) => id !== targetAnonymousId)
  }
  room.activeCount = Math.max(0, (room.activeCount || 1) - 1)
  await room.save()

  return {
    success: true,
    roomId: room._id.toString(),
    targetAnonymousId,
    activeCount: room.activeCount,
  }
}

async function banRoomMember(user, roomId, targetAnonymousId) {
  if (!targetAnonymousId || typeof targetAnonymousId !== 'string') {
    throw new AppError('Geçersiz kullanıcı.', 400)
  }

  const room = await AnonymousRoom.findById(roomId)
  if (!room) {
    throw new AppError('Oda bulunamadı.', 404)
  }

  const isOwner = Boolean(user && room.createdBy && room.createdBy.toString() === user._id.toString())
  const isAdmin = Boolean(user && user.role === 'admin')
  if (!isOwner && !isAdmin) {
    throw new AppError('Yalnızca oda yöneticisi üyeleri engelleyebilir.', 403)
  }

  if (!Array.isArray(room.bannedAnonymousIds)) {
    room.bannedAnonymousIds = []
  }
  if (!room.bannedAnonymousIds.includes(targetAnonymousId)) {
    room.bannedAnonymousIds.push(targetAnonymousId)
  }
  if (Array.isArray(room.allowedAnonymousIds)) {
    room.allowedAnonymousIds = room.allowedAnonymousIds.filter((id) => id !== targetAnonymousId)
  }
  room.activeCount = Math.max(0, (room.activeCount || 1) - 1)
  await room.save()

  return {
    success: true,
    roomId: room._id.toString(),
    targetAnonymousId,
    activeCount: room.activeCount,
  }
}

async function getLoungeSummary() {
  const roomCount = await AnonymousRoom.countDocuments()
  // Active count across all rooms
  const rooms = await AnonymousRoom.find().select('activeCount').lean()
  const totalRoomActive = rooms.reduce((sum, r) => sum + (r.activeCount || 0), 0)
  return {
    totalRooms: roomCount,
    activeParticipants: Math.max(totalRoomActive, 1),
  }
}

async function deleteCustomRoom(user, roomId) {
  const room = await AnonymousRoom.findById(roomId)
  if (!room) {
    throw new AppError('Oda bulunamadı.', 404)
  }
  if (room.isSystem) {
    throw new AppError('Sistem odaları silinemez.', 403)
  }
  const isAdmin = user.role === 'admin'
  if (!isAdmin && (!room.createdBy || room.createdBy.toString() !== user._id.toString())) {
    throw new AppError('Yalnızca kendi açtığınız odayı silebilirsiniz.', 403)
  }

  await AnonymousMessage.deleteMany({ roomId: room._id })
  await AnonymousRoom.findByIdAndDelete(roomId)

  return { success: true, roomId: roomId.toString() }
}

async function deleteRoomMessage(user, messageId) {
  const profile = await getOrCreateAnonymousProfile(user)
  const message = await AnonymousMessage.findById(messageId)
  if (!message) {
    throw new AppError('Mesaj bulunamadı.', 404)
  }
  const isAdmin = user.role === 'admin'
  if (!isAdmin && message.senderAnonymousId !== profile.anonymousId) {
    throw new AppError('Yalnızca kendi mesajlarınızı silebilirsiniz.', 403)
  }

  await AnonymousMessage.findByIdAndDelete(messageId)
  return {
    success: true,
    messageId: messageId.toString(),
    roomId: message.roomId ? message.roomId.toString() : null,
  }
}

async function blockAnonymousUser(user, targetAnonymousId) {
  if (!targetAnonymousId || typeof targetAnonymousId !== 'string') {
    throw new AppError('Geçersiz kullanıcı.', 400)
  }
  const profile = await getOrCreateAnonymousProfile(user)
  if (profile.anonymousId === targetAnonymousId) {
    throw new AppError('Kendinizi engelleyemezsiniz.', 400)
  }

  if (!user.anonymousProfile) {
    user.anonymousProfile = {}
  }
  if (!Array.isArray(user.anonymousProfile.blockedAnonymousIds)) {
    user.anonymousProfile.blockedAnonymousIds = []
  }

  if (!user.anonymousProfile.blockedAnonymousIds.includes(targetAnonymousId)) {
    user.anonymousProfile.blockedAnonymousIds.push(targetAnonymousId)
    await user.save()
  }

  return {
    success: true,
    targetAnonymousId,
    blockedAnonymousIds: user.anonymousProfile.blockedAnonymousIds,
  }
}

async function unblockAnonymousUser(user, targetAnonymousId) {
  if (!targetAnonymousId || typeof targetAnonymousId !== 'string') {
    throw new AppError('Geçersiz kullanıcı.', 400)
  }

  if (user.anonymousProfile && Array.isArray(user.anonymousProfile.blockedAnonymousIds)) {
    user.anonymousProfile.blockedAnonymousIds = user.anonymousProfile.blockedAnonymousIds.filter(
      (id) => id !== targetAnonymousId,
    )
    await user.save()
  }

  return {
    success: true,
    targetAnonymousId,
    blockedAnonymousIds: user.anonymousProfile?.blockedAnonymousIds || [],
  }
}

function getDirectChatKey(id1, id2) {
  if (!id1 || !id2) return null
  return [String(id1), String(id2)].sort().join('_')
}

function serializeDirectChat(chat, myAnonId) {
  const partnerAnonId = chat.participants.find((id) => id !== myAnonId)
  let partnerProfile = null

  if (chat.participantProfiles) {
    if (chat.participantProfiles instanceof Map) {
      partnerProfile = chat.participantProfiles.get(partnerAnonId)
    } else if (typeof chat.participantProfiles === 'object') {
      partnerProfile = chat.participantProfiles[partnerAnonId]
    }
  }

  let unreadCount = 0
  if (chat.unreadCounts) {
    if (chat.unreadCounts instanceof Map) {
      unreadCount = chat.unreadCounts.get(myAnonId) || 0
    } else if (typeof chat.unreadCounts === 'object') {
      unreadCount = chat.unreadCounts[myAnonId] || 0
    }
  }

  return {
    id: chat._id.toString(),
    chatKey: chat.chatKey,
    sessionId: chat.chatKey,
    partner: {
      anonymousId: partnerAnonId,
      alias: partnerProfile?.alias || 'Gölge Gezgin',
      avatarKey: partnerProfile?.avatarKey || 'avatar-1',
      gender: partnerProfile?.gender || 'unspecified',
      ageRange: partnerProfile?.ageRange || 'unspecified',
      status: partnerProfile?.status || '',
    },
    lastMessage: chat.lastMessage || null,
    lastMessageAt: chat.lastMessageAt || chat.updatedAt || chat.createdAt,
    unreadCount,
    hasUnread: unreadCount > 0,
    createdAt: chat.createdAt,
  }
}

async function getOrCreateDirectChat(user, targetAnonymousId, targetProfileData = null) {
  const myProfile = await getOrCreateAnonymousProfile(user)
  const myAnonId = myProfile.anonymousId

  if (!targetAnonymousId || myAnonId === targetAnonymousId) {
    throw new AppError('Geçersiz sohbet hedefi.', 400)
  }

  const chatKey = getDirectChatKey(myAnonId, targetAnonymousId)
  let chat = await AnonymousDirectChat.findOne({ chatKey })

  if (!chat) {
    chat = new AnonymousDirectChat({
      chatKey,
      participants: [myAnonId, targetAnonymousId],
      participantProfiles: new Map(),
    })
  }

  // Update current user's profile in the chat record
  chat.participantProfiles.set(myAnonId, {
    alias: myProfile.alias,
    avatarKey: myProfile.avatarKey,
    gender: myProfile.gender,
    ageRange: myProfile.ageRange,
    status: myProfile.status,
  })

  // If target profile data is provided, save or update it
  if (targetProfileData && typeof targetProfileData === 'object') {
    chat.participantProfiles.set(targetAnonymousId, {
      alias: targetProfileData.alias || 'Gölge Gezgin',
      avatarKey: targetProfileData.avatarKey || 'avatar-1',
      gender: targetProfileData.gender || 'unspecified',
      ageRange: targetProfileData.ageRange || 'unspecified',
      status: targetProfileData.status || '',
    })
  }

  // If previously deleted by current user, restore it
  if (chat.deletedBy && chat.deletedBy.includes(myAnonId)) {
    chat.deletedBy = chat.deletedBy.filter((id) => id !== myAnonId)
  }

  if (!Array.isArray(chat.participantUserIds)) {
    chat.participantUserIds = []
  }
  if (user._id && !chat.participantUserIds.some((id) => id.toString() === user._id.toString())) {
    chat.participantUserIds.push(user._id)
  }
  if (chat.participantUserIds.length < 2) {
    const targetUser = await User.findOne({ 'anonymousProfile.anonymousId': targetAnonymousId }).select('_id')
    if (targetUser && !chat.participantUserIds.some((id) => id.toString() === targetUser._id.toString())) {
      chat.participantUserIds.push(targetUser._id)
    }
  }

  await chat.save()

  return serializeDirectChat(chat, myAnonId)
}

async function listDirectChats(user) {
  const myProfile = await getOrCreateAnonymousProfile(user)
  const myAnonId = myProfile.anonymousId

  const chats = await AnonymousDirectChat.find({
    participants: myAnonId,
    deletedBy: { $ne: myAnonId },
  }).sort({ lastMessageAt: -1 })

  return chats.map((chat) => serializeDirectChat(chat, myAnonId))
}

async function getDirectChatMessages(user, chatKey, limit = 50) {
  const myProfile = await getOrCreateAnonymousProfile(user)
  const myAnonId = myProfile.anonymousId

  const chat = await AnonymousDirectChat.findOne({ chatKey })
  if (!chat || !chat.participants.includes(myAnonId)) {
    throw new AppError('Sohbet bulunamadı veya yetkiniz yok.', 404)
  }

  // Automatically mark partner's messages as read
  const now = new Date()
  await AnonymousMessage.updateMany(
    {
      conversationId: chatKey,
      senderAnonymousId: { $ne: myAnonId },
      status: { $ne: 'read' },
    },
    {
      $set: { status: 'read', readAt: now },
    },
  )

  if (chat.unreadCounts) {
    if (chat.unreadCounts instanceof Map) {
      chat.unreadCounts.set(myAnonId, 0)
    } else if (typeof chat.unreadCounts === 'object') {
      chat.unreadCounts[myAnonId] = 0
    }
    await chat.save()
  }

  const messages = await AnonymousMessage.find({ conversationId: chatKey })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return messages.reverse().map((msg) => ({
    id: msg._id.toString(),
    sessionId: chatKey,
    conversationId: chatKey,
    senderAnonymousId: msg.senderAnonymousId,
    senderAlias: msg.senderAlias,
    senderAvatar: msg.senderAvatar,
    text: msg.text,
    media: Array.isArray(msg.media) ? msg.media : [],
    status: msg.status || 'sent',
    deliveredAt: msg.deliveredAt || null,
    readAt: msg.readAt || null,
    createdAt: msg.createdAt,
  }))
}

async function saveDirectChatMessage({ chatKey, user, text, media = [], status = 'sent' }) {
  const cleanText = typeof text === 'string' ? text.trim().slice(0, 1000) : ''
  const cleanMedia = Array.isArray(media) ? media : []

  if (!cleanText && cleanMedia.length === 0) {
    throw new AppError('Mesaj metni veya medya gereklidir.', 400)
  }

  const myProfile = await getOrCreateAnonymousProfile(user)
  const myAnonId = myProfile.anonymousId

  let chat = await AnonymousDirectChat.findOne({ chatKey })
  if (!chat || !chat.participants.includes(myAnonId)) {
    throw new AppError('Sohbet bulunamadı veya yetkiniz yok.', 404)
  }

  const partnerAnonId = chat.participants.find((id) => id !== myAnonId)
  if (myProfile.blockedAnonymousIds?.includes(partnerAnonId)) {
    throw new AppError('Bu kullanıcı engellenmiş.', 403)
  }

  const initialStatus = ['sent', 'delivered', 'read'].includes(status) ? status : 'sent'
  const now = new Date()

  // Create message
  const message = await AnonymousMessage.create({
    conversationId: chatKey,
    roomId: null,
    senderAnonymousId: myAnonId,
    senderAlias: myProfile.alias,
    senderAvatar: myProfile.avatarKey,
    text: cleanText,
    media: cleanMedia,
    status: initialStatus,
    deliveredAt: initialStatus === 'delivered' || initialStatus === 'read' ? now : null,
    readAt: initialStatus === 'read' ? now : null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })

  // Update chat
  chat.lastMessage = {
    text: cleanText || (cleanMedia.length > 0 ? (cleanMedia[0].type === 'audio' ? '🎤 Sesli Mesaj' : '📷 Fotoğraf') : ''),
    senderAnonymousId: myAnonId,
    senderAlias: myProfile.alias,
    hasMedia: cleanMedia.length > 0,
    mediaType: cleanMedia[0]?.type || '',
    createdAt: message.createdAt,
  }
  chat.lastMessageAt = message.createdAt
  // Un-hide chat for anyone who had deleted it previously
  chat.deletedBy = []
  chat.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Increment unread count for partner if message is not read immediately
  if (!chat.unreadCounts) chat.unreadCounts = new Map()
  if (initialStatus !== 'read') {
    const currentUnread =
      (chat.unreadCounts instanceof Map
        ? chat.unreadCounts.get(partnerAnonId)
        : chat.unreadCounts[partnerAnonId]) || 0
    if (chat.unreadCounts instanceof Map) {
      chat.unreadCounts.set(partnerAnonId, currentUnread + 1)
    } else {
      chat.unreadCounts[partnerAnonId] = currentUnread + 1
    }
  }

  // Ensure current user's profile is up to date in the chat
  chat.participantProfiles.set(myAnonId, {
    alias: myProfile.alias,
    avatarKey: myProfile.avatarKey,
    gender: myProfile.gender,
    ageRange: myProfile.ageRange,
    status: myProfile.status,
  })

  await chat.save()

  return {
    id: message._id.toString(),
    sessionId: chatKey,
    conversationId: chatKey,
    senderAnonymousId: myAnonId,
    senderAlias: myProfile.alias,
    senderAvatar: myProfile.avatarKey,
    text: message.text,
    media: message.media || [],
    status: message.status,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    createdAt: message.createdAt,
  }
}

async function markDirectChatAsRead(user, chatKey) {
  const myProfile = await getOrCreateAnonymousProfile(user)
  const myAnonId = myProfile.anonymousId

  const chat = await AnonymousDirectChat.findOne({ chatKey })
  if (!chat || !chat.participants.includes(myAnonId)) {
    throw new AppError('Sohbet bulunamadı.', 404)
  }

  const now = new Date()
  await AnonymousMessage.updateMany(
    {
      conversationId: chatKey,
      senderAnonymousId: { $ne: myAnonId },
      status: { $ne: 'read' },
    },
    {
      $set: { status: 'read', readAt: now },
    },
  )

  if (!chat.unreadCounts) chat.unreadCounts = new Map()
  if (chat.unreadCounts instanceof Map) {
    chat.unreadCounts.set(myAnonId, 0)
  } else {
    chat.unreadCounts[myAnonId] = 0
  }
  await chat.save()

  return { success: true, chatKey, readAt: now }
}

async function deleteDirectChatForUser(user, chatKey) {
  const myProfile = await getOrCreateAnonymousProfile(user)
  const myAnonId = myProfile.anonymousId

  const chat = await AnonymousDirectChat.findOne({ chatKey })
  if (!chat || !chat.participants.includes(myAnonId)) {
    throw new AppError('Sohbet bulunamadı.', 404)
  }

  if (!chat.deletedBy.includes(myAnonId)) {
    chat.deletedBy.push(myAnonId)
    await chat.save()
  }

  return { success: true, chatKey }
}

module.exports = {
  generateRandomAlias,
  getAnonymousId,
  serializeAnonymousProfile,
  getOrCreateAnonymousProfile,
  updateAnonymousProfile,
  seedDefaultRoomsIfNeeded,
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
  getDirectChatKey,
  getOrCreateDirectChat,
  listDirectChats,
  getDirectChatMessages,
  saveDirectChatMessage,
  deleteDirectChatForUser,
  markDirectChatAsRead,
  requestRoomJoin,
  approveRoomJoin,
  rejectRoomJoin,
  kickRoomMember,
  banRoomMember,
}
