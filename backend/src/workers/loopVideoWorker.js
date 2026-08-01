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
  claimNextLoopVideoJob,
  enqueueRawLoopBackfill,
  recoverStalledRemoteLoopJobs,
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
  let adaptiveResult = null
  let sourceMaterial = null
  let currentProgress = 0
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
    sourceMaterial = await materializeLoopJobSource(job)
    const sourcePath = sourceMaterial.sourcePath
    currentProgress = 2
    await updateJobProgress(job._id, currentProgress)
    adaptiveResult = await buildAdaptiveLoopVariants(sourcePath, {
      timeoutMs: env.loopWorkerJobTimeoutMs,
      onProgress: (progress) => {
        currentProgress = progress
        return updateJobProgress(job._id, progress)
      },
    })
    const published = await publishAdaptiveLoopOutputs(adaptiveResult)
    currentProgress = 95
    await updateJobProgress(job._id, currentProgress)
    await completeJob(job, published)
    await removePath(sourcePath)
    if (isRemoteOutput(published)) {
      await removePath(adaptiveResult.outputDirectory, { recursive: true })
    }
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

  const recoveredJobs = await recoverStalledRemoteLoopJobs()
  if (recoveredJobs.length) {
    console.info(JSON.stringify({ tag: 'loop_worker_recovery', recovered: recoveredJobs.length }))
  }

  if (env.loopRawBackfillLimit > 0) {
    const queuedBackfillJobs = await enqueueRawLoopBackfill({ limit: env.loopRawBackfillLimit })
    console.info(JSON.stringify({
      tag: 'loop_backfill',
      requested: env.loopRawBackfillLimit,
      queued: queuedBackfillJobs.length,
    }))
  }

  while (!stopping) {
    const job = await claimNextLoopVideoJob(workerId)
    if (!job) {
      await wait(env.loopWorkerPollMs)
      continue
    }
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
