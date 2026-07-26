const { User } = require('../models/User')
const { Post } = require('../models/Post')
const { Conversation } = require('../models/Conversation')
const { serializeUser } = require('../utils/tokens')
const { extractTopicsFromText } = require('../utils/topicExtraction')
const { calculateDistanceKm } = require('./locationService')
const {
  uniqueIds,
  buildIdSet,
  countIntersection,
  countTopicOverlap,
  computeDiscoveryScore,
  buildSuggestionReason,
} = require('./discoveryScoreService')

const suggestionCache = new Map()
const SUGGESTION_CACHE_TTL_MS = 1000 * 60 * 2

function getCacheKey({ userId, mode, limit, locationHash }) {
  return [userId, mode, limit, locationHash || 'none'].join(':')
}

function getCachedSuggestions(cacheKey) {
  const cached = suggestionCache.get(cacheKey)

  if (!cached) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    suggestionCache.delete(cacheKey)
    return null
  }

  return cached.value
}

function setCachedSuggestions(cacheKey, value) {
  suggestionCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + SUGGESTION_CACHE_TTL_MS,
  })
}

function invalidateSuggestionCache(userId) {
  const prefix = `${userId}:`

  for (const key of suggestionCache.keys()) {
    if (key.startsWith(prefix)) {
      suggestionCache.delete(key)
    }
  }
}

function buildViewerRelationshipState(targetUser, viewer) {
  const targetId = targetUser._id.toString()
  const viewerId = viewer._id.toString()
  const viewerFriendIds = new Set(uniqueIds(viewer.friendIds || []))
  const targetFriendIds = new Set(uniqueIds(targetUser.friendIds || []))
  const isOwnProfile = targetId === viewerId

  return {
    canFollow: !isOwnProfile,
    isFollowing: !isOwnProfile && viewerFriendIds.has(targetId),
    followsViewer: !isOwnProfile && targetFriendIds.has(viewerId),
  }
}

function createLocationHash(location = {}) {
  const lat = typeof location.latRounded === 'number' ? location.latRounded : 'x'
  const lng = typeof location.lngRounded === 'number' ? location.lngRounded : 'x'
  return `${lat}:${lng}:${location.city || ''}:${location.country || ''}`
}

function normalizeLocationText(value = '') {
  return `${value || ''}`.trim().toLowerCase()
}

function buildNearbyLabel({ sameCity, sameCountry, nearbyDistanceKm }) {
  if (sameCity) {
    return 'Ayni sehirde'
  }

  if (typeof nearbyDistanceKm === 'number') {
    if (nearbyDistanceKm <= 5) {
      return 'Yakininda'
    }

    if (nearbyDistanceKm <= 15) {
      return 'Yakin bolgede'
    }

    if (nearbyDistanceKm <= 50) {
      return 'Ayni bolgede'
    }
  }

  if (sameCountry) {
    return 'Ayni ulkede'
  }

  return ''
}

async function buildViewerSignals(viewer) {
  const viewedProfileIds = uniqueIds(viewer.activity?.viewedProfileIds || [])
  const interactionPostIds = uniqueIds([
    ...(viewer.activity?.likedPostIds || []),
    ...(viewer.activity?.commentedPostIds || []),
    ...(viewer.activity?.savedPostIds || []),
    ...(viewer.activity?.sharedPostIds || []),
  ])
  const [engagedPosts, ownPosts, conversations] = await Promise.all([
    interactionPostIds.length
      ? Post.find({ _id: { $in: interactionPostIds } }, { text: 1 }).lean()
      : [],
    Post.find({ author: viewer._id }, { text: 1 }).sort({ createdAt: -1 }).limit(16).lean(),
    Conversation.find(
      { participantIds: viewer._id },
      { participantIds: 1 },
    )
      .sort({ updatedAt: -1 })
      .limit(24)
      .lean(),
  ])

  const topicSet = new Set()
  ;[...engagedPosts, ...ownPosts].forEach((post) => {
    extractTopicsFromText(post.text || '').forEach((topic) => {
      if (topic?.key) {
        topicSet.add(topic.key)
      }
    })
  })

  const recentConversationPartnerIds = new Set()
  conversations.forEach((conversation) => {
    ;(conversation.participantIds || []).forEach((participantId) => {
      const normalizedId = participantId?.toString()

      if (normalizedId && normalizedId !== viewer._id.toString()) {
        recentConversationPartnerIds.add(normalizedId)
      }
    })
  })

  return {
    viewedProfileIds: new Set(viewedProfileIds),
    interactionPostIds: buildIdSet(interactionPostIds),
    viewerFriendIds: buildIdSet(viewer.friendIds || []),
    viewerBlockedIds: buildIdSet(viewer.blockedUserIds || []),
    viewerTopics: [...topicSet],
    recentConversationPartnerIds,
  }
}

