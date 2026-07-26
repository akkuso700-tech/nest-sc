const { z } = require('zod')

const objectIdSchema = z.string().trim().regex(/^[a-fA-F0-9]{24}$/)

const mediaSchema = z.object({
  url: z.string().trim().url(),
  type: z.enum(['image', 'video']),
})

const sendMessageSchema = z.object({
  body: z.object({
    recipientId: objectIdSchema,
    text: z.string().trim().min(1).max(5000),
    media: z.array(mediaSchema).max(4).optional().default([]),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const listConversationsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).optional().default(30),
  }),
})

const conversationIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    conversationId: objectIdSchema,
  }),
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).optional().default(50),
  }),
})

const messageIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    messageId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const updateMessageSchema = z.object({
  body: z.object({
    text: z.string().trim().min(1).max(5000),
  }),
  params: z.object({
    messageId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

module.exports = {
  sendMessageSchema,
  listConversationsSchema,
  conversationIdSchema,
  messageIdSchema,
  updateMessageSchema,
}
