const mongoose = require('mongoose')
const crypto = require('crypto')
const { z } = require('zod')
const { Post } = require('../models/Post')
const { PostView } = require('../models/PostView')
const { LoopPlaybackEvent } = require('../models/LoopPlaybackEvent')
const { RecommendationEvent } = require('../models/RecommendationEvent')
const { FeedSession } = require('../models/FeedSession')
const { TelemetryReceipt } = require('../models/TelemetryReceipt')
const { Comment } = require('../models/Comment')
const { Notification } = require('../models/Notification')
const { User } = require('../models/User')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')
const {
  normalizeTopicToken,
  buildTopicSlug,
  formatTopicLabel,
  extractTopicsFromText,
  extractRecommendationTopicKeys,
} = require('../utils/topicExtraction')
const {
  buildMediaItems,
  removeUploadedFiles,
} = require('../middlewares/uploadMedia')
const {
  serializePostForViewer,
  serializeCommentForViewer,
} = require('../utils/socialSerializers')
const { normalizeUserMedia } = require('../utils/mediaUrls')
const { sanitizeTitle, slugifyTitle } = require('../utils/postSeo')
const { env } = require('../config/env')
const { enqueueLoopVideo } = require('../services/videoProcessingQueueService')
const { verifyLoopUploadSubmission } = require('../services/loopDirectUploadService')

const TREND_CACHE_TTL_MS = 45 * 1000
const LOOP_COMPLETION_THRESHOLD = 0.95
const LOOP_RANKING_CANDIDATE_MIN = 80
const FEED_SESSION_TTL_MS = 20 * 60 * 1000
const FEED_SESSION_MAX_ITEMS = 320
const INTEREST_TOPIC_LIMIT = 40
const INTEREST_PROFILE_POST_LIMIT = 220
const INTEREST_PROFILE_TTL_MS = 6 * 60 * 60 * 1000
const RECOMMENDATION_EVENT_TTL_DAYS = 180
const RECOMMENDATION_EVENT_LIMIT = 600
const RECENTLY_SEEN_HOURS = 48
const RECENTLY_SEEN_LIMIT = 1000
const TELEMETRY_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000
const LOOP_TELEMETRY_SAMPLE_RATES = Object.freeze({
  waiting: 0.25,
  stalled: 0.5,
  error: 1,
  'recover-failed': 1,
  'time-gap': 0.2,
  'dropped-frames': 0.2,
})
const FEED_POST_PROJECTION =
  'author group title slug text media contentType privacy publication moderation groupModeration archivedAt stats likedByUserIds savedByUserIds sharedByUserIds createdAt updatedAt'
const trendingTopicsCache = {
  items: [],
  expiresAt: 0,
}

const PUBLIC_FEED_CACHE_TTL_MS = 25 * 1000 // 25s TTL for guest public feeds
const publicFeedCache = new Map()

function getPublicFeedCacheKey({ view, loopMode, topic, limit, offset }) {
  return `${view || 'explore'}:${loopMode || 'none'}:${topic || 'none'}:${limit || 10}:${offset || 0}`
}

function getFromPublicFeedCache(key) {
  const entry = publicFeedCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    publicFeedCache.delete(key)
    return null
  }
  return entry.data
}

function setInPublicFeedCache(key, data, ttlMs = PUBLIC_FEED_CACHE_TTL_MS) {
  if (publicFeedCache.size > 200) {
    const oldestKey = publicFeedCache.keys().next().value
    publicFeedCache.delete(oldestKey)
  }
  publicFeedCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  })
}

function invalidatePublicFeedCache() {
  publicFeedCache.clear()
  trendingTopicsCache.expiresAt = 0
}

function nowMs() {
  return Date.now()
}

function buildUploadPerfLogger(req, flow) {
  const startedAtMs = nowMs()
  const requestId = req.headers?.['x-request-id'] || crypto.randomUUID()
  const steps = {}

  return {
    requestId,
    mark(stepName) {
      steps[stepName] = nowMs()
    },
    flush(extra = {}) {
      const timeline = {}
      let previous = startedAtMs
      for (const [stepName, timestamp] of Object.entries(steps)) {
        timeline[`${stepName}Ms`] = Math.max(0, timestamp - previous)
        previous = timestamp
      }

      const logPayload = {
        tag: 'upload_perf',
        flow,
        requestId,
        path: req.originalUrl || req.url,
        method: req.method,
        totalMs: Math.max(0, nowMs() - startedAtMs),
        timeline,
        ...extra,
      }
      console.info(JSON.stringify(logPayload))
    },
  }
}

function getFeedCursorSecret() {
  return process.env.FEED_CURSOR_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-feed-cursor-secret-change-me'
}

function signFeedCursorPayload(payloadJson) {
  return crypto.createHmac('sha256', getFeedCursorSecret()).update(payloadJson).digest('base64url')
}

function encodeFeedCursor(payload) {
  const payloadJson = JSON.stringify(payload)
  const encodedPayload = Buffer.from(payloadJson, 'utf8').toString('base64url')
  const signature = signFeedCursorPayload(payloadJson)
  return `${encodedPayload}.${signature}`
}

function decodeFeedCursor(cursorToken) {
  if (!cursorToken || typeof cursorToken !== 'string' || !cursorToken.includes('.')) {
    return null
  }

  const [encodedPayload, signature] = cursorToken.split('.', 2)
  if (!encodedPayload || !signature) {
    return null
  }

  let payloadJson = ''
  try {
    payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8')
  } catch {
    return null
  }

  const expectedSignature = Buffer.from(signFeedCursorPayload(payloadJson))
  const receivedSignature = Buffer.from(signature)
  if (
    expectedSignature.length !== receivedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null
  }

  try {
    return JSON.parse(payloadJson)
  } catch {
    return null
  }
}

function normalizeFeedSessionScope({ reqUserId, view, topic, loopMode = null, experimentVariant = 'control' }) {
  return {
    reqUserId: reqUserId || null,
    view,
    topic: topic || null,
    loopMode: view === 'loop' ? loopMode || 'explore' : null,
    experimentVariant,
  }
}

async function createFeedSession({ orderedPostIds, scope, limit }) {
  const createdAtMs = Date.now()
  const sessionId = crypto.randomBytes(12).toString('hex')
  const uniqueOrderedIds = [...new Set((orderedPostIds || []).map((value) => value?.toString()).filter(Boolean))]
  const expiresAt = new Date(createdAtMs + FEED_SESSION_TTL_MS)

  await FeedSession.create({
    sessionId,
    orderedPostIds: uniqueOrderedIds.slice(0, FEED_SESSION_MAX_ITEMS),
    scope,
    limit,
    expiresAt,
  })

  return {
    id: sessionId,
    orderedPostIds: uniqueOrderedIds.slice(0, FEED_SESSION_MAX_ITEMS),
    scope,
    limit,
    createdAtMs,
    expiresAtMs: expiresAt.getTime(),
  }
}

async function resolveFeedSessionFromCursor({ cursorToken, scope }) {
  const payload = decodeFeedCursor(cursorToken)
  if (!payload) {
    return null
  }

  if (
    !payload.sessionId ||
    typeof payload.position !== 'number' ||
    !payload.scope ||
    payload.scope.view !== scope.view ||
    (payload.scope.topic || null) !== (scope.topic || null) ||
    (payload.scope.loopMode || null) !== (scope.loopMode || null) ||
    (payload.scope.experimentVariant || 'control') !== (scope.experimentVariant || 'control') ||
    (payload.scope.reqUserId || null) !== (scope.reqUserId || null)
  ) {
    return null
  }

  if (typeof payload.exp === 'number' && payload.exp <= Date.now()) {
    return null
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + FEED_SESSION_TTL_MS)
  const sessionDocument = await FeedSession.findOneAndUpdate(
    {
      sessionId: payload.sessionId,
      expiresAt: { $gt: now },
      'scope.reqUserId': scope.reqUserId,
      'scope.view': scope.view,
      'scope.topic': scope.topic,
      'scope.loopMode': scope.loopMode,
      'scope.experimentVariant': scope.experimentVariant,
    },
    { $set: { expiresAt } },
    { returnDocument: 'after' },
  ).lean()

  if (!sessionDocument) {
    return null
  }

  return {
    session: {
      id: sessionDocument.sessionId,
      orderedPostIds: (sessionDocument.orderedPostIds || []).map((postId) => postId.toString()),
      scope: sessionDocument.scope,
      limit: sessionDocument.limit,
      createdAtMs: new Date(sessionDocument.createdAt).getTime(),
      expiresAtMs: expiresAt.getTime(),
    },
    position: Math.max(0, payload.position),
  }
}

function buildSessionPagination({ session, position, limit, scope }) {
  const endExclusive = Math.min(session.orderedPostIds.length, position + limit)
  const pageIds = []

  for (let index = position; index < endExclusive; index += 1) {
    const postId = session.orderedPostIds[index]
    if (!postId) {
      continue
    }
    pageIds.push(postId)
  }

  const nextPosition = endExclusive
  const hasMore = nextPosition < session.orderedPostIds.length
  const nextCursor = hasMore
    ? encodeFeedCursor({
      sessionId: session.id,
      position: nextPosition,
      scope,
      exp: session.expiresAtMs,
    })
    : null

  return {
    pageIds,
    pagination: {
      hasMore,
      nextCursor,
      nextOffset: hasMore ? nextPosition : null,
    },
  }
}

function canAccessPost(post, user) {
  const authorId = post.author?._id?.toString?.() || post.author?.toString?.()
  const viewerId = user?._id?.toString?.() || ''
  const viewerBlockedAuthor = Boolean(
    viewerId &&
      authorId &&
      (user.blockedUserIds || []).some((blockedId) => blockedId?.toString?.() === authorId),
  )

  if (viewerBlockedAuthor && user?.role !== 'admin') {
    return false
  }
  const scheduledFor = post.publication?.scheduledFor ? new Date(post.publication.scheduledFor) : null
  const isScheduledForFuture =
    post.publication?.status === 'scheduled' &&
    scheduledFor instanceof Date &&
    !Number.isNaN(scheduledFor.getTime()) &&
    scheduledFor > new Date()

  if (isScheduledForFuture && user?.role !== 'admin') {
    if (authorId !== user?._id?.toString()) {
      return false
    }
  }

  if (post.archivedAt && user?.role !== 'admin') {
    if (authorId !== user?._id?.toString()) {
      return false
    }
  }

  const visibility = post.moderation?.visibility || 'visible'
  const postGroup = post.group

  if (visibility !== 'visible' && user?.role !== 'admin') {
    return false
  }

  if (postGroup && (post.groupModeration?.status || 'approved') !== 'approved') {
    if (!user) {
      return false
    }

    const groupMembers = Array.isArray(postGroup.members) ? postGroup.members : []
    const memberEntry = groupMembers.find((entry) => {
      const memberId = entry?.user?._id?.toString?.() || entry?.user?.toString?.()
      return memberId === user._id.toString()
    })
    const memberRole = memberEntry?.role || 'member'
    const canModerateGroup = ['owner', 'admin', 'moderator'].includes(memberRole)
    const isAuthor = authorId === user._id.toString()

    return isAuthor || canModerateGroup || user.role === 'admin'
  }

  if (post.privacy === 'public') {
    if (!postGroup) {
      return true
    }

    if (postGroup.privacy !== 'private') {
      return true
    }

    if (!user) {
      return false
    }

    const groupMembers = Array.isArray(postGroup.members) ? postGroup.members : []
    const isGroupMember = groupMembers.some((entry) => {
      const memberId = entry?.user?._id?.toString?.() || entry?.user?.toString?.()
      return memberId === user._id.toString() && (entry?.status || 'active') === 'active'
    })

    return isGroupMember || user.role === 'admin'
  }

  if (!user) {
    return false
  }

  if (post.privacy === 'followers') {
    const followsAuthor = (user.friendIds || []).some(
      (followedId) => followedId?.toString?.() === authorId,
    )

    return followsAuthor || authorId === viewerId || user.role === 'admin'
  }

  return (
    authorId === viewerId ||
    user.role === 'admin'
  )
}

function buildPublicationVisibilityFilter(now = new Date()) {
  return {
    $or: [
      { 'publication.status': { $ne: 'scheduled' } },
      { 'publication.scheduledFor': { $lte: now } },
    ],
  }
}

function appendAndFilter(filter, condition) {
  if (!filter.$and) {
    filter.$and = []
  }

  filter.$and.push(condition)
}

function getPostViewDayBucket(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getPostViewExpiresAt(now = new Date()) {
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 45)
  return expiresAt
}

function resolveRequestIp(req) {
  const forwardedFor = req.headers?.['x-forwarded-for']

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    const [firstIp] = forwardedFor.split(',')
    return firstIp.trim()
  }

  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function buildPostViewViewerKey(req) {
  if (req.user?._id) {
    return `user:${req.user._id.toString()}`
  }

  const source = `${resolveRequestIp(req)}|${req.headers?.['user-agent'] || 'unknown'}`
  const fingerprint = crypto.createHash('sha256').update(source).digest('hex').slice(0, 40)
  return `guest:${fingerprint}`
}

