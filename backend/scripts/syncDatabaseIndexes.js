const mongoose = require('mongoose')
const { env } = require('../src/config/env')
const { User } = require('../src/models/User')
const { Post } = require('../src/models/Post')
const { Comment } = require('../src/models/Comment')
const { RefreshToken } = require('../src/models/RefreshToken')
const { Notification } = require('../src/models/Notification')
const { WebVital } = require('../src/models/WebVital')
const { PostView } = require('../src/models/PostView')
const { RecommendationEvent } = require('../src/models/RecommendationEvent')
const { FeedSession } = require('../src/models/FeedSession')
const { TelemetryReceipt } = require('../src/models/TelemetryReceipt')
const { VideoProcessingJob } = require('../src/models/VideoProcessingJob')

async function syncIndexes() {
  console.log(`[syncIndexes] Connecting to MongoDB: ${env.mongoUri.replace(/:[^:@]+@/, ':***@')}...`)
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  })
  console.log(`[syncIndexes] Connected to database: ${mongoose.connection.name}`)

  const models = [
    { name: 'User', model: User },
    { name: 'Post', model: Post },
    { name: 'Comment', model: Comment },
    { name: 'RefreshToken', model: RefreshToken },
    { name: 'Notification', model: Notification },
    { name: 'WebVital', model: WebVital },
    { name: 'PostView', model: PostView },
    { name: 'RecommendationEvent', model: RecommendationEvent },
    { name: 'FeedSession', model: FeedSession },
    { name: 'TelemetryReceipt', model: TelemetryReceipt },
    { name: 'VideoProcessingJob', model: VideoProcessingJob },
  ]

  for (const { name, model } of models) {
    try {
      const startTime = Date.now()
      console.log(`[syncIndexes] Synchronizing indexes for ${name}...`)
      await model.createIndexes()
      const indexes = await model.collection.indexes()
      const duration = Date.now() - startTime
      console.log(`[syncIndexes] ✓ ${name}: ${indexes.length} indexes synced in ${duration}ms`)
      indexes.forEach((idx) => {
        console.log(`    - ${idx.name}: ${JSON.stringify(idx.key)}`)
      })
    } catch (error) {
      console.error(`[syncIndexes] ✗ Failed for ${name}:`, error.message)
    }
  }

  await mongoose.disconnect()
  console.log('[syncIndexes] All database indexes synchronized successfully.')
}

if (require.main === module) {
  syncIndexes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[syncIndexes] Fatal error:', err)
      process.exit(1)
    })
}

module.exports = { syncIndexes }
