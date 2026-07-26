const bcrypt = require('bcryptjs')
const { User } = require('../models/User')
const { Post } = require('../models/Post')
const { RefreshToken } = require('../models/RefreshToken')
const { Notification } = require('../models/Notification')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')
const { serializePostForViewer } = require('../utils/socialSerializers')
const { serializeUser } = require('../utils/tokens')
const { clearAuthCookies } = require('../utils/cookies')
const {
  getSuggestedUsersForViewer,
  invalidateSuggestionCache,
} = require('../services/suggestionService')
const {
  normalizeApproximateLocation,
  logLocationConsent,
} = require('../services/locationService')
const { uploadProfileDataImage } = require('../services/mediaStorageService')
const { normalizeUserMedia } = require('../utils/mediaUrls')

function nowMs() {
  return Date.now()
}

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assertProfileAccess(profileUser, viewer) {
  const isOwnProfile =
    viewer && profileUser._id.toString() === viewer._id.toString()
  const isAdminViewer = viewer?.role === 'admin'

  if (profileUser.accountStatus === 'suspended' && !isAdminViewer) {
    throw new AppError('This profile is not available.', 404)
  }

  if (profileUser.isPrivate && !isOwnProfile && !isAdminViewer) {
    throw new AppError('This profile is private.', 403)
  }

  return { isOwnProfile, isAdminViewer }
}

function buildViewerRelationshipState(targetUser, viewer) {
  const isOwnProfile =
    Boolean(viewer) && targetUser._id.toString() === viewer._id.toString()

  return {
    canFollow: Boolean(viewer) && !isOwnProfile,
    isFollowing:
      Boolean(viewer) &&
      !isOwnProfile &&
      (viewer.friendIds || []).some(
        (friendId) => friendId.toString() === targetUser._id.toString(),
      ),
    followsViewer:
      Boolean(viewer) &&
      !isOwnProfile &&
      (targetUser.friendIds || []).some(
        (friendId) => friendId.toString() === viewer._id.toString(),
      ),
  }
}

function buildDiscoverySummary(user) {
  return {
    locationConsent: {
      status: user.discovery?.locationConsent?.status || 'unknown',
      consentGivenAt: user.discovery?.locationConsent?.consentGivenAt || null,
      source: user.discovery?.locationConsent?.source || '',
    },
    lastApproxLocation: {
      city: user.discovery?.lastApproxLocation?.city || '',
      country: user.discovery?.lastApproxLocation?.country || '',
      latRounded: user.discovery?.lastApproxLocation?.latRounded ?? null,
      lngRounded: user.discovery?.lastApproxLocation?.lngRounded ?? null,
      accuracy: user.discovery?.lastApproxLocation?.accuracy ?? null,
      source: user.discovery?.lastApproxLocation?.source || '',
      capturedAt: user.discovery?.lastApproxLocation?.capturedAt || null,
      lastSeenAt: user.discovery?.lastApproxLocation?.lastSeenAt || null,
    },
    lastExactLocation: {
      city: user.discovery?.lastExactLocation?.city || '',
      country: user.discovery?.lastExactLocation?.country || '',
      latitude: user.discovery?.lastExactLocation?.latitude ?? null,
      longitude: user.discovery?.lastExactLocation?.longitude ?? null,
      accuracy: user.discovery?.lastExactLocation?.accuracy ?? null,
      source: user.discovery?.lastExactLocation?.source || '',
      capturedAt: user.discovery?.lastExactLocation?.capturedAt || null,
      lastSeenAt: user.discovery?.lastExactLocation?.lastSeenAt || null,
    },
    nearbyDiscoveryUsageCount: user.discovery?.nearbyDiscoveryUsageCount || 0,
    lastNearbyDiscoveryAt: user.discovery?.lastNearbyDiscoveryAt || null,
  }
}

function buildVisiblePostFilter({ ownerId, viewer, isOwnProfile, isAdminViewer }) {
  const filter = {
    archivedAt: null,
  }

  if (!isAdminViewer) {
    filter['moderation.visibility'] = 'visible'
  }

  if (ownerId) {
    filter.author = ownerId
  }

  if (!isOwnProfile && !isAdminViewer) {
    filter.privacy = 'public'
  }

  return filter
}

