const path = require('path')
const dotenv = require('dotenv')
const ms = require('ms')
const { z } = require('zod')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const envSource = { ...process.env }

if (envSource.NODE_ENV !== 'production') {
  envSource.JWT_ACCESS_SECRET =
    envSource.JWT_ACCESS_SECRET || 'dev-access-secret-change-me'
  envSource.JWT_REFRESH_SECRET =
    envSource.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me'
  envSource.JWT_PASSWORD_RESET_SECRET =
    envSource.JWT_PASSWORD_RESET_SECRET || 'dev-password-reset-secret-change-me'
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'undefined') {
    return fallback
  }

  return value === 'true'
}

function parseDuration(value, label) {
  const parsed = ms(value)

  if (typeof parsed !== 'number') {
    throw new Error(`${label} must be a valid duration string.`)
  }

  return parsed
}

function normalizeOriginValue(value) {
  const rawValue = String(value || '').trim()

  if (!rawValue) {
    return ''
  }

  try {
    const parsedUrl = new URL(rawValue)
    return parsedUrl.origin.toLowerCase()
  } catch {
    return rawValue.replace(/\/+$/, '').toLowerCase()
  }
}

function buildOriginVariants(origin) {
  const normalizedOrigin = normalizeOriginValue(origin)

  if (!normalizedOrigin) {
    return []
  }

  let parsedUrl = null

  try {
    parsedUrl = new URL(normalizedOrigin)
  } catch {
    return [normalizedOrigin]
  }

  const hostName = parsedUrl.hostname.toLowerCase()
  const variants = new Set([normalizedOrigin])

  if (hostName.startsWith('www.')) {
    variants.add(`${parsedUrl.protocol}//${hostName.slice(4)}${parsedUrl.port ? `:${parsedUrl.port}` : ''}`)
  } else {
    variants.add(`${parsedUrl.protocol}//www.${hostName}${parsedUrl.port ? `:${parsedUrl.port}` : ''}`)
  }

  return [...variants]
}

function optionalTrimmedString(minLength = 1) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value
      }

      const trimmedValue = value.trim()
      return trimmedValue ? trimmedValue : undefined
    },
    z.string().min(minLength).optional(),
  )
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  UPLOADS_DIR: z.string().optional(),
  UPLOAD_DIR: z.string().optional(),
  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://127.0.0.1:27017/my-social-1'),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'hostinger']).default('local'),
  S3_BUCKET: optionalTrimmedString(3),
  S3_REGION: optionalTrimmedString(2),
  S3_ENDPOINT: optionalTrimmedString(8),
  S3_PUBLIC_BASE_URL: optionalTrimmedString(8),
  S3_ACCESS_KEY_ID: optionalTrimmedString(3),
  S3_SECRET_ACCESS_KEY: optionalTrimmedString(8),
  S3_PREFIX: optionalTrimmedString(2),
  S3_OBJECT_ACL: optionalTrimmedString(3),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  HOSTINGER_UPLOAD_URL: optionalTrimmedString(10),
  HOSTINGER_UPLOAD_TOKEN: optionalTrimmedString(12),
  HOSTINGER_PUBLIC_BASE_URL: optionalTrimmedString(10),
  HOSTINGER_UPLOAD_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  EMAIL_PROVIDER: z.enum(['disabled', 'resend']).default('disabled'),
  EMAIL_FROM: optionalTrimmedString(6),
  RESEND_API_KEY: optionalTrimmedString(10),
  ADMIN_SIGNUP_NOTIFICATION_EMAILS: z.string().optional(),
  EMAIL_VERIFICATION_PEPPER: optionalTrimmedString(8),
  EMAIL_VERIFICATION_TTL: z.string().default('10m'),
  GOOGLE_CLIENT_ID: optionalTrimmedString(10),
  GOOGLE_CLIENT_SECRET: optionalTrimmedString(10),
  GOOGLE_REDIRECT_URI: optionalTrimmedString(10),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_PASSWORD_RESET_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_PASSWORD_RESET_EXPIRES_IN: z.string().default('30m'),
  RATE_LIMIT_WINDOW: z.string().default('15m'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  LOOP_TRANSCODE_ENABLED: z.string().optional(),
  LOOP_HLS_ENABLED: z.string().optional(),
  LOOP_PROCESSING_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  FFMPEG_PATH: optionalTrimmedString(2),
  FFPROBE_PATH: optionalTrimmedString(2),
  LOOP_TRANSCODE_VIDEO_BITRATE_KBPS: z.coerce.number().int().positive().default(2200),
  LOOP_TRANSCODE_AUDIO_BITRATE_KBPS: z.coerce.number().int().positive().default(128),
  LOOP_ASYNC_PROCESSING_ENABLED: z.string().optional(),
  LOOP_WORKER_MODE: z.enum(['embedded', 'external', 'disabled']).default('embedded'),
  LOOP_MAX_DURATION_SECONDS: z.coerce.number().int().positive().default(90),
  LOOP_WORKER_POLL_MS: z.coerce.number().int().positive().default(2000),
  LOOP_WORKER_STARTUP_GRACE_MS: z.coerce.number().int().min(0).default(0),
  LOOP_WORKER_LEASE_MS: z.coerce.number().int().positive().default(20 * 60 * 1000),
  LOOP_WORKER_STALE_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  LOOP_WORKER_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  LOOP_WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  LOOP_RAW_BACKFILL_LIMIT: z.coerce.number().int().min(0).max(20).default(0),
  LOOP_BACKFILL_LEADER_LEASE_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  LOOP_BACKFILL_DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().positive().default(2 * 60 * 1000),
  LOOP_BACKFILL_MAX_SOURCE_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),
  LOOP_UPLOAD_CONCURRENCY: z.coerce.number().int().min(1).max(6).default(3),
  LOOP_DIRECT_UPLOAD_ENABLED: z.string().optional(),
  LOOP_DIRECT_UPLOAD_URL: optionalTrimmedString(10),
  LOOP_DIRECT_UPLOAD_SECRET: optionalTrimmedString(32),
  LOOP_DIRECT_UPLOAD_TICKET_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(600),
  LOOP_DIRECT_UPLOAD_CHUNK_BYTES: z.coerce.number().int().min(1024 * 1024).max(16 * 1024 * 1024).default(8 * 1024 * 1024),
  LOOP_HOSTINGER_MEDIA_ROOT: optionalTrimmedString(2),
  REDIS_URL: optionalTrimmedString(5),
  REDIS_HOST: optionalTrimmedString(2),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: optionalTrimmedString(1),
  MESSAGE_NOTIFICATION_QUEUE_ENABLED: z.string().optional(),
  MESSAGE_NOTIFICATION_DELAY_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  MESSAGE_NOTIFICATION_THROTTLE_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
  MESSAGE_NOTIFICATION_WORKER_MODE: z.enum(['embedded', 'external', 'disabled']).default('embedded'),
})

