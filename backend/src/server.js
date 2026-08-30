const http = require('http')
const { env } = require('./config/env')
const { connectDatabase } = require('./config/database')
const { createApp } = require('./app')
const { initSocketServer } = require('./sockets')
const { runWorker } = require('./workers/loopVideoWorker')
const { runMessageNotificationWorker } = require('./workers/messageNotificationWorker')
const { setAppIo } = require('./queues/messageNotificationQueue')

async function bootstrap() {
  const app = createApp()
  const server = http.createServer(app)
  const io = initSocketServer(server)

  app.locals.io = io
  setAppIo(io)

  server.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`)
  })

  try {
    await connectDatabase()
    if (env.loopWorkerMode === 'embedded') {
      void runWorker({ manageDatabase: false }).catch((error) => {
        console.error('Embedded Loop worker failed:', error)
      })
    }
    if (env.messageNotification.workerMode === 'embedded') {
      void runMessageNotificationWorker({ io, manageDatabase: false }).catch((error) => {
        console.warn('Embedded Message notification worker failed:', error.message)
      })
    }
  } catch (error) {
    console.error('Failed to connect to database:', error)
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start backend:', error)
  process.exit(1)
})