async function buildProfilePayload(profileUser, viewer) {
  const { isOwnProfile, isAdminViewer } = assertProfileAccess(profileUser, viewer)

  const postFilter = buildVisiblePostFilter({
    ownerId: profileUser._id,
    viewer,
    isOwnProfile,
    isAdminViewer,
  })
  const likedPostIds = profileUser.activity?.likedPostIds || []
  const savedPostIds = profileUser.activity?.savedPostIds || []
  const commentedPostIds = profileUser.activity?.commentedPostIds || []

  const [followerCount, postCount, mediaCount, recentPosts, likedPosts, savedPosts, repliedPosts] = await Promise.all([
    User.countDocuments({ friendIds: profileUser._id }),
    Post.countDocuments(postFilter),
    Post.countDocuments({
      ...postFilter,
      'media.0': { $exists: true },
    }),
    Post.find(postFilter)
      .populate('author', 'firstName lastName username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(20),
    likedPostIds.length
      ? Post.find({
          ...buildVisiblePostFilter({
            ownerId: null,
            viewer,
            isOwnProfile,
            isAdminViewer,
          }),
          _id: { $in: likedPostIds },
        })
          .populate('author', 'firstName lastName username avatarUrl')
          .sort({ createdAt: -1 })
          .limit(20)
      : [],
    isOwnProfile && savedPostIds.length
      ? Post.find({
          ...buildVisiblePostFilter({
            ownerId: null,
            viewer: profileUser,
            isOwnProfile: true,
            isAdminViewer,
          }),
          _id: { $in: savedPostIds },
        })
          .populate('author', 'firstName lastName username avatarUrl')
          .sort({ createdAt: -1 })
          .limit(20)
      : [],
    commentedPostIds.length
      ? Post.find({
          ...buildVisiblePostFilter({
            ownerId: null,
            viewer,
            isOwnProfile,
            isAdminViewer,
          }),
          _id: { $in: commentedPostIds },
        })
          .populate('author', 'firstName lastName username avatarUrl')
          .sort({ createdAt: -1 })
          .limit(20)
      : [],
  ])

  return {
    user: serializeUser(profileUser),
    discovery: isOwnProfile || isAdminViewer ? buildDiscoverySummary(profileUser) : null,
    stats: {
      followers: followerCount,
      following: profileUser.friendIds.length,
      posts: postCount,
      media: mediaCount,
      friends: profileUser.friendIds.length,
      likes: profileUser.activity?.likedPostIds?.length || 0,
      saved: profileUser.activity?.savedPostIds?.length || 0,
    },
    isOwnProfile,
    viewerState: buildViewerRelationshipState(profileUser, viewer),
    recentPosts: recentPosts.map((post) => serializePostForViewer(post, viewer)),
    likedPosts: likedPosts.map((post) => serializePostForViewer(post, viewer)),
    savedPosts: savedPosts.map((post) => serializePostForViewer(post, viewer)),
    repliedPosts: repliedPosts.map((post) => serializePostForViewer(post, viewer)),
  }
}

async function buildConnectionPayload(profileUser, viewer, type) {
  assertProfileAccess(profileUser, viewer)
  const viewerFollowingIds = new Set((viewer?.friendIds || []).map((friendId) => friendId.toString()))

  const connections =
    type === 'followers'
      ? await User.find({ friendIds: profileUser._id })
          .sort({ createdAt: -1 })
          .select('firstName lastName username email birthDate location role accountStatus moderation bio avatarUrl coverUrl isPrivate lastLoginAt createdAt friendIds')
      : await User.find({ _id: { $in: profileUser.friendIds || [] } })
          .sort({ createdAt: -1 })
          .select('firstName lastName username email birthDate location role accountStatus moderation bio avatarUrl coverUrl isPrivate lastLoginAt createdAt friendIds')

  return {
    user: serializeUser(profileUser),
    type,
    items: connections.map((connectionUser) => ({
      user: serializeUser(connectionUser),
      viewerState: buildViewerRelationshipState(connectionUser, viewer),
      mutualConnectionCount: viewer
        ? (connectionUser.friendIds || []).reduce(
            (count, friendId) =>
              viewerFollowingIds.has(friendId.toString()) ? count + 1 : count,
            0,
          )
        : 0,
    })),
  }
}

async function getGuestDiscoverySuggestions({ mode = 'for-you', limit = 6 }) {
  if (mode === 'nearby') {
    return {
      mode,
      items: [],
      meta: {
        generatedAt: new Date().toISOString(),
        locationEnabled: false,
        isGuest: true,
      },
    }
  }

  const candidates = await User.find({
    accountStatus: 'active',
    isPrivate: false,
  })
    .select(
      'firstName lastName username email birthDate location role accountStatus moderation bio avatarUrl coverUrl isPrivate lastLoginAt createdAt friendIds',
    )
    .sort({ lastLoginAt: -1, createdAt: -1 })
    .limit(80)
    .lean()

  if (!candidates.length) {
    return {
      mode,
      items: [],
      meta: {
        generatedAt: new Date().toISOString(),
        locationEnabled: false,
        isGuest: true,
      },
    }
  }

  const candidateIds = candidates.map((candidate) => candidate._id)
  const postMetricsRaw = await Post.aggregate([
    {
      $match: {
        author: { $in: candidateIds },
        archivedAt: null,
        'moderation.visibility': 'visible',
        privacy: 'public',
      },
    },
    {
      $group: {
        _id: '$author',
        postCount: { $sum: 1 },
        engagement: {
          $sum: {
            $add: [
              { $ifNull: ['$stats.likes', 0] },
              { $ifNull: ['$stats.comments', 0] },
              { $ifNull: ['$stats.saves', 0] },
              { $ifNull: ['$stats.shares', 0] },
            ],
          },
        },
      },
    },
  ])
  const postMetrics = new Map(
    postMetricsRaw.map((entry) => [entry._id?.toString?.() || '', entry]),
  )

  const withScores = candidates.map((candidate) => {
    const candidateId = candidate._id.toString()
    const friendCount = (candidate.friendIds || []).length
    const metrics = postMetrics.get(candidateId) || { postCount: 0, engagement: 0 }

    const score =
      mode === 'mutual'
        ? friendCount * 6 + metrics.postCount * 2 + metrics.engagement * 0.35
        : metrics.postCount * 5 + metrics.engagement * 0.45 + friendCount * 2

    const reason =
      mode === 'mutual'
        ? friendCount
          ? `${friendCount} baglantiya sahip`
          : 'Toplulugun aktif uyelerinden'
        : metrics.postCount
          ? `${metrics.postCount} gonderiyle aktif`
          : 'Platformda aktif'

    return {
      user: serializeUser(candidate),
      viewerState: {
        canFollow: false,
        isFollowing: false,
        followsViewer: false,
      },
      mutualConnectionCount: mode === 'mutual' ? friendCount : 0,
      reason,
      score,
      lastLoginAt: candidate.lastLoginAt || candidate.createdAt || null,
    }
  })

  const items = withScores
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return new Date(right.lastLoginAt || 0) - new Date(left.lastLoginAt || 0)
    })
    .slice(0, limit)
    .map(({ score, lastLoginAt, ...item }) => item)

  return {
    mode,
    items,
    meta: {
      generatedAt: new Date().toISOString(),
      locationEnabled: false,
      isGuest: true,
    },
  }
}

