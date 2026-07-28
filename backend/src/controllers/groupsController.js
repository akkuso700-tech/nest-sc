const mongoose = require('mongoose')
const { Group } = require('../models/Group')
const { Post } = require('../models/Post')
const { Comment } = require('../models/Comment')
const { PostView } = require('../models/PostView')
const { Report } = require('../models/Report')
const { LoopPlaybackEvent } = require('../models/LoopPlaybackEvent')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')
const { serializePostForViewer } = require('../utils/socialSerializers')
const { buildMediaItems, removeUploadedFiles } = require('../middlewares/uploadMedia')
const { sanitizeTitle, slugifyTitle } = require('../utils/postSeo')

function slugifyName(value = '') {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
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

async function buildUniqueSlug(name) {
  const base = slugifyName(name) || `group-${Date.now()}`
  let slug = base
  let counter = 1
  while (await Group.exists({ slug })) {
    counter += 1
    slug = `${base}-${counter}`
  }
  return slug
}

function getMemberEntry(group, userId) {
  return (group.members || []).find(
    (entry) => resolveEntryUserId(entry) === userId.toString() && (entry.status || 'active') === 'active',
  )
}

function resolveEntryUserId(entry) {
  return (
    entry?.user?._id?.toString?.() ||
    entry?.user?.toString?.() ||
    ''
  )
}

async function ensureCreatorMembership(group) {
  const creatorId = group.createdBy?.toString?.()
  if (!creatorId) {
    return group
  }

  const creatorEntries = (group.members || []).filter(
    (entry) => resolveEntryUserId(entry) === creatorId,
  )
  const existingCreatorEntry = creatorEntries[0] || null

  if (existingCreatorEntry) {
    let hasChange = false

    if (creatorEntries.length > 1) {
      const normalizedMembers = []
      let kept = false
      ;(group.members || []).forEach((entry) => {
        const entryUserId = resolveEntryUserId(entry)
        if (entryUserId !== creatorId) {
          normalizedMembers.push(entry)
          return
        }

        if (!kept) {
          normalizedMembers.push(entry)
          kept = true
        }
      })
      group.members = normalizedMembers
      hasChange = true
    }

    if ((existingCreatorEntry.status || 'active') !== 'active') {
      existingCreatorEntry.status = 'active'
      hasChange = true
    }
    if (existingCreatorEntry.role !== 'owner') {
      existingCreatorEntry.role = 'owner'
      hasChange = true
    }
    if (hasChange) {
      group.stats.memberCount = (group.members || []).filter(
        (entry) => (entry.status || 'active') === 'active',
      ).length
      await group.save()
    }
    return group
  }

  group.members.push({
    user: group.createdBy,
    role: 'owner',
    status: 'active',
    joinedAt: new Date(),
  })
  group.stats.memberCount = (group.members || []).filter(
    (entry) => (entry.status || 'active') === 'active',
  ).length
  await group.save()
  return group
}

function canModerateGroup(group, user) {
  if (!user) {
    return false
  }
  if (user.role === 'admin') {
    return true
  }
  const memberEntry = getMemberEntry(group, user._id)
  return ['owner', 'admin', 'moderator'].includes(memberEntry?.role || '')
}

function canManageGroupSettings(group, user) {
  if (!user) {
    return false
  }
  if (user.role === 'admin') {
    return true
  }
  const memberEntry = getMemberEntry(group, user._id)
  return ['owner', 'admin'].includes(memberEntry?.role || '')
}

function serializeGroup(group, viewerId = null) {
  const activeMembers = (group.members || []).filter((entry) => (entry.status || 'active') === 'active')
  const viewerMembership = viewerId
    ? (group.members || []).find((entry) => {
        const memberId = entry.user?._id?.toString?.() || entry.user?.toString?.()
        return memberId === viewerId.toString()
      }) || null
    : null
  const managers = activeMembers.filter((entry) => ['owner', 'admin'].includes(entry.role))
  const moderators = activeMembers.filter((entry) => entry.role === 'moderator')

  return {
    id: group._id,
    name: group.name,
    slug: group.slug,
    about: group.about || '',
    privacy: group.privacy,
    coverImageUrl: group.coverImageUrl || '',
    postApprovalRequired: Boolean(group.postApprovalRequired),
    joinApprovalRequired: Boolean(group.joinApprovalRequired),
    stats: {
      memberCount: activeMembers.length,
    },
    managers: managers.map((entry) => ({
      userId: entry.user?._id || entry.user,
      firstName: entry.user?.firstName || '',
      lastName: entry.user?.lastName || '',
      avatarUrl: entry.user?.avatarUrl || '',
      role: entry.role,
    })),
    moderators: moderators.map((entry) => ({
      userId: entry.user?._id || entry.user,
      firstName: entry.user?.firstName || '',
      lastName: entry.user?.lastName || '',
      avatarUrl: entry.user?.avatarUrl || '',
      role: entry.role,
    })),
    viewerRole: viewerMembership?.role || null,
    isViewerMember: (viewerMembership?.status || '') === 'active',
    viewerMembershipStatus: viewerMembership?.status || 'none',
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }
}

function serializeSidebarGroup(group, options = {}) {
  const {
    isViewerMember = false,
    viewerRole = null,
    viewerMembershipStatus = isViewerMember ? 'active' : 'none',
  } = options

  return {
    id: group._id,
    name: group.name,
    slug: group.slug,
    about: group.about || '',
    privacy: group.privacy,
    coverImageUrl: group.coverImageUrl || '',
    postApprovalRequired: Boolean(group.postApprovalRequired),
    joinApprovalRequired: Boolean(group.joinApprovalRequired),
    stats: {
      memberCount: Number(group?.stats?.memberCount || 0),
    },
    managers: [],
    moderators: [],
    viewerRole,
    isViewerMember,
    viewerMembershipStatus,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }
}

async function getGroupByIdOrThrow(groupId, options = {}) {
  const { populateMembers = true } = options

  if (!mongoose.isValidObjectId(groupId)) {
    throw new AppError('Group not found.', 404)
  }
  let query = Group.findById(groupId)
  if (populateMembers) {
    query = query.populate('members.user', 'firstName lastName username avatarUrl verification')
  }
  const group = await query
  if (!group) {
    throw new AppError('Group not found.', 404)
  }
  return ensureCreatorMembership(group)
}

const createGroup = asyncHandler(async (req, res) => {
  const { name, privacy, about } = req.validated.body
  const slug = await buildUniqueSlug(name)
  const group = await Group.create({
    name: name.trim(),
    slug,
    privacy,
    about: about || '',
    createdBy: req.user._id,
    members: [
      {
        user: req.user._id,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
      },
    ],
    stats: { memberCount: 1 },
  })
  const populated = await Group.findById(group._id).populate('members.user', 'firstName lastName username avatarUrl verification')
  res.status(201).json({
    message: 'Group created successfully.',
    group: serializeGroup(populated, req.user._id),
  })
})

const listSidebarGroups = asyncHandler(async (req, res) => {
  const { q, limit } = req.validated.query
  const search = q.trim()
  const safeRegex = search ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null
  const activeFilter = { members: { $elemMatch: { user: req.user._id, status: 'active' } } }

  const [managed, joined, suggested] = await Promise.all([
    Group.find({
      ...activeFilter,
      ...(safeRegex ? { name: safeRegex } : {}),
      members: { $elemMatch: { user: req.user._id, status: 'active', role: { $in: ['owner', 'admin', 'moderator'] } } },
    })
      .select('name slug about privacy coverImageUrl postApprovalRequired joinApprovalRequired stats createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
    Group.find({
      members: {
        $elemMatch: {
          user: req.user._id,
          status: 'active',
          role: 'member',
        },
      },
      ...(safeRegex ? { name: safeRegex } : {}),
    })
      .select('name slug about privacy coverImageUrl postApprovalRequired joinApprovalRequired stats createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
    Group.find({
      ...(safeRegex ? { name: safeRegex } : {}),
      'members.user': { $ne: req.user._id },
      'stats.memberCount': { $gt: 0 },
    })
      .select('name slug about privacy coverImageUrl postApprovalRequired joinApprovalRequired stats createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
  ])

  res.json({
    managed: managed.map((item) =>
      serializeSidebarGroup(item, {
        isViewerMember: true,
        viewerMembershipStatus: 'active',
      })),
    joined: joined.map((item) =>
      serializeSidebarGroup(item, {
        isViewerMember: true,
        viewerRole: 'member',
        viewerMembershipStatus: 'active',
      })),
    suggested: suggested.map((item) =>
      serializeSidebarGroup(item, {
        isViewerMember: false,
        viewerMembershipStatus: 'none',
      })),
  })
})

const getGroupBySlug = asyncHandler(async (req, res) => {
  const groupDocument = await Group.findOne({ slug: req.validated.params.slug })
    .populate('members.user', 'firstName lastName username avatarUrl verification')
  if (!groupDocument) {
    throw new AppError('Group not found.', 404)
  }
  const group = await ensureCreatorMembership(groupDocument)
  res.json({ group: serializeGroup(group, req.user._id) })
})

const updateGroup = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  if (!canManageGroupSettings(group, req.user)) {
    throw new AppError('You do not have permission to update this group.', 403)
  }

  const updates = req.validated.body
  if (typeof updates.name !== 'undefined') {
    group.name = updates.name.trim()
  }
  if (typeof updates.about !== 'undefined') {
    group.about = updates.about
  }
  if (typeof updates.privacy !== 'undefined') {
    group.privacy = updates.privacy
  }
  if (typeof updates.coverImageUrl !== 'undefined') {
    group.coverImageUrl = updates.coverImageUrl
  }
  if (typeof updates.postApprovalRequired !== 'undefined') {
    group.postApprovalRequired = updates.postApprovalRequired
  }
  if (typeof updates.joinApprovalRequired !== 'undefined') {
    group.joinApprovalRequired = updates.joinApprovalRequired
  }

  await group.save()
  const refreshed = await Group.findById(group._id).populate('members.user', 'firstName lastName username avatarUrl verification')
  res.json({
    message: 'Group updated successfully.',
    group: serializeGroup(refreshed, req.user._id),
  })
})

const deleteGroup = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  if (!canManageGroupSettings(group, req.user)) {
    throw new AppError('You do not have permission to delete this group.', 403)
  }
  const posts = await Post.find({ group: group._id }).select('_id').lean()
  const postIds = posts.map((post) => post._id)
  const comments = postIds.length
    ? await Comment.find({ post: { $in: postIds } }).select('_id').lean()
    : []
  const commentIds = comments.map((comment) => comment._id)

  if (commentIds.length) {
    await Report.deleteMany({ targetKind: 'comment', targetId: { $in: commentIds } })
  }
  if (postIds.length) {
    await Promise.all([
      Comment.deleteMany({ post: { $in: postIds } }),
      PostView.deleteMany({ post: { $in: postIds } }),
      LoopPlaybackEvent.deleteMany({ post: { $in: postIds } }),
      Report.deleteMany({ targetKind: 'post', targetId: { $in: postIds } }),
      Post.deleteMany({ _id: { $in: postIds } }),
    ])
  }
  await group.deleteOne()
  res.json({ message: 'Group deleted successfully.' })
})

