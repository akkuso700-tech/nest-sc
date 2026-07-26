const http = require('http')
const { env } = require('./config/env')
const { connectDatabase } = require('./config/database')
const { createApp } = require('./app')
const { initSocketServer } = require('./sockets')

async function bootstrap() {
  await connectDatabase()

  const app = createApp()
  const server = http.createServer(app)
  const io = initSocketServer(server)

  app.locals.io = io

  server.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`)
  })
}

bootstrap().catch((error) => {
  console.error('Failed to start backend:', error)
  process.exit(1)
})