const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await User.findById(req.user._id)

  if (!profile) {
    throw new AppError('User not found.', 404)
  }

  const payload = await buildProfilePayload(profile, req.user)
  res.json(payload)
})

const getProfileByUsername = asyncHandler(async (req, res) => {
  const profile = await User.findOne({
    username: req.validated.params.username.toLowerCase(),
  })

  if (!profile) {
    throw new AppError('Profile not found.', 404)
  }

  const payload = await buildProfilePayload(profile, req.user || null)
  res.json(payload)
})

const checkUsernameAvailability = asyncHandler(async (req, res) => {
  const requestedUsername = req.validated.query.username.toLowerCase()

  const existingUser = await User.findOne({ username: requestedUsername }).select('_id username')
  const isOwnUsername =
    Boolean(req.user) &&
    req.user.username &&
    req.user.username.toLowerCase() === requestedUsername

  const available = !existingUser || isOwnUsername

  res.json({
    username: requestedUsername,
    available,
    message: available
      ? 'Kullanici adi kullanilabilir.'
      : 'Bu kullanici adi zaten kullanimda.',
  })
})

const searchUsers = asyncHandler(async (req, res) => {
  const query = req.validated.query.q.trim()
  const limit = req.validated.query.limit
  const filter = {
    accountStatus: { $ne: 'suspended' },
    isPrivate: false,
  }

  if (req.user?._id) {
    filter._id = { $ne: req.user._id }
  }

  if (query) {
    const escapedQuery = escapeRegex(query)

    filter.$or = [
      { username: { $regex: `^${escapedQuery}`, $options: 'i' } },
      { firstName: { $regex: `^${escapedQuery}`, $options: 'i' } },
      { lastName: { $regex: `^${escapedQuery}`, $options: 'i' } },
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ['$firstName', ' ', '$lastName'] },
            regex: escapedQuery,
            options: 'i',
          },
        },
      },
    ]
  }

  const users = await User.find(filter)
    .select('firstName lastName username avatarUrl lastLoginAt createdAt')
    .sort({ lastLoginAt: -1, createdAt: -1 })
    .limit(limit)

  res.json({
    users: users.map((item) => ({
      ...serializeUser(item),
      viewerState: buildViewerRelationshipState(item, req.user || null),
    })),
  })
})

