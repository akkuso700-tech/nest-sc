const mongoose = require('mongoose')
const crypto = require('crypto')
const { z } = require('zod')
const { Post } = require('../models/Post')
const { PostView } = require('../models/PostView')
const { User } = require('../models/User')
const { Notification } = require('../models/Notification')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')
const { buildMediaItems, removeUploadedFiles } = require('../middlewares/uploadMedia')
const { serializePostForViewer } = require('../utils/socialSerializers')
const { normalizeUserMedia } = require('../utils/mediaUrls')

const STORY_TTL_HOURS = 24
const STORY_VIDEO_MAX_DURATION_SECONDS = 15
const STORY_MENTION_REGEX = /@[\p{L}\p{N}_]+/gu

const storyMetaSchema = z
  .object({
    music: z
      .object({
        title: z.string().trim().max(120).optional().default(''),
        artist: z.string().trim().max(120).optional().default(''),
      })
      .optional(),
    stickers: z
      .array(z.string().trim().min(1).max(60))
      .max(8)
      .optional()
      .default([]),
    mentions: z
      .array(
        z
          .string()
          .trim()
          .min(3)
          .max(40)
          .regex(/^[\p{L}\p{N}_]+$/u),
      )
      .max(20)
      .optional()
      .default([]),
    link: z
      .object({
        url: z.string().trim().url().max(1024),
        label: z.string().trim().max(120).optional().default(''),
      })
      .optional(),
  })
  .optional()
  .default(undefined)

const createStoryBodySchema = z.object({
  text: z.string().trim().max(1200).optional().default(''),
  privacy: z.enum(['public', 'followers', 'private']).optional().default('public'),
  storyMeta: z.union([z.string(), storyMetaSchema]).optional(),
})

function normalizeStoryMeta(rawMeta = undefined) {
  if (!rawMeta || (typeof rawMeta === 'string' && !rawMeta.trim())) {
    return null
  }

  let parsedMeta = rawMeta

  if (typeof rawMeta === 'string') {
    try {
      parsedMeta = JSON.parse(rawMeta)
    } catch {
      throw new AppError('Story metadata format is invalid.', 400)
    }
  }

  const parsedResult = storyMetaSchema.safeParse(parsedMeta)

  if (!parsedResult.success) {
    throw new AppError('Story metadata is invalid.', 400)
  }

  const value = parsedResult.data || {}
  const normalizedMusic = value.music
    ? {
        title: `${value.music.title || ''}`.trim(),
        artist: `${value.music.artist || ''}`.trim(),
      }
    : null
  const normalizedStickers = [...new Set((value.stickers || []).map((item) => `${item}`.trim()).filter(Boolean))]
  const normalizedMentions = [
    ...new Set(
      (value.mentions || [])
        .map((item) => `${item}`.replace(/^@/, '').trim().toLowerCase())
        .filter((item) => item.length >= 3),
    ),
  ]
  const normalizedLink =
    value.link && `${value.link.url || ''}`.trim()
      ? {
          url: `${value.link.url}`.trim(),
          label: `${value.link.label || ''}`.trim(),
        }
      : null

  if (
    !normalizedMusic?.title &&
    !normalizedMusic?.artist &&
    !normalizedStickers.length &&
    !normalizedMentions.length &&
    !normalizedLink
  ) {
    return null
  }

  return {
    ...(normalizedMusic ? { music: normalizedMusic } : {}),
    ...(normalizedStickers.length ? { stickers: normalizedStickers } : {}),
    ...(normalizedMentions.length ? { mentions: normalizedMentions } : {}),
    ...(normalizedLink ? { link: normalizedLink } : {}),
  }
}

function extractMentionedUsernames(text = '') {
  if (!`${text}`.trim()) {
    return []
  }

  return [
    ...new Set(
      (`${text}`.match(STORY_MENTION_REGEX) || [])
        .map((item) => item.replace(/^@/, '').trim().toLowerCase())
        .filter((item) => item.length >= 3),
    ),
  ]
}