async function buildCandidateTopicMap(candidateIds = []) {
  if (!candidateIds.length) {
    return new Map()
  }

  const posts = await Post.find(
    {
      author: { $in: candidateIds },
      archivedAt: null,
      'moderation.visibility': 'visible',
    },
    { author: 1, text: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(Math.max(candidateIds.length * 4, 40))
    .lean()

  const topicMap = new Map()

  posts.forEach((post) => {
    const authorId = post.author?.toString?.()

    if (!authorId) {
      return
    }

    if (!topicMap.has(authorId)) {
      topicMap.set(authorId, [])
    }

    const currentTopics = topicMap.get(authorId)
    const nextTopics = extractTopicsFromText(post.text || '')

    nextTopics.forEach((topic) => {
      if (!currentTopics.some((entry) => entry.key === topic.key)) {
        currentTopics.push(topic)
      }
    })
  })

  return topicMap
}

async function persistSuggestionHistory(viewerId, items, mode) {
  if (!items.length) {
    return
  }

  const shownAt = new Date()
  const nextHistory = items.map((item) => ({
    userId: item.user.id,
    mode,
    shownAt,
  }))

  const viewer = await User.findById(viewerId).select('discovery.suggestionHistory')

  if (!viewer) {
    return
  }

  const mergedHistory = [
    ...nextHistory,
    ...((viewer.discovery?.suggestionHistory || []).map((entry) => ({
      userId: entry.userId,
      mode: entry.mode,
      shownAt: entry.shownAt,
    })) || []),
  ]
    .sort((left, right) => new Date(right.shownAt) - new Date(left.shownAt))
    .slice(0, 60)

  viewer.discovery = viewer.discovery || {}
  viewer.discovery.suggestionHistory = mergedHistory
  await viewer.save()
}

async function recordNearbyDiscoveryUsage(userId) {
  await User.updateOne(
    { _id: userId },
    {
      $inc: { 'discovery.nearbyDiscoveryUsageCount': 1 },
      $set: { 'discovery.lastNearbyDiscoveryAt': new Date() },
    },
  )
}

async function getSuggestedUsersForViewer({
  viewer,
  mode = 'for-you',
  limit = 6,
  refresh = false,
}) {
  const locationEnabled =
    viewer.discovery?.locationConsent?.status === 'granted' &&
    typeof viewer.discovery?.lastApproxLocation?.latRounded === 'number' &&
    typeof viewer.discovery?.lastApproxLocation?.lngRounded === 'number'
  const locationHash = createLocationHash(viewer.discovery?.lastApproxLocation || {})
  const cacheKey = getCacheKey({
    userId: viewer._id.toString(),
    mode,
    limit,
    locationHash: mode === 'nearby' ? locationHash : '',
  })

  if (!refresh) {
    const cached = getCachedSuggestions(cacheKey)

    if (cached) {
      return cached
    }
  }

  if (mode === 'nearby' && !locationEnabled) {
    return {
      mode,
      items: [],
      meta: {
        generatedAt: new Date().toISOString(),
        locationEnabled: false,
      },
    }
  }

  const viewerSignals = await buildViewerSignals(viewer)
  const candidateFilter = {
    _id: {
      $nin: [viewer._id, ...(viewer.friendIds || []), ...(viewer.blockedUserIds || [])],
    },
    accountStatus: 'active',
    isPrivate: false,
    blockedUserIds: { $ne: viewer._id },
  }

  if (mode === 'mutual' && (viewer.friendIds || []).length) {
    candidateFilter.friendIds = { $in: viewer.friendIds }
  }

  const candidates = await User.find(candidateFilter)
    .select(
      'firstName lastName username email birthDate location role accountStatus moderation bio avatarUrl coverUrl isPrivate lastLoginAt createdAt friendIds blockedUserIds activity discovery',
    )
    .sort({ lastLoginAt: -1, createdAt: -1 })
    .limit(mode === 'nearby' ? 80 : 60)

  const candidateIds = candidates.map((candidate) => candidate._id)
  const candidateTopicMap = await buildCandidateTopicMap(candidateIds)
  const historyEntries = viewer.discovery?.suggestionHistory || []

  const items = candidates
    .map((candidate) => {
      const candidateId = candidate._id.toString()
      const mutualConnectionCount = countIntersection(candidate.friendIds, viewer.friendIds)
      const sharedInteractionCount =
        countIntersection(candidate.activity?.likedPostIds, viewer.activity?.likedPostIds) +
        countIntersection(candidate.activity?.commentedPostIds, viewer.activity?.commentedPostIds) +
        countIntersection(candidate.activity?.savedPostIds, viewer.activity?.savedPostIds) +
        countIntersection(candidate.activity?.sharedPostIds, viewer.activity?.sharedPostIds)
      const sameCity =
        normalizeLocationText(candidate.location?.city || candidate.discovery?.lastApproxLocation?.city) !== '' &&
        normalizeLocationText(candidate.location?.city || candidate.discovery?.lastApproxLocation?.city) ===
          normalizeLocationText(
            viewer.discovery?.lastApproxLocation?.city || viewer.location?.city,
          )
      const sameCountry =
        normalizeLocationText(candidate.location?.country || candidate.discovery?.lastApproxLocation?.country) !== '' &&
        normalizeLocationText(candidate.location?.country || candidate.discovery?.lastApproxLocation?.country) ===
          normalizeLocationText(
            viewer.discovery?.lastApproxLocation?.country || viewer.location?.country,
          )
      const nearbyDistanceKm = calculateDistanceKm(
        viewer.discovery?.lastApproxLocation,
        candidate.discovery?.lastApproxLocation,
      )
      const hasViewedProfile = viewerSignals.viewedProfileIds.has(candidateId)
      const topicOverlapCount = countTopicOverlap(
        viewerSignals.viewerTopics,
        candidateTopicMap.get(candidateId) || [],
      )
      const hasRecentConversation = viewerSignals.recentConversationPartnerIds.has(candidateId)
      const historyEntry = historyEntries.find(
        (entry) => entry.userId?.toString() === candidateId && entry.mode === mode,
      )
      const hoursSinceShown = historyEntry?.shownAt
        ? (Date.now() - new Date(historyEntry.shownAt).getTime()) / (1000 * 60 * 60)
        : null
      const nearbyLabel = buildNearbyLabel({
        sameCity,
        sameCountry,
        nearbyDistanceKm,
      })

      if (mode === 'mutual' && mutualConnectionCount === 0) {
        return null
      }

      if (
        mode === 'nearby' &&
        !nearbyLabel &&
        !(typeof nearbyDistanceKm === 'number' && nearbyDistanceKm <= 50)
      ) {
        return null
      }

      const score = computeDiscoveryScore({
        mutualConnectionCount,
        sameCity,
        sameCountry,
        nearbyDistanceKm,
        sharedInteractionCount,
        hasViewedProfile,
        topicOverlapCount,
        hasRecentConversation,
        hoursSinceShown,
      })

      return {
        user: serializeUser(candidate),
        viewerState: buildViewerRelationshipState(candidate, viewer),
        mutualConnectionCount,
        sharedInteractionCount,
        topicOverlapCount,
        hasRecentConversation,
        nearbyLabel,
        score,
        reason: buildSuggestionReason({
          nearbyLabel,
          mutualConnectionCount,
          sharedInteractionCount,
          topicOverlapCount,
          hasRecentConversation,
          sameCity,
          sameCountry,
        }),
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return new Date(right.user.lastLoginAt || 0) - new Date(left.user.lastLoginAt || 0)
    })
    .slice(0, limit)

  if (mode === 'nearby') {
    await recordNearbyDiscoveryUsage(viewer._id)
  }

  await persistSuggestionHistory(viewer._id, items, mode)

  const payload = {
    mode,
    items,
    meta: {
      generatedAt: new Date().toISOString(),
      locationEnabled,
    },
  }

  setCachedSuggestions(cacheKey, payload)

  return payload
}

module.exports = {
  getSuggestedUsersForViewer,
  invalidateSuggestionCache,
}
