const { User } = require('../models/User')
const { Post } = require('../models/Post')
const { Group } = require('../models/Group')
const { asyncHandler } = require('../utils/asyncHandler')
const { serializeUser } = require('../utils/tokens')
const { serializePostForViewer } = require('../utils/socialSerializers')
const {
  countIntersection,
  countTopicOverlap,
  computeDiscoveryScore,
} = require('../services/discoveryScoreService')
const { extractTopicsFromText } = require('../utils/topicExtraction')
const { calculateDistanceKm } = require('../services/locationService')
const MAX_SEARCH_HISTORY = 8

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildViewerSets(viewer) {
  return {
    friendIds: new Set((viewer?.friendIds || []).map((item) => item.toString())),
    viewedProfileIds: new Set((viewer?.activity?.viewedProfileIds || []).map((item) => item.toString())),
    likedPostIds: viewer?.activity?.likedPostIds || [],
    commentedPostIds: viewer?.activity?.commentedPostIds || [],
    savedPostIds: viewer?.activity?.savedPostIds || [],
    sharedPostIds: viewer?.activity?.sharedPostIds || [],
  }
}

function getViewerTopicKeys(viewerPosts = []) {
  const keys = new Set()

  viewerPosts.forEach((post) => {
    extractTopicsFromText(post.text || '').forEach((topic) => {
      if (topic?.key) {
        keys.add(topic.key)
      }
    })
  })

  return [...keys]
}

function getUserTopics(posts = []) {
  const keys = []
  posts.forEach((post) => {
    extractTopicsFromText(post.text || '').forEach((topic) => {
      if (topic?.key && !keys.includes(topic.key)) {
        keys.push(topic.key)
      }
    })
  })
  return keys
}

function getSearchTextScore(user, query) {
  const normalizedQuery = query.toLowerCase()
  const username = `${user.username || ''}`.toLowerCase()
  const firstName = `${user.firstName || ''}`.toLowerCase()
  const lastName = `${user.lastName || ''}`.toLowerCase()
  const fullName = `${firstName} ${lastName}`.trim()

  if (username === normalizedQuery) {
    return 120
  }

  if (fullName === normalizedQuery) {
    return 110
  }

  if (username.startsWith(normalizedQuery)) {
    return 95
  }

  if (firstName.startsWith(normalizedQuery) || lastName.startsWith(normalizedQuery) || fullName.startsWith(normalizedQuery)) {
    return 78
  }

  if (username.includes(normalizedQuery)) {
    return 56
  }

  if (fullName.includes(normalizedQuery)) {
    return 48
  }

  return 20
}

function matchesSearchQuery(user, query) {
  const normalizedQuery = `${query || ''}`.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  const username = `${user.username || ''}`.toLowerCase()
  const firstName = `${user.firstName || ''}`.toLowerCase()
  const lastName = `${user.lastName || ''}`.toLowerCase()
  const fullName = `${firstName} ${lastName}`.trim()
  const reversedFullName = `${lastName} ${firstName}`.trim()
  const email = `${user.email || ''}`.toLowerCase()

  if (
    username.includes(normalizedQuery) ||
    firstName.includes(normalizedQuery) ||
    lastName.includes(normalizedQuery) ||
    fullName.includes(normalizedQuery) ||
    reversedFullName.includes(normalizedQuery) ||
    email.includes(normalizedQuery)
  ) {
    return true
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)

  if (!queryTokens.length) {
    return true
  }

  return queryTokens.every((token) =>
    username.includes(token) ||
    firstName.includes(token) ||
    lastName.includes(token) ||
    fullName.includes(token) ||
    reversedFullName.includes(token),
  )
}

function buildPeopleReason({ mutualConnectionCount, sameCity, sameCountry, topicOverlapCount, hasViewedProfile, nearbyDistanceKm }) {
  if (sameCity) {
    return 'Ayni sehirde'
  }

  if (typeof nearbyDistanceKm === 'number' && nearbyDistanceKm <= 15) {
    return 'Yakininda'
  }

  if (mutualConnectionCount > 0) {
    return `${mutualConnectionCount} ortak baglanti`
  }

  if (topicOverlapCount > 0) {
    return 'Benzer ilgi alanlari'
  }

  if (hasViewedProfile) {
    return 'Daha once baktin'
  }

  if (sameCountry) {
    return 'Ayni ulkede'
  }

  return 'Kullanici'
}

