const mongoose = require('mongoose')
const { env } = require('./env')
const { WebVital } = require('../models/WebVital')
const { PostView } = require('../models/PostView')
const { RecommendationEvent } = require('../models/RecommendationEvent')
const { FeedSession } = require('../models/FeedSession')
const { TelemetryReceipt } = require('../models/TelemetryReceipt')
const { VideoProcessingJob } = require('../models/VideoProcessingJob')

mongoose.set('strictQuery', true)

async function connectDatabase() {
  await mongoose.connect(env.mongoUri, {
    autoIndex: env.isDevelopment,
  })

  console.log(`MongoDB connected: ${mongoose.connection.name}`)

  // Index synchronization must not block the web process from becoming ready.
  // On constrained hosts, an index build can outlive the startup grace period
  // and cause Passenger to repeatedly restart an otherwise healthy process.
  void Promise.all([
    WebVital.createIndexes(),
    PostView.createIndexes(),
    RecommendationEvent.createIndexes(),
    FeedSession.createIndexes(),
    TelemetryReceipt.createIndexes(),
    VideoProcessingJob.createIndexes(),
  ]).catch((error) => {
    console.error('Failed to synchronize database indexes:', error)
  })
}

async function disconnectDatabase() {
  await mongoose.disconnect()
}

module.exports = { connectDatabase, disconnectDatabase }
