const { z } = require('zod')

const objectIdSchema = z.string().trim().regex(/^[a-fA-F0-9]{24}$/)

const mediaItemSchema = z.object({
  url: z.string().trim().url(),
  posterUrl: z.string().trim().url().optional(),
  type: z.enum(['image', 'video']),
  durationSeconds: z.coerce.number().int().min(0).max(600).optional(),
})

const basePostBodySchema = z.object({
  title: z.string().trim().max(80).optional().default(''),
  text: z.string().trim().min(1).max(5000),
  media: z.array(mediaItemSchema).max(4).optional().default([]),
  privacy: z.enum(['public', 'followers', 'private']).optional().default('public'),
  contentType: z.enum(['post', 'loop']).optional().default('post'),
})

const createPostSchema = z.object({
  body: basePostBodySchema,
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const updatePostSchema = z.object({
  body: basePostBodySchema.partial().refine(
    (value) =>
      typeof value.text !== 'undefined' ||
      typeof value.title !== 'undefined' ||
      typeof value.media !== 'undefined' ||
      typeof value.privacy !== 'undefined' ||
      typeof value.contentType !== 'undefined',
    'At least one field must be updated.',
  ),
  params: z.object({
    postId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const feedSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    authorId: objectIdSchema.optional(),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    cursor: z.string().trim().min(8).max(2048).optional(),
    topic: z.string().trim().min(2).max(80).optional(),
    view: z.enum(['latest', 'explore', 'following', 'for-you', 'loop']).optional().default('latest'),
    loopMode: z.enum(['explore', 'following', 'for-you']).optional().default('explore'),
  }),
})

const trendsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    limit: z.coerce.number().int().positive().max(20).optional().default(10),
  }),
})

const recommendationContextSchema = z.object({
  sessionId: z.string().trim().min(8).max(64),
  rank: z.coerce.number().int().min(1).max(10000),
  algorithm: z.string().trim().min(1).max(120),
  view: z.enum(['latest', 'explore', 'following', 'for-you', 'loop']),
  loopMode: z.enum(['explore', 'following', 'for-you']).nullable().optional(),
  experiment: z.object({
    id: z.string().trim().min(3).max(80),
    variant: z.enum(['control', 'challenger']),
  }),
})

const postIdSchema = z.object({
  body: z.object({
    recommendation: recommendationContextSchema.optional(),
  }).default({}),
  params: z.object({
    postId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const registerPostViewSchema = z.object({
  body: z
    .object({
      watchRatio: z.coerce.number().min(0).max(1).optional(),
      replayCount: z.coerce.number().int().min(0).max(1000).optional(),
      swipeVelocity: z.coerce.number().min(0).max(20000).optional(),
      visibleMs: z.coerce.number().int().min(0).max(10 * 60 * 1000).optional(),
      recommendation: recommendationContextSchema.optional(),
    })
    .default({}),
  params: z.object({
    postId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const loopTelemetrySchema = z.object({
  body: z.object({
    eventId: z.string().trim().min(8).max(64).optional(),
    eventType: z.enum([
      'waiting',
      'stalled',
      'error',
      'recover-failed',
      'time-gap',
      'dropped-frames',
    ]),
    mediaUrl: z.string().trim().max(2048).optional(),
    currentTimeSec: z.coerce.number().min(0).max(24 * 60 * 60).optional(),
    timeGapMs: z.coerce.number().int().min(0).max(60 * 60 * 1000).optional(),
    droppedFrames: z.coerce.number().int().min(0).max(10 * 1000 * 1000).optional(),
    totalFrames: z.coerce.number().int().min(0).max(100 * 1000 * 1000).optional(),
    network: z.object({
      effectiveType: z.string().trim().max(20).optional(),
      downlinkMbps: z.coerce.number().min(0).max(10000).optional(),
      rttMs: z.coerce.number().int().min(0).max(120000).optional(),
      saveData: z.coerce.boolean().optional(),
    }).optional(),
    device: z.object({
      userAgent: z.string().trim().max(512).optional(),
      platform: z.string().trim().max(64).optional(),
      viewport: z.object({
        width: z.coerce.number().int().min(0).max(10000).optional(),
        height: z.coerce.number().int().min(0).max(10000).optional(),
      }).optional(),
      deviceMemoryGb: z.coerce.number().min(0).max(1024).optional(),
      hardwareConcurrency: z.coerce.number().int().min(0).max(512).optional(),
    }).optional(),
  }).default({}),
  params: z.object({
    postId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const createCommentSchema = z.object({
  body: z.object({
    text: z.string().trim().min(1).max(2000),
    parentCommentId: objectIdSchema.optional(),
  }),
  params: z.object({
    postId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const commentIdParamsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    commentId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const updateCommentSchema = z.object({
  body: z.object({
    text: z.string().trim().min(1).max(2000),
  }),
  params: z.object({
    commentId: objectIdSchema,
  }),
  query: z.object({}).default({}),
})

const getPostLikesSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    postId: objectIdSchema,
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
    q: z.string().trim().max(100).optional().default(''),
  }),
})

module.exports = {
  createPostSchema,
  updatePostSchema,
  feedSchema,
  trendsSchema,
  postIdSchema,
  getPostLikesSchema,
  registerPostViewSchema,
  loopTelemetrySchema,
  createCommentSchema,
  commentIdParamsSchema,
  updateCommentSchema,
}