const parsedEnv = envSchema.safeParse(envSource)

if (!parsedEnv.success) {
  console.error('Invalid environment variables:')
  console.error(parsedEnv.error.flatten().fieldErrors)
  process.exit(1)
}

const rawEnv = parsedEnv.data

if (rawEnv.EMAIL_PROVIDER === 'resend' && !rawEnv.RESEND_API_KEY) {
  console.error('Invalid environment variables:')
  console.error({
    RESEND_API_KEY: ['RESEND_API_KEY is required when EMAIL_PROVIDER=resend.'],
  })
  process.exit(1)
}

if (
  rawEnv.STORAGE_PROVIDER === 's3' &&
  (!rawEnv.S3_BUCKET || !rawEnv.S3_ACCESS_KEY_ID || !rawEnv.S3_SECRET_ACCESS_KEY)
) {
  console.error('Invalid environment variables:')
  console.error({
    S3_BUCKET: ['Required when STORAGE_PROVIDER=s3.'],
    S3_ACCESS_KEY_ID: ['Required when STORAGE_PROVIDER=s3.'],
    S3_SECRET_ACCESS_KEY: ['Required when STORAGE_PROVIDER=s3.'],
  })
  process.exit(1)
}

if (
  rawEnv.STORAGE_PROVIDER === 'hostinger' &&
  (!rawEnv.HOSTINGER_UPLOAD_URL || !rawEnv.HOSTINGER_UPLOAD_TOKEN)
) {
  console.error('Invalid environment variables:')
  console.error({
    HOSTINGER_UPLOAD_URL: ['Required when STORAGE_PROVIDER=hostinger.'],
    HOSTINGER_UPLOAD_TOKEN: ['Required when STORAGE_PROVIDER=hostinger.'],
  })
  process.exit(1)
}