async function notifyStoryMentions({ story, actor, text = '', storyMeta = null }) {
  const actorId = actor?._id?.toString?.()

  const usernames = [
    ...new Set([
      ...extractMentionedUsernames(text),
      ...((storyMeta?.mentions || []).map((item) => `${item}`.toLowerCase())),
    ]),
  ]

  if (!usernames.length) {
    return
  }

  const mentionedUsers = await User.find({
    username: { $in: usernames },
    accountStatus: 'active',
  }).select('_id')

  const notifications = mentionedUsers
    .map((mentionedUser) => {
      const mentionedUserId = mentionedUser._id?.toString?.()
      if (!mentionedUserId || mentionedUserId === actorId) {
        return null
      }

      return {
        user: mentionedUser._id,
        actor: actor._id,
        type: 'mention',
        entityKind: 'post',
        entityId: story._id,
        title: 'Yeni etiketleme',
        body: `${actor.firstName} seni bir hikayede etiketledi.`,
      }
    })
    .filter(Boolean)

  if (!notifications.length) {
    return
  }

  await Notification.insertMany(notifications, { ordered: false })
}

function appendAndFilter(filter, condition) {
  if (!filter.$and) {
    filter.$and = []
  }

  filter.$and.push(condition)
}

function buildPublicationVisibilityFilter(now = new Date()) {
  return {
    $or: [
      { 'publication.status': { $ne: 'scheduled' } },
      { 'publication.scheduledFor': { $lte: now } },
    ],
  }
}