const getGroupMembers = asyncHandler(async (req, res) => {
  const { q, limit, offset, cursor } = req.validated.query
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  if (group.privacy === 'private' && !getMemberEntry(group, req.user._id) && req.user.role !== 'admin') {
    throw new AppError('Group access denied.', 403)
  }
  const query = q.trim().toLowerCase()
  const filtered = (group.members || [])
    .filter((entry) => (entry.status || 'active') === 'active')
    .filter((entry) => {
      if (!query) {
        return true
      }
      const firstName = (entry.user?.firstName || '').toLowerCase()
      const lastName = (entry.user?.lastName || '').toLowerCase()
      return `${firstName} ${lastName}`.includes(query)
    })
    .sort((left, right) => new Date(right.joinedAt || 0) - new Date(left.joinedAt || 0))

  let paged = filtered
  if (cursor) {
    const cursorDate = new Date(cursor)
    paged = filtered.filter((entry) => {
      const joinedAt = new Date(entry.joinedAt || 0)
      return joinedAt < cursorDate
    })
  } else if (offset > 0) {
    paged = filtered.slice(offset)
  }

  const limited = paged.slice(0, limit + 1)
  const hasMore = limited.length > limit
  const trimmed = hasMore ? limited.slice(0, limit) : limited

  const members = trimmed
    .map((entry) => ({
      userId: entry.user?._id || entry.user,
      firstName: entry.user?.firstName || '',
      lastName: entry.user?.lastName || '',
      avatarUrl: entry.user?.avatarUrl || '',
      role: entry.role,
    }))

  res.json({
    members,
    pagination: {
      hasMore,
      nextOffset: hasMore && !cursor ? offset + limit : null,
      nextCursor: hasMore
        ? trimmed[trimmed.length - 1]?.joinedAt?.toISOString?.() || null
        : null,
    },
  })
})

