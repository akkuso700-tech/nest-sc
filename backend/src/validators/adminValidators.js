const { z } = require('zod')

const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.enum(['user', 'moderator', 'admin']),
  }),
  params: z.object({
    userId: z.string().trim().min(1),
  }),
  query: z.object({}).default({}),
})

const updateUserStatusSchema = z.object({
  body: z.object({
    accountStatus: z.enum(['active', 'suspended']),
    reason: z.string().trim().max(280).optional().default(''),
  }),
  params: z.object({
    userId: z.string().trim().min(1),
  }),
  query: z.object({}).default({}),
})

const adminListUsersSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().max(120).optional().default(''),
    role: z.enum(['all', 'user', 'moderator', 'admin']).optional().default('all'),
    accountStatus: z.enum(['all', 'active', 'suspended']).optional().default('all'),
    country: z.string().trim().max(80).optional().default(''),
    sortBy: z.enum(['createdAt', 'lastLoginAt']).optional().default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(12),
  }),
})

const adminUserIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    userId: z.string().trim().min(1),
  }),
  query: z.object({}).default({}),
})

const adminUsersSummarySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    period: z.enum(['today', '7d', '30d', 'custom']).optional().default('7d'),
    dateFrom: z.string().trim().max(40).optional().default(''),
    dateTo: z.string().trim().max(40).optional().default(''),
  }),
})

const adminContentSummarySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    period: z.enum(['today', '7d', '30d', 'custom']).optional().default('7d'),
    dateFrom: z.string().trim().max(40).optional().default(''),
    dateTo: z.string().trim().max(40).optional().default(''),
  }),
})

const adminListContentSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().max(120).optional().default(''),
    privacy: z.enum(['all', 'public', 'followers', 'private']).optional().default('all'),
    contentType: z.enum(['all', 'post', 'loop', 'story']).optional().default('all'),
    mediaKind: z.enum(['all', 'media', 'text']).optional().default('all'),
    visibility: z.enum(['all', 'visible', 'hidden', 'removed']).optional().default('all'),
    sortBy: z
      .enum(['createdAt', 'contentType', 'privacy', 'views'])
      .optional()
      .default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(12),
  }),
})

const updatePostModerationSchema = z.object({
  body: z.object({
    visibility: z.enum(['visible', 'hidden', 'removed']),
    reason: z.string().trim().max(280).optional().default(''),
  }),
  params: z.object({
    postId: z.string().trim().min(1),
  }),
  query: z.object({}).default({}),
})

const bulkUserStatusSchema = z.object({
  body: z.object({
    userIds: z.array(z.string().trim().min(1)).min(1).max(100),
    accountStatus: z.enum(['active', 'suspended']),
    reason: z.string().trim().max(280).optional().default(''),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const bulkUserDeleteSchema = z.object({
  body: z.object({
    userIds: z.array(z.string().trim().min(1)).min(1).max(100),
    reason: z.string().trim().max(280).optional().default(''),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const bulkPostModerationSchema = z.object({
  body: z.object({
    postIds: z.array(z.string().trim().min(1)).min(1).max(100),
    visibility: z.enum(['visible', 'hidden', 'removed']),
    reason: z.string().trim().max(280).optional().default(''),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const adminListCommentsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().max(120).optional().default(''),
    visibility: z.enum(['all', 'visible', 'hidden', 'removed']).optional().default('all'),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(12),
  }),
})

const updateCommentModerationSchema = z.object({
  body: z.object({
    visibility: z.enum(['visible', 'hidden', 'removed']),
    reason: z.string().trim().max(280).optional().default(''),
  }),
  params: z.object({
    commentId: z.string().trim().min(1),
  }),
  query: z.object({}).default({}),
})

const adminListReportsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    status: z.enum(['all', 'open', 'in_review', 'resolved', 'dismissed']).optional().default('all'),
    targetKind: z.enum(['all', 'user', 'post', 'comment', 'message']).optional().default('all'),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(12),
  }),
})

const updateReportStatusSchema = z.object({
  body: z.object({
    status: z.enum(['open', 'in_review', 'resolved', 'dismissed']),
    resolutionNote: z.string().trim().max(500).optional().default(''),
  }),
  params: z.object({
    reportId: z.string().trim().min(1),
  }),
  query: z.object({}).default({}),
})

const adminListAuditLogsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().max(120).optional().default(''),
    action: z.string().trim().max(120).optional().default(''),
    actor: z.string().trim().max(120).optional().default(''),
    targetKind: z.enum(['all', 'user', 'post', 'comment', 'report', 'system']).optional().default('all'),
    targetId: z.string().trim().max(80).optional().default(''),
    dateFrom: z.string().trim().max(40).optional().default(''),
    dateTo: z.string().trim().max(40).optional().default(''),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(15),
  }),
})

const adminSignupNotificationSettingsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const contractSectionSchema = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(12000),
})

const contractLanguageSchema = z.object({
  terms: contractSectionSchema,
  cookies: contractSectionSchema,
  privacy: contractSectionSchema,
})

const updateAdminSignupNotificationSettingsSchema = z.object({
  body: z.object({
    emails: z
      .array(z.string().trim().email())
      .max(30)
      .optional()
      .default([]),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const adminSignupContractsSettingsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const updateAdminSignupContractsSettingsSchema = z.object({
  body: z.object({
    contracts: z.record(
      z.string().trim().regex(/^[a-z]{2}(?:-[a-z]{2})?$/),
      contractLanguageSchema,
    ),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

module.exports = {
  updateUserRoleSchema,
  updateUserStatusSchema,
  adminListUsersSchema,
  adminUsersSummarySchema,
  adminContentSummarySchema,
  adminUserIdSchema,
  adminListContentSchema,
  updatePostModerationSchema,
  bulkUserStatusSchema,
  bulkUserDeleteSchema,
  bulkPostModerationSchema,
  adminListCommentsSchema,
  updateCommentModerationSchema,
  adminListReportsSchema,
  updateReportStatusSchema,
  adminListAuditLogsSchema,
  adminSignupNotificationSettingsSchema,
  updateAdminSignupNotificationSettingsSchema,
  adminSignupContractsSettingsSchema,
  updateAdminSignupContractsSettingsSchema,
}