function resolveRequestIp(req) {
  const forwardedFor = req.headers?.['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    const [firstIp] = forwardedFor.split(',')
    return firstIp.trim()
  }

  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function buildViewerKey(req) {
  if (req.user?._id) {
    return `user:${req.user._id.toString()}`
  }

  const source = `${resolveRequestIp(req)}|${req.headers?.['user-agent'] || 'unknown'}`
  const fingerprint = crypto.createHash('sha256').update(source).digest('hex').slice(0, 40)
  return `guest:${fingerprint}`
}

function getStoryViewDayBucket(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getStoryViewExpiresAt(now = new Date()) {
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 2)
  return expiresAt
}

function getStoryExpiresAt(now = new Date()) {
  const expiresAt = new Date(now)
  expiresAt.setHours(expiresAt.getHours() + STORY_TTL_HOURS)
  return expiresAt
}

async function getStoryById(storyId) {
  if (!mongoose.isValidObjectId(storyId)) {
    throw new AppError('Story not found.', 404)
  }

  const story = await Post.findById(storyId).populate(
    'author',
    'firstName lastName username avatarUrl verification',
  )

  if (!story || story.contentType !== 'story') {
    throw new AppError('Story not found.', 404)
  }

  return story
}

function buildStoryVisibilityFilter(viewer, now = new Date()) {
  const filter = {
    contentType: 'story',
    archivedAt: null,
    'moderation.visibility': 'visible',
    storyExpiresAt: { $gt: now },
  }

  appendAndFilter(filter, buildPublicationVisibilityFilter(now))

  if (!viewer) {
    filter.privacy = 'public'
    return filter
  }

  if (viewer.role === 'admin') {
    return filter
  }

  const viewerId = viewer._id.toString()
  const followingIds = (viewer.friendIds || []).map((id) => id.toString())
  const visibilityConditions = [{ privacy: 'public' }, { author: viewer._id }, { privacy: 'private', author: viewer._id }]

  if (followingIds.length) {
    visibilityConditions.push({ privacy: 'followers', author: { $in: followingIds } })
  }

  appendAndFilter(filter, { $or: visibilityConditions })

  return filter
}

async function buildViewedStorySet(storyIds, req) {
  if (!storyIds.length) {
    return new Set()
  }

  const viewerKey = buildViewerKey(req)
  const viewedStories = await PostView.find({
    post: { $in: storyIds },
    viewerKey,
  })
    .select('post')
    .lean()

  return new Set(viewedStories.map((item) => item.post.toString()))
}

const createStory = asyncHandler(async (req, res) => {
  let shouldCleanupUploadedFiles = true

  try {
    const media = await buildMediaItems(req.files || [])
    const parsedInput = createStoryBodySchema.safeParse(req.body || {})

    if (!parsedInput.success) {
      throw parsedInput.error
    }

    if (!media.length) {
      throw new AppError('Story media is required.', 400)
    }

    if (media.length > 1) {
      throw new AppError('Story supports only one media item.', 400)
    }

    if (media[0].type === 'video' && media[0].durationSeconds > STORY_VIDEO_MAX_DURATION_SECONDS) {
      throw new AppError('Story video must be 15 seconds or shorter.', 400)
    }

    const storyMeta = normalizeStoryMeta(parsedInput.data.storyMeta)
    const now = new Date()
    const story = await Post.create({
      author: req.user._id,
      text: parsedInput.data.text,
      media: [media[0]],
      contentType: 'story',
      privacy: parsedInput.data.privacy,
      ...(storyMeta ? { storyMeta } : {}),
      publication: {
        status: 'published',
        scheduledFor: null,
      },
      storyExpiresAt: getStoryExpiresAt(now),
    })

    const populatedStory = await Post.findById(story._id).populate(
      'author',
      'firstName lastName username avatarUrl verification',
    )

    try {
      await notifyStoryMentions({
        story,
        actor: req.user,
        text: parsedInput.data.text,
        storyMeta,
      })
    } catch {
      // Story publish flow should stay resilient even if mention notifications fail.
    }

    shouldCleanupUploadedFiles = false

    res.status(201).json({
      message: 'Story published successfully.',
      story: serializePostForViewer(populatedStory, req.user),
    })
  } finally {
    if (shouldCleanupUploadedFiles) {
      await removeUploadedFiles(req.files)
    }
  }
})

const listStoryRails = asyncHandler(async (req, res) => {
  const limit = req.validated?.query?.limit || 30
  const now = new Date()
  const filter = buildStoryVisibilityFilter(req.user || null, now)
  const stories = await Post.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit * 10)
    .populate('author', 'firstName lastName username avatarUrl verification')

  const groupedMap = new Map()

  stories.forEach((story) => {
    const authorId = story.author?._id?.toString?.() || ''
    if (!authorId) {
      return
    }

    if (!groupedMap.has(authorId)) {
      groupedMap.set(authorId, {
        author: story.author,
        items: [],
        latestCreatedAt: story.createdAt,
      })
    }

    const group = groupedMap.get(authorId)
    group.items.push(story)
    if (!group.latestCreatedAt || story.createdAt > group.latestCreatedAt) {
      group.latestCreatedAt = story.createdAt
    }
  })

  const groupedRails = [...groupedMap.values()]
    .sort((left, right) => new Date(right.latestCreatedAt) - new Date(left.latestCreatedAt))
    .slice(0, limit)

  const storyIds = groupedRails.flatMap((group) => group.items.map((story) => story._id.toString()))
  const viewedStorySet = await buildViewedStorySet(storyIds, req)

  const rails = groupedRails.map((group) => {
    const serializedItems = group.items
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
      .map((story) => {
        const serialized = serializePostForViewer(story, req.user || null)
        return {
          ...serialized,
          viewedByViewer: viewedStorySet.has(story._id.toString()),
        }
      })

    const hasUnseen = serializedItems.some((story) => !story.viewedByViewer)

    return {
      author: normalizeUserMedia(group.author),
      hasUnseen,
      items: serializedItems,
      latestCreatedAt: group.latestCreatedAt,
    }
  })

  res.json({
    rails,
    meta: {
      totalRails: rails.length,
      now: now.toISOString(),
    },
  })
})

const getStoriesByUsername = asyncHandler(async (req, res) => {
  const username = req.validated?.params?.username?.toLowerCase()
  const targetUser = await User.findOne({ username }).select('_id firstName lastName username avatarUrl friendIds verification')

  if (!targetUser) {
    throw new AppError('User not found.', 404)
  }

  const now = new Date()
  const filter = buildStoryVisibilityFilter(req.user || null, now)
  filter.author = targetUser._id

  const stories = await Post.find(filter)
    .sort({ createdAt: 1 })
    .populate('author', 'firstName lastName username avatarUrl verification')

  const viewedStorySet = await buildViewedStorySet(stories.map((story) => story._id.toString()), req)

  res.json({
    author: targetUser,
    items: stories.map((story) => {
      const serialized = serializePostForViewer(story, req.user || null)
      return {
        ...serialized,
        viewedByViewer: viewedStorySet.has(story._id.toString()),
      }
    }),
  })
})