function isLikelyAutomatedClient(req) {
  const userAgent = `${req.headers?.['user-agent'] || ''}`
  return /bot|crawler|spider|slurp|headlesschrome|lighthouse|pagespeed|preview|facebookexternalhit/i.test(
    userAgent,
  )
}

function buildPostViewUpdatePipeline({
  postId,
  viewerKey,
  dayBucket,
  expiresAt,
  now,
  watchRatio,
  replayCount,
  swipeVelocity,
  visibleMs,
  quickSkip,
  longView,
  recommendation,
}) {
  const currentWatchRatio = { $ifNull: ['$maxWatchRatio', 0] }
  const currentReplayCount = { $ifNull: ['$replayCount', 0] }
  const currentVisibleMs = { $ifNull: ['$maxVisibleMs', 0] }

  return [
    {
      $set: {
        post: postId,
        viewerKey,
        dayBucket,
        expiresAt,
        createdAt: { $ifNull: ['$createdAt', now] },
        updatedAt: now,
        maxWatchRatio:
          typeof watchRatio === 'number'
            ? { $max: [currentWatchRatio, watchRatio] }
            : currentWatchRatio,
        replayCount:
          typeof replayCount === 'number'
            ? { $max: [currentReplayCount, replayCount] }
            : currentReplayCount,
        maxVisibleMs:
          typeof visibleMs === 'number'
            ? { $max: [currentVisibleMs, visibleMs] }
            : currentVisibleMs,
        swipeVelocity:
          typeof swipeVelocity === 'number'
            ? { $ifNull: ['$swipeVelocity', swipeVelocity] }
            : { $ifNull: ['$swipeVelocity', null] },
        quickSkipRecorded: quickSkip ? true : { $ifNull: ['$quickSkipRecorded', false] },
        longViewRecorded: longView ? true : { $ifNull: ['$longViewRecorded', false] },
        feedSessionId: recommendation?.sessionId || { $ifNull: ['$feedSessionId', ''] },
        feedRank: recommendation?.rank || { $ifNull: ['$feedRank', null] },
        algorithm: recommendation?.algorithm || { $ifNull: ['$algorithm', ''] },
        feedView: recommendation?.view || { $ifNull: ['$feedView', ''] },
        loopMode: recommendation?.loopMode || { $ifNull: ['$loopMode', ''] },
        experimentId:
          recommendation?.experiment?.id || { $ifNull: ['$experimentId', ''] },
        experimentVariant:
          recommendation?.experiment?.variant || { $ifNull: ['$experimentVariant', ''] },
      },
    },
  ]
}

async function updatePostViewSignal({ filter, pipeline, upsert = true }) {
  return PostView.findOneAndUpdate(filter, pipeline, {
    upsert,
    returnDocument: 'before',
    updatePipeline: true,
  }).lean()
}

function buildCommentTree(comments, user) {
  const commentMap = new Map()
  const roots = []

  comments.forEach((comment) => {
    commentMap.set(
      comment._id.toString(),
      serializeCommentForViewer(comment, user),
    )
  })

  comments.forEach((comment) => {
    const serialized = commentMap.get(comment._id.toString())
    const parentId = comment.parentComment?.toString()

    if (parentId && commentMap.has(parentId)) {
      commentMap.get(parentId).replies.push(serialized)
      return
    }

    roots.push(serialized)
  })

  return roots
}

async function getAccessiblePost(postId, user) {
  if (!mongoose.isValidObjectId(postId)) {
    throw new AppError('Post not found.', 404)
  }

  const post = await Post.findById(postId).populate(
    'author',
    'firstName lastName username avatarUrl verification',
  )
    .populate('group', 'name slug privacy members.user members.role members.status')

  if (!post) {
    throw new AppError('Post not found.', 404)
  }

  const authorId = post.author?._id || post.author
  if (user?._id && user.role !== 'admin' && authorId) {
    const authorBlocksViewer = await User.exists({
      _id: authorId,
      blockedUserIds: user._id,
    })
    if (authorBlocksViewer) {
      throw new AppError('Post not found.', 404)
    }
  }

  if (!canAccessPost(post, user)) {
    throw new AppError('Post access denied.', 403)
  }

  return post
}

async function buildPostDetail(post, user) {
  const commentsFilter = { post: post._id }

  if (user?.role !== 'admin') {
    commentsFilter['moderation.visibility'] = 'visible'
  }

  const comments = await Comment.find(commentsFilter)
    .populate('author', 'firstName lastName username avatarUrl verification')
    .sort({ createdAt: 1 })

  return {
    post: serializePostForViewer(post, user),
    comments: buildCommentTree(comments, user),
    viewer: {
      canComment: Boolean(user),
      isOwner:
        Boolean(user) &&
        post.author?._id?.toString?.() === user._id.toString(),
    },
  }
}

function toggleInteraction(ids, userId) {
  const normalizedUserId = userId.toString()
  const hasInteracted = ids.some((item) => item.toString() === normalizedUserId)

  if (hasInteracted) {
    return {
      nextIds: ids.filter((item) => item.toString() !== normalizedUserId),
      active: false,
    }
  }

  return {
    nextIds: [...ids, userId],
    active: true,
  }
}

const createPostBodySchema = z.object({
  title: z.string().trim().max(80).optional().default(''),
  text: z.string().trim().max(5000).optional().default(''),
  privacy: z.enum(['public', 'followers', 'private']).optional().default('public'),
  contentType: z.enum(['post', 'loop']).optional().default('post'),
  publishMode: z.enum(['publish', 'schedule']).optional().default('publish'),
  scheduledFor: z.string().datetime().optional(),
  loopUpload: z.object({
    ticket: z.string().min(40),
    sourceUrl: z.string().url(),
  }).optional(),
})

const createCommentBodySchema = z
  .object({
    text: z.string().trim().max(2000).optional().default(''),
    parentCommentId: z.string().trim().optional(),
  })

async function parsePostInput(req) {
  const result = createPostBodySchema.safeParse(req.body || {})

  if (!result.success) {
    throw result.error
  }

  const title = sanitizeTitle(result.data.title || '')
  const hasDirectLoopUpload = Boolean(result.data.loopUpload)

  if (hasDirectLoopUpload && result.data.contentType !== 'loop') {
    throw new AppError('Direct video upload can only be used for Loop posts.', 400)
  }
  if (hasDirectLoopUpload && (req.files || []).length) {
    throw new AppError('Choose either direct upload or multipart media, not both.', 400)
  }

  const directLoopUpload = hasDirectLoopUpload
    ? verifyLoopUploadSubmission(result.data.loopUpload, req.user?._id)
    : null
  const builtMedia = await buildMediaItems(req.files || [], {
    contentType: result.data.contentType,
    trace: req.uploadPerfTrace || null,
    deferLoopProcessing:
      result.data.contentType === 'loop' && env.loopAsyncProcessingEnabled,
  })
  const processingJobs = []
  const media = builtMedia.map((item, mediaIndex) => {
    const { _processingSource, ...publicMedia } = item
    if (_processingSource) {
      processingJobs.push({ mediaIndex, ..._processingSource })
    }
    return publicMedia
  })

  if (directLoopUpload) {
    media.push({
      url: directLoopUpload.sourceUrl,
      hlsUrl: '',
      posterUrl: '',
      type: 'video',
      durationSeconds: 0,
      processing: 'queued',
      processingProgress: 0,
      processingError: '',
    })
    processingJobs.push({
      mediaIndex: media.length - 1,
      path: '',
      sourceUrl: directLoopUpload.sourceUrl,
      originalName: directLoopUpload.fileName,
      mimeType: directLoopUpload.mimeType,
    })
  }

  if (!result.data.text.trim() && !media.length) {
    throw new AppError('Post text or media is required.', 400)
  }

  if (
    result.data.contentType === 'loop' &&
    !media.some((item) => item.type === 'video')
  ) {
    throw new AppError('Loop posts require at least one video.', 400)
  }

  let publication = {
    status: 'published',
    scheduledFor: null,
  }

  if (result.data.publishMode === 'schedule') {
    if (!result.data.scheduledFor) {
      throw new AppError('Scheduled date and time is required.', 400)
    }

    const scheduledDate = new Date(result.data.scheduledFor)

    if (Number.isNaN(scheduledDate.getTime())) {
      throw new AppError('Invalid scheduled date.', 400)
    }

    if (scheduledDate.getTime() <= Date.now()) {
      throw new AppError('Scheduled date must be in the future.', 400)
    }

    publication = {
      status: 'scheduled',
      scheduledFor: scheduledDate,
    }
  }

  return {
    title,
    text: result.data.text.trim(),
    privacy: result.data.privacy,
    contentType: result.data.contentType,
    media,
    processingJobs,
    publication,
  }
}

async function buildUniquePostSlug(sourceTitle, postId = null) {
  const baseSlug = slugifyTitle(sourceTitle || '') || 'post'
  let nextSlug = baseSlug
  let counter = 1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await Post.findOne({
      slug: nextSlug,
      ...(postId ? { _id: { $ne: postId } } : {}),
    })
      .select('_id')
      .lean()

    if (!existing) {
      return nextSlug
    }

    counter += 1
    nextSlug = `${baseSlug}-${counter}`
  }
}

function getLoopTelemetryExpiresAt(now = new Date()) {
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 14)
  return expiresAt
}

function sanitizeLoopTelemetryPayload(payload = {}) {
  const safePayload = payload && typeof payload === 'object' ? payload : {}
  const network = safePayload.network && typeof safePayload.network === 'object'
    ? safePayload.network
    : {}
  const device = safePayload.device && typeof safePayload.device === 'object'
    ? safePayload.device
    : {}
  const viewport = device.viewport && typeof device.viewport === 'object'
    ? device.viewport
    : {}

  return {
    eventId: `${safePayload.eventId || ''}`.slice(0, 64),
    eventType: safePayload.eventType,
    mediaUrl: `${safePayload.mediaUrl || ''}`.slice(0, 2048),
    currentTimeSec:
      typeof safePayload.currentTimeSec === 'number' && Number.isFinite(safePayload.currentTimeSec)
        ? clamp(safePayload.currentTimeSec, 0, 24 * 60 * 60)
        : 0,
    timeGapMs:
      Number.isInteger(safePayload.timeGapMs) && safePayload.timeGapMs >= 0
        ? Math.min(safePayload.timeGapMs, 60 * 60 * 1000)
        : 0,
    droppedFrames:
      Number.isInteger(safePayload.droppedFrames) && safePayload.droppedFrames >= 0
        ? Math.min(safePayload.droppedFrames, 10 * 1000 * 1000)
        : 0,
    totalFrames:
      Number.isInteger(safePayload.totalFrames) && safePayload.totalFrames >= 0
        ? Math.min(safePayload.totalFrames, 100 * 1000 * 1000)
        : 0,
    network: {
      effectiveType: `${network.effectiveType || ''}`.slice(0, 20),
      downlinkMbps:
        typeof network.downlinkMbps === 'number' && Number.isFinite(network.downlinkMbps)
          ? clamp(network.downlinkMbps, 0, 10000)
          : 0,
      rttMs:
        Number.isInteger(network.rttMs) && network.rttMs >= 0
          ? Math.min(network.rttMs, 120000)
          : 0,
      saveData: Boolean(network.saveData),
    },
    device: {
      userAgent: `${device.userAgent || ''}`.slice(0, 512),
      platform: `${device.platform || ''}`.slice(0, 64),
      viewport: {
        width:
          Number.isInteger(viewport.width) && viewport.width >= 0
            ? Math.min(viewport.width, 10000)
            : 0,
        height:
          Number.isInteger(viewport.height) && viewport.height >= 0
            ? Math.min(viewport.height, 10000)
            : 0,
      },
      deviceMemoryGb:
        typeof device.deviceMemoryGb === 'number' && Number.isFinite(device.deviceMemoryGb)
          ? clamp(device.deviceMemoryGb, 0, 1024)
          : 0,
      hardwareConcurrency:
        Number.isInteger(device.hardwareConcurrency) && device.hardwareConcurrency >= 0
          ? Math.min(device.hardwareConcurrency, 512)
          : 0,
    },
  }
}

async function parseCommentInput(req) {
  const media = await buildMediaItems(req.files || [])
  const result = createCommentBodySchema.safeParse(req.body || {})

  if (!result.success) {
    throw result.error
  }

  if (!result.data.text.trim() && !media.length) {
    throw new AppError('Comment text or media is required.', 400)
  }

  return {
    text: result.data.text.trim(),
    parentCommentId: result.data.parentCommentId,
    media,
  }
}

async function getCommentWithAccess(commentId, user) {
  if (!mongoose.isValidObjectId(commentId)) {
    throw new AppError('Comment not found.', 404)
  }

  const comment = await Comment.findById(commentId).populate(
    'author',
    'firstName lastName username avatarUrl verification',
  )

  if (!comment) {
    throw new AppError('Comment not found.', 404)
  }

  if ((comment.moderation?.visibility || 'visible') !== 'visible' && user?.role !== 'admin') {
    throw new AppError('Comment not found.', 404)
  }

  const post = await getAccessiblePost(comment.post, user)

  return { comment, post }
}

