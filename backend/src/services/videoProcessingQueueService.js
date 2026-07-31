const os = require('os')
const { VideoProcessingJob } = require('../models/VideoProcessingJob')
const { Post } = require('../models/Post')
const { env } = require('../config/env')

function buildWorkerId() {
  return `${os.hostname()}:${process.pid}`
}

async function enqueueLoopVideo({ postId, mediaIndex = 0, sourcePath, originalName, mimeType }) {
  return VideoProcessingJob.findOneAndUpdate(
    { post: postId, mediaIndex },
    {
      $setOnInsert: {
        sourcePath,
        originalName: originalName || 'loop-video',
        mimeType: mimeType || 'video/mp4',
        status: 'queued',
        progress: 0,
        attempts: 0,
        maxAttempts: env.loopWorkerMaxAttempts,
        nextRunAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )
}

async function claimNextLoopVideoJob(workerId = buildWorkerId()) {
  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + env.loopWorkerLeaseMs)

  return VideoProcessingJob.findOneAndUpdate(
    {
      attempts: { $lt: env.loopWorkerMaxAttempts },
      nextRunAt: { $lte: now },
      $or: [
        { status: { $in: ['queued', 'retry'] } },
        { status: 'processing', leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: 'processing',
        workerId,
        leaseExpiresAt,
        startedAt: now,
        errorCode: '',
        errorMessage: '',
      },
      $inc: { attempts: 1 },
    },
    { sort: { nextRunAt: 1, createdAt: 1 }, returnDocument: 'after' },
  )
}

async function updateJobProgress(jobId, progress) {
  const safeProgress = Math.max(0, Math.min(99, Math.round(Number(progress) || 0)))
  await Promise.all([
    VideoProcessingJob.updateOne(
      { _id: jobId, status: 'processing' },
      {
        $set: {
          progress: safeProgress,
          leaseExpiresAt: new Date(Date.now() + env.loopWorkerLeaseMs),
        },
      },
    ),
    VideoProcessingJob.findById(jobId)
      .select('post mediaIndex')
      .lean()
      .then((job) => {
        if (!job) return null
        return Post.updateOne(
          { _id: job.post },
          {
            $set: {
              [`media.${job.mediaIndex}.processing`]: 'processing',
              [`media.${job.mediaIndex}.processingProgress`]: safeProgress,
            },
          },
        )
      }),
  ])
}

async function completeJob(job, mediaResult) {
  const mediaPath = `media.${job.mediaIndex}`
  const updated = await Post.updateOne(
    { _id: job.post, [`${mediaPath}.type`]: 'video' },
    {
      $set: {
        [`${mediaPath}.url`]: mediaResult.url,
        [`${mediaPath}.hlsUrl`]: mediaResult.hlsUrl,
        [`${mediaPath}.posterUrl`]: mediaResult.posterUrl,
        [`${mediaPath}.durationSeconds`]: mediaResult.durationSeconds,
        [`${mediaPath}.width`]: mediaResult.width,
        [`${mediaPath}.height`]: mediaResult.height,
        [`${mediaPath}.processing`]: 'ready',
        [`${mediaPath}.processingProgress`]: 100,
        [`${mediaPath}.processingError`]: '',
        [`${mediaPath}.renditions`]: mediaResult.renditions || [],
      },
    },
  )

  if (!updated.matchedCount) {
    throw Object.assign(new Error('The target post or video no longer exists.'), {
      code: 'POST_NOT_FOUND',
      permanent: true,
    })
  }

  await VideoProcessingJob.updateOne(
    { _id: job._id },
    {
      $set: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        leaseExpiresAt: null,
        errorCode: '',
        errorMessage: '',
      },
    },
  )
}

async function failOrRetryJob(job, error) {
  const isPermanent = Boolean(error?.permanent)
  const exhausted = Number(job.attempts || 0) >= Number(job.maxAttempts || env.loopWorkerMaxAttempts)
  const shouldFail = isPermanent || exhausted
  const retryDelayMs = Math.min(60_000 * 2 ** Math.max(0, Number(job.attempts || 1) - 1), 15 * 60_000)
  const errorCode = String(error?.code || 'VIDEO_PROCESSING_FAILED').slice(0, 80)
  const errorMessage = String(error?.message || 'Video processing failed.').slice(0, 1000)

  await VideoProcessingJob.updateOne(
    { _id: job._id },
    {
      $set: {
        status: shouldFail ? 'failed' : 'retry',
        leaseExpiresAt: null,
        nextRunAt: shouldFail ? new Date() : new Date(Date.now() + retryDelayMs),
        errorCode,
        errorMessage,
      },
    },
  )

  await Post.updateOne(
    { _id: job.post },
    {
      $set: {
        [`media.${job.mediaIndex}.processing`]: shouldFail ? 'failed' : 'queued',
        [`media.${job.mediaIndex}.processingProgress`]: 0,
        [`media.${job.mediaIndex}.processingError`]: shouldFail ? errorCode : '',
      },
    },
  )
}

module.exports = {
  buildWorkerId,
  enqueueLoopVideo,
  claimNextLoopVideoJob,
  updateJobProgress,
  completeJob,
  failOrRetryJob,
}
