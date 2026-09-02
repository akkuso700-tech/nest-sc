import assert from 'node:assert/strict'
import test from 'node:test'

const originalWindow = globalThis.window
const originalFetch = globalThis.fetch

globalThis.window = {
  location: {
    hostname: 'localhost',
    host: 'localhost',
    protocol: 'http:',
    origin: 'http://localhost',
  },
  setTimeout,
  clearTimeout,
}

const { _test } = await import('../src/lib/apiClient.js')

test.after(() => {
  globalThis.window = originalWindow
  globalThis.fetch = originalFetch
})

test('idempotent API requests retry a transient server response', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response('{}', {
      status: calls === 1 ? 503 : 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const response = await _test.fetchWithApiFallback('/health', {}, { timeoutMs: 500 })
  assert.equal(response.status, 200)
  assert.equal(calls, 2)
})

test('timed out API requests abort and stop after the bounded retry policy', async () => {
  let calls = 0
  globalThis.fetch = (_url, options) => {
    calls += 1
    return new Promise((resolve, reject) => {
      options.signal.addEventListener(
        'abort',
        () => reject(options.signal.reason || new Error('aborted')),
        { once: true },
      )
    })
  }

  await assert.rejects(
    _test.fetchWithApiFallback('/slow', {}, { timeoutMs: 100 }),
    (error) => error?.code === 'API_TIMEOUT',
  )
  assert.equal(calls, 6)
})

test('caller cancellation is not retried', async () => {
  const controller = new AbortController()
  let calls = 0
  globalThis.fetch = (_url, options) => {
    calls += 1
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
      controller.abort(new Error('caller cancelled'))
    })
  }

  await assert.rejects(
    _test.fetchWithApiFallback('/cancelled', { signal: controller.signal }),
    /caller cancelled/,
  )
  assert.equal(calls, 1)
})