async function findCommentDescendantIds(rootCommentId) {
  const ids = [rootCommentId.toString()]
  const queue = [rootCommentId.toString()]

  while (queue.length) {
    const currentId = queue.shift()
    const children = await Comment.find(
      { parentComment: currentId },
      { _id: 1 },
    ).lean()

    children.forEach((child) => {
      const childId = child._id.toString()
      ids.push(childId)
      queue.push(childId)
    })
  }

  return ids
}

async function emitNotification(io, notification) {
  if (!io) {
    return
  }

  const populatedNotification = await Notification.findById(notification._id).populate(
    'actor',
    'firstName lastName username avatarUrl verification',
  )

  if (populatedNotification) {
    const serializedNotification = populatedNotification.toObject
      ? populatedNotification.toObject()
      : populatedNotification
    let targetPostId = null
    let targetCommentId = null

    if (serializedNotification.entityKind === 'post') {
      targetPostId = serializedNotification.entityId?.toString?.() || null
    }

    if (serializedNotification.entityKind === 'comment') {
      targetCommentId = serializedNotification.entityId?.toString?.() || null
      const comment = await Comment.findById(serializedNotification.entityId)
        .select('post')
        .lean()
      targetPostId = comment?.post?.toString?.() || null
    }

    io.to(`user:${notification.user}`).emit('notification:new', {
      ...serializedNotification,
      actor: normalizeUserMedia(serializedNotification.actor),
      targetPostId,
      targetCommentId,
      targetConversationId: null,
    })
  }
}

async function createNotification({
  io,
  recipientId,
  actor,
  type,
  entityKind,
  entityId,
  title,
  body,
}) {
  if (!recipientId || recipientId.toString() === actor._id.toString()) {
    return null
  }

  const notification = await Notification.create({
    user: recipientId,
    actor: actor._id,
    type,
    entityKind,
    entityId,
    title,
    body,
  })

  await emitNotification(io, notification)
  return notification
}

async function updateUserActivity(userId, field, itemId, active) {
  if (!field) {
    return
  }

  await User.updateOne(
    { _id: userId },
    active
      ? {
          $addToSet: { [`activity.${field}`]: itemId },
          $set: { 'discovery.interestProfile.updatedAt': null },
        }
      : {
          $pull: { [`activity.${field}`]: itemId },
          $set: { 'discovery.interestProfile.updatedAt': null },
        },
  )
}

function getTelemetryReceiptExpiresAt(now = new Date()) {
  return new Date(now.getTime() + TELEMETRY_RECEIPT_TTL_MS)
}

function getLoopTelemetrySampleRate(eventType) {
  return LOOP_TELEMETRY_SAMPLE_RATES[eventType] ?? 0
}

function shouldPersistLoopTelemetry({ payload, postId, viewerKey }) {
  const sampleRate = getLoopTelemetrySampleRate(payload.eventType)
  if (sampleRate >= 1) {
    return { sampled: true, sampleRate }
  }

  const sampleSeed = [
    payload.eventId,
    postId,
    viewerKey,
    payload.eventType,
    payload.currentTimeSec,
  ].join('|')

  return {
    sampled: hashToUnitInterval(sampleSeed) < sampleRate,
    sampleRate,
  }
}

async function toggleDocumentInteraction({
  document,
  user,
  idsField,
  statsField,
  responseKey,
  serializer,
}) {
  const { nextIds, active } = toggleInteraction(document[idsField] || [], user._id)

  document[idsField] = nextIds
  document.stats[statsField] = nextIds.length
  await document.save()

  return {
    active,
    [responseKey]: serializer(document, user),
  }
}

function uniqueStringIds(values = []) {
  return [...new Set(values.map((value) => value?.toString()).filter(Boolean))]
}

function buildPaginationMeta(items, limit, offset = 0) {
  const hasMore = items.length > limit
  const trimmedItems = hasMore ? items.slice(0, limit) : items

  return {
    items: trimmedItems,
    pagination: {
      hasMore,
      nextCursor: hasMore
        ? trimmedItems[trimmedItems.length - 1]?.createdAt?.toISOString?.() || null
        : null,
      nextOffset: hasMore ? offset + limit : null,
    },
  }
}

function buildRecommendedScore(post, signals, userId) {
  const postId = post._id.toString()
  const authorId = post.author?._id?.toString?.() || post.author?.toString?.()
  const ageInHours = Math.max(
    0,
    (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60),
  )
  const engagementScore =
    (post.stats?.likes || 0) * 3 +
    (post.stats?.comments || 0) * 4 +
    (post.stats?.saves || 0) * 5 +
    (post.stats?.shares || 0) * 4

  let score = Math.min(engagementScore, 400) * 0.15

  if (authorId && signals.followingAuthorIds.has(authorId)) {
    score += 34
  }

  if (authorId && signals.engagedAuthorIds.has(authorId)) {
    score += 28
  }

  if (authorId && signals.viewedProfileIds.has(authorId)) {
    score += 14
  }

  if (signals.likedPostIds.has(postId)) {
    score += 18
  }

  if (signals.commentedPostIds.has(postId)) {
    score += 22
  }

  if (signals.savedPostIds.has(postId)) {
    score += 24
  }

  if (signals.sharedPostIds.has(postId)) {
    score += 20
  }

  if (authorId === userId) {
    score += 6
  }

  score += Math.max(0, 36 - ageInHours) * 1.25

  return score
}

function normalizeTopicScoresMap(rawMap) {
  if (!rawMap) {
    return new Map()
  }

  if (rawMap instanceof Map) {
    return new Map(
      [...rawMap.entries()]
        .map(([key, value]) => [normalizeTopicToken(key), Number(value || 0)])
        .filter(([key]) => Boolean(key)),
    )
  }

  if (typeof rawMap === 'object') {
    return new Map(
      Object.entries(rawMap)
        .map(([key, value]) => [normalizeTopicToken(key), Number(value || 0)])
        .filter(([key]) => Boolean(key)),
    )
  }

  return new Map()
}

function boundedSortedTopicEntries(topicScoresMap) {
  return [...topicScoresMap.entries()]
    .filter(([key, value]) => key && Number.isFinite(value) && value !== 0)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, INTEREST_TOPIC_LIMIT)
}

function topicsFromPost(post) {
  return extractRecommendationTopicKeys(`${post?.title || ''} ${post?.text || ''}`.trim())
}

function sumTopicScore(topicScoresMap, topicKeys = []) {
  return topicKeys.reduce((total, topicKey) => total + Number(topicScoresMap.get(topicKey) || 0), 0)
}

function computeHashtagMatchScore({ postTopicKeys = [], topicScoresMap, hiddenTopicSet }) {
  if (!postTopicKeys.length) {
    return 0
  }

  if (postTopicKeys.some((topicKey) => hiddenTopicSet.has(topicKey))) {
    return -1
  }

  const total = sumTopicScore(topicScoresMap, postTopicKeys)
  return clamp(total / Math.max(postTopicKeys.length * 8, 1), -1, 1)
}

function computePostQualityScore(post) {
  const stats = post.stats || {}
  const views = Math.max(Number(stats.views || 0), 0)
  const weightedEngagement =
    (Number(stats.likes || 0) * 3) +
    (Number(stats.comments || 0) * 4) +
    (Number(stats.saves || 0) * 5) +
    (Number(stats.shares || 0) * 4)
  const priorStrength = 16
  const priorWeightedEngagementPerView = 0.3
  const engagementPerView =
    (weightedEngagement + priorWeightedEngagementPerView * priorStrength) /
    (views + priorStrength)
  return clamp(engagementPerView / 8, 0, 1)
}

function computeFreshnessScore(post, horizonHours = 120) {
  const ageInHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60))
  return clamp(1 - ageInHours / horizonHours, 0, 1)
}

function buildPersonalizedCandidateScore({
  post,
  userId,
  signals,
  topicScoresMap,
  hiddenTopicSet,
  experimentVariant = 'control',
}) {
  const postTopicKeys = topicsFromPost(post)
  const hashtagMatch = computeHashtagMatchScore({ postTopicKeys, topicScoresMap, hiddenTopicSet })
  const recScore = clamp(buildRecommendedScore(post, signals, userId) / 120, 0, 1)
  const freshness = computeFreshnessScore(post)
  const quality = computePostQualityScore(post)
  const loopScore = post.contentType === 'loop' ? buildLoopRankingScore(post) : 0
  const recentlySeenPenalty = signals.recentlySeenPostIds?.has(post._id.toString()) ? 0.6 : 0

  const weights =
    experimentVariant === 'challenger'
      ? { topic: 0.3, behavior: 0.3, freshness: 0.15, quality: 0.15, loop: 0.1 }
      : { topic: 0.35, behavior: 0.35, freshness: 0.15, quality: 0.1, loop: 0.05 }
  const score =
    hashtagMatch * weights.topic +
    recScore * weights.behavior +
    freshness * weights.freshness +
    quality * weights.quality +
    loopScore * weights.loop -
    recentlySeenPenalty

  return {
    score,
    topics: postTopicKeys,
    authorId: post.author?._id?.toString?.() || post.author?.toString?.() || '',
  }
}

function applyDiversityPenalty(baseScore, candidateMeta, history = []) {
  let penalty = 0

  const recentAuthors = history.slice(-4).map((entry) => entry.authorId).filter(Boolean)
  const recentTopics = history.slice(-6).flatMap((entry) => entry.topics || [])

  if (candidateMeta.authorId && recentAuthors.filter((authorId) => authorId === candidateMeta.authorId).length >= 2) {
    penalty += 0.15
  }

  if (candidateMeta.topics.length) {
    const overlaps = candidateMeta.topics.reduce(
      (count, topicKey) => count + (recentTopics.includes(topicKey) ? 1 : 0),
      0,
    )
    penalty += clamp(overlaps * 0.03, 0, 0.2)
  }

  return baseScore - penalty
}

function hasFreshInterestProfile(user, topicScoresMap) {
  const updatedAtMs = new Date(user?.discovery?.interestProfile?.updatedAt || 0).getTime()
  return (
    topicScoresMap instanceof Map &&
    Number.isFinite(updatedAtMs) &&
    updatedAtMs > 0 &&
    Date.now() - updatedAtMs < INTEREST_PROFILE_TTL_MS
  )
}

function rankPersonalizedCandidates({ entries = [], seedContext = '' }) {
  const remaining = entries.map((entry) => ({ ...entry }))
  const selected = []
  const history = []

  while (remaining.length) {
    let bestIndex = 0
    let bestScore = Number.NEGATIVE_INFINITY
    const recentAuthorIds = history.slice(-9).map((entry) => entry.authorId).filter(Boolean)
    const eligibleIndexes = remaining
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        if (!entry.meta.authorId) {
          return true
        }
        return recentAuthorIds.filter((authorId) => authorId === entry.meta.authorId).length < 2
      })
      .map(({ index }) => index)
    const candidateIndexes = eligibleIndexes.length
      ? new Set(eligibleIndexes)
      : new Set(remaining.map((_, index) => index))

    remaining.forEach((entry, index) => {
      if (!candidateIndexes.has(index)) {
        return
      }
      const postId = entry.post?._id?.toString?.() || entry.post?.id || ''
      const explorationJitter = (hashToUnitInterval(`${seedContext}|${postId}`) - 0.5) * 0.025
      const score = applyDiversityPenalty(entry.baseScore, entry.meta, history) + explorationJitter

      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })

    const [winner] = remaining.splice(bestIndex, 1)
    selected.push(winner.post)
    history.push(winner.meta)
  }

  return selected
}

async function getExcludedFeedAuthorIds(user) {
  if (!user?._id || user.role === 'admin') {
    return []
  }

  const blockedByViewer = uniqueStringIds(user.blockedUserIds || [])
  const usersBlockingViewer = await User.find({ blockedUserIds: user._id }).select('_id').lean()

  return uniqueStringIds([
    ...blockedByViewer,
    ...usersBlockingViewer.map((entry) => entry._id),
  ])
}

function getRecommendationEventExpiresAt(now = new Date()) {
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + RECOMMENDATION_EVENT_TTL_DAYS)
  return expiresAt
}

async function recordRecommendationEvent({
  userId,
  postId,
  eventType,
  weight,
  source = 'explicit',
  recommendation = null,
}) {
  if (!userId || !postId || !eventType || !Number.isFinite(weight)) {
    return
  }

  try {
    await RecommendationEvent.create({
      user: userId,
      post: postId,
      eventType,
      weight: clamp(weight, -20, 20),
      source,
      feedSessionId: recommendation?.sessionId || '',
      feedRank: recommendation?.rank || null,
      algorithm: recommendation?.algorithm || '',
      experimentId: recommendation?.experiment?.id || '',
      experimentVariant: recommendation?.experiment?.variant || '',
      expiresAt: getRecommendationEventExpiresAt(),
    })
  } catch {
    // Recommendation analytics must not block the user's primary action.
  }
}