const listGroupsFeed = asyncHandler(async (req, res) => {
  const { groupIds } = req.validated.body
  const { limit, offset } = req.validated.query
  const dedupedGroupIds = [...new Set(groupIds)]

  const groups = await Group.find({ _id: { $in: dedupedGroupIds } })
    .select('privacy members.user members.status')
    .lean()

  const accessibleGroupIds = groups
    .filter((group) => {
      if (group.privacy !== 'private') {
        return true
      }
      if (req.user.role === 'admin') {
        return true
      }

      return (group.members || []).some((entry) => (
        entry?.user?.toString?.() === req.user._id.toString() &&
        (entry?.status || 'active') === 'active'
      ))
    })
    .map((group) => group._id)

  if (!accessibleGroupIds.length) {
    res.json({ posts: [], pagination: { hasMore: false, nextOffset: null } })
    return
  }

  const posts = await Post.find({
    group: { $in: accessibleGroupIds },
    'moderation.visibility': 'visible',
    'groupModeration.status': 'approved',
  })
    .select('author group title slug text media contentType privacy publication moderation stats likedByUserIds savedByUserIds sharedByUserIds createdAt updatedAt')
    .populate('author', 'firstName lastName username avatarUrl verification')
    .populate('group', 'name slug privacy coverImageUrl')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit + 1)
    .lean()

  const hasMore = posts.length > limit
  const trimmed = hasMore ? posts.slice(0, limit) : posts

  res.json({
    posts: trimmed.map((post) => serializePostForViewer(post, req.user)),
    pagination: {
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    },
  })
})