const getDiscoverySuggestions = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    const payload = await getGuestDiscoverySuggestions({
      mode: req.validated.query.mode,
      limit: req.validated.query.limit,
    })
    res.json(payload)
    return
  }

  const viewer = await User.findById(req.user._id)

  if (!viewer) {
    throw new AppError('User not found.', 404)
  }

  const payload = await getSuggestedUsersForViewer({
    viewer,
    mode: req.validated.query.mode,
    limit: req.validated.query.limit,
    refresh: req.validated.query.refresh,
  })

  res.json(payload)
})

const updateDiscoveryLocation = asyncHandler(async (req, res) => {
  const viewer = await User.findById(req.user._id)

  if (!viewer) {
    throw new AppError('User not found.', 404)
  }

  const normalizedLocation = normalizeApproximateLocation(
    req.validated.body,
    viewer.location || {},
  )

  viewer.discovery = viewer.discovery || {}
  viewer.discovery.locationConsent = {
    status: normalizedLocation.status,
    consentGivenAt:
      normalizedLocation.status === 'granted'
        ? normalizedLocation.consentGivenAt
        : viewer.discovery?.locationConsent?.consentGivenAt || null,
    source: normalizedLocation.source,
  }

  if (normalizedLocation.status === 'granted') {
    viewer.discovery.lastApproxLocation = {
      city: normalizedLocation.city,
      country: normalizedLocation.country,
      latRounded: normalizedLocation.latRounded,
      lngRounded: normalizedLocation.lngRounded,
      accuracy: normalizedLocation.accuracy,
      source: normalizedLocation.source,
      capturedAt: normalizedLocation.consentGivenAt,
      lastSeenAt: normalizedLocation.lastSeenAt,
    }
    viewer.discovery.lastExactLocation = {
      city: normalizedLocation.city,
      country: normalizedLocation.country,
      latitude: normalizedLocation.latitude,
      longitude: normalizedLocation.longitude,
      accuracy: normalizedLocation.accuracy,
      source: normalizedLocation.source,
      capturedAt: normalizedLocation.consentGivenAt,
      lastSeenAt: normalizedLocation.lastSeenAt,
    }
  }

  await viewer.save()

  await logLocationConsent({
    userId: viewer._id,
    ...normalizedLocation,
  })

  invalidateSuggestionCache(viewer._id.toString())

  res.json({
    message:
      normalizedLocation.status === 'granted'
        ? 'Exact GPS location saved for nearby discovery.'
        : 'Location permission preference saved.',
    discovery: buildDiscoverySummary(viewer),
  })
})

const getMyConnections = asyncHandler(async (req, res) => {
  const profile = await User.findById(req.user._id)

  if (!profile) {
    throw new AppError('User not found.', 404)
  }

  const payload = await buildConnectionPayload(
    profile,
    req.user,
    req.validated.params.connectionType,
  )

  res.json(payload)
})

const getProfileConnections = asyncHandler(async (req, res) => {
  const profile = await User.findOne({
    username: req.validated.params.username.toLowerCase(),
  })

  if (!profile) {
    throw new AppError('Profile not found.', 404)
  }

  const payload = await buildConnectionPayload(
    profile,
    req.user || null,
    req.validated.params.connectionType,
  )

  res.json(payload)
})

