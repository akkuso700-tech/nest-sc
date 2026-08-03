const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const { createApp } = require('../src/app')

test('localized SPA routes use the deployed frontend index instead of a hard-coded asset shell', async (t) => {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  await new Promise((resolve) => server.once('listening', resolve))

  const address = server.address()
  const deployedIndex = fs.readFileSync(
    path.resolve(__dirname, '../public/index.html'),
    'utf8',
  )

  for (const route of ['/tr', '/tr/', '/tr/loop', '/tr/posts/deployment-smoke-test']) {
    const response = await fetch(`http://127.0.0.1:${address.port}${route}`)
    const body = await response.text()

    assert.equal(response.status, 200, route)
    assert.equal(response.headers.get('x-nest-demo-build'), null, route)
    assert.match(response.headers.get('cache-control') || '', /must-revalidate/, route)
    assert.equal(body, deployedIndex, route)
  }
})
