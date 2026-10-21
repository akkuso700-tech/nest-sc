const mongoose = require('mongoose')
const { env } = require('./env')
const { WebVital } = require('../models/WebVital')
const { PostView } = require('../models/PostView')
const { RecommendationEvent } = require('../models/RecommendationEvent')
const { FeedSession } = require('../models/FeedSession')
const { TelemetryReceipt } = require('../models/TelemetryReceipt')
const { VideoProcessingJob } = require('../models/VideoProcessingJob')

const { User } = require('../models/User')
const { Post } = require('../models/Post')
const { Comment } = require('../models/Comment')
const { RefreshToken } = require('../models/RefreshToken')
const { Notification } = require('../models/Notification')

mongoose.set('strictQuery', true)

let listenersAttached = false
let indexSyncTimer = null

function attachConnectionListeners() {
  if (listenersAttached) return
  listenersAttached = true

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error?.message || error)
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Waiting for automatic driver reconnection...')
  })

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected successfully.')
  })
}

async function syncIndexesSequentially() {
  const models = [
    User,
    Post,
    Comment,
    RefreshToken,
    Notification,
    WebVital,
    PostView,
    RecommendationEvent,
    FeedSession,
    TelemetryReceipt,
    VideoProcessingJob,
  ]

  for (const model of models) {
    if (mongoose.connection.readyState !== 1) {
      return
    }
    try {
      await model.createIndexes()
    } catch (error) {
      console.error(`Failed to synchronize indexes for ${model.modelName}:`, error?.message || error)
    }
  }
}

async function connectDatabase() {
  attachConnectionListeners()

  await mongoose.connect(env.mongoUri, {
    autoIndex: env.isDevelopment,
    maxPoolSize: 20,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
  })

  console.log(`MongoDB connected: ${mongoose.connection.name}`)

  // Defer and serialize index synchronization so startup traffic is never starved.
  if (indexSyncTimer) {
    clearTimeout(indexSyncTimer)
  }
  indexSyncTimer = setTimeout(() => {
    indexSyncTimer = null
    void syncIndexesSequentially()
  }, 5000)
  if (typeof indexSyncTimer.unref === 'function') {
    indexSyncTimer.unref()
  }
}

async function disconnectDatabase() {
  if (indexSyncTimer) {
    clearTimeout(indexSyncTimer)
    indexSyncTimer = null
  }
  await mongoose.disconnect()
}

module.exports = { connectDatabase, disconnectDatabase }
