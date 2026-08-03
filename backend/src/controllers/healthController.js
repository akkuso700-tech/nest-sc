const { env } = require('../config/env')

function getHealth(req, res) {
  res.json({
    status: 'ok',
    service: 'my-social-1-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    loopProcessing: {
      asyncEnabled: env.loopAsyncProcessingEnabled,
      workerMode: env.loopWorkerMode,
      backfillEnabled: env.loopRawBackfillLimit > 0,
      backfillBatchSize: env.loopRawBackfillLimit,
    },
  })
}

module.exports = { getHealth }
