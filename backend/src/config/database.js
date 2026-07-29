const mongoose = require('mongoose')
const { env } = require('./env')
const { WebVital } = require('../models/WebVital')
const { PostView } = require('../models/PostView')
const { RecommendationEvent } = require('../models/RecommendationEvent')
const { FeedSession } = require('../models/FeedSession')
const { TelemetryReceipt } = require('../models/TelemetryReceipt')

mongoose.set('strictQuery', true)

async function connectDatabase() {
  await mongoose.connect(env.mongoUri, {
    autoIndex: env.isDevelopment,
  })

  await Promise.all([
    WebVital.createIndexes(),
    PostView.createIndexes(),
    RecommendationEvent.createIndexes(),
    FeedSession.createIndexes(),
    TelemetryReceipt.createIndexes(),
  ])

  console.log(`MongoDB connected: ${mongoose.connection.name}`)
}

module.exports = { connectDatabase }
