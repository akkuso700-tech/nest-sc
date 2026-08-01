const fs = require('fs')
const { env } = require('../config/env')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { buildAdaptiveLoopVariants } = require('../services/videoProcessingService')
const {
  publishAdaptiveLoopOutputs,
} = require('../services/loopVideoPublishingService')
const { materializeLoopJobSource } = require('../services/loopVideoSourceService')
const {
  buildWorkerId,
  acquireWorkerLease,
  claimNextLoopVideoJob,
  enqueueRawLoopBackfill,
  recoverStalledLoopJobs,
  requeueRelocatedLoopJobs,
  updateJobProgress,
  completeJob,
  failOrRetryJob,
} = require('../services/videoProcessingQueueService')

let stopping = false

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function removePath(filePath, options = {}) {
  if (!filePath) return
  await fs.promises.rm(filePath, { force: true, recursive: Boolean(options.recursive) }).catch(() => undefined)
}

async function processJob(job) {
  const processStartedAt = Date.now()
  const claimedAt = new Date(job.startedAt || processStartedAt).getTime()
  const createdAt = new Date(job.createdAt || processStartedAt).getTime()
  const timings = {
    queueWaitMs: Math.max(0, claimedAt - createdAt),
    sourceMs: 0,
    encodeMs: 0,
    publishMs: 0,
    finalizeMs: 0,
  }
  let adaptiveResult = null
  let sourceMaterial = null
  let currentProgress = 0
  let currentStage = 'source'
  let heartbeatBusy = false
  const heartbeatEveryMs = Math.max(5_000, Math.min(30_000, Math.floor(env.loopWorkerLeaseMs / 3)))
  const heartbeat = setInterval(async () => {
    if (heartbeatBusy) return
    heartbeatBusy = true
    try {
      await updateJobProgress(job._id, currentProgress)
    } catch (error) {
      console.error(JSON.stringify({
        tag: 'loop_worker_heartbeat',
        jobId: job.id,
        errorMessage: error?.message || 'Job heartbeat failed.',
      }))
    } finally {
      heartbeatBusy = false
    }
  }, heartbeatEveryMs)
  heartbeat.unref?.()
  try {
    let stageStartedAt = Date.now()
    sourceMaterial = await materializeLoopJobSource(job)
    timings.sourceMs = Date.now() - stageStartedAt
    const sourcePath = sourceMaterial.sourcePath
    currentProgress = 2
    await updateJobProgress(job._id, currentProgress)
    currentStage = 'encode'
    stageStartedAt = Date.now()
    adaptiveResult = await buildAdaptiveLoopVariants(sourcePath, {
      timeoutMs: env.loopWorkerJobTimeoutMs,
      onProgress: (progress) => {
        currentProgress = progress
        return updateJobProgress(job._id, progress)
      },
    })
    timings.encodeMs = Date.now() - stageStartedAt
    currentStage = 'publish'
    stageStartedAt = Date.now()
    const published = await publishAdaptiveLoopOutputs(adaptiveResult)
    timings.publishMs = Date.now() - stageStartedAt
    currentProgress = 95
    await updateJobProgress(job._id, currentProgress)
    currentStage = 'finalize'
    stageStartedAt = Date.now()
    await completeJob(job, published)
    await removePath(sourcePath)
    if (isRemoteOutput(published)) {
      await removePath(adaptiveResult.outputDirectory, { recursive: true })
    }
    timings.finalizeMs = Date.now() - stageStartedAt
    console.info(JSON.stringify({
      tag: 'loop_worker_timing',
      jobId: job.id,
      postId: job.post,
      attempt: job.attempts,
      ok: true,
      ...timings,
      totalMs: Date.now() - processStartedAt,
    }))
    console.info(JSON.stringify({ tag: 'loop_worker', jobId: job.id, postId: job.post, ok: true }))
  } catch (error) {
    await failOrRetryJob(job, error)
    if (sourceMaterial?.temporary) {
      await removePath(sourceMaterial.sourcePath)
    }
    if (error?.permanent && adaptiveResult?.outputDirectory) {
      await removePath(adaptiveResult.outputDirectory, { recursive: true })
    }
    console.error(JSON.stringify({
      tag: 'loop_worker_timing',
      jobId: job.id,
      postId: job.post,
      attempt: job.attempts,
      ok: false,
      failedStage: currentStage,
      ...timings,
      totalMs: Date.now() - processStartedAt,
      errorCode: error?.code || 'VIDEO_PROCESSING_FAILED',
    }))
    console.error(JSON.stringify({
      tag: 'loop_worker',
      jobId: job.id,
      postId: job.post,
      ok: false,
      errorCode: error?.code || 'VIDEO_PROCESSING_FAILED',
      errorMessage: error?.message || 'Video processing failed.',
    }))
  } finally {
    clearInterval(heartbeat)
  }
}