const updateMemberRole = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId, { populateMembers: false })
  if (!canManageGroupSettings(group, req.user)) {
    throw new AppError('You do not have permission to manage roles.', 403)
  }

  const targetEntry = group.members.find(
    (entry) => resolveEntryUserId(entry) === req.validated.params.userId && (entry.status || 'active') === 'active',
  )
  if (!targetEntry) {
    throw new AppError('Member not found.', 404)
  }
  if (targetEntry.role === 'owner') {
    throw new AppError('Owner role cannot be changed.', 400)
  }

  targetEntry.role = req.validated.body.role
  await group.save()
  res.json({ message: 'Member role updated successfully.' })
})

const removeMember = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  if (!canModerateGroup(group, req.user)) {
    throw new AppError('You do not have permission to remove members.', 403)
  }

  const targetEntry = group.members.find(
    (entry) => resolveEntryUserId(entry) === req.validated.params.userId && (entry.status || 'active') === 'active',
  )
  if (!targetEntry) {
    throw new AppError('Member not found.', 404)
  }
  if (targetEntry.role === 'owner') {
    throw new AppError('Owner cannot be removed.', 400)
  }

  targetEntry.status = 'removed'
  targetEntry.role = 'member'
  group.stats.memberCount = Math.max(((group.stats && group.stats.memberCount) || 1) - 1, 0)
  await group.save()
  res.json({ message: 'Member removed from group.' })
})

const listGroupPosts = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId, { populateMembers: false })
  const isMember = Boolean(getMemberEntry(group, req.user._id))
  if (group.privacy === 'private' && !isMember && req.user.role !== 'admin') {
    throw new AppError('Group access denied.', 403)
  }

  const posts = await Post.find({
    group: group._id,
    'moderation.visibility': 'visible',
    'groupModeration.status': 'approved',
  })
    .select('author group title slug text media contentType privacy publication moderation stats likedByUserIds savedByUserIds sharedByUserIds createdAt updatedAt')
    .populate('author', 'firstName lastName username avatarUrl verification')
    .populate('group', 'name slug privacy coverImageUrl')
    .sort({ createdAt: -1 })
    .skip(req.validated.query.offset)
    .limit(req.validated.query.limit)
    .lean()

  res.json({
    posts: posts.map((post) => serializePostForViewer(post, req.user)),
  })
})

