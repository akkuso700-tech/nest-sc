const { z } = require('zod')
const { env } = require('../config/env')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')
const {
  directUploadEnabled,
  issueLoopUploadTicket,
  normalizeUploadEndpoint,
  publicSourceUrl,
} = require('../services/loopDirectUploadService')

const uploadTicketSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(6).max(100),
  bytes: z.coerce.number().int().positive(),
})

const createLoopUploadTicket = asyncHandler(async (req, res) => {
  if (!directUploadEnabled()) {
    throw new AppError('Direct Loop upload is not enabled.', 503, {
      code: 'LOOP_DIRECT_UPLOAD_DISABLED',
    })
  }

  const result = uploadTicketSchema.safeParse(req.body || {})
  if (!result.success) throw result.error

  const issued = issueLoopUploadTicket({
    userId: req.user._id,
    fileName: result.data.fileName,
    mimeType: result.data.mimeType,
    bytes: result.data.bytes,
  })

  res.status(201).json({
    endpoint: normalizeUploadEndpoint(env.loopDirectUploadUrl),
    ticket: issued.ticket,
    sourceUrl: publicSourceUrl(issued.payload),
    uploadId: issued.payload.uploadId,
    expiresAt: new Date(issued.payload.expiresAt * 1000).toISOString(),
    chunkBytes: env.loopDirectUploadChunkBytes,
  })
})

module.exports = { createLoopUploadTicket }
