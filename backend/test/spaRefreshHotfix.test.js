const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const { createApp } = require('../src/app')

test('localized SPA route is resolved again after a delayed frontend mount', async (t) => {
  const directories = [
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../frontend-dist'),
  ]
  const heldDirectories = []

  for (const directory of directories) {
    if (!fs.existsSync(directory)) continue
    const heldDirectory = `${directory}.__spa_test_hold`
    fs.renameSync(directory, heldDirectory)
    heldDirectories.push({ directory, heldDirectory })
  }

  t.after(() => {
    for (const { directory, heldDirectory } of heldDirectories) {
      if (fs.existsSync(heldDirectory) && !fs.existsSync(directory)) {
        fs.renameSync(heldDirectory, directory)
      }
    }
  })

  const app = createApp()

  const primaryDirectory = directories[0]
  const heldPrimary = heldDirectories.find((item) => item.directory === primaryDirectory)
  if (heldPrimary) {
    fs.renameSync(heldPrimary.heldDirectory, heldPrimary.directory)
  } else {
    fs.mkdirSync(primaryDirectory, { recursive: true })
    fs.writeFileSync(path.join(primaryDirectory, 'index.html'), '<!doctype html><title>SPA</title>')
    t.after(() => fs.rmSync(primaryDirectory, { recursive: true, force: true }))
  }

  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  await new Promise((resolve) => server.once('listening', resolve))

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/tr/`)
  const body = await response.text()

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /text\/html/)
  assert.match(response.headers.get('cache-control') || '', /must-revalidate/)
  assert.match(body, /<!doctype html>/i)
})
