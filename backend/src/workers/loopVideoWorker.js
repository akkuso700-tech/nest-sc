const fs = require('fs')
const { env } = require('../config/env')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { buildAdaptiveLoopVariants } = require('../services/videoProcessingService')
const {
  assertPathInsideUploads,
  publishAdaptiveLoopOutputs,
} = require('../services/loopVideoPublishingService')
const {
  buildWorkerId,
  claimNextLoopVideoJob,
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
  try {
    const sourcePath = assertPathInsideUploads(job.sourcePath)
    await fs.promises.access(sourcePath, fs.constants.R_OK)
    await updateJobProgress(job._id, 2)
    adaptiveResult = await buildAdaptiveLoopVariants(sourcePath, {
      timeoutMs: env.loopWorkerJobTimeoutMs,
      onProgress: (progress) => updateJobProgress(job._id, progress),
    })
    const published = await publishAdaptiveLoopOutputs(adaptiveResult)
    await updateJobProgress(job._id, 95)
    await completeJob(job, published)
    await removePath(sourcePath)
    if (isRemoteOutput(published)) {
      await removePath(adaptiveResult.outputDirectory, { recursive: true })
    }
    console.info(JSON.stringify({ tag: 'loop_worker', jobId: job.id, postId: job.post, ok: true }))
  } catch (error) {
    await failOrRetryJob(job, error)
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
  }
}

function isRemoteOutput(result) {
  return /^https?:\/\//i.test(String(result?.hlsUrl || ''))
}

async function runWorker() {
  await connectDatabase()
  const workerId = buildWorkerId()
  console.info(`Loop video worker started (${workerId}).`)

  while (!stopping) {
    const job = await claimNextLoopVideoJob(workerId)
    if (!job) {
      await wait(env.loopWorkerPollMs)
      continue
    }
    await processJob(job)
  }

  await disconnectDatabase()
}

function requestStop() {
  stopping = true
}

process.on('SIGINT', requestStop)
process.on('SIGTERM', requestStop)

if (require.main === module) {
  runWorker().catch((error) => {
    console.error('Loop video worker failed:', error)
    process.exitCode = 1
  })
}

module.exports = { processJob, runWorker, requestStop }