const createGroupPost = asyncHandler(async (req, res) => {
  let shouldCleanupUploadedFiles = true
  try {
    const group = await getGroupByIdOrThrow(req.validated.params.groupId)
    if (!getMemberEntry(group, req.user._id) && req.user.role !== 'admin') {
      throw new AppError('Only group members can share posts.', 403)
    }

    const media = await buildMediaItems(req.files || [], { contentType: 'post' })
    const title = sanitizeTitle(req.body?.title || '')
    const text = `${req.body?.text || ''}`.trim()
    if (!text && !media.length) {
      throw new AppError('Post text or media is required.', 400)
    }

    const requiresApproval = Boolean(group.postApprovalRequired) && !canModerateGroup(group, req.user)
    const slugSource = title || text.slice(0, 80)
    const post = await Post.create({
      author: req.user._id,
      group: group._id,
      title,
      slug: slugSource ? await buildUniquePostSlug(slugSource) : null,
      text,
      media,
      contentType: 'post',
      privacy: 'public',
      groupModeration: {
        status: requiresApproval ? 'pending' : 'approved',
        reviewedAt: requiresApproval ? null : new Date(),
        reviewedBy: requiresApproval ? null : req.user._id,
      },
    })
    shouldCleanupUploadedFiles = false

    const populatedPost = await Post.findById(post._id)
      .populate('author', 'firstName lastName username avatarUrl verification')
      .populate('group', 'name slug privacy coverImageUrl')

    res.status(201).json({
      message: requiresApproval
        ? 'Post submitted for approval.'
        : 'Post created successfully.',
      post: serializePostForViewer(populatedPost, req.user),
      pendingApproval: requiresApproval,
    })
  } catch (error) {
    if (shouldCleanupUploadedFiles) {
      await removeUploadedFiles(req.files)
    }
    throw error
  }
})

const listPendingPosts = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId, { populateMembers: false })
  if (!canModerateGroup(group, req.user)) {
    throw new AppError('You do not have permission to view pending posts.', 403)
  }
  const posts = await Post.find({
    group: group._id,
    'groupModeration.status': 'pending',
    'moderation.visibility': 'visible',
  })
    .select('author group title slug text media contentType privacy publication moderation stats likedByUserIds savedByUserIds sharedByUserIds createdAt updatedAt')
    .populate('author', 'firstName lastName username avatarUrl verification')
    .populate('group', 'name slug privacy coverImageUrl')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()

  res.json({ posts: posts.map((post) => serializePostForViewer(post, req.user)) })
})

const approvePendingPost = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  if (!canModerateGroup(group, req.user)) {
    throw new AppError('You do not have permission to approve posts.', 403)
  }
  const post = await Post.findOne({
    _id: req.validated.params.postId,
    group: group._id,
    'groupModeration.status': 'pending',
  })
  if (!post) {
    throw new AppError('Pending post not found.', 404)
  }
  post.groupModeration.status = 'approved'
  post.groupModeration.reviewedAt = new Date()
  post.groupModeration.reviewedBy = req.user._id
  await post.save()
  res.json({ message: 'Post approved successfully.' })
})

const rejectPendingPost = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  if (!canModerateGroup(group, req.user)) {
    throw new AppError('You do not have permission to reject posts.', 403)
  }
  const post = await Post.findOne({
    _id: req.validated.params.postId,
    group: group._id,
    'groupModeration.status': 'pending',
  })
  if (!post) {
    throw new AppError('Pending post not found.', 404)
  }
  post.groupModeration.status = 'rejected'
  post.groupModeration.reviewedAt = new Date()
  post.groupModeration.reviewedBy = req.user._id
  await post.save()
  res.json({ message: 'Post rejected successfully.' })
})

