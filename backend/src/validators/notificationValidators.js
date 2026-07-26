const { z } = require('zod')

const objectIdSchema = z.string().trim().regex(/^[a-fA-F0-9]{24}$/)
const booleanFromQuerySchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    return value === 'true'
  }

  return value
}, z.boolean())

const listNotificationsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).optional().default(30),
    unreadOnly: booleanFromQuerySchema.optional().default(false),
  }),
})

const notificationIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    notificationId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const emptyNotificationActionSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

module.exports = {
  listNotificationsSchema,
  notificationIdSchema,
  emptyNotificationActionSchema,
}
