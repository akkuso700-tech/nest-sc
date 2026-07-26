const mongoose = require('mongoose')
const { env } = require('./env')
const { WebVital } = require('../models/WebVital')

mongoose.set('strictQuery', true)

async function connectDatabase() {
  await mongoose.connect(env.mongoUri, {
    autoIndex: env.isDevelopment,
  })

  await WebVital.createIndexes()

  console.log(`MongoDB connected: ${mongoose.connection.name}`)
}

module.exports = { connectDatabase }