async function getRecentlySeenPostIds(user, hours = RECENTLY_SEEN_HOURS) {
  if (!user?._id) {
    return []
  }

  const viewerKey = `user:${user._id.toString()}`
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
  const rows = await PostView.find({ viewerKey, updatedAt: { $gte: since } })
    .sort({ updatedAt: -1 })
    .limit(RECENTLY_SEEN_LIMIT)
    .select('post')
    .lean()

  return uniqueStringIds(rows.map((row) => row.post))
}

async function buildAndPersistInterestProfile(user) {
  const likedPostIds = uniqueStringIds(user.activity?.likedPostIds || [])
  const commentedPostIds = uniqueStringIds(user.activity?.commentedPostIds || [])
  const savedPostIds = uniqueStringIds(user.activity?.savedPostIds || [])
  const sharedPostIds = uniqueStringIds(user.activity?.sharedPostIds || [])

  const legacyWeightedIds = [
    ...likedPostIds.map((postId) => ({ postId, weight: 3 * 0.35 })),
    ...commentedPostIds.map((postId) => ({ postId, weight: 2 * 0.35 })),
    ...savedPostIds.map((postId) => ({ postId, weight: 4 * 0.35 })),
    ...sharedPostIds.map((postId) => ({ postId, weight: 5 * 0.35 })),
  ]
  const recommendationEvents = await RecommendationEvent.find({ user: user._id })
    .sort({ createdAt: -1 })
    .limit(RECOMMENDATION_EVENT_LIMIT)
    .select('post weight createdAt')
    .lean()
  const eventWeightedIds = recommendationEvents.map((event) => {
    const ageDays = Math.max(0, (Date.now() - new Date(event.createdAt).getTime()) / (24 * 60 * 60 * 1000))
    const timeDecay = Math.pow(0.5, ageDays / 30)
    return {
      postId: event.post?.toString?.() || '',
      weight: Number(event.weight || 0) * timeDecay,
    }
  })
  const weightedIds = [...legacyWeightedIds, ...eventWeightedIds]

  const uniqueInteractionPostIds = uniqueStringIds(weightedIds.map((entry) => entry.postId))
  const postsFromActivity = uniqueInteractionPostIds.length
    ? await Post.find({ _id: { $in: uniqueInteractionPostIds } }).select('title text').lean()
    : []
  const byPostId = new Map(postsFromActivity.map((post) => [post._id.toString(), post]))
  const topicScoresMap = new Map()

  weightedIds.forEach(({ postId, weight }) => {
    const post = byPostId.get(postId)
    const topicKeys = topicsFromPost(post)
    topicKeys.forEach((topicKey) => {
      topicScoresMap.set(topicKey, Number(topicScoresMap.get(topicKey) || 0) + weight)
    })
  })

  const viewerKey = `user:${user._id.toString()}`
  const loopViews = await PostView.find({ viewerKey })
    .sort({ updatedAt: -1 })
    .limit(INTEREST_PROFILE_POST_LIMIT)
    .select('post maxWatchRatio replayCount maxVisibleMs updatedAt')
    .lean()

  const loopPostIds = uniqueStringIds(loopViews.map((row) => row.post))
  const loopPosts = loopPostIds.length
    ? await Post.find({ _id: { $in: loopPostIds } }).select('title text').lean()
    : []
  const loopPostById = new Map(loopPosts.map((post) => [post._id.toString(), post]))

  loopViews.forEach((viewRow) => {
    const post = loopPostById.get(viewRow.post?.toString?.() || '')
    const topicKeys = topicsFromPost(post)
    if (!topicKeys.length) {
      return
    }
    const watchRatio = clamp(Number(viewRow.maxWatchRatio || 0), 0, 1)
    const replayCount = clamp(Number(viewRow.replayCount || 0), 0, 8)
    const visibleMs = Math.max(0, Number(viewRow.maxVisibleMs || 0))
    const ageDays = Math.max(0, (Date.now() - new Date(viewRow.updatedAt).getTime()) / (24 * 60 * 60 * 1000))
    const timeDecay = Math.pow(0.5, ageDays / 21)
    const watchWeight =
      watchRatio >= 0.75 || visibleMs >= 8000
        ? 2
        : watchRatio >= 0.5 || visibleMs >= 5000
          ? 1
          : watchRatio < 0.15 && visibleMs > 0 && visibleMs <= 1500
            ? -1.5
            : 0
    const replayWeight = replayCount > 0 ? Math.min(2, replayCount * 0.5) : 0
    const totalWeight = (watchWeight + replayWeight) * timeDecay

    if (totalWeight === 0) {
      return
    }

    topicKeys.forEach((topicKey) => {
      topicScoresMap.set(topicKey, Number(topicScoresMap.get(topicKey) || 0) + totalWeight)
    })
  })

  const hiddenTopicKeys = uniqueStringIds(
    (user.discovery?.interestProfile?.hiddenTopicKeys || []).map((item) => normalizeTopicToken(item)),
  )
  hiddenTopicKeys.forEach((topicKey) => {
    topicScoresMap.set(topicKey, Number(topicScoresMap.get(topicKey) || 0) - 10)
  })

  const boundedEntries = boundedSortedTopicEntries(topicScoresMap)
  const persistedMap = Object.fromEntries(boundedEntries)

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        'discovery.interestProfile.topicScores': persistedMap,
        'discovery.interestProfile.updatedAt': new Date(),
      },
    },
  )

  return {
    topicScoresMap: normalizeTopicScoresMap(persistedMap),
    hiddenTopicSet: new Set(hiddenTopicKeys),
  }
}

