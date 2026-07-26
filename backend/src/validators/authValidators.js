const { z } = require('zod')

function adultDateSchema() {
  return z.coerce.date().refine((value) => {
    const minimumBirthDate = new Date()
    minimumBirthDate.setFullYear(minimumBirthDate.getFullYear() - 18)
    return value <= minimumBirthDate
  }, 'Users must be at least 18 years old.')
}

const registerSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(15),
    lastName: z.string().trim().min(2).max(15),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    birthDate: adultDateSchema(),
    username: z.string().trim().min(3).max(30).optional(),
    locale: z.string().trim().min(2).max(10).optional().default('tr'),
    signupConsentVersion: z.string().trim().min(1).max(60).optional(),
    signupConsentText: z.string().trim().min(1).max(10000).optional(),
    location: z
      .object({
        country: z.string().trim().min(2).max(80),
        city: z.string().trim().max(80).optional().default(''),
      })
      .optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const loginSchema = z.object({
  body: z.object({
    emailOrUsername: z.string().trim().min(3).max(160),
    password: z.string().min(8).max(128),
    rememberMe: z.boolean().optional().default(true),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const loginIdentifierSchema = z.object({
  body: z.object({
    emailOrUsername: z.string().trim().min(3).max(160),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const passwordResetRequestSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const passwordResetConfirmSchema = z.object({
  body: z.object({
    token: z.string().trim().min(20),
    newPassword: z.string().min(8).max(128),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const emailAvailabilitySchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const signupVerificationSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    code: z.string().trim().min(4).max(12),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const signupRequestCodeSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

module.exports = {
  registerSchema,
  signupVerificationSchema,
  signupRequestCodeSchema,
  loginSchema,
  loginIdentifierSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  emailAvailabilitySchema,
}