const joinGroup = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  const existing = group.members.find((entry) => resolveEntryUserId(entry) === req.user._id.toString())
  if (existing && (existing.status || 'active') === 'active') {
    res.json({ message: 'You are already a group member.' })
    return
  }
  const shouldRequireApproval = Boolean(group.joinApprovalRequired)

  if (shouldRequireApproval) {
    if (existing) {
      existing.status = 'pending'
      existing.role = 'member'
      existing.joinedAt = new Date()
    } else {
      group.members.push({
        user: req.user._id,
        role: 'member',
        status: 'pending',
        joinedAt: new Date(),
      })
    }
    await group.save()
    res.json({
      message: 'Join request submitted and pending approval.',
      pendingApproval: true,
    })
    return
  }

  if (existing) {
    existing.status = 'active'
    existing.role = existing.role || 'member'
    existing.joinedAt = new Date()
  } else {
    group.members.push({
      user: req.user._id,
      role: 'member',
      status: 'active',
      joinedAt: new Date(),
    })
  }
  group.stats.memberCount = (group.members || []).filter((entry) => (entry.status || 'active') === 'active').length
  await group.save()
  res.json({ message: 'Joined group successfully.', pendingApproval: false })
})

const leaveGroup = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  const existing = group.members.find((entry) => resolveEntryUserId(entry) === req.user._id.toString())
  if (!existing || !['active', 'pending'].includes(existing.status || 'active')) {
    throw new AppError('You are not a member of this group.', 400)
  }
  if (existing.role === 'owner') {
    throw new AppError('Group owner cannot leave the group.', 400)
  }
  const wasActive = (existing.status || 'active') === 'active'
  existing.status = 'removed'
  existing.role = 'member'
  if (wasActive) {
    group.stats.memberCount = Math.max(((group.stats && group.stats.memberCount) || 1) - 1, 0)
  }
  await group.save()
  res.json({ message: 'Left group successfully.' })
})

const listJoinRequests = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  if (!canModerateGroup(group, req.user)) {
    throw new AppError('You do not have permission to view join requests.', 403)
  }

  const requests = (group.members || [])
    .filter((entry) => (entry.status || 'active') === 'pending')
    .map((entry) => ({
      userId: entry.user?._id || entry.user,
      firstName: entry.user?.firstName || '',
      lastName: entry.user?.lastName || '',
      username: entry.user?.username || '',
      avatarUrl: entry.user?.avatarUrl || '',
      requestedAt: entry.joinedAt || null,
    }))

  res.json({ requests, members: requests })
})

const approveJoinRequest = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  if (!canModerateGroup(group, req.user)) {
    throw new AppError('You do not have permission to approve join requests.', 403)
  }
  const requestEntry = (group.members || []).find(
    (entry) => resolveEntryUserId(entry) === req.validated.params.userId && (entry.status || 'active') === 'pending',
  )
  if (!requestEntry) {
    throw new AppError('Join request not found.', 404)
  }
  requestEntry.status = 'active'
  requestEntry.role = 'member'
  group.stats.memberCount = (group.members || []).filter((entry) => (entry.status || 'active') === 'active').length
  await group.save()
  res.json({ message: 'Join request approved.' })
})

const rejectJoinRequest = asyncHandler(async (req, res) => {
  const group = await getGroupByIdOrThrow(req.validated.params.groupId)
  if (!canModerateGroup(group, req.user)) {
    throw new AppError('You do not have permission to reject join requests.', 403)
  }
  const requestEntry = (group.members || []).find(
    (entry) => resolveEntryUserId(entry) === req.validated.params.userId && (entry.status || 'active') === 'pending',
  )
  if (!requestEntry) {
    throw new AppError('Join request not found.', 404)
  }
  requestEntry.status = 'removed'
  requestEntry.role = 'member'
  await group.save()
  res.json({ message: 'Join request rejected.' })
})

module.exports = {
  createGroup,
  listSidebarGroups,
  listGroupsFeed,
  getGroupBySlug,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  updateMemberRole,
  removeMember,
  listGroupPosts,
  createGroupPost,
  listPendingPosts,
  approvePendingPost,
  rejectPendingPost,
  joinGroup,
  leaveGroup,
  listJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
}