function buildLoopRankingScore(post) {
  const stats = post.stats || {}
  const views = Math.max(0, Number(stats.views || 0))
  const loopSignalsCount = Math.max(0, Number(stats.loopSignalsCount || 0))
  const completionRate = clamp(
    (Number(stats.loopCompletions || 0) + 2) / (views + 8),
    0,
    1,
  )
  const replayRate = clamp(
    (Number(stats.loopReplays || 0) + 1) / (views + 10),
    0,
    3,
  )
  const avgWatchRatio = clamp(
    (Number(stats.loopWatchRatioSum || 0) + 0.45 * 8) / (loopSignalsCount + 8),
    0,
    1,
  )
  const avgVisibleMs = clamp(
    (Number(stats.loopVisibleMsSum || 0) + 2500 * 8) / (views + 8),
    0,
    25000,
  )
  const visibleQuality = clamp(avgVisibleMs / 8000, 0, 1)
  const avgSwipeVelocity =
    loopSignalsCount > 0
      ? Number(stats.loopSwipeVelocitySum || 0) / loopSignalsCount
      : null
  const swipeQuality =
    typeof avgSwipeVelocity === 'number' && Number.isFinite(avgSwipeVelocity)
      ? clamp(1 - avgSwipeVelocity / 2200, 0, 1)
      : 0.45

  const engagementScore = computePostQualityScore(post)

  const ageInHours = Math.max(
    0,
    (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60),
  )
  const freshnessScore = clamp(1 - ageInHours / 72, 0, 1)
  const replayQuality = clamp(replayRate / 1.5, 0, 1)
  const confidence = clamp(
    Math.log10(views + 1) / 2 * 0.6 + clamp(loopSignalsCount / 25, 0, 1) * 0.4,
    0.2,
    1,
  )

  const rawQualityScore =
    completionRate * 0.34 +
    avgWatchRatio * 0.26 +
    replayQuality * 0.2 +
    swipeQuality * 0.12 +
    visibleQuality * 0.05 +
    engagementScore * 0.02 +
    freshnessScore * 0.01
  const explorationBoost = freshnessScore * (1 - confidence) * 0.08
  const score = rawQualityScore * confidence + explorationBoost

  return Number(score.toFixed(6))
}

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractMentionedUsernames(text = '') {
  if (!text.trim()) {
    return []
  }

  return [
    ...new Set(
      (text.match(/@[\p{L}\p{N}_]+/gu) || [])
        .map((item) => item.replace(/^@/, '').trim().toLowerCase())
        .filter((item) => item.length >= 3),
    ),
  ]
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function hashToUnitInterval(seedInput = '') {
  const hash = crypto.createHash('sha256').update(String(seedInput)).digest('hex').slice(0, 12)
  const max = 16 ** 12 - 1
  const value = parseInt(hash, 16)
  if (!Number.isFinite(value) || max <= 0) {
    return 0.5
  }
  return value / max
}

function buildFeedSeedContext({ userId = 'guest', view = 'latest', topic = null }) {
  const now = new Date()
  const dayKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`
  return `${userId}|${view}|${topic || ''}|${dayKey}`
}

function buildFeedExperiment({ req, view, loopMode = null }) {
  const experimentId = 'feed-quality-2026-07'
  const subjectId = req.user?._id?.toString() || buildPostViewViewerKey(req)
  const bucket = hashToUnitInterval(`${experimentId}|${subjectId}|${view}|${loopMode || ''}`)

  return {
    id: experimentId,
    variant: bucket < 0.1 ? 'challenger' : 'control',
  }
}

function deprioritizeRecentlySeen(items = [], recentlySeenPostIds = new Set()) {
  if (!recentlySeenPostIds.size) {
    return items
  }

  const unseen = []
  const seen = []
  items.forEach((item) => {
    const postId = item?._id?.toString?.() || item?.id || ''
    const target = recentlySeenPostIds.has(postId) ? seen : unseen
    target.push(item)
  })
  return [...unseen, ...seen]
}

function buildTrendEntry({ label, posts }) {
  const now = Date.now()
  const recentWindowHours = 6
  const previousWindowHours = 18
  const recentWindowMs = recentWindowHours * 60 * 60 * 1000
  const previousWindowMs = previousWindowHours * 60 * 60 * 1000
  const recentThreshold = now - recentWindowMs
  const previousThreshold = recentThreshold - previousWindowMs

  const recentPosts = posts.filter((entry) => entry.createdAtMs >= recentThreshold)
  const previousPosts = posts.filter(
    (entry) => entry.createdAtMs < recentThreshold && entry.createdAtMs >= previousThreshold,
  )

  if (!recentPosts.length) {
    return null
  }

  const engagementTotal = recentPosts.reduce((total, entry) => total + entry.engagement, 0)
  const uniqueAuthorCount = new Set(recentPosts.map((entry) => entry.authorId)).size
  const freshnessAverage =
    recentPosts.reduce((total, entry) => {
      const ageRatio = clamp((now - entry.createdAtMs) / recentWindowMs, 0, 1)
      return total + (1 - ageRatio)
    }, 0) / recentPosts.length

  const recentRate = recentPosts.length / recentWindowHours
  const previousRate = previousPosts.length / previousWindowHours
  const growthScore =
    previousPosts.length === 0
      ? clamp(recentPosts.length * 22, 0, 100)
      : clamp(((recentRate - previousRate) / Math.max(previousRate, 0.15)) * 45 + 50, 0, 100)

  const volumeScore = clamp(recentPosts.length * 18 + Math.log10(engagementTotal + 1) * 24, 0, 100)
  const diversityScore = clamp(uniqueAuthorCount * 22, 0, 100)
  const freshnessScore = clamp(freshnessAverage * 100, 0, 100)
  const score =
    volumeScore * 0.35 +
    growthScore * 0.3 +
    diversityScore * 0.2 +
    freshnessScore * 0.15

  return {
    key: normalizeTopicToken(label),
    slug: buildTopicSlug(label),
    label,
    score: Number(score.toFixed(2)),
    postCount: recentPosts.length,
    uniqueAuthorCount,
    engagementTotal,
    growthScore: Number(growthScore.toFixed(2)),
    freshnessScore: Number(freshnessScore.toFixed(2)),
    lastActivityAt: new Date(
      Math.max(...recentPosts.map((entry) => entry.createdAtMs)),
    ).toISOString(),
  }
}

async function buildTrendingTopics(limit = 10) {
  const nowMs = Date.now()

  if (trendingTopicsCache.expiresAt > nowMs && trendingTopicsCache.items.length) {
    return trendingTopicsCache.items.slice(0, limit)
  }

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const now = new Date()
  const posts = await Post.find({
    group: null,
    privacy: 'public',
    archivedAt: null,
    'moderation.visibility': 'visible',
    createdAt: { $gte: since },
    ...buildPublicationVisibilityFilter(now),
  })
    .select('text author createdAt stats')
    .lean()

  const topicBuckets = new Map()

  posts.forEach((post) => {
    const topics = extractTopicsFromText(post.text || '')

    if (!topics.length) {
      return
    }

    const engagement =
      (post.stats?.likes || 0) * 3 +
      (post.stats?.comments || 0) * 4 +
      (post.stats?.saves || 0) * 5 +
      (post.stats?.shares || 0) * 4

    topics.forEach((topic) => {
      if (!topicBuckets.has(topic.key)) {
        topicBuckets.set(topic.key, {
          label: topic.label,
          posts: [],
        })
      }

      topicBuckets.get(topic.key).posts.push({
        createdAtMs: new Date(post.createdAt).getTime(),
        authorId: post.author?.toString?.() || '',
        engagement,
      })
    })
  })

  const items = [...topicBuckets.values()]
    .map((bucket) => buildTrendEntry(bucket))
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return new Date(right.lastActivityAt) - new Date(left.lastActivityAt)
    })
    .slice(0, limit)

  trendingTopicsCache.items = items
  trendingTopicsCache.expiresAt = nowMs + TREND_CACHE_TTL_MS

  return items
}

function emitTrendsUpdate(io) {
  trendingTopicsCache.expiresAt = 0
  trendingTopicsCache.items = []

  if (!io) {
    return
  }

  io.emit('trends:update', {
    updatedAt: new Date().toISOString(),
  })
}

async function notifyMentionedUsers({
  io,
  actor,
  text,
  entityKind = 'post',
  entityId = null,
  previousMentions = [],
}) {
  const previousMentionSet = new Set((previousMentions || []).map((item) => item.toLowerCase()))
  const nextMentionUsernames = extractMentionedUsernames(text).filter(
    (username) => !previousMentionSet.has(username),
  )

  if (!nextMentionUsernames.length) {
    return
  }

  const mentionedUsers = await User.find({
    username: { $in: nextMentionUsernames },
    accountStatus: 'active',
  }).select('_id username')

  await Promise.all(
    mentionedUsers.map((mentionedUser) =>
      createNotification({
        io,
        recipientId: mentionedUser._id,
        actor,
        type: 'mention',
        entityKind,
        entityId,
        title: 'Yeni etiketleme',
        body: `${actor.firstName} seni bir gonderide etiketledi.`,
      }),
    ),
  )
}

async function buildForYouRankedPosts({ user, limit, offset, experimentVariant = 'control' }) {
  const followingAuthorIds = uniqueStringIds(user.friendIds || [])
  const viewedProfileIds = uniqueStringIds(user.activity?.viewedProfileIds || [])
  const likedPostIds = uniqueStringIds(user.activity?.likedPostIds || [])
  const commentedPostIds = uniqueStringIds(user.activity?.commentedPostIds || [])
  const savedPostIds = uniqueStringIds(user.activity?.savedPostIds || [])
  const sharedPostIds = uniqueStringIds(user.activity?.sharedPostIds || [])
  const recentlySeenPostIds = await getRecentlySeenPostIds(user)
  const engagedPostIds = uniqueStringIds([
    ...likedPostIds,
    ...commentedPostIds,
    ...savedPostIds,
    ...sharedPostIds,
  ])

  let engagedAuthorIds = []

  if (engagedPostIds.length) {
    const engagedPosts = await Post.find(
      { _id: { $in: engagedPostIds } },
      { author: 1 },
    ).lean()

    engagedAuthorIds = uniqueStringIds(engagedPosts.map((post) => post.author))
  }

  const relatedAuthorIds = uniqueStringIds([
    ...followingAuthorIds,
    ...viewedProfileIds,
    ...engagedAuthorIds,
  ])

  const candidateFilter = {
    group: null,
    archivedAt: null,
    'moderation.visibility': 'visible',
    $or: [{ privacy: 'public' }, { author: user._id }],
  }
  appendAndFilter(candidateFilter, {
    $or: [{ contentType: { $exists: false } }, { contentType: 'post' }, { contentType: 'loop' }],
  })
  const excludedAuthorIds = await getExcludedFeedAuthorIds(user)
  if (excludedAuthorIds.length) {
    candidateFilter.author = { $nin: excludedAuthorIds }
  }
  const hiddenPostIds = uniqueStringIds(
    (user.discovery?.interestProfile?.hiddenPostIds || []).map((item) => item?.toString?.() || item),
  )
  if (hiddenPostIds.length) {
    candidateFilter._id = { $nin: hiddenPostIds }
  }

  appendAndFilter(candidateFilter, buildPublicationVisibilityFilter())

  if (relatedAuthorIds.length) {
    candidateFilter.$or.push({
      author: { $in: relatedAuthorIds },
      privacy: { $in: ['public', 'followers'] },
    })
  }

  const sampleSize = Math.max(60, offset + limit + 30)
  const candidatePosts = await Post.find(candidateFilter)
    .select(FEED_POST_PROJECTION)
    .populate('author', 'firstName lastName username avatarUrl verification')
    .sort({ createdAt: -1 })
    .limit(sampleSize)
    .lean()

  const signals = {
    followingAuthorIds: new Set(followingAuthorIds),
    viewedProfileIds: new Set(viewedProfileIds),
    engagedAuthorIds: new Set(engagedAuthorIds),
    likedPostIds: new Set(likedPostIds),
    commentedPostIds: new Set(commentedPostIds),
    savedPostIds: new Set(savedPostIds),
    sharedPostIds: new Set(sharedPostIds),
    recentlySeenPostIds: new Set(recentlySeenPostIds),
  }

  const persistedTopicScores = normalizeTopicScoresMap(user.discovery?.interestProfile?.topicScores || {})
  const hiddenTopicSet = new Set(
    uniqueStringIds(
      (user.discovery?.interestProfile?.hiddenTopicKeys || []).map((item) => normalizeTopicToken(item)),
    ),
  )
  const hasPersistentProfile = hasFreshInterestProfile(user, persistedTopicScores)
  const interestProfile = hasPersistentProfile
    ? {
      topicScoresMap: persistedTopicScores,
      hiddenTopicSet,
    }
    : await buildAndPersistInterestProfile(user)

  const personalizedEntries = candidatePosts.map((post) => {
    const personalized = buildPersonalizedCandidateScore({
        post,
        userId: user._id.toString(),
        signals,
        topicScoresMap: interestProfile.topicScoresMap,
        hiddenTopicSet: interestProfile.hiddenTopicSet,
        experimentVariant,
      })
    return {
      post,
      baseScore: personalized.score,
      meta: {
        topics: personalized.topics,
        authorId: personalized.authorId,
      },
    }
  })
  const rankedPosts = rankPersonalizedCandidates({
    entries: personalizedEntries,
    seedContext: buildFeedSeedContext({
      userId: user._id.toString(),
      view: 'for-you',
    })
  })

  return rankedPosts.slice(0, Math.max(limit + offset, FEED_SESSION_MAX_ITEMS))
}

async function buildForYouFeed({ user, limit, offset }) {
  const rankedPosts = await buildForYouRankedPosts({ user, limit, offset })
  return buildPaginationMeta(rankedPosts.slice(offset, offset + limit + 1), limit, offset)
}

async function fetchPostsInOrder(postIds = [], user) {
  if (!postIds.length) {
    return []
  }

  const rows = await Post.find({ _id: { $in: postIds } })
    .select(FEED_POST_PROJECTION)
    .populate('author', 'firstName lastName username avatarUrl verification')
    .populate('group', 'name slug privacy members.user members.role members.status')

  const byId = new Map(rows.map((row) => [row._id.toString(), row]))
  return postIds.map((postId) => byId.get(postId)).filter((post) => Boolean(post && canAccessPost(post, user)))
}

function resolveFeedAlgorithm({ view, loopMode = null, user = null, experimentVariant = 'control' }) {
  const suffix = experimentVariant === 'challenger' ? 'challenger' : 'control'
  if (view === 'for-you') {
    return `for-you-session-v3-${suffix}`
  }
  if (view === 'loop') {
    return loopMode === 'for-you' && user
      ? `loop-personalized-diversity-v3-${suffix}`
      : `loop-${loopMode || 'explore'}-quality-v3-${suffix}`
  }
  return `${view}-quality-diversity-v3-${suffix}`
}

function serializeFeedPosts(posts, user, {
  sessionId,
  startRank = 1,
  view,
  loopMode = null,
  algorithm,
  experiment,
}) {
  return posts.map((post, index) => ({
    ...serializePostForViewer(post, user),
    _recommendation: {
      sessionId,
      rank: startRank + index,
      view,
      loopMode: view === 'loop' ? loopMode : null,
      algorithm,
      experiment,
    },
  }))
}

const createPost = asyncHandler(async (req, res) => {
  let shouldCleanupUploadedFiles = true
  const perf = buildUploadPerfLogger(req, 'create_post')
  req.uploadPerfTrace = {}

  try {
    const parsedInput = await parsePostInput(req)
    perf.mark('parse_input_done')
    const slugSource = parsedInput.title || parsedInput.text.slice(0, 80)
    const slug = slugSource ? await buildUniquePostSlug(slugSource) : null
    perf.mark('slug_done')
    const post = await Post.create({
      author: req.user._id,
      title: parsedInput.title,
      slug,
      text: parsedInput.text,
      media: parsedInput.media,
      contentType: parsedInput.contentType,
      privacy: parsedInput.privacy,
      publication: parsedInput.publication,
    })
    perf.mark('post_create_done')

    if (parsedInput.processingJobs?.length) {
      try {
        for (const job of parsedInput.processingJobs) {
          await enqueueLoopVideo({
            postId: post._id,
            mediaIndex: job.mediaIndex,
            sourcePath: job.path,
            sourceUrl: job.sourceUrl,
            originalName: job.originalName,
            mimeType: job.mimeType,
          })
        }
      } catch (queueError) {
        await Post.deleteOne({ _id: post._id })
        throw queueError
      }
      perf.mark('video_queued')
    }
    shouldCleanupUploadedFiles = false
    const io = req.app.locals.io || null

      const populatedPost = await Post.findById(post._id).populate(
        'author',
        'firstName lastName username avatarUrl verification',
      )
      perf.mark('post_populate_done')

      await notifyMentionedUsers({
        io,
        actor: req.user,
        text: parsedInput.text,
        entityKind: 'post',
        entityId: post._id,
      })
      perf.mark('mentions_done')

      emitTrendsUpdate(io)
      invalidatePublicFeedCache()
      perf.mark('trends_emit_done')

    const isScheduled = parsedInput.publication?.status === 'scheduled'

    const isProcessing = Boolean(parsedInput.processingJobs?.length)
    res.status(isProcessing ? 202 : 201).json({
      message: isScheduled
        ? 'Post scheduled successfully.'
        : isProcessing
          ? 'Loop video uploaded and queued for processing.'
          : 'Post created successfully.',
      post: serializePostForViewer(populatedPost, req.user),
      meta: {
        scheduled: isScheduled,
        scheduledFor: parsedInput.publication?.scheduledFor || null,
        processing: isProcessing,
      },
    })
    perf.flush({
      ok: true,
      contentType: parsedInput.contentType,
      mediaCount: Array.isArray(parsedInput.media) ? parsedInput.media.length : 0,
      mediaTrace: req.uploadPerfTrace,
    })
  } catch (error) {
    if (shouldCleanupUploadedFiles) {
      await removeUploadedFiles(req.files)
    }

    perf.flush({
      ok: false,
      errorMessage: error.message,
      errorName: error.name,
      mediaTrace: req.uploadPerfTrace,
    })
    throw error
  }
})

const getFeed = asyncHandler(async (req, res) => {
  const { authorId, limit, cursor, offset, topic, view, loopMode } = req.validated.query

  const isGuestInitialFeed = !req.user && !authorId && !cursor && (!offset || Number(offset) === 0)
  const publicCacheKey = isGuestInitialFeed
    ? getPublicFeedCacheKey({ view, loopMode, topic, limit, offset: 0 })
    : null

  if (publicCacheKey) {
    const cachedResponse = getFromPublicFeedCache(publicCacheKey)
    if (cachedResponse) {
      res.json(cachedResponse)
      return
    }
  }

  const experiment = buildFeedExperiment({ req, view, loopMode })
  const scope = normalizeFeedSessionScope({
    reqUserId: req.user?._id?.toString(),
    view,
    topic,
    loopMode,
    experimentVariant: experiment.variant,
  })
  const algorithm = resolveFeedAlgorithm({
    view,
    loopMode,
    user: req.user,
    experimentVariant: experiment.variant,
  })

  if (view === 'for-you' && req.user && !authorId) {
    const resumeState = cursor ? await resolveFeedSessionFromCursor({ cursorToken: cursor, scope }) : null
    if (resumeState) {
      const page = buildSessionPagination({
        session: resumeState.session,
        position: resumeState.position,
        limit,
        scope,
      })
      const orderedPosts = await fetchPostsInOrder(page.pageIds, req.user)
      res.json({
        posts: serializeFeedPosts(orderedPosts, req.user, {
          sessionId: resumeState.session.id,
          startRank: resumeState.position + 1,
          view,
          algorithm,
          experiment,
        }),
        pagination: page.pagination,
        meta: {
          view,
          topic: topic || null,
          sessionId: resumeState.session.id,
          algorithm,
          experiment,
        },
      })
      return
    }

    const rankedPosts = await buildForYouRankedPosts({
      user: req.user,
      limit: FEED_SESSION_MAX_ITEMS,
      offset: 0,
      experimentVariant: experiment.variant,
    })
    const session = await createFeedSession({
      orderedPostIds: rankedPosts.map((post) => post._id.toString()),
      scope,
      limit,
    })
    const page = buildSessionPagination({
      session,
      position: Math.max(0, Number(offset || 0)),
      limit,
      scope,
    })
    const orderedPosts = await fetchPostsInOrder(page.pageIds, req.user)

    res.json({
      posts: serializeFeedPosts(orderedPosts, req.user, {
        sessionId: session.id,
        startRank: Math.max(0, Number(offset || 0)) + 1,
        view,
        algorithm,
        experiment,
      }),
      pagination: page.pagination,
      meta: {
        view,
        topic: topic || null,
        sessionId: session.id,
        algorithm,
        experiment,
      },
    })
    return
  }

  const filter = {
    group: null,
  }
  const excludedAuthorIds = await getExcludedFeedAuthorIds(req.user)
  if (excludedAuthorIds.length) {
    appendAndFilter(filter, { author: { $nin: excludedAuthorIds } })
  }
  let sort = { createdAt: -1 }
  const isLoopView = view === 'loop'

  const shouldIncludeLoopInExploreTopic = !authorId && view === 'explore' && Boolean(topic)

  if (isLoopView) {
    filter.contentType = 'loop'
    filter.media = {
      $elemMatch: {
        type: 'video',
        processing: 'ready',
        hlsUrl: { $nin: ['', null] },
        posterUrl: { $nin: ['', null] },
        durationSeconds: { $gt: 0 },
        width: { $gt: 0 },
        height: { $gt: 0 },
        renditions: { $elemMatch: { url: { $nin: ['', null] } } },
      },
    }
  } else if (!authorId) {
    if (shouldIncludeLoopInExploreTopic) {
      appendAndFilter(filter, {
        $or: [{ contentType: { $exists: false } }, { contentType: 'post' }, { contentType: 'loop' }],
      })
    } else {
      appendAndFilter(filter, {
        $or: [{ contentType: { $exists: false } }, { contentType: 'post' }],
      })
    }
  }

  if (topic) {
    const rawTopic = `${topic}`.replace(/^#/, '').trim()
    const normalizedTopic = normalizeTopicToken(rawTopic)
    const tokens = [
      rawTopic,
      normalizedTopic,
    ]
      .map((value) => value.trim())
      .filter(Boolean)
    const uniqueTokens = [...new Set(tokens)]

    if (uniqueTokens.length) {
      const topicPattern = uniqueTokens.map((value) => escapeRegex(value)).join('|')
      filter.text = {
        $regex: new RegExp(`(^|[^\\p{L}\\p{N}_])#(?:${topicPattern})(?=$|[^\\p{L}\\p{N}_])`, 'iu'),
      }
    }
  }

  const canUseCreatedAtCursor =
    Boolean(cursor) &&
    view !== 'explore' &&
    view !== 'for-you' &&
    !decodeFeedCursor(cursor)

  if (canUseCreatedAtCursor) {
    filter.createdAt = { $lt: new Date(cursor) }
  }

  if (authorId) {
    filter.author = authorId
  }

  if (!req.user || req.user.role !== 'admin') {
    filter['moderation.visibility'] = 'visible'
    filter.archivedAt = null
    appendAndFilter(filter, buildPublicationVisibilityFilter())
  }

  if (req.user) {
    const hiddenPostIds = uniqueStringIds(
      (req.user.discovery?.interestProfile?.hiddenPostIds || []).map((item) => item?.toString?.() || item),
    )
    if (hiddenPostIds.length) {
      filter._id = { $nin: hiddenPostIds }
    }
  }

  if (authorId) {
    if (!req.user) {
      filter.privacy = 'public'
    } else if (req.user.role !== 'admin' && authorId !== req.user._id.toString()) {
      const followsAuthor = (req.user.friendIds || []).some(
        (followedId) => followedId?.toString?.() === authorId,
      )
      filter.privacy = followsAuthor ? { $in: ['public', 'followers'] } : 'public'
    }
  } else if (view === 'loop') {
    if (loopMode === 'following') {
      if (!req.user || !(req.user.friendIds || []).length) {
        res.json({
          posts: [],
          pagination: {
            hasMore: false,
            nextCursor: null,
            nextOffset: null,
          },
          meta: {
            view,
            loopMode,
          },
        })
        return
      }

      filter.$or = [
        {
          author: { $in: req.user.friendIds },
          privacy: { $in: ['public', 'followers'] },
        },
      ]
    } else if (!req.user) {
      filter.privacy = 'public'
    } else {
      filter.$or = [
        { privacy: 'public' },
        { author: req.user._id },
        ...(loopMode === 'for-you' && (req.user.friendIds || []).length
          ? [{ author: { $in: req.user.friendIds }, privacy: 'followers' }]
          : []),
      ]
    }
  } else if (view === 'explore') {
    filter.privacy = 'public'
    sort = {
      'stats.likes': -1,
      'stats.comments': -1,
      'stats.saves': -1,
      'stats.shares': -1,
      createdAt: -1,
    }
  } else if (view === 'following') {
    if (!req.user || !(req.user.friendIds || []).length) {
      res.json({
        posts: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
          nextOffset: null,
        },
        meta: {
          view,
        },
      })
      return
    }

    filter.$or = [
      {
        author: { $in: req.user.friendIds },
        privacy: { $in: ['public', 'followers'] },
      },
    ]
  } else if (!req.user) {
    filter.privacy = 'public'
  } else {
    filter.$or = [{ privacy: 'public' }, { author: req.user._id }]
  }

  const supportsSessionPagination = !authorId && ['latest', 'explore', 'following', 'loop'].includes(view)

  if (supportsSessionPagination) {
    const resumeState = cursor ? await resolveFeedSessionFromCursor({ cursorToken: cursor, scope }) : null
    if (resumeState) {
      const page = buildSessionPagination({
        session: resumeState.session,
        position: resumeState.position,
        limit,
        scope,
      })
      const orderedPosts = await fetchPostsInOrder(page.pageIds, req.user)
      res.json({
        posts: serializeFeedPosts(orderedPosts, req.user, {
          sessionId: resumeState.session.id,
          startRank: resumeState.position + 1,
          view,
          loopMode,
          algorithm,
          experiment,
        }),
        pagination: page.pagination,
        meta: {
          view,
          topic: topic || null,
          loopMode: view === 'loop' ? loopMode : null,
          sessionId: resumeState.session.id,
          algorithm,
          experiment,
        },
      })
      return
    }

    const feedSeedContext = buildFeedSeedContext({
      userId: req.user?._id?.toString() || 'guest',
      view,
      topic: view === 'loop' ? loopMode : topic,
    })
    let orderedPostIds = []
    let loopCandidates = []
    let basePosts = []
    const isInitialPage = !cursor && (!offset || Number(offset) === 0)

    if (view === 'loop') {
      const recentlySeenPostIdSet = new Set(await getRecentlySeenPostIds(req.user))
      const candidateLimit = isInitialPage
        ? Math.max(LOOP_RANKING_CANDIDATE_MIN, limit * 5)
        : Math.max(LOOP_RANKING_CANDIDATE_MIN, FEED_SESSION_MAX_ITEMS + 40)
      loopCandidates = await Post.find(filter)
        .select(FEED_POST_PROJECTION)
        .populate('author', 'firstName lastName username avatarUrl verification')
        .sort({ createdAt: -1 })
        .limit(candidateLimit)
        .lean()

      let rankedLoops

      if (req.user && loopMode === 'for-you') {
        const persistedTopicScores = normalizeTopicScoresMap(req.user.discovery?.interestProfile?.topicScores || {})
        const hiddenTopicSet = new Set(
          uniqueStringIds(
            (req.user.discovery?.interestProfile?.hiddenTopicKeys || []).map((item) => normalizeTopicToken(item)),
          ),
        )
        const hasPersistentProfile = hasFreshInterestProfile(req.user, persistedTopicScores)
        const interestProfile = hasPersistentProfile
          ? {
            topicScoresMap: persistedTopicScores,
            hiddenTopicSet,
          }
          : await buildAndPersistInterestProfile(req.user)
        const neutralSignals = {
          followingAuthorIds: new Set(uniqueStringIds(req.user.friendIds || [])),
          viewedProfileIds: new Set(uniqueStringIds(req.user.activity?.viewedProfileIds || [])),
          engagedAuthorIds: new Set(),
          likedPostIds: new Set(uniqueStringIds(req.user.activity?.likedPostIds || [])),
          commentedPostIds: new Set(uniqueStringIds(req.user.activity?.commentedPostIds || [])),
          savedPostIds: new Set(uniqueStringIds(req.user.activity?.savedPostIds || [])),
          sharedPostIds: new Set(uniqueStringIds(req.user.activity?.sharedPostIds || [])),
          recentlySeenPostIds: recentlySeenPostIdSet,
        }
        const personalizedEntries = loopCandidates.map((post) => {
            const globalWeight = experiment.variant === 'challenger' ? 0.45 : 0.55
            const personalizedWeight = 1 - globalWeight
            const baseScore =
              buildLoopRankingScore(post) * globalWeight +
              buildPersonalizedCandidateScore({
                post,
                userId: req.user._id.toString(),
                signals: neutralSignals,
                topicScoresMap: interestProfile.topicScoresMap,
                hiddenTopicSet: interestProfile.hiddenTopicSet,
                experimentVariant: experiment.variant,
              }).score * personalizedWeight
            const meta = {
              topics: topicsFromPost(post),
              authorId: post.author?._id?.toString?.() || post.author?.toString?.() || '',
            }
            return { post, baseScore, meta }
          })

        rankedLoops = rankPersonalizedCandidates({
          entries: personalizedEntries,
          seedContext: feedSeedContext,
        })
      } else {
        rankedLoops = rankPersonalizedCandidates({
          entries: loopCandidates.map((post) => ({
            post,
            baseScore: buildLoopRankingScore(post),
            meta: {
              topics: topicsFromPost(post),
              authorId: post.author?._id?.toString?.() || post.author?.toString?.() || '',
            },
          })),
          seedContext: feedSeedContext,
        })
        rankedLoops = deprioritizeRecentlySeen(rankedLoops, recentlySeenPostIdSet)
      }

      orderedPostIds = rankedLoops.map((post) => post._id.toString())
    } else {
      const candidateLimit = isInitialPage
        ? Math.min(FEED_SESSION_MAX_ITEMS, Math.max(48, limit * 4))
        : FEED_SESSION_MAX_ITEMS

      basePosts = await Post.find(filter)
        .select(FEED_POST_PROJECTION)
        .populate('author', 'firstName lastName username avatarUrl verification')
        .sort(sort)
        .limit(candidateLimit)
        .lean()

      const globalEntries = basePosts.map((post) => {
          const ageInHours = Math.max(
            0,
            (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60),
          )
          const freshness = clamp(1 - ageInHours / 96, 0, 1)
          return {
            post,
            baseScore: computePostQualityScore(post) * 0.6 + freshness * 0.4,
            meta: {
              topics: topicsFromPost(post),
              authorId: post.author?._id?.toString?.() || post.author?.toString?.() || '',
            },
          }
      })
      let diversifiedPosts =
        view === 'latest'
          ? basePosts
          : rankPersonalizedCandidates({
              entries: globalEntries,
              seedContext: feedSeedContext,
            })
      if (['explore', 'following'].includes(view)) {
        diversifiedPosts = deprioritizeRecentlySeen(
          diversifiedPosts,
          new Set(await getRecentlySeenPostIds(req.user)),
        )
      }

      orderedPostIds = diversifiedPosts.map((post) => post._id.toString())
    }

    const session = await createFeedSession({
      orderedPostIds,
      scope,
      limit,
    })
    const page = buildSessionPagination({
      session,
      position: Math.max(0, Number(offset || 0)),
      limit,
      scope,
    })

    const candidateMap = new Map(
      (view === 'loop' ? loopCandidates : basePosts).map((post) => [post._id.toString(), post]),
    )
    const inMemoryPosts = page.pageIds.map((id) => candidateMap.get(id)).filter(Boolean)
    const orderedPosts =
      inMemoryPosts.length === page.pageIds.length
        ? inMemoryPosts
        : await fetchPostsInOrder(page.pageIds, req.user)

    const responsePayload = {
      posts: serializeFeedPosts(orderedPosts, req.user, {
        sessionId: session.id,
        startRank: Math.max(0, Number(offset || 0)) + 1,
        view,
        loopMode,
        algorithm,
        experiment,
      }),
      pagination: page.pagination,
      meta: {
        view,
        topic: topic || null,
        loopMode: view === 'loop' ? loopMode : null,
        sessionId: session.id,
        algorithm,
        experiment,
      },
    }

    if (publicCacheKey) {
      setInPublicFeedCache(publicCacheKey, responsePayload)
    }

    res.json(responsePayload)
    return
  }

  let query = Post.find(filter)
    .select(FEED_POST_PROJECTION)
    .populate('author', 'firstName lastName username avatarUrl verification')
    .sort(sort)

  if (canUseCreatedAtCursor) {
    query = query.limit(limit + 1)
  } else {
    query = query.skip(offset).limit(limit + 1)
  }

  const posts = await query.lean()
  const paginated = buildPaginationMeta(posts, limit, offset)

  res.json({
    posts: paginated.items.map((post) => serializePostForViewer(post, req.user)),
    pagination: paginated.pagination,
    meta: {
      view,
      topic: topic || null,
    },
  })
})

