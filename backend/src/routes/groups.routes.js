const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const { validateRequest } = require('../middlewares/validateRequest')
const { createUploadMiddleware } = require('../middlewares/uploadMedia')
const {
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
} = require('../controllers/groupsController')
const {
  listGroupsSchema,
  groupsFeedSchema,
  createGroupSchema,
  groupSlugSchema,
  groupIdSchema,
  updateGroupSchema,
  groupMembersSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
  groupPostsSchema,
  createGroupPostSchema,
  postApprovalActionSchema,
  joinRequestActionSchema,
} = require('../validators/groupValidators')

const groupsRouter = express.Router()
const uploadGroupPostMedia = createUploadMiddleware('posts', 4)

groupsRouter.get('/sidebar', authenticate, validateRequest(listGroupsSchema), listSidebarGroups)
groupsRouter.post('/feed', authenticate, validateRequest(groupsFeedSchema), listGroupsFeed)
groupsRouter.post('/', authenticate, validateRequest(createGroupSchema), createGroup)
groupsRouter.get('/slug/:slug', authenticate, validateRequest(groupSlugSchema), getGroupBySlug)
groupsRouter.patch('/:groupId', authenticate, validateRequest(updateGroupSchema), updateGroup)
groupsRouter.delete('/:groupId', authenticate, validateRequest(groupIdSchema), deleteGroup)
groupsRouter.post('/:groupId/join', authenticate, validateRequest(groupIdSchema), joinGroup)
groupsRouter.post('/:groupId/leave', authenticate, validateRequest(groupIdSchema), leaveGroup)
groupsRouter.get('/:groupId/join-requests', authenticate, validateRequest(groupIdSchema), listJoinRequests)
groupsRouter.post(
  '/:groupId/join-requests/:userId/approve',
  authenticate,
  validateRequest(joinRequestActionSchema),
  approveJoinRequest,
)
groupsRouter.post(
  '/:groupId/join-requests/:userId/reject',
  authenticate,
  validateRequest(joinRequestActionSchema),
  rejectJoinRequest,
)
groupsRouter.get('/:groupId/members', authenticate, validateRequest(groupMembersSchema), getGroupMembers)
groupsRouter.patch(
  '/:groupId/members/:userId/role',
  authenticate,
  validateRequest(updateMemberRoleSchema),
  updateMemberRole,
)
groupsRouter.delete(
  '/:groupId/members/:userId',
  authenticate,
  validateRequest(removeMemberSchema),
  removeMember,
)
groupsRouter.get('/:groupId/posts', authenticate, validateRequest(groupPostsSchema), listGroupPosts)
groupsRouter.post(
  '/:groupId/posts',
  authenticate,
  validateRequest(createGroupPostSchema),
  uploadGroupPostMedia,
  createGroupPost,
)
groupsRouter.get(
  '/:groupId/pending-posts',
  authenticate,
  validateRequest(groupIdSchema),
  listPendingPosts,
)
groupsRouter.post(
  '/:groupId/pending-posts/:postId/approve',
  authenticate,
  validateRequest(postApprovalActionSchema),
  approvePendingPost,
)
groupsRouter.post(
  '/:groupId/pending-posts/:postId/reject',
  authenticate,
  validateRequest(postApprovalActionSchema),
  rejectPendingPost,
)

module.exports = { groupsRouter }
