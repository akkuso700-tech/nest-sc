const path = require('path')
const { spawn } = require('child_process')

const children = []
let stopping = false

function start(name, relativeScript, envOverrides = {}) {
  const child = spawn(process.execPath, [path.resolve(__dirname, relativeScript)], {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, ...envOverrides },
  })
  children.push(child)
  child.on('exit', (code, signal) => {
    if (stopping) return
    console.error(`${name} exited unexpectedly (code=${code}, signal=${signal || 'none'}).`)
    shutdown(code || 1)
  })
}

function shutdown(exitCode = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = exitCode
  children.forEach((child) => {
    if (!child.killed) child.kill('SIGTERM')
  })
  setTimeout(() => {
    children.forEach((child) => {
      if (!child.killed) child.kill('SIGKILL')
    })
    process.exit(exitCode)
  }, 10_000).unref()
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('API server', 'server.js', { LOOP_WORKER_MODE: 'external' })
start('Loop worker', 'workers/loopVideoWorker.js')