const getTrendingTopics = asyncHandler(async (req, res) => {
  const topics = await buildTrendingTopics(req.validated.query.limit)

  res.json({
    topics,
    meta: {
      algorithm: 'volume-growth-diversity-freshness',
      windowHours: 48,
    },
  })
})

const getPostById = asyncHandler(async (req, res) => {
  const post = await getAccessiblePost(req.validated.params.postId, req.user)
  const payload = await buildPostDetail(post, req.user || null)

  res.json(payload)
})

const registerPostView = asyncHandler(async (req, res) => {
  const post = await getAccessiblePost(req.validated.params.postId, req.user || null)

  if (isLikelyAutomatedClient(req)) {
    return res.json({
      postId: post._id,
      counted: false,
      ignored: 'automated-client',
      stats: {
        views: Number(post.stats?.views || 0),
        loopCompletions: Number(post.stats?.loopCompletions || 0),
        loopReplays: Number(post.stats?.loopReplays || 0),
      },
    })
  }

  const loopMetrics = req.validated.body || {}
  const normalizedWatchRatio =
    typeof loopMetrics.watchRatio === 'number' && Number.isFinite(loopMetrics.watchRatio)
      ? clamp(loopMetrics.watchRatio, 0, 1)
      : null
  const normalizedReplayCount =
    Number.isInteger(loopMetrics.replayCount) && loopMetrics.replayCount >= 0
      ? loopMetrics.replayCount
      : null
  const normalizedSwipeVelocity =
    typeof loopMetrics.swipeVelocity === 'number' &&
    Number.isFinite(loopMetrics.swipeVelocity) &&
    loopMetrics.swipeVelocity >= 0
      ? loopMetrics.swipeVelocity
      : null
  const normalizedVisibleMs =
    Number.isInteger(loopMetrics.visibleMs) && loopMetrics.visibleMs >= 0
      ? loopMetrics.visibleMs
      : null
  const recommendation = loopMetrics.recommendation || null
  const quickSkip = Boolean(
    typeof normalizedVisibleMs === 'number' &&
      normalizedVisibleMs >= 250 &&
      normalizedVisibleMs <= 1500 &&
      Number(normalizedWatchRatio || 0) < 0.15 &&
      Number(normalizedReplayCount || 0) === 0,
  )
  const longView = Boolean(
    Number(normalizedWatchRatio || 0) >= 0.65 ||
      Number(normalizedVisibleMs || 0) >= 8000 ||
      Number(normalizedReplayCount || 0) > 0,
  )
  const dayBucket = getPostViewDayBucket()
  const viewerKey = buildPostViewViewerKey(req)
  let counted = false
  let previousViewSignal = null
  const viewFilter = {
    post: post._id,
    viewerKey,
    dayBucket,
  }
  const now = new Date()
  const updatePipeline = buildPostViewUpdatePipeline({
    postId: post._id,
    viewerKey,
    dayBucket,
    expiresAt: getPostViewExpiresAt(now),
    now,
    watchRatio: normalizedWatchRatio,
    replayCount: normalizedReplayCount,
    swipeVelocity: normalizedSwipeVelocity,
    visibleMs: normalizedVisibleMs,
    quickSkip,
    longView,
    recommendation,
  })

  try {
    previousViewSignal = await updatePostViewSignal({
      filter: viewFilter,
      pipeline: updatePipeline,
    })
    counted = !previousViewSignal
  } catch (error) {
    if (error?.code !== 11000) {
      throw error
    }

    previousViewSignal = await updatePostViewSignal({
      filter: viewFilter,
      pipeline: updatePipeline,
      upsert: false,
    })
  }

  const statsIncrements = {}

  if (counted) {
    statsIncrements['stats.views'] = 1
  }

  const isLoopPost =
    post.contentType === 'loop' && (post.media || []).some((item) => item.type === 'video')
  const hasLoopSignals =
    typeof normalizedWatchRatio === 'number' ||
    typeof normalizedReplayCount === 'number' ||
    typeof normalizedSwipeVelocity === 'number' ||
    typeof normalizedVisibleMs === 'number'

  if (isLoopPost && hasLoopSignals) {
    const previousWatchRatio = Number(previousViewSignal?.maxWatchRatio || 0)
    const nextWatchRatio =
      typeof normalizedWatchRatio === 'number'
        ? Math.max(previousWatchRatio, normalizedWatchRatio)
        : previousWatchRatio
    const previousReplayCount = Number(previousViewSignal?.replayCount || 0)
    const nextReplayCount =
      typeof normalizedReplayCount === 'number'
        ? Math.max(previousReplayCount, normalizedReplayCount)
        : previousReplayCount
    const previousSwipeVelocity =
      typeof previousViewSignal?.swipeVelocity === 'number' && Number.isFinite(previousViewSignal.swipeVelocity)
        ? previousViewSignal.swipeVelocity
        : null
    const shouldRegisterSwipeSignal =
      previousSwipeVelocity === null && typeof normalizedSwipeVelocity === 'number'

    if (nextWatchRatio > previousWatchRatio) {
      statsIncrements['stats.loopWatchRatioSum'] = Number(
        ((statsIncrements['stats.loopWatchRatioSum'] || 0) + (nextWatchRatio - previousWatchRatio)).toFixed(6),
      )
    }
    if (nextReplayCount > previousReplayCount) {
      statsIncrements['stats.loopReplays'] =
        (statsIncrements['stats.loopReplays'] || 0) + (nextReplayCount - previousReplayCount)
    }
    if (
      previousWatchRatio < LOOP_COMPLETION_THRESHOLD &&
      nextWatchRatio >= LOOP_COMPLETION_THRESHOLD
    ) {
      statsIncrements['stats.loopCompletions'] =
        (statsIncrements['stats.loopCompletions'] || 0) + 1
    }
    if (shouldRegisterSwipeSignal) {
      statsIncrements['stats.loopSwipeVelocitySum'] =
        (statsIncrements['stats.loopSwipeVelocitySum'] || 0) + normalizedSwipeVelocity
    }
    if (previousWatchRatio <= 0 && nextWatchRatio > 0) {
      statsIncrements['stats.loopSignalsCount'] =
        (statsIncrements['stats.loopSignalsCount'] || 0) + 1
    }
    if (typeof normalizedVisibleMs === 'number') {
      const previousMaxVisible = Number(previousViewSignal?.maxVisibleMs || 0)
      const nextMaxVisible = Math.max(previousMaxVisible, normalizedVisibleMs)
      if (nextMaxVisible > previousMaxVisible) {
        statsIncrements['stats.loopVisibleMsSum'] =
          (statsIncrements['stats.loopVisibleMsSum'] || 0) + (nextMaxVisible - previousMaxVisible)
      }
    }
  }

  if (Object.keys(statsIncrements).length) {
    await Post.updateOne({ _id: post._id }, { $inc: statsIncrements })
  }

  if (req.user?._id && isLoopPost && hasLoopSignals) {
    if (quickSkip && !previousViewSignal?.quickSkipRecorded) {
      await recordRecommendationEvent({
        userId: req.user._id,
        postId: post._id,
        eventType: 'quick-skip',
        weight: -2.5,
        source: 'playback',
        recommendation,
      })
    }
    if (longView && !previousViewSignal?.longViewRecorded) {
      await recordRecommendationEvent({
        userId: req.user._id,
        postId: post._id,
        eventType: 'long-view',
        weight: 2.5,
        source: 'playback',
        recommendation,
      })
    }
    await User.updateOne(
      { _id: req.user._id },
      { $set: { 'discovery.interestProfile.updatedAt': null } },
    )
  }

  const latestPost = await Post.findById(post._id).select('stats.views stats.loopCompletions stats.loopReplays')
  const views = Number(latestPost?.stats?.views || 0)

  res.json({
    postId: post._id,
    counted,
    stats: {
      views,
      loopCompletions: Number(latestPost?.stats?.loopCompletions || 0),
      loopReplays: Number(latestPost?.stats?.loopReplays || 0),
    },
  })
})

