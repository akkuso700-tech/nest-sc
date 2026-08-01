const os = require('os')
const { VideoProcessingJob } = require('../models/VideoProcessingJob')
const { WorkerLease } = require('../models/WorkerLease')
const { Post } = require('../models/Post')
const { env } = require('../config/env')

const LOOP_JOB_PRIORITIES = Object.freeze({
  BACKFILL: 10,
  USER_UPLOAD: 100,
})

const LOOP_WORKER_SLOT = 'loop-video'
let lastLockBusyLogAt = 0

function buildWorkerId() {
  return `${os.hostname()}:${process.pid}`
}

async function enqueueLoopVideo({
  postId,
  mediaIndex = 0,
  sourcePath = '',
  sourceUrl = '',
  originalName,
  mimeType,
  priority = LOOP_JOB_PRIORITIES.USER_UPLOAD,
}) {
  return VideoProcessingJob.findOneAndUpdate(
    { post: postId, mediaIndex },
    {
      $setOnInsert: {
        sourcePath,
        sourceUrl,
        originalName: originalName || 'loop-video',
        mimeType: mimeType || 'video/mp4',
        workerSlot: LOOP_WORKER_SLOT,
        status: 'queued',
        progress: 0,
        priority,
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
          priority: LOOP_JOB_PRIORITIES.BACKFILL,
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
        priority: LOOP_JOB_PRIORITIES.BACKFILL,
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

function buildStalledLoopJobFilter({ now, staleBefore }) {
  return {
    status: 'processing',
    workerSlot: LOOP_WORKER_SLOT,
    $or: [
      { leaseExpiresAt: { $lte: now } },
      { updatedAt: { $lte: staleBefore } },
    ],
  }
}

async function recoverStalledLoopJobs(options = {}) {
  const limit = Math.max(1, Math.min(20, Number(options.limit || 5)))
  const staleMs = Math.max(30_000, Number(options.staleMs || env.loopWorkerStaleMs))
  const now = options.now instanceof Date ? options.now : new Date()
  const staleBefore = new Date(now.getTime() - staleMs)
  const stalledFilter = buildStalledLoopJobFilter({ now, staleBefore })
  const candidates = await VideoProcessingJob.find(stalledFilter)
    .select('_id post mediaIndex attempts maxAttempts sourcePath sourceUrl leaseExpiresAt updatedAt')
    .sort({ leaseExpiresAt: 1, updatedAt: 1 })
    .limit(limit)
    .lean()

  const recovered = []
  for (const job of candidates) {
    const exhausted = Number(job.attempts || 0) >= Number(job.maxAttempts || env.loopWorkerMaxAttempts)
    const nextStatus = exhausted ? 'failed' : 'retry'
    const errorCode = exhausted ? 'WORKER_RESTART_LIMIT' : 'WORKER_INTERRUPTED'
    const errorMessage = exhausted
      ? 'The worker stopped repeatedly before completing the video.'
      : 'The previous worker stopped before completing the job.'
    const result = await VideoProcessingJob.updateOne(
      { _id: job._id, ...stalledFilter },
      {
        $set: {
          status: nextStatus,
          progress: 0,
          nextRunAt: now,
          leaseExpiresAt: null,
          workerId: '',
          errorCode,
          errorMessage,
        },
      },
    )
    if (!result.modifiedCount) continue

    await Post.updateOne(
      { _id: job.post },
      {
        $set: {
          [`media.${job.mediaIndex}.processing`]: exhausted ? 'failed' : 'queued',
          [`media.${job.mediaIndex}.processingProgress`]: 0,
          [`media.${job.mediaIndex}.processingError`]: exhausted ? errorCode : '',
        },
      },
    )
    recovered.push({ ...job, recoveryStatus: nextStatus, recoveryErrorCode: errorCode })
  }

  return recovered
}

async function requeueRelocatedLoopJobs(options = {}) {
  const limit = Math.max(1, Math.min(20, Number(options.limit || 5)))
  const candidates = await VideoProcessingJob.find({
    status: 'failed',
    errorCode: 'INVALID_JOB_SOURCE_PATH',
    sourcePath: { $nin: ['', null] },
    $or: [
      { recoveryCount: { $lt: 1 } },
      { recoveryCount: { $exists: false } },
    ],
  })
    .select('_id post mediaIndex')
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean()

  const requeued = []
  for (const job of candidates) {
    const updated = await VideoProcessingJob.updateOne(
      {
        _id: job._id,
        status: 'failed',
        errorCode: 'INVALID_JOB_SOURCE_PATH',
      },
      {
        $set: {
          status: 'queued',
          progress: 0,
          attempts: 0,
          maxAttempts: env.loopWorkerMaxAttempts,
          priority: LOOP_JOB_PRIORITIES.USER_UPLOAD,
          nextRunAt: new Date(),
          leaseExpiresAt: null,
          workerId: '',
          errorCode: '',
          errorMessage: '',
        },
        $inc: { recoveryCount: 1 },
      },
    )
    if (!updated.modifiedCount) continue

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
    requeued.push(job)
  }

  return requeued
}

// Kept as an alias so older scripts can update without a coordinated restart.
const recoverStalledRemoteLoopJobs = recoverStalledLoopJobs

async function claimNextLoopVideoJob(workerId = buildWorkerId()) {
  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + env.loopWorkerLeaseMs)

  const claimUpdate = {
    $set: {
      status: 'processing',
      workerSlot: LOOP_WORKER_SLOT,
      workerId,
      leaseExpiresAt,
      startedAt: now,
      errorCode: '',
      errorMessage: '',
    },
    $inc: { attempts: 1 },
  }

  // Always reclaim the expired lock holder before considering higher-priority
  // queued jobs. Otherwise the unique worker-slot index rejects the queued job
  // forever and the same job wins the priority sort on every poll.
  const interruptedJob = await VideoProcessingJob.findOneAndUpdate(
    {
      status: 'processing',
      workerSlot: LOOP_WORKER_SLOT,
      attempts: { $lt: env.loopWorkerMaxAttempts },
      leaseExpiresAt: { $lte: now },
    },
    claimUpdate,
    { sort: { leaseExpiresAt: 1, createdAt: 1 }, returnDocument: 'after' },
  )

  if (interruptedJob) return interruptedJob

  try {
    return await VideoProcessingJob.findOneAndUpdate(
      {
        attempts: { $lt: env.loopWorkerMaxAttempts },
        nextRunAt: { $lte: now },
        status: { $in: ['queued', 'retry'] },
      },
      claimUpdate,
      { sort: { priority: -1, nextRunAt: 1, createdAt: 1 }, returnDocument: 'after' },
    )
  } catch (error) {
    // This index is the distributed single-worker lock across API instances.
    if (error?.code === 11000) {
      const nowMs = Date.now()
      if (nowMs - lastLockBusyLogAt >= 30_000) {
        lastLockBusyLogAt = nowMs
        console.info(JSON.stringify({
          tag: 'loop_worker_lock_busy',
          workerId,
        }))
      }
      return null
    }
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
  LOOP_JOB_PRIORITIES,
  buildWorkerId,
  acquireWorkerLease,
  enqueueLoopVideo,
  enqueueRawLoopBackfill,
  buildStalledLoopJobFilter,
  recoverStalledLoopJobs,
  recoverStalledRemoteLoopJobs,
  requeueRelocatedLoopJobs,
  claimNextLoopVideoJob,
  updateJobProgress,
  completeJob,
  failOrRetryJob,
}
