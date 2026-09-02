const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const { validateRequest } = require('../middlewares/validateRequest')
const { createUploadMiddleware } = require('../middlewares/uploadMedia')
const {
  sendMessage,
  listConversations,
  listConversationMessages,
  markMessagesRead,
  deleteMessageForCurrentUser,
  updateMessageForCurrentUser,
  hideConversationForCurrentUser,
  blockConversationPeer,
  toggleMessageReaction,
  getLinkPreview,
} = require('../controllers/messagesController')
const {
  listConversationsSchema,
  conversationIdSchema,
  messageIdSchema,
  updateMessageSchema,
  reactMessageSchema,
} = require('../validators/messageValidators')

const messagesRouter = express.Router()
const uploadMessageMedia = createUploadMiddleware('messages', 4)

messagesRouter.use(authenticate)
messagesRouter.get('/link-preview', getLinkPreview)
messagesRouter.get(
  '/conversations',
  validateRequest(listConversationsSchema),
  listConversations,
)
messagesRouter.get(
  '/conversations/:conversationId',
  validateRequest(conversationIdSchema),
  listConversationMessages,
)
messagesRouter.post('/', uploadMessageMedia, sendMessage)
messagesRouter.post(
  '/conversations/:conversationId/read',
  validateRequest(conversationIdSchema),
  markMessagesRead,
)
messagesRouter.post(
  '/conversations/:conversationId/hide',
  validateRequest(conversationIdSchema),
  hideConversationForCurrentUser,
)
messagesRouter.post(
  '/conversations/:conversationId/block',
  validateRequest(conversationIdSchema),
  blockConversationPeer,
)
messagesRouter.patch('/:messageId', validateRequest(updateMessageSchema), updateMessageForCurrentUser)
messagesRouter.post('/:messageId/reactions', validateRequest(reactMessageSchema), toggleMessageReaction)
messagesRouter.delete('/:messageId', validateRequest(messageIdSchema), deleteMessageForCurrentUser)

module.exports = { messagesRouter }
