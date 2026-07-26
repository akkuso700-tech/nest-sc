const { z } = require('zod')

const createReportSchema = z.object({
  body: z.object({
    targetKind: z.enum(['user', 'post', 'comment', 'message']),
    targetId: z.string().trim().min(1),
    reason: z.string().trim().min(3).max(140),
    details: z.string().trim().max(1000).optional().default(''),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const listMyReportsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    status: z.enum(['all', 'open', 'in_review', 'resolved', 'dismissed']).optional().default('all'),
    targetKind: z.enum(['all', 'user', 'post', 'comment', 'message']).optional().default('all'),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(12),
  }),
})

module.exports = { createReportSchema, listMyReportsSchema }