const recordLoopTelemetry = asyncHandler(async (req, res) => {
  const post = await getAccessiblePost(req.validated.params.postId, req.user || null)

  if (post.contentType !== 'loop') {
    throw new AppError('Loop telemetry is only accepted for loop posts.', 400)
  }

  if (isLikelyAutomatedClient(req)) {
    return res.json({ ok: true, ignored: 'automated-client' })
  }

  const payload = sanitizeLoopTelemetryPayload(req.validated.body || {})
  const viewerKey = buildPostViewViewerKey(req)

  if (payload.eventId) {
    try {
      await TelemetryReceipt.create({
        eventId: payload.eventId,
        expiresAt: getTelemetryReceiptExpiresAt(),
      })
    } catch (error) {
      if (error?.code === 11000) {
        return res.json({ ok: true, deduplicated: true })
      }
      throw error
    }
  }

  const { sampled, sampleRate } = shouldPersistLoopTelemetry({
    payload,
    postId: post._id.toString(),
    viewerKey,
  })

  if (sampled) {
    await LoopPlaybackEvent.create({
      eventId: payload.eventId,
      post: post._id,
      user: req.user?._id || null,
      viewerKey,
      eventType: payload.eventType,
      mediaUrl: payload.mediaUrl,
      currentTimeSec: payload.currentTimeSec,
      timeGapMs: payload.timeGapMs,
      droppedFrames: payload.droppedFrames,
      totalFrames: payload.totalFrames,
      network: payload.network,
      device: payload.device,
      sampleRate,
      expiresAt: getLoopTelemetryExpiresAt(),
    })
  }

  const statsIncrements = {}
  if (payload.eventType === 'waiting') {
    statsIncrements['stats.loopWaitingEvents'] = 1
  } else if (payload.eventType === 'stalled') {
    statsIncrements['stats.loopStalledEvents'] = 1
  } else if (payload.eventType === 'error') {
    statsIncrements['stats.loopErrorEvents'] = 1
  } else if (payload.eventType === 'recover-failed') {
    statsIncrements['stats.loopRecoverFailedEvents'] = 1
  } else if (payload.eventType === 'time-gap') {
    statsIncrements['stats.loopTimeGapEvents'] = 1
  }

  if (payload.droppedFrames > 0) {
    statsIncrements['stats.loopDroppedFramesSum'] =
      (statsIncrements['stats.loopDroppedFramesSum'] || 0) + payload.droppedFrames
  }

  if (Object.keys(statsIncrements).length) {
    await Post.updateOne({ _id: post._id }, { $inc: statsIncrements })
  }

  res.json({
    ok: true,
    sampled,
    sampleRate,
  })
})

const createComment = asyncHandler(async (req, res) => {
  let shouldCleanupUploadedFiles = true

  try {
    const io = req.app.locals.io || null
    const parsedInput = await parseCommentInput(req)
    const post = await getAccessiblePost(req.params.postId, req.user)
    let parentComment = null

    if (parsedInput.parentCommentId) {
      parentComment = await Comment.findOne({
        _id: parsedInput.parentCommentId,
        post: post._id,
      })

      if (!parentComment) {
        throw new AppError('Parent comment not found for this post.', 404)
      }
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      parentComment: parentComment?._id || null,
      text: parsedInput.text,
      media: parsedInput.media,
    })
    shouldCleanupUploadedFiles = false

    if (parentComment) {
      parentComment.stats.replies += 1
      await parentComment.save()
    }

    post.stats.comments += 1
    await post.save()

    await updateUserActivity(
      req.user._id,
      'commentedPostIds',
      post._id,
      true,
    )
    await recordRecommendationEvent({
      userId: req.user._id,
      postId: post._id,
      eventType: 'comment',
      weight: 2,
    })

    const populatedComment = await Comment.findById(comment._id).populate(
      'author',
      'firstName lastName username avatarUrl verification',
    )

    try {
      await createNotification({
        io,
        recipientId: post.author?._id || post.author,
        actor: req.user,
        type: 'comment',
        entityKind: 'post',
        entityId: post._id,
        title: 'New comment',
        body: `${req.user.firstName} commented on your post.`,
      })
    } catch (notificationError) {
      // Comment creation should still succeed even if notification delivery fails.
    }

    emitTrendsUpdate(io)

    res.status(201).json({
      message: 'Comment created successfully.',
      comment: serializeCommentForViewer(populatedComment, req.user),
      postStats: post.stats,
    })
  } catch (error) {
    if (shouldCleanupUploadedFiles) {
      await removeUploadedFiles(req.files)
    }

    throw error
  }
})

