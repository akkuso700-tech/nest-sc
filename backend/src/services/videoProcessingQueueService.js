const os = require('os')
const { VideoProcessingJob } = require('../models/VideoProcessingJob')
const { WorkerLease } = require('../models/WorkerLease')
const { Post } = require('../models/Post')
const { env } = require('../config/env')

function buildWorkerId() {
  return `${os.hostname()}:${process.pid}`
}

async function enqueueLoopVideo({ postId, mediaIndex = 0, sourcePath = '', sourceUrl = '', originalName, mimeType }) {
  return VideoProcessingJob.findOneAndUpdate(
    { post: postId, mediaIndex },
    {
      $setOnInsert: {
        sourcePath,
        sourceUrl,
        originalName: originalName || 'loop-video',
        mimeType: mimeType || 'video/mp4',
        workerSlot: 'loop-video',
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

async function acquireWorkerLease(key, owner, leaseMs) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + Math.max(30_000, Number(leaseMs) || 0))

  try {
    const lease = await WorkerLease.findOneAndUpdate(
      {
        _id: key,
        $or: [
          { expiresAt: { $lte: now } },
          { owner },
        ],
      },
      {
        $set: { owner, expiresAt },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean()

    return Boolean(lease && lease.owner === owner)
  } catch (error) {
    if (error?.code === 11000) return false
    throw error
  }
}

function originalNameFromUrl(sourceUrl) {
  try {
    return decodeURIComponent(new URL(sourceUrl).pathname.split('/').pop() || 'loop-video.mp4')
  } catch {
    return 'loop-video.mp4'
  }
}

async function enqueueRawLoopBackfill(options = {}) {
  const limit = Math.max(0, Math.min(20, Number(options.limit ?? env.loopRawBackfillLimit) || 0))
  if (!limit) return []

  const queued = []
  const failedEncoderJobs = await VideoProcessingJob.find({
    status: 'failed',
    sourceUrl: { $nin: ['', null] },
    $or: [
      { recoveryCount: { $lt: 1 } },
      { recoveryCount: { $exists: false } },
    ],
    errorCode: { $in: ['ENCODER_RESOURCE_LIMIT', 'VIDEO_PROCESSING_FAILED'] },
  })
    .select('_id post mediaIndex')
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean()

  for (const failedJob of failedEncoderJobs) {
    const job = await VideoProcessingJob.findOneAndUpdate(
      { _id: failedJob._id, status: 'failed' },
      {
        $set: {
          status: 'queued',
          progress: 0,
          attempts: 0,
          maxAttempts: env.loopWorkerMaxAttempts,
          nextRunAt: new Date(),
          leaseExpiresAt: null,
          workerId: '',
          errorCode: '',
          errorMessage: '',
        },
        $inc: { recoveryCount: 1 },
      },
      { returnDocument: 'after' },
    )
    if (!job) continue

    await Post.updateOne(
      { _id: failedJob.post },
      {
        $set: {
          [`media.${failedJob.mediaIndex}.processing`]: 'queued',
          [`media.${failedJob.mediaIndex}.processingProgress`]: 0,
          [`media.${failedJob.mediaIndex}.processingError`]: '',
        },
      },
    )
    queued.push(job)
  }

  if (queued.length >= limit) return queued

  const candidates = await Post.find({
    contentType: 'loop',
    archivedAt: null,
    $or: [
      { 'publication.status': 'published' },
      { 'publication.status': { $exists: false } },
    ],
    'moderation.visibility': { $nin: ['hidden', 'removed'] },
    media: {
      $elemMatch: {
        type: 'video',
        processing: { $in: ['raw', null] },
        hlsUrl: { $in: ['', null] },
        url: { $regex: '^https?://' },
      },
    },
  })
    .select('_id media')
    .sort({ createdAt: -1 })
    .limit(Math.max(limit * 4, limit))
    .lean()

  for (const post of candidates) {
    if (queued.length >= limit) break
    const mediaIndex = (post.media || []).findIndex(
      (item) =>
        item?.type === 'video' &&
        `${item?.processing || 'raw'}` === 'raw' &&
        !item?.hlsUrl &&
        /^https?:\/\//i.test(String(item?.url || '')),
    )
    if (mediaIndex < 0) continue

    const existingJob = await VideoProcessingJob.exists({ post: post._id, mediaIndex })
    if (existingJob) continue

    const media = post.media[mediaIndex]
    let job
    try {
      job = await enqueueLoopVideo({
        postId: post._id,
        mediaIndex,
        sourceUrl: media.url,
        originalName: originalNameFromUrl(media.url),
        mimeType: 'video/mp4',
      })
    } catch (error) {
      if (error?.code === 11000) continue
      throw error
    }

    await Post.updateOne(
      {
        _id: post._id,
        [`media.${mediaIndex}.processing`]: { $in: ['raw', null] },
      },
      {
        $set: {
          [`media.${mediaIndex}.processing`]: 'queued',
          [`media.${mediaIndex}.processingProgress`]: 0,
          [`media.${mediaIndex}.processingError`]: '',
        },
      },
    )
    queued.push(job)
  }

  return queued
}

async function recoverStalledRemoteLoopJobs(options = {}) {
  const limit = Math.max(1, Math.min(20, Number(options.limit || 5)))
  const staleMs = Math.max(30_000, Number(options.staleMs || env.loopWorkerStaleMs))
  const staleBefore = new Date(Date.now() - staleMs)
  const candidates = await VideoProcessingJob.find({
    status: 'processing',
    sourceUrl: { $nin: ['', null] },
    updatedAt: { $lte: staleBefore },
  })
    .select('_id post mediaIndex')
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean()

  const recovered = []
  for (const job of candidates) {
    const result = await VideoProcessingJob.updateOne(
      { _id: job._id, status: 'processing', updatedAt: { $lte: staleBefore } },
      {
        $set: {
          status: 'retry',
          nextRunAt: new Date(),
          leaseExpiresAt: null,
          workerId: '',
          errorCode: 'WORKER_INTERRUPTED',
          errorMessage: 'The previous worker stopped before completing the job.',
        },
      },
    )
    if (!result.modifiedCount) continue

    await Post.updateOne(
      { _id: job.post },
      {
        $set: {
          [`media.${job.mediaIndex}.processing`]: 'queued',
          [`media.${job.mediaIndex}.processingProgress`]: 0,
          [`media.${job.mediaIndex}.processingError`]: '',
        },
      },
    )
    recovered.push(job)
  }

  return recovered
}

async function claimNextLoopVideoJob(workerId = buildWorkerId()) {
  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + env.loopWorkerLeaseMs)

  try {
    return await VideoProcessingJob.findOneAndUpdate(
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
          workerSlot: 'loop-video',
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
  } catch (error) {
    // This index is the distributed single-worker lock across API instances.
    if (error?.code === 11000) return null
    throw error
  }
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
  acquireWorkerLease,
  enqueueLoopVideo,
  enqueueRawLoopBackfill,
  recoverStalledRemoteLoopJobs,
  claimNextLoopVideoJob,
  updateJobProgress,
  completeJob,
  failOrRetryJob,
}
