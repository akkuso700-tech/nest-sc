const { z } = require('zod')

const listStoriesSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    limit: z.coerce.number().int().positive().max(60).optional().default(30),
  }),
})

const usernameStoriesSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    username: z.string().trim().min(2).max(60),
  }),
  query: z.object({}).default({}),
})

const storyIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    storyId: z.string().trim().regex(/^[a-fA-F0-9]{24}$/),
  }),
  query: z.object({}).default({}),
})

const storyViewersSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    storyId: z.string().trim().regex(/^[a-fA-F0-9]{24}$/),
  }),
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).optional().default(30),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
})

module.exports = {
  listStoriesSchema,
  usernameStoriesSchema,
  storyIdSchema,
  storyViewersSchema,
}
