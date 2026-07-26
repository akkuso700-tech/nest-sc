const express = require('express')
const { authenticate } = require('../middlewares/authenticate')
const { validateRequest } = require('../middlewares/validateRequest')
const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationsController')
const {
  listNotificationsSchema,
  notificationIdSchema,
  emptyNotificationActionSchema,
} = require('../validators/notificationValidators')

const notificationsRouter = express.Router()

notificationsRouter.use(authenticate)
notificationsRouter.get('/', validateRequest(listNotificationsSchema), listNotifications)
notificationsRouter.patch(
  '/read-all',
  validateRequest(emptyNotificationActionSchema),
  markAllNotificationsRead,
)
notificationsRouter.patch(
  '/:notificationId/read',
  validateRequest(notificationIdSchema),
  markNotificationRead,
)

module.exports = { notificationsRouter }
