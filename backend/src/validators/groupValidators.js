const { z } = require('zod')

const objectIdSchema = z.string().trim().regex(/^[a-fA-F0-9]{24}$/)
const imageSourceSchema = z.preprocess(
  (value) => {
    if (value === null || typeof value === 'undefined') {
      return ''
    }
    return value
  },
  z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value) ||
        /^https?:\/\//.test(value),
      'Image must be a valid URL or data image.',
    ),
)

const listGroupsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().max(80).optional().default(''),
    limit: z.coerce.number().int().min(1).max(30).optional().default(10),
  }),
})

const createGroupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3).max(30),
    privacy: z.enum(['public', 'private']).optional().default('public'),
    about: z.string().trim().max(1200).optional().default(''),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const groupSlugSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    slug: z.string().trim().min(3).max(120),
  }),
  query: z.object({}).default({}),
})

const groupIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    groupId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const updateGroupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3).max(30).optional(),
    about: z.string().trim().max(1200).optional(),
    privacy: z.enum(['public', 'private']).optional(),
    coverImageUrl: imageSourceSchema.optional(),
    postApprovalRequired: z.boolean().optional(),
    joinApprovalRequired: z.boolean().optional(),
  }).refine(
    (value) =>
      typeof value.name !== 'undefined' ||
      typeof value.about !== 'undefined' ||
      typeof value.privacy !== 'undefined' ||
      typeof value.coverImageUrl !== 'undefined' ||
      typeof value.postApprovalRequired !== 'undefined' ||
      typeof value.joinApprovalRequired !== 'undefined',
    'At least one field must be updated.',
  ),
  params: z.object({
    groupId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const groupMembersSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    groupId: objectIdSchema,
  }),
  query: z.object({
    q: z.string().trim().max(80).optional().default(''),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
    cursor: z.string().datetime().optional(),
  }),
})

const groupsFeedSchema = z.object({
  body: z.object({
    groupIds: z.array(objectIdSchema).min(1).max(8),
  }),
  params: z.object({}).default({}),
  query: z.object({
    limit: z.coerce.number().int().positive().max(20).optional().default(4),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
})

const updateMemberRoleSchema = z.object({
  body: z.object({
    role: z.enum(['admin', 'moderator', 'member']),
  }),
  params: z.object({
    groupId: objectIdSchema,
    userId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const removeMemberSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    groupId: objectIdSchema,
    userId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const groupPostsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    groupId: objectIdSchema,
  }),
  query: z.object({
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
})

const createGroupPostSchema = z.object({
  body: z.object({
    title: z.string().trim().max(80).optional(),
    text: z.string().trim().max(5000).optional(),
  }).default({}),
  params: z.object({
    groupId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const postApprovalActionSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    groupId: objectIdSchema,
    postId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const joinRequestActionSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    groupId: objectIdSchema,
    userId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

module.exports = {
  listGroupsSchema,
  createGroupSchema,
  groupSlugSchema,
  groupIdSchema,
  updateGroupSchema,
  groupMembersSchema,
  groupsFeedSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
  groupPostsSchema,
  createGroupPostSchema,
  postApprovalActionSchema,
  joinRequestActionSchema,
}