const updateMyProfile = asyncHandler(async (req, res) => {
  const startMs = nowMs()
  const requestId =
    req.headers?.['x-request-id'] ||
    `profile-${Math.random().toString(36).slice(2, 10)}`
  const timeline = {}
  const mark = (step) => {
    timeline[step] = nowMs()
  }

  const profile = await User.findById(req.user._id)
  mark('profile_lookup_done')

  if (!profile) {
    throw new AppError('User not found.', 404)
  }

  const body = req.validated.body || {}
  const hasField = (field) => Object.prototype.hasOwnProperty.call(body, field)
  const currentEmail = String(profile.email || '').trim().toLowerCase()
  const currentUsername = String(profile.username || '').trim().toLowerCase()
  const incomingEmail = hasField('email')
    ? String(body.email || '').trim().toLowerCase()
    : currentEmail
  const incomingUsername = hasField('username')
    ? String(body.username || '').trim().toLowerCase()
    : currentUsername
  const shouldProcessAvatar = hasField('avatarUrl')
  const shouldProcessCover = hasField('coverUrl')

  let nextAvatarUrl = profile.avatarUrl
  let nextCoverUrl = profile.coverUrl

  const [avatarResult, coverResult] = await Promise.all([
    shouldProcessAvatar
      ? uploadProfileDataImage(body.avatarUrl, {
          username: incomingUsername,
          kind: 'avatar',
        })
      : Promise.resolve(profile.avatarUrl),
    shouldProcessCover
      ? uploadProfileDataImage(body.coverUrl, {
          username: incomingUsername,
          kind: 'cover',
        })
      : Promise.resolve(profile.coverUrl),
  ])
  nextAvatarUrl = avatarResult
  mark('avatar_upload_done')
  nextCoverUrl = coverResult
  mark('cover_upload_done')

  const emailChanged = hasField('email') && incomingEmail !== currentEmail
  const usernameChanged = hasField('username') && incomingUsername !== currentUsername

  if (emailChanged || usernameChanged) {
    const conflictingUser = await User.findOne({
      _id: { $ne: req.user._id },
      $or: [
        ...(emailChanged ? [{ email: incomingEmail }] : []),
        ...(usernameChanged ? [{ username: incomingUsername }] : []),
      ],
    })

    if (conflictingUser) {
      if (String(conflictingUser.email || '').toLowerCase() === incomingEmail) {
        throw new AppError('This email address is already in use.', 409)
      }

      throw new AppError('This username is already in use.', 409)
    }
  }

  if (hasField('firstName')) {
    profile.firstName = body.firstName
  }

  if (hasField('lastName')) {
    profile.lastName = body.lastName
  }

  if (hasField('email')) {
    profile.email = incomingEmail
  }

  if (hasField('username')) {
    profile.username = incomingUsername
  }

  if (hasField('birthDate')) {
    profile.birthDate = body.birthDate
  }

  if (hasField('bio')) {
    profile.bio = body.bio
  }

  if (hasField('avatarUrl')) {
    profile.avatarUrl = nextAvatarUrl
  }

  if (hasField('coverUrl')) {
    profile.coverUrl = nextCoverUrl
  }

  if (body.location) {
    profile.location = {
      city: body.location.city ?? profile.location?.city ?? '',
      country: body.location.country ?? profile.location?.country ?? '',
    }
  }
  if (hasField('isPrivate')) {
    profile.isPrivate = body.isPrivate
  }

  await profile.save({ validateModifiedOnly: true })
  mark('profile_save_done')

  const payload = await buildProfilePayload(profile, profile)
  mark('payload_build_done')
  res.json({
    message: 'Profile updated successfully.',
    ...payload,
  })

  const stepDurations = {}
  let previous = startMs
  for (const [step, at] of Object.entries(timeline)) {
    stepDurations[`${step}Ms`] = Math.max(0, at - previous)
    previous = at
  }
  console.info(
    JSON.stringify({
      tag: 'upload_perf',
      flow: 'update_profile',
      requestId,
      path: req.originalUrl || req.url,
      method: req.method,
      totalMs: Math.max(0, nowMs() - startMs),
      hasAvatarUpdate: hasField('avatarUrl'),
      hasCoverUpdate: hasField('coverUrl'),
      timeline: stepDurations,
    }),
  )
})

