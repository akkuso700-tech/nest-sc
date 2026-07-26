const express = require('express')
const { validateRequest } = require('../middlewares/validateRequest')
const { authenticate, authenticateOptional } = require('../middlewares/authenticate')
const { createUploadMiddleware } = require('../middlewares/uploadMedia')
const {
  createStory,
  listStoryRails,
  getStoriesByUsername,
  registerStoryView,
  getStoryViewers,
  deleteStory,
} = require('../controllers/storiesController')
const {
  listStoriesSchema,
  usernameStoriesSchema,
  storyIdSchema,
  storyViewersSchema,
} = require('../validators/storyValidators')

const storiesRouter = express.Router()
const uploadStoryMedia = createUploadMiddleware('stories', 1)

storiesRouter.get('/rails', authenticateOptional, validateRequest(listStoriesSchema), listStoryRails)
storiesRouter.get('/user/:username', authenticateOptional, validateRequest(usernameStoriesSchema), getStoriesByUsername)
storiesRouter.post('/', authenticate, uploadStoryMedia, createStory)
storiesRouter.post('/:storyId/view', authenticateOptional, validateRequest(storyIdSchema), registerStoryView)
storiesRouter.get('/:storyId/viewers', authenticate, validateRequest(storyViewersSchema), getStoryViewers)
storiesRouter.delete('/:storyId', authenticate, validateRequest(storyIdSchema), deleteStory)

module.exports = { storiesRouter }
