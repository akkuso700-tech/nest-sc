const http = require('http')
const { env } = require('./config/env')
const { runWorker, requestStop } = require('./workers/loopVideoWorker')

let ready = false
let stopping = false

const server = http.createServer((req, res) => {
  if (req.url !== '/health') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'not-found' }))
    return
  }
  res.writeHead(ready ? 200 : 503, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify({ status: ready ? 'ready' : 'starting', service: 'loop-worker' }))
})

async function shutdown() {
  if (stopping) return
  stopping = true
  ready = false
  requestStop()
  server.close()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.listen(env.port, () => {
  console.log(`Loop worker health endpoint listening on port ${env.port}`)
})

runWorker()
  .then(() => shutdown())
  .catch((error) => {
    console.error('Loop worker service failed:', error)
    process.exitCode = 1
    shutdown()
  })

ready = true