function isRemoteOutput(result) {
  return /^https?:\/\//i.test(String(result?.hlsUrl || ''))
}

async function runWorker(options = {}) {
  const manageDatabase = options.manageDatabase !== false
  if (manageDatabase) await connectDatabase()
  const workerId = buildWorkerId()
  console.info(`Loop video worker started (${workerId}, mode=${manageDatabase ? 'external' : 'embedded'}).`)

  if (env.loopWorkerStartupGraceMs > 0) {
    console.info(JSON.stringify({ tag: 'loop_worker_startup_grace', delayMs: env.loopWorkerStartupGraceMs }))
    await wait(env.loopWorkerStartupGraceMs)
  }

  let nextRecoveryAt = 0

  async function recoverInterruptedJobs() {
    const recoveredJobs = await recoverStalledLoopJobs()
    const retried = recoveredJobs.filter((job) => job.recoveryStatus === 'retry').length
    const failed = recoveredJobs.filter((job) => job.recoveryStatus === 'failed').length
    console.info(JSON.stringify({
      tag: 'loop_worker_recovery',
      recovered: recoveredJobs.length,
      retried,
      failed,
    }))
    nextRecoveryAt = Date.now() + Math.max(30_000, Math.min(env.loopWorkerStaleMs, 5 * 60_000))
  }

  await recoverInterruptedJobs()

  const relocatedJobs = await requeueRelocatedLoopJobs()
  console.info(JSON.stringify({
    tag: 'loop_worker_relocated_sources',
    requeued: relocatedJobs.length,
  }))

  if (env.loopRawBackfillLimit > 0) {
    const isBackfillLeader = await acquireWorkerLease(
      'loop-raw-backfill',
      workerId,
      env.loopBackfillLeaderLeaseMs,
    )
    const queuedBackfillJobs = isBackfillLeader
      ? await enqueueRawLoopBackfill({ limit: env.loopRawBackfillLimit })
      : []
    console.info(JSON.stringify({
      tag: 'loop_backfill',
      requested: env.loopRawBackfillLimit,
      queued: queuedBackfillJobs.length,
      leader: isBackfillLeader,
    }))
  }

  while (!stopping) {
    if (Date.now() >= nextRecoveryAt) {
      await recoverInterruptedJobs()
    }
    const job = await claimNextLoopVideoJob(workerId)
    if (!job) {
      await wait(env.loopWorkerPollMs)
      continue
    }
    console.info(JSON.stringify({
      tag: 'loop_worker_claimed',
      jobId: job.id,
      postId: job.post,
      attempt: job.attempts,
      priority: job.priority,
      workerId,
    }))
    await processJob(job)
  }

  if (manageDatabase) await disconnectDatabase()
}

function requestStop() {
  stopping = true
}

if (require.main === module) {
  process.on('SIGINT', requestStop)
  process.on('SIGTERM', requestStop)
  runWorker().catch((error) => {
    console.error('Loop video worker failed:', error)
    process.exitCode = 1
  })
}

module.exports = { processJob, runWorker, requestStop }
