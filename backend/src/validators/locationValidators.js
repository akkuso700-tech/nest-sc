const { z } = require('zod')

const locationAutocompleteSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().min(2).max(60),
    limit: z.coerce.number().int().min(1).max(20).optional().default(8),
    lang: z.enum(['tr', 'en', 'de', 'es']).optional().default('tr'),
  }),
})

module.exports = {
  locationAutocompleteSchema,
}