const toggleFollowByUsername = asyncHandler(async (req, res) => {
  const targetProfile = await User.findOne({
    username: req.validated.params.username.toLowerCase(),
  })

  if (!targetProfile) {
    throw new AppError('Profile not found.', 404)
  }

  if (targetProfile._id.toString() === req.user._id.toString()) {
    throw new AppError('You cannot follow your own profile.', 400)
  }

  const viewer = await User.findById(req.user._id)

  if (!viewer) {
    throw new AppError('User not found.', 404)
  }

  const alreadyFollowing = viewer.friendIds.some(
    (friendId) => friendId.toString() === targetProfile._id.toString(),
  )

  if (alreadyFollowing) {
    viewer.friendIds = viewer.friendIds.filter(
      (friendId) => friendId.toString() !== targetProfile._id.toString(),
    )
  } else {
    viewer.friendIds.push(targetProfile._id)
  }

  await viewer.save()
  invalidateSuggestionCache(viewer._id.toString())

  if (!alreadyFollowing) {
    const followNotification = await Notification.create({
      user: targetProfile._id,
      actor: viewer._id,
      type: 'follow',
      entityKind: 'profile',
      entityId: viewer._id,
      title: 'New follower',
      body: `${viewer.firstName} started following you.`,
    })

    const io = req.app.locals.io || null
    if (io) {
      const populatedNotification = await Notification.findById(
        followNotification._id,
      ).populate('actor', 'firstName lastName username avatarUrl lastLoginAt')

      if (populatedNotification) {
        const serializedNotification = {
          ...(populatedNotification.toObject
            ? populatedNotification.toObject()
            : populatedNotification),
          actor: normalizeUserMedia(populatedNotification.actor),
          targetPostId: null,
          targetCommentId: null,
          targetConversationId: null,
        }
        io
          .to(`user:${targetProfile._id}`)
          .emit('notification:new', serializedNotification)
      }
    }
  }

  const refreshedTargetProfile = await User.findById(targetProfile._id)
  const payload = await buildProfilePayload(refreshedTargetProfile, viewer)

  res.json({
    message: alreadyFollowing ? 'Profile unfollowed successfully.' : 'Profile followed successfully.',
    ...payload,
  })
})

const changeMyPassword = asyncHandler(async (req, res) => {
  const profile = await User.findById(req.user._id).select('+passwordHash')

  if (!profile) {
    throw new AppError('User not found.', 404)
  }

  const passwordMatches = await profile.comparePassword(
    req.validated.body.currentPassword,
  )

  if (!passwordMatches) {
    throw new AppError('Current password is incorrect.', 400)
  }

  const nextPasswordMatchesCurrent = await bcrypt.compare(
    req.validated.body.newPassword,
    profile.passwordHash,
  )

  if (nextPasswordMatchesCurrent) {
    throw new AppError('New password must be different from the current password.', 400)
  }

  profile.passwordHash = await bcrypt.hash(req.validated.body.newPassword, 12)
  await profile.save()
  await RefreshToken.updateMany(
    { user: profile._id, revokedAt: null },
    { revokedAt: new Date(), lastUsedAt: new Date() },
  )

  clearAuthCookies(res)

  res.json({
    message: 'Password changed successfully. Please sign in again.',
  })
})

const deleteMyAccount = asyncHandler(async (req, res) => {
  const profile = await User.findById(req.user._id).select('+passwordHash')

  if (!profile) {
    throw new AppError('User not found.', 404)
  }

  const passwordMatches = await profile.comparePassword(
    req.validated.body.currentPassword,
  )

  if (!passwordMatches) {
    throw new AppError('Current password is incorrect.', 400)
  }

  await Promise.all([
    RefreshToken.deleteMany({ user: profile._id }),
    Notification.deleteMany({
      $or: [{ user: profile._id }, { actor: profile._id }],
    }),
    Post.deleteMany({ author: profile._id }),
    User.updateMany(
      { friendIds: profile._id },
      { $pull: { friendIds: profile._id } },
    ),
    User.deleteOne({ _id: profile._id }),
  ])

  clearAuthCookies(res)

  res.json({
    message: 'Account deleted successfully.',
  })
})

module.exports = {
  getMyProfile,
  getProfileByUsername,
  checkUsernameAvailability,
  searchUsers,
  getDiscoverySuggestions,
  updateDiscoveryLocation,
  getMyConnections,
  getProfileConnections,
  updateMyProfile,
  toggleFollowByUsername,
  changeMyPassword,
  deleteMyAccount,
}
