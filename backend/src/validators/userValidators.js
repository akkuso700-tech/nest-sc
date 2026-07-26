const { z } = require('zod')

function adultDateSchema() {
  return z.coerce.date().refine((value) => {
    const minimumBirthDate = new Date()
    minimumBirthDate.setFullYear(minimumBirthDate.getFullYear() - 18)
    return value <= minimumBirthDate
  }, 'Users must be at least 18 years old.')
}

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores.')

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

const getProfileSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    username: usernameSchema,
  }),
  query: z.object({}).default({}),
})

const checkUsernameAvailabilitySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    username: usernameSchema,
  }),
})

const searchUsersSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    q: z.string().trim().max(40).optional().default(''),
    limit: z.coerce.number().int().min(1).max(10).optional().default(6),
  }),
})

const discoveryModeSchema = z.enum(['for-you', 'mutual', 'nearby'])

const getDiscoverySuggestionsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    mode: discoveryModeSchema.optional().default('for-you'),
    limit: z.coerce.number().int().min(1).max(12).optional().default(6),
    refresh: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => value === true || value === 'true'),
  }),
})

const updateDiscoveryLocationSchema = z.object({
  body: z
    .object({
      status: z.enum(['granted', 'denied']),
      source: z.string().trim().max(60).optional().default('browser-geolocation'),
      city: z.string().trim().max(80).optional().default(''),
      country: z.string().trim().max(80).optional().default(''),
      latitude: z.coerce.number().min(-90).max(90).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
      accuracy: z.coerce.number().min(0).max(50000).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.status === 'granted') {
        if (typeof value.latitude !== 'number') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['latitude'],
            message: 'Latitude is required when geolocation is granted.',
          })
        }

        if (typeof value.longitude !== 'number') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['longitude'],
            message: 'Longitude is required when geolocation is granted.',
          })
        }
      }
    }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const connectionTypeSchema = z.enum(['followers', 'following'])

const getMyConnectionsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    connectionType: connectionTypeSchema,
  }),
  query: z.object({}).default({}),
})

const getProfileConnectionsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    username: usernameSchema,
    connectionType: connectionTypeSchema,
  }),
  query: z.object({}).default({}),
})

const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(15).optional(),
    lastName: z.string().trim().min(2).max(15).optional(),
    email: z.string().trim().email().optional(),
    username: usernameSchema.optional(),
    birthDate: adultDateSchema().optional(),
    bio: z.string().trim().max(120).optional(),
    avatarUrl: imageSourceSchema.optional(),
    coverUrl: imageSourceSchema.optional(),
    location: z.object({
      city: z.string().trim().max(80).optional().default(''),
      country: z.string().trim().max(80).optional().default(''),
    }).optional(),
    isPrivate: z.boolean().optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8).max(128),
    newPassword: z.string().min(8).max(128),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const deleteAccountSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8).max(128),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

module.exports = {
  getProfileSchema,
  checkUsernameAvailabilitySchema,
  searchUsersSchema,
  getDiscoverySuggestionsSchema,
  updateDiscoveryLocationSchema,
  getMyConnectionsSchema,
  getProfileConnectionsSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
}