const registerStoryView = asyncHandler(async (req, res) => {
  const { storyId } = req.validated?.params || {}
  const story = await getStoryById(storyId)

  const filter = buildStoryVisibilityFilter(req.user || null, new Date())
  filter._id = story._id
  const accessible = await Post.exists(filter)
  if (!accessible) {
    throw new AppError('Story access denied.', 403)
  }

  const now = new Date()
  const dayBucket = getStoryViewDayBucket(now)
  const viewerKey = buildViewerKey(req)
  const result = await PostView.updateOne(
    {
      post: story._id,
      viewerKey,
      dayBucket,
    },
    {
      $setOnInsert: {
        post: story._id,
        viewerKey,
        dayBucket,
        expiresAt: getStoryViewExpiresAt(now),
      },
    },
    {
      upsert: true,
    },
  )

  if (result.upsertedCount > 0) {
    await Post.updateOne({ _id: story._id }, { $inc: { 'stats.views': 1 } })
  }

  const latestStory = await Post.findById(story._id).select('stats.views')

  res.json({
    message: 'Story view tracked.',
    stats: {
      views: Number(latestStory?.stats?.views || 0),
    },
  })
})

const getStoryViewers = asyncHandler(async (req, res) => {
  const { storyId } = req.validated?.params || {}
  const { limit = 30, offset = 0 } = req.validated?.query || {}
  const story = await getStoryById(storyId)
  const storyAuthorId = story.author?._id?.toString?.() || story.author?.toString?.()
  const requesterId = req.user?._id?.toString?.() || ''
  const isAdmin = req.user?.role === 'admin'
  const isOwner = requesterId && requesterId === storyAuthorId

  if (!isOwner && !isAdmin) {
    throw new AppError('Story viewers access denied.', 403)
  }

  const views = await PostView.find({
    post: story._id,
    viewerKey: { $regex: /^user:/ },
  })
    .select('viewerKey updatedAt')
    .sort({ updatedAt: -1 })
    .lean()

  const latestViewerMap = new Map()

  views.forEach((view) => {
    const viewerKey = `${view.viewerKey || ''}`
    if (!viewerKey.startsWith('user:')) {
      return
    }

    const viewerUserId = viewerKey.slice(5)

    if (!mongoose.isValidObjectId(viewerUserId) || latestViewerMap.has(viewerUserId)) {
      return
    }

    latestViewerMap.set(viewerUserId, view.updatedAt || new Date())
  })

  const orderedViewerIds = [...latestViewerMap.keys()]
  const users = await User.find({ _id: { $in: orderedViewerIds } })
    .select('firstName lastName username avatarUrl verification')
    .lean()

  const usersMap = new Map(users.map((user) => [user._id.toString(), normalizeUserMedia(user)]))
  const allViewers = orderedViewerIds
    .map((userId) => {
      const user = usersMap.get(userId)
      if (!user) {
        return null
      }

      return {
        viewer: user,
        viewedAt: latestViewerMap.get(userId),
      }
    })
    .filter(Boolean)

  const guestViewerKeys = await PostView.distinct('viewerKey', {
    post: story._id,
    viewerKey: { $regex: /^guest:/ },
  })

  const viewers = allViewers.slice(offset, offset + limit)

  res.json({
    viewers,
    pagination: {
      total: allViewers.length,
      limit,
      offset,
      hasMore: offset + limit < allViewers.length,
      nextOffset: offset + limit < allViewers.length ? offset + limit : null,
    },
    meta: {
      guestViewers: guestViewerKeys.length,
      storyId: story._id.toString(),
    },
  })
})

const deleteStory = asyncHandler(async (req, res) => {
  const { storyId } = req.validated?.params || {}
  const story = await getStoryById(storyId)

  const isOwner = story.author?.toString?.() === req.user._id.toString()
  const isAdmin = req.user.role === 'admin'

  if (!isOwner && !isAdmin) {
    throw new AppError('Story delete access denied.', 403)
  }

  await Post.deleteOne({ _id: story._id })

  res.json({
    message: 'Story deleted successfully.',
  })
})

module.exports = {
  createStory,
  listStoryRails,
  getStoriesByUsername,
  registerStoryView,
  getStoryViewers,
  deleteStory,
}