if (
  parseBoolean(rawEnv.LOOP_DIRECT_UPLOAD_ENABLED, false) &&
  (!(rawEnv.LOOP_DIRECT_UPLOAD_URL || rawEnv.HOSTINGER_UPLOAD_URL) ||
    !rawEnv.LOOP_DIRECT_UPLOAD_SECRET ||
    !rawEnv.HOSTINGER_PUBLIC_BASE_URL)
) {
  console.error('Invalid environment variables:')
  console.error({
    LOOP_DIRECT_UPLOAD_URL: ['LOOP_DIRECT_UPLOAD_URL or HOSTINGER_UPLOAD_URL is required when direct upload is enabled.'],
    LOOP_DIRECT_UPLOAD_SECRET: ['A separate secret of at least 32 characters is required when direct upload is enabled.'],
    HOSTINGER_PUBLIC_BASE_URL: ['Required when direct upload is enabled.'],
  })
  process.exit(1)
}

const corsOrigins = [
  ...(rawEnv.CORS_ORIGINS
    ? rawEnv.CORS_ORIGINS.split(',').map((item) => item.trim()).filter(Boolean)
    : []),
  rawEnv.CLIENT_URL,
]
  .flatMap((origin) => buildOriginVariants(origin))
  .filter(Boolean)

const uniqueCorsOrigins = [...new Set(corsOrigins)]

