const express = require('express')
const { validateRequest } = require('../middlewares/validateRequest')
const {
  authenticate,
  authenticateOptional,
} = require('../middlewares/authenticate')
const { createUploadMiddleware } = require('../middlewares/uploadMedia')
const { createLoopUploadTicket } = require('../controllers/loopUploadsController')
const {
  createPost,
  getFeed,
  getTrendingTopics,
  getPostById,
  registerPostView,
  recordLoopTelemetry,
  createComment,
  getPostLikes,
  getPostInsights,
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
} = require('../controllers/postsController')
const {
  updatePostSchema,
  feedSchema,
  trendsSchema,
  postIdSchema,
  getPostLikesSchema,
  registerPostViewSchema,
  loopTelemetrySchema,
  commentIdParamsSchema,
  updateCommentSchema,
} = require('../validators/postValidators')

const postsRouter = express.Router()
const uploadPostMedia = createUploadMiddleware('posts', 4, {
  allowLargeLoopVideo: true,
})
const uploadCommentMedia = createUploadMiddleware('comments', 1)

postsRouter.get('/feed', authenticateOptional, validateRequest(feedSchema), getFeed)
postsRouter.get('/trends', authenticateOptional, validateRequest(trendsSchema), getTrendingTopics)
postsRouter.post('/loop-upload-ticket', authenticate, createLoopUploadTicket)
postsRouter.post(
  '/comments/:commentId/like',
  authenticate,
  validateRequest(commentIdParamsSchema),
  toggleCommentLike,
)
postsRouter.post(
  '/comments/:commentId/save',
  authenticate,
  validateRequest(commentIdParamsSchema),
  toggleCommentSave,
)
postsRouter.post(
  '/comments/:commentId/share',
  authenticate,
  validateRequest(commentIdParamsSchema),
  toggleCommentShare,
)
postsRouter.patch(
  '/comments/:commentId',
  authenticate,
  validateRequest(updateCommentSchema),
  updateComment,
)
postsRouter.delete(
  '/comments/:commentId',
  authenticate,
  validateRequest(commentIdParamsSchema),
  deleteComment,
)
postsRouter.get('/:postId', authenticateOptional, validateRequest(postIdSchema), getPostById)
postsRouter.post(
  '/:postId/view',
  authenticateOptional,
  validateRequest(registerPostViewSchema),
  registerPostView,
)
postsRouter.post(
  '/:postId/loop-telemetry',
  authenticateOptional,
  validateRequest(loopTelemetrySchema),
  recordLoopTelemetry,
)
postsRouter.get(
  '/:postId/likes',
  authenticateOptional,
  validateRequest(getPostLikesSchema),
  getPostLikes,
)
postsRouter.get(
  '/:postId/insights',
  authenticate,
  validateRequest(postIdSchema),
  getPostInsights,
)
postsRouter.post(
  '/:postId/like',
  authenticate,
  validateRequest(postIdSchema),
  togglePostLike,
)
postsRouter.post(
  '/:postId/save',
  authenticate,
  validateRequest(postIdSchema),
  togglePostSave,
)
postsRouter.post(
  '/:postId/share',
  authenticate,
  validateRequest(postIdSchema),
  togglePostShare,
)
postsRouter.post(
  '/:postId/not-interested',
  authenticate,
  validateRequest(postIdSchema),
  markPostNotInterested,
)
postsRouter.post(
  '/:postId/archive',
  authenticate,
  validateRequest(postIdSchema),
  togglePostArchive,
)
postsRouter.post(
  '/:postId/comments',
  authenticate,
  validateRequest(postIdSchema),
  uploadCommentMedia,
  createComment,
)
postsRouter.post('/', authenticate, uploadPostMedia, createPost)
postsRouter.patch('/:postId', authenticate, validateRequest(updatePostSchema), updatePost)
postsRouter.delete('/:postId', authenticate, validateRequest(postIdSchema), deletePost)

module.exports = { postsRouter }
