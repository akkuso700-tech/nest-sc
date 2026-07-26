const { z } = require('zod')

const searchSuggestSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().min(2).max(40),
    limit: z.coerce.number().int().min(1).max(10).optional().default(6),
  }),
})

const searchResultsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().max(80).optional().default(''),
    tab: z.enum(['all', 'posts', 'popular', 'latest', 'people', 'nearby', 'groups']).optional().default('all'),
    sort: z.enum(['popular', 'latest']).optional().default('popular'),
    limit: z.coerce.number().int().min(1).max(20).optional().default(10),
  }),
})

const searchHistorySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const saveSearchHistorySchema = z.object({
  body: z.object({
    query: z.string().trim().min(1).max(80),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const deleteSearchHistorySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().max(80).optional().default(''),
  }),
})

module.exports = {
  searchSuggestSchema,
  searchResultsSchema,
  searchHistorySchema,
  saveSearchHistorySchema,
  deleteSearchHistorySchema,
}