const togglePostLike = asyncHandler(async (req, res) => {
  const io = req.app.locals.io || null
  const post = await getAccessiblePost(req.validated.params.postId, req.user)
  const result = await toggleDocumentInteraction({
    document: post,
    user: req.user,
    idsField: 'likedByUserIds',
    statsField: 'likes',
    responseKey: 'post',
    serializer: serializePostForViewer,
  })

  await updateUserActivity(
    req.user._id,
    'likedPostIds',
    post._id,
    result.active,
  )
  await recordRecommendationEvent({
    userId: req.user._id,
    postId: post._id,
    eventType: result.active ? 'like' : 'unlike',
    weight: result.active ? 3 : -3,
    recommendation: req.validated.body?.recommendation || null,
  })

  if (result.active) {
    await createNotification({
      io,
      recipientId: post.author?._id || post.author,
      actor: req.user,
      type: 'like',
      entityKind: 'post',
      entityId: post._id,
      title: 'Post liked',
      body: `${req.user.firstName} liked your post.`,
    })
  }

  emitTrendsUpdate(io)

  res.json({
    message: result.active ? 'Post liked.' : 'Post unliked.',
    post: result.post,
  })
})

const togglePostSave = asyncHandler(async (req, res) => {
  const post = await getAccessiblePost(req.validated.params.postId, req.user)
  const io = req.app.locals.io || null
  const result = await toggleDocumentInteraction({
    document: post,
    user: req.user,
    idsField: 'savedByUserIds',
    statsField: 'saves',
    responseKey: 'post',
    serializer: serializePostForViewer,
  })

  await updateUserActivity(
    req.user._id,
    'savedPostIds',
    post._id,
    result.active,
  )
  await recordRecommendationEvent({
    userId: req.user._id,
    postId: post._id,
    eventType: result.active ? 'save' : 'unsave',
    weight: result.active ? 4 : -4,
    recommendation: req.validated.body?.recommendation || null,
  })

  emitTrendsUpdate(io)

  res.json({
    message: result.active ? 'Post saved.' : 'Post unsaved.',
    post: result.post,
  })
})

const togglePostShare = asyncHandler(async (req, res) => {
  const io = req.app.locals.io || null
  const post = await getAccessiblePost(req.validated.params.postId, req.user)
  const result = await toggleDocumentInteraction({
    document: post,
    user: req.user,
    idsField: 'sharedByUserIds',
    statsField: 'shares',
    responseKey: 'post',
    serializer: serializePostForViewer,
  })

  await updateUserActivity(
    req.user._id,
    'sharedPostIds',
    post._id,
    result.active,
  )
  await recordRecommendationEvent({
    userId: req.user._id,
    postId: post._id,
    eventType: result.active ? 'share' : 'unshare',
    weight: result.active ? 5 : -5,
    recommendation: req.validated.body?.recommendation || null,
  })

  if (result.active) {
    await createNotification({
      io,
      recipientId: post.author?._id || post.author,
      actor: req.user,
      type: 'share',
      entityKind: 'post',
      entityId: post._id,
      title: 'Post shared',
      body: `${req.user.firstName} shared your post.`,
    })
  }

  emitTrendsUpdate(io)

  res.json({
    message: result.active ? 'Post shared.' : 'Post unshared.',
    post: result.post,
  })
})

const markPostNotInterested = asyncHandler(async (req, res) => {
  const post = await getAccessiblePost(req.validated.params.postId, req.user)
  const topicKeys = extractTopicsFromText(post.text || '').map((topic) => topic.key)
  const hiddenTopicKeys = uniqueStringIds([
    ...(req.user.discovery?.interestProfile?.hiddenTopicKeys || []),
    ...topicKeys,
  ])
  const nextHiddenPostIds = uniqueStringIds([
    ...(req.user.discovery?.interestProfile?.hiddenPostIds || []).map((item) => item?.toString?.() || item),
    post._id.toString(),
  ])

  await User.updateOne(
    { _id: req.user._id },
    {
      $set: {
        'discovery.interestProfile.hiddenTopicKeys': hiddenTopicKeys,
        'discovery.interestProfile.hiddenPostIds': nextHiddenPostIds,
      },
    },
  )

  await recordRecommendationEvent({
    userId: req.user._id,
    postId: post._id,
    eventType: 'not-interested',
    weight: -8,
    recommendation: req.validated.body?.recommendation || null,
  })
  await buildAndPersistInterestProfile({
    ...req.user.toObject(),
    discovery: {
      ...(req.user.discovery || {}),
      interestProfile: {
        ...(req.user.discovery?.interestProfile || {}),
        hiddenTopicKeys,
      },
    },
  })
  res.json({
    message: 'Preference updated. Similar content will appear less often.',
    hiddenTopicKeys,
  })
})

const toggleCommentLike = asyncHandler(async (req, res) => {
  const io = req.app.locals.io || null
  const { comment } = await getCommentWithAccess(req.validated.params.commentId, req.user)
  const result = await toggleDocumentInteraction({
    document: comment,
    user: req.user,
    idsField: 'likedByUserIds',
    statsField: 'likes',
    responseKey: 'comment',
    serializer: serializeCommentForViewer,
  })

  if (result.active) {
    await createNotification({
      io,
      recipientId: comment.author?._id || comment.author,
      actor: req.user,
      type: 'like',
      entityKind: 'comment',
      entityId: comment._id,
      title: 'Comment liked',
      body: `${req.user.firstName} liked your comment.`,
    })
  }

  res.json({
    message: result.active ? 'Comment liked.' : 'Comment unliked.',
    comment: result.comment,
  })
})

const toggleCommentSave = asyncHandler(async (req, res) => {
  const { comment } = await getCommentWithAccess(req.validated.params.commentId, req.user)
  const result = await toggleDocumentInteraction({
    document: comment,
    user: req.user,
    idsField: 'savedByUserIds',
    statsField: 'saves',
    responseKey: 'comment',
    serializer: serializeCommentForViewer,
  })

  res.json({
    message: result.active ? 'Comment saved.' : 'Comment unsaved.',
    comment: result.comment,
  })
})

const toggleCommentShare = asyncHandler(async (req, res) => {
  const io = req.app.locals.io || null
  const { comment } = await getCommentWithAccess(req.validated.params.commentId, req.user)
  const result = await toggleDocumentInteraction({
    document: comment,
    user: req.user,
    idsField: 'sharedByUserIds',
    statsField: 'shares',
    responseKey: 'comment',
    serializer: serializeCommentForViewer,
  })

  if (result.active) {
    await createNotification({
      io,
      recipientId: comment.author?._id || comment.author,
      actor: req.user,
      type: 'share',
      entityKind: 'comment',
      entityId: comment._id,
      title: 'Comment shared',
      body: `${req.user.firstName} shared your comment.`,
    })
  }

  res.json({
    message: result.active ? 'Comment shared.' : 'Comment unshared.',
    comment: result.comment,
  })
})

const updateComment = asyncHandler(async (req, res) => {
  const { comment } = await getCommentWithAccess(req.validated.params.commentId, req.user)
  const canEdit =
    comment.author?._id?.toString?.() === req.user._id.toString() ||
    comment.author?.toString?.() === req.user._id.toString() ||
    req.user.role === 'admin'

  if (!canEdit) {
    throw new AppError('You do not have permission to edit this comment.', 403)
  }

  comment.text = req.validated.body.text
  await comment.save()

  res.json({
    message: 'Comment updated successfully.',
    comment: serializeCommentForViewer(comment, req.user),
  })
})

const deleteComment = asyncHandler(async (req, res) => {
  const io = req.app.locals.io || null
  const { comment, post } = await getCommentWithAccess(req.validated.params.commentId, req.user)
  const postAuthorId = post.author?._id?.toString?.() || post.author?.toString?.()
  const canDelete =
    comment.author?._id?.toString?.() === req.user._id.toString() ||
    comment.author?.toString?.() === req.user._id.toString() ||
    (postAuthorId && postAuthorId === req.user._id.toString()) ||
    req.user.role === 'admin'

  if (!canDelete) {
    throw new AppError('You do not have permission to delete this comment.', 403)
  }

  const descendantIds = await findCommentDescendantIds(comment._id)
  const deleteCount = descendantIds.length

  await Comment.deleteMany({ _id: { $in: descendantIds } })

  if (comment.parentComment) {
    const parent = await Comment.findById(comment.parentComment)

    if (parent) {
      parent.stats.replies = Math.max((parent.stats?.replies || 1) - 1, 0)
      await parent.save()
    }
  }

  post.stats.comments = Math.max((post.stats?.comments || 0) - deleteCount, 0)
  await post.save()
  emitTrendsUpdate(io)

  res.json({
    message: 'Comment deleted successfully.',
    deletedCommentId: comment._id.toString(),
    deletedCount: deleteCount,
    postStats: post.stats,
  })
})

const updatePost = asyncHandler(async (req, res) => {
  const io = req.app.locals.io || null
  const post = await Post.findById(req.validated.params.postId)

  if (!post) {
    throw new AppError('Post not found.', 404)
  }

  const canEdit =
    post.author.toString() === req.user._id.toString() || req.user.role === 'admin'

  if (!canEdit) {
    throw new AppError('You do not have permission to update this post.', 403)
  }

  const { title, text, media, privacy, contentType } = req.validated.body
  const previousMentions = extractMentionedUsernames(post.text || '')

  const hasTitleUpdate = typeof title !== 'undefined'
  const hasTextUpdate = typeof text !== 'undefined'

  if (hasTitleUpdate) {
    const normalizedTitle = sanitizeTitle(title || '')
    post.title = normalizedTitle
  }

  if (typeof text !== 'undefined') {
    post.text = text
  }

  if (hasTitleUpdate || hasTextUpdate) {
    const slugSource = sanitizeTitle(post.title || '') || sanitizeTitle((post.text || '').slice(0, 80))
    post.slug = slugSource ? await buildUniquePostSlug(slugSource, post._id) : null
  }

  if (typeof media !== 'undefined') {
    post.media = media
  }

  if (typeof privacy !== 'undefined') {
    post.privacy = privacy
  }

  if (typeof contentType !== 'undefined') {
    post.contentType = contentType
  }

  await post.save()

  await notifyMentionedUsers({
    io,
    actor: req.user,
    text: post.text || '',
    entityKind: 'post',
    entityId: post._id,
    previousMentions,
  })

  emitTrendsUpdate(io)
  invalidatePublicFeedCache()

  const populatedPost = await Post.findById(post._id).populate(
    'author',
    'firstName lastName username avatarUrl verification',
  )

  res.json({
    message: 'Post updated successfully.',
    post: serializePostForViewer(populatedPost, req.user),
  })
})

const togglePostArchive = asyncHandler(async (req, res) => {
  const io = req.app.locals.io || null
  const post = await Post.findById(req.validated.params.postId)

  if (!post) {
    throw new AppError('Post not found.', 404)
  }

  const canManage =
    post.author.toString() === req.user._id.toString() || req.user.role === 'admin'

  if (!canManage) {
    throw new AppError('You do not have permission to archive this post.', 403)
  }

  post.archivedAt = post.archivedAt ? null : new Date()
  await post.save()
  emitTrendsUpdate(io)
  invalidatePublicFeedCache()

  const populatedPost = await Post.findById(post._id).populate(
    'author',
    'firstName lastName username avatarUrl verification',
  )

  res.json({
    message: post.archivedAt ? 'Post archived.' : 'Post restored.',
    post: serializePostForViewer(populatedPost, req.user),
  })
})

const deletePost = asyncHandler(async (req, res) => {
  const io = req.app.locals.io || null
  const post = await Post.findById(req.validated.params.postId)

  if (!post) {
    throw new AppError('Post not found.', 404)
  }

  const canManage =
    post.author.toString() === req.user._id.toString() || req.user.role === 'admin'

  if (!canManage) {
    throw new AppError('You do not have permission to delete this post.', 403)
  }

  await Comment.deleteMany({ post: post._id })
  await post.deleteOne()
  emitTrendsUpdate(io)
  invalidatePublicFeedCache()

  res.json({
    message: 'Post deleted successfully.',
    deletedPostId: req.validated.params.postId,
  })
})

module.exports = {
  buildTrendingTopics,
  createPost,
  getFeed,
  getTrendingTopics,
  getPostById,
  registerPostView,
  recordLoopTelemetry,
  createComment,
  togglePostLike,
  togglePostSave,
  togglePostShare,
  markPostNotInterested,
  toggleCommentLike,
  toggleCommentSave,
  toggleCommentShare,
  updateComment,
  deleteComment,
  updatePost,
  togglePostArchive,
  deletePost,
  _test: {
    buildFeedExperiment,
    buildLoopRankingScore,
    buildPostViewUpdatePipeline,
    canAccessPost,
    computePostQualityScore,
    deprioritizeRecentlySeen,
    hasFreshInterestProfile,
    normalizeFeedSessionScope,
    rankPersonalizedCandidates,
    serializeFeedPosts,
    shouldPersistLoopTelemetry,
    topicsFromPost,
  },
}
