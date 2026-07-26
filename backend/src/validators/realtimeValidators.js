const { z } = require('zod')

const syncSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    since: z.string().datetime().optional(),
    limit: z.coerce.number().int().positive().max(100).optional().default(30),
  }),
})

module.exports = { syncSchema }
