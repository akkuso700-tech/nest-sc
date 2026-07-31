const path = require('path')
const { spawn } = require('child_process')
const { bootstrap } = require('./apiServer')

let loopWorker = null
let workerRestartTimer = null
let stopping = false

function startLoopWorker() {
  if (stopping || loopWorker) return
  loopWorker = spawn(process.execPath, [path.resolve(__dirname, 'workers/loopVideoWorker.js')], {
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  })
  loopWorker.on('exit', (code, signal) => {
    loopWorker = null
    if (stopping) return
    console.error(`Loop worker exited unexpectedly (code=${code}, signal=${signal || 'none'}).`)
    workerRestartTimer = setTimeout(startLoopWorker, 5_000)
  })
}

function stopLoopWorker() {
  stopping = true
  if (workerRestartTimer) clearTimeout(workerRestartTimer)
  if (loopWorker && !loopWorker.killed) loopWorker.kill('SIGTERM')
}

process.on('SIGINT', stopLoopWorker)
process.on('SIGTERM', stopLoopWorker)

// Hostinger requires the configured entry process itself to call listen()
// within its startup window. Start the independent worker only after that
// listener is ready, so worker startup can never delay HTTP availability.
bootstrap({ onListening: startLoopWorker }).catch((error) => {
  console.error('Failed to start backend:', error)
  process.exit(1)
})