function resolveDiscoveryLocation(discovery) {
  const exactLocation = discovery?.lastExactLocation
  const hasExactCoordinates =
    Number.isFinite(exactLocation?.latitude) &&
    Number.isFinite(exactLocation?.longitude)

  if (hasExactCoordinates) {
    return exactLocation
  }

  return discovery?.lastApproxLocation || {}
}

async function buildPeopleResults({
  query,
  viewer,
  limit,
  nearbyOnly = false,
  excludeConnected = false,
}) {
  const viewerSets = buildViewerSets(viewer)
  const viewerPosts = viewer
    ? await Post.find({
        author: viewer._id,
        archivedAt: null,
        'moderation.visibility': 'visible',
      }, { text: 1 }).sort({ createdAt: -1 }).limit(12).lean()
    : []
  const viewerTopicKeys = getViewerTopicKeys(viewerPosts)
  const searchRegex = query ? new RegExp(escapeRegex(query), 'i') : null
  const searchPattern = query ? escapeRegex(query.trim()) : ''
  const filter = {
    accountStatus: 'active',
    isPrivate: false,
  }

  if (viewer?._id) {
    const excludedIds = [viewer._id, ...(viewer.blockedUserIds || [])]

    if (excludeConnected) {
      excludedIds.push(...(viewer.friendIds || []))
    }

    filter._id = {
      $nin: excludedIds,
    }
    filter.blockedUserIds = { $ne: viewer._id }
  }

  if (searchRegex) {
    filter.$or = [
      { username: searchRegex },
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ['$firstName', ' ', '$lastName'] },
            regex: searchPattern,
            options: 'i',
          },
        },
      },
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ['$lastName', ' ', '$firstName'] },
            regex: searchPattern,
            options: 'i',
          },
        },
      },
    ]
  }

  const candidates = await User.find(filter)
    .select('firstName lastName username email avatarUrl friendIds location activity discovery lastLoginAt createdAt')
    .sort({ lastLoginAt: -1, createdAt: -1 })
    .limit(nearbyOnly ? 80 : 30)

  const candidateIds = candidates.map((item) => item._id)
  const candidatePosts = candidateIds.length
    ? await Post.find({
        author: { $in: candidateIds },
        archivedAt: null,
        'moderation.visibility': 'visible',
      }, { author: 1, text: 1 }).sort({ createdAt: -1 }).limit(Math.max(candidateIds.length * 2, 40)).lean()
    : []

  const topicMap = new Map()
  candidatePosts.forEach((post) => {
    const authorId = post.author?.toString?.()
    if (!authorId) return
    if (!topicMap.has(authorId)) {
      topicMap.set(authorId, [])
    }
    const current = topicMap.get(authorId)
    getUserTopics([post]).forEach((key) => {
      if (!current.includes(key)) {
        current.push(key)
      }
    })
  })

  const viewerLocation = resolveDiscoveryLocation(viewer?.discovery)

  return candidates
    .map((candidate) => {
      const candidateLocation = resolveDiscoveryLocation(candidate?.discovery)
      const candidateId = candidate._id.toString()
      const candidateCity =
        candidate.location?.city || candidateLocation.city || ''
      const candidateCountry =
        candidate.location?.country || candidateLocation.country || ''
      const sameCity =
        Boolean(candidateCity && (viewer?.location?.city || viewerLocation.city)) &&
        `${candidateCity}`.trim().toLowerCase() ===
          `${viewerLocation.city || viewer?.location?.city || ''}`.trim().toLowerCase()
      const sameCountry =
        Boolean(candidateCountry && (viewer?.location?.country || viewerLocation.country)) &&
        `${candidateCountry}`.trim().toLowerCase() ===
          `${viewerLocation.country || viewer?.location?.country || ''}`.trim().toLowerCase()
      const nearbyDistanceKm = calculateDistanceKm(viewerLocation, candidateLocation)
      if (nearbyOnly && !(sameCity || sameCountry || (typeof nearbyDistanceKm === 'number' && nearbyDistanceKm <= 50))) {
        return null
      }

      if (query && !matchesSearchQuery(candidate, query)) {
        return null
      }

      const mutualConnectionCount = viewer
        ? countIntersection(candidate.friendIds, viewer.friendIds)
        : 0
      const isFollowing = viewer ? viewerSets.friendIds.has(candidateId) : false
      const sharedInteractionCount = viewer
        ? countIntersection(candidate.activity?.likedPostIds, viewerSets.likedPostIds) +
          countIntersection(candidate.activity?.commentedPostIds, viewerSets.commentedPostIds) +
          countIntersection(candidate.activity?.savedPostIds, viewerSets.savedPostIds) +
          countIntersection(candidate.activity?.sharedPostIds, viewerSets.sharedPostIds)
        : 0
      const hasViewedProfile = viewer ? viewerSets.viewedProfileIds.has(candidateId) : false
      const topicOverlapCount = countTopicOverlap(viewerTopicKeys, topicMap.get(candidateId) || [])
      const socialScore = viewer
        ? computeDiscoveryScore({
            mutualConnectionCount,
            sameCity,
            sameCountry,
            nearbyDistanceKm,
            sharedInteractionCount,
            hasViewedProfile,
            topicOverlapCount,
            hasRecentConversation: false,
          })
        : 0
      const textScore = query ? getSearchTextScore(candidate, query) : 32

      return {
        user: serializeUser(candidate),
        score: textScore * 0.65 + socialScore * 0.35 + (nearbyOnly && typeof nearbyDistanceKm === 'number' ? Math.max(0, 40 - nearbyDistanceKm) : 0),
        reason: buildPeopleReason({
          mutualConnectionCount,
          sameCity,
          sameCountry,
          topicOverlapCount,
          hasViewedProfile,
          nearbyDistanceKm,
        }),
        mutualConnectionCount,
        nearbyDistanceKm,
        viewerState: {
          isFollowing,
          canFollow:
            Boolean(viewer) &&
            candidateId !== viewer._id.toString() &&
            !viewerSets.friendIds.has(candidateId),
        },
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

function buildPostScore(post, query) {
  const interactionScore =
    (post.stats?.likes || 0) * 3 +
    (post.stats?.comments || 0) * 4 +
    (post.stats?.shares || 0) * 4 +
    (post.stats?.saves || 0) * 5
  const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60))
  const freshness = Math.max(0, 48 - ageHours) * 0.8
  const text = `${post.text || ''}`.toLowerCase()
  const relevance = query
    ? (text.includes(query.toLowerCase()) ? 32 : 0) + (text.startsWith(query.toLowerCase()) ? 18 : 0)
    : 0

  return interactionScore + freshness + relevance
}

async function buildPostResults({ query, viewer, sort = 'popular', limit = 10 }) {
  const searchRegex = query ? new RegExp(escapeRegex(query), 'i') : null
  const visibleAuthorFilter = viewer
    ? {
        accountStatus: 'active',
        $or: [{ isPrivate: false }, { _id: viewer._id }],
      }
    : {
        accountStatus: 'active',
        isPrivate: false,
      }

  const visibleAuthors = await User.find(visibleAuthorFilter, { _id: 1 }).lean()
  const visibleAuthorIds = visibleAuthors.map((item) => item._id)

  if (!visibleAuthorIds.length) {
    return []
  }

  const authorMatches = searchRegex
    ? await User.find(
        {
          ...visibleAuthorFilter,
          $and: [
            {
              $or: [
                { username: searchRegex },
                { firstName: searchRegex },
                { lastName: searchRegex },
              ],
            },
          ],
        },
        { _id: 1 },
      ).lean()
    : []

  const filter = {
    archivedAt: null,
    'moderation.visibility': 'visible',
    author: { $in: visibleAuthorIds },
    $or: [
      { privacy: 'public' },
      ...(viewer ? [{ author: viewer._id }] : []),
    ],
  }

  if (searchRegex) {
    filter.$and = [
      {
        $or: [
          { text: searchRegex },
          { author: { $in: authorMatches.map((item) => item._id) } },
        ],
      },
    ]
  }

  const posts = await Post.find(filter)
    .populate('author', 'firstName lastName username avatarUrl')
    .sort(sort === 'latest' ? { createdAt: -1 } : { createdAt: -1 })
    .limit(sort === 'latest' ? limit : Math.max(limit * 3, 30))
  const filteredPosts = posts.filter((post) => Boolean(post.author))

  const rankedPosts =
    sort === 'latest'
      ? filteredPosts
      : filteredPosts
          .map((post) => ({ post, score: buildPostScore(post, query) }))
          .sort((left, right) => right.score - left.score)
          .map((item) => item.post)

  return rankedPosts.slice(0, limit).map((post) => serializePostForViewer(post, viewer))
}

async function buildGroupResults({ query, limit = 10 }) {
  const safeQuery = `${query || ''}`.trim()
  const regex = safeQuery ? new RegExp(escapeRegex(safeQuery), 'i') : null
  const filter = regex ? { name: regex } : {}

  const groups = await Group.find(filter)
    .select('name slug privacy coverImageUrl stats.memberCount createdAt updatedAt')
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean()

  return groups.map((group) => ({
    id: group._id,
    name: group.name,
    slug: group.slug,
    privacy: group.privacy,
    coverImageUrl: group.coverImageUrl || '',
    memberCount: Number(group?.stats?.memberCount || 0),
  }))
}

const getSearchSuggestions = asyncHandler(async (req, res) => {
  const viewer = req.user ? await User.findById(req.user._id) : null
  const [items, posts] = await Promise.all([
    buildPeopleResults({
      query: req.validated.query.q,
      viewer,
      limit: req.validated.query.limit,
      excludeConnected: false,
    }),
    buildPostResults({
      query: req.validated.query.q,
      viewer,
      sort: 'popular',
      limit: Math.min(req.validated.query.limit, 4),
    }),
  ])

  res.json({
    items,
    posts,
  })
})

const getSearchResults = asyncHandler(async (req, res) => {
  const viewer = req.user ? await User.findById(req.user._id) : null
  const { q, tab, sort, limit } = req.validated.query
  const effectiveSort = tab === 'latest' ? 'latest' : 'popular'
  const isContentOnlyTab = tab === 'posts' || tab === 'popular' || tab === 'latest'
  const shouldLoadPosts = tab === 'all' || isContentOnlyTab
  const shouldLoadPeople = tab === 'all' || tab === 'people'
  const shouldLoadNearby = tab === 'all' || tab === 'nearby'
  const shouldLoadGroups = tab === 'all' || tab === 'groups'

  const [posts, people, nearby, groups] = await Promise.all([
    shouldLoadPosts
      ? buildPostResults({
          query: q,
          viewer,
          sort: tab === 'all' ? sort : effectiveSort,
          limit,
        })
      : [],
    shouldLoadPeople ? buildPeopleResults({ query: q, viewer, limit }) : [],
    shouldLoadNearby && viewer?.discovery?.locationConsent?.status === 'granted'
        ? buildPeopleResults({ query: q, viewer, limit, nearbyOnly: true, excludeConnected: false })
        : [],
    shouldLoadGroups ? buildGroupResults({ query: q, limit }) : [],
  ])

  res.json({
    query: q,
    tab,
    sort: tab === 'all' ? sort : effectiveSort,
    results: {
      posts,
      people,
      nearby,
      groups,
    },
    meta: {
      locationEnabled: viewer?.discovery?.locationConsent?.status === 'granted',
    },
  })
})

function serializeSearchHistoryItems(user) {
  return (user?.activity?.recentSearches || [])
    .slice()
    .sort((left, right) => new Date(right.searchedAt).getTime() - new Date(left.searchedAt).getTime())
    .slice(0, MAX_SEARCH_HISTORY)
    .map((item) => ({
      query: item.query,
      searchedAt: item.searchedAt,
    }))
}

const getSearchHistory = asyncHandler(async (req, res) => {
  const viewer = await User.findById(req.user._id).select('activity.recentSearches')

  res.json({
    items: serializeSearchHistoryItems(viewer),
  })
})

const saveSearchHistory = asyncHandler(async (req, res) => {
  const viewer = await User.findById(req.user._id)

  if (!viewer) {
    res.json({ items: [] })
    return
  }

  const query = req.validated.body.query.trim()
  const normalizedQuery = query.toLowerCase()
  const nextHistory = (viewer.activity?.recentSearches || []).filter(
    (item) => `${item.query || ''}`.trim().toLowerCase() !== normalizedQuery,
  )

  nextHistory.unshift({
    query,
    searchedAt: new Date(),
  })

  viewer.activity = viewer.activity || {}
  viewer.activity.recentSearches = nextHistory.slice(0, MAX_SEARCH_HISTORY)
  await viewer.save()

  res.json({
    items: serializeSearchHistoryItems(viewer),
  })
})

const deleteSearchHistory = asyncHandler(async (req, res) => {
  const viewer = await User.findById(req.user._id)

  if (!viewer) {
    res.json({ items: [] })
    return
  }

  const query = req.validated.query.q.trim()
  viewer.activity = viewer.activity || {}

  if (query) {
    const normalizedQuery = query.toLowerCase()
    viewer.activity.recentSearches = (viewer.activity.recentSearches || []).filter(
      (item) => `${item.query || ''}`.trim().toLowerCase() !== normalizedQuery,
    )
  } else {
    viewer.activity.recentSearches = []
  }

  await viewer.save()

  res.json({
    items: serializeSearchHistoryItems(viewer),
  })
})

module.exports = {
  getSearchSuggestions,
  getSearchResults,
  getSearchHistory,
  saveSearchHistory,
  deleteSearchHistory,
}