const env = {
  nodeEnv: rawEnv.NODE_ENV,
  isProduction: rawEnv.NODE_ENV === 'production',
  isDevelopment: rawEnv.NODE_ENV === 'development',
  port: rawEnv.PORT,
  clientUrl: rawEnv.CLIENT_URL,
  corsOrigins: uniqueCorsOrigins,
  trustProxy: parseBoolean(rawEnv.TRUST_PROXY, rawEnv.NODE_ENV === 'production'),
  uploadsDir: rawEnv.UPLOADS_DIR || rawEnv.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
  mongoUri: rawEnv.MONGODB_URI,
  storageProvider: rawEnv.STORAGE_PROVIDER,
  s3Bucket: rawEnv.S3_BUCKET || undefined,
  s3Region: rawEnv.S3_REGION || 'us-east-1',
  s3Endpoint: rawEnv.S3_ENDPOINT || undefined,
  s3PublicBaseUrl: rawEnv.S3_PUBLIC_BASE_URL || undefined,
  s3AccessKeyId: rawEnv.S3_ACCESS_KEY_ID || undefined,
  s3SecretAccessKey: rawEnv.S3_SECRET_ACCESS_KEY || undefined,
  s3Prefix: rawEnv.S3_PREFIX || 'nest-social',
  s3ObjectAcl: rawEnv.S3_OBJECT_ACL || undefined,
  s3ForcePathStyle: parseBoolean(rawEnv.S3_FORCE_PATH_STYLE, false),
  hostingerUploadUrl: rawEnv.HOSTINGER_UPLOAD_URL || undefined,
  hostingerUploadToken: rawEnv.HOSTINGER_UPLOAD_TOKEN || undefined,
  hostingerPublicBaseUrl: rawEnv.HOSTINGER_PUBLIC_BASE_URL || undefined,
  hostingerUploadTimeoutMs: rawEnv.HOSTINGER_UPLOAD_TIMEOUT_MS,
  emailProvider: rawEnv.EMAIL_PROVIDER,
  emailFrom: rawEnv.EMAIL_FROM || undefined,
  resendApiKey: rawEnv.RESEND_API_KEY || undefined,
  adminSignupNotificationEmails: (rawEnv.ADMIN_SIGNUP_NOTIFICATION_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
  emailVerificationPepper:
    rawEnv.EMAIL_VERIFICATION_PEPPER || rawEnv.JWT_ACCESS_SECRET,
  emailVerificationTtlMs: parseDuration(
    rawEnv.EMAIL_VERIFICATION_TTL,
    'EMAIL_VERIFICATION_TTL',
  ),
  googleClientId: rawEnv.GOOGLE_CLIENT_ID || undefined,
  googleClientSecret: rawEnv.GOOGLE_CLIENT_SECRET || undefined,
  googleRedirectUri: rawEnv.GOOGLE_REDIRECT_URI || undefined,
  rateLimit: {
    windowMs: parseDuration(rawEnv.RATE_LIMIT_WINDOW, 'RATE_LIMIT_WINDOW'),
    max: rawEnv.RATE_LIMIT_MAX,
  },
  loopTranscodeEnabled: parseBoolean(rawEnv.LOOP_TRANSCODE_ENABLED, false),
  loopHlsEnabled: parseBoolean(rawEnv.LOOP_HLS_ENABLED, false),
  loopProcessingTimeoutMs: rawEnv.LOOP_PROCESSING_TIMEOUT_MS,
  ffmpegPath: rawEnv.FFMPEG_PATH || undefined,
  ffprobePath: rawEnv.FFPROBE_PATH || undefined,
  loopTranscodeVideoBitrateKbps: rawEnv.LOOP_TRANSCODE_VIDEO_BITRATE_KBPS,
  loopTranscodeAudioBitrateKbps: rawEnv.LOOP_TRANSCODE_AUDIO_BITRATE_KBPS,
  loopAsyncProcessingEnabled: parseBoolean(rawEnv.LOOP_ASYNC_PROCESSING_ENABLED, true),
  loopWorkerMode: rawEnv.LOOP_WORKER_MODE,
  loopMaxDurationSeconds: rawEnv.LOOP_MAX_DURATION_SECONDS,
  loopWorkerPollMs: rawEnv.LOOP_WORKER_POLL_MS,
  loopWorkerStartupGraceMs: rawEnv.LOOP_WORKER_STARTUP_GRACE_MS,
  loopWorkerLeaseMs: rawEnv.LOOP_WORKER_LEASE_MS,
  loopWorkerStaleMs: rawEnv.LOOP_WORKER_STALE_MS,
  loopWorkerJobTimeoutMs: rawEnv.LOOP_WORKER_JOB_TIMEOUT_MS,
  loopWorkerMaxAttempts: rawEnv.LOOP_WORKER_MAX_ATTEMPTS,
  loopRawBackfillLimit: rawEnv.LOOP_RAW_BACKFILL_LIMIT,
  loopBackfillLeaderLeaseMs: rawEnv.LOOP_BACKFILL_LEADER_LEASE_MS,
  loopBackfillDownloadTimeoutMs: rawEnv.LOOP_BACKFILL_DOWNLOAD_TIMEOUT_MS,
  loopBackfillMaxSourceBytes: rawEnv.LOOP_BACKFILL_MAX_SOURCE_BYTES,
  loopUploadConcurrency: rawEnv.LOOP_UPLOAD_CONCURRENCY,
  loopDirectUploadEnabled: parseBoolean(rawEnv.LOOP_DIRECT_UPLOAD_ENABLED, false),
  loopDirectUploadUrl: rawEnv.LOOP_DIRECT_UPLOAD_URL || rawEnv.HOSTINGER_UPLOAD_URL || undefined,
  loopDirectUploadSecret: rawEnv.LOOP_DIRECT_UPLOAD_SECRET || undefined,
  loopDirectUploadTicketTtlSeconds: rawEnv.LOOP_DIRECT_UPLOAD_TICKET_TTL_SECONDS,
  loopDirectUploadChunkBytes: rawEnv.LOOP_DIRECT_UPLOAD_CHUNK_BYTES,
  loopHostingerMediaRoot: rawEnv.LOOP_HOSTINGER_MEDIA_ROOT || undefined,
  redis: {
    url: rawEnv.REDIS_URL || undefined,
    host: rawEnv.REDIS_HOST || '127.0.0.1',
    port: rawEnv.REDIS_PORT || 6379,
    password: rawEnv.REDIS_PASSWORD || undefined,
  },
  messageNotification: {
    queueEnabled: parseBoolean(rawEnv.MESSAGE_NOTIFICATION_QUEUE_ENABLED, true),
    delayMs: rawEnv.MESSAGE_NOTIFICATION_DELAY_MS,
    throttleMs: rawEnv.MESSAGE_NOTIFICATION_THROTTLE_MS,
    workerMode: rawEnv.MESSAGE_NOTIFICATION_WORKER_MODE,
  },
  jwt: {
    accessSecret: rawEnv.JWT_ACCESS_SECRET,
    refreshSecret: rawEnv.JWT_REFRESH_SECRET,
    passwordResetSecret: rawEnv.JWT_PASSWORD_RESET_SECRET,
    accessExpiresIn: rawEnv.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: rawEnv.JWT_REFRESH_EXPIRES_IN,
    passwordResetExpiresIn: rawEnv.JWT_PASSWORD_RESET_EXPIRES_IN,
    accessExpiresMs: parseDuration(
      rawEnv.JWT_ACCESS_EXPIRES_IN,
      'JWT_ACCESS_EXPIRES_IN',
    ),
    refreshExpiresMs: parseDuration(
      rawEnv.JWT_REFRESH_EXPIRES_IN,
      'JWT_REFRESH_EXPIRES_IN',
    ),
    passwordResetExpiresMs: parseDuration(
      rawEnv.JWT_PASSWORD_RESET_EXPIRES_IN,
      'JWT_PASSWORD_RESET_EXPIRES_IN',
    ),
  },
}

module.exports = { env }
