import process from 'node:process'

const DEFAULT_BASE_URLS = ['https://nest-sc.com', 'https://demo.nest-sc.com']
const REQUEST_TIMEOUT_MS = 15000
const MAX_ASSETS = 300

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function configuredBaseUrls() {
  const configured = String(process.env.DEPLOYMENT_BASE_URLS || '')
    .split(',')
    .map(normalizeBaseUrl)
    .filter(Boolean)

  return configured.length ? configured : DEFAULT_BASE_URLS
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      redirect: 'follow',
      ...options,
      signal: controller.signal,
      headers: {
        Accept: '*/*',
        'User-Agent': 'NestSC-Deployment-Smoke/1.0',
        ...options.headers,
      },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function collectAssetPaths(source = '') {
  const matches = source.matchAll(/(?:["'`(]|^)(\/?assets\/[A-Za-z0-9_.-]+\.(?:js|css))/g)
  return [...matches].map((match) => `/${match[1].replace(/^\/+/, '')}`)
}

async function checkHtmlRoute(baseUrl, pathName) {
  const url = `${baseUrl}${pathName}`
  const startedAt = Date.now()
  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
  })
  const body = await response.text()
  const contentType = response.headers.get('content-type') || ''

  assert(response.status === 200, `${url} returned ${response.status}, expected 200.`)
  assert(contentType.includes('text/html'), `${url} returned ${contentType}, expected HTML.`)
  assert(body.includes('id="root"'), `${url} did not return the React application shell.`)

  return {
    url,
    durationMs: Date.now() - startedAt,
    body,
  }
}

async function checkPublishedAssets(baseUrl, indexHtml) {
  const queued = [...new Set(collectAssetPaths(indexHtml))]
  const checked = new Set()

  while (queued.length) {
    assert(checked.size < MAX_ASSETS, `Asset graph exceeded the ${MAX_ASSETS} file safety limit.`)
    const batch = queued.splice(0, 8).filter((assetPath) => !checked.has(assetPath))
    if (!batch.length) continue

    const results = await Promise.all(
      batch.map(async (assetPath) => {
        const response = await fetchWithTimeout(`${baseUrl}${assetPath}`)
        const body = await response.text()
        const contentType = response.headers.get('content-type') || ''

        assert(response.status === 200, `${baseUrl}${assetPath} returned ${response.status}.`)
        if (assetPath.endsWith('.js')) {
          assert(
            /javascript|ecmascript/i.test(contentType),
            `${baseUrl}${assetPath} returned ${contentType}, expected JavaScript.`,
          )
        }
        if (assetPath.endsWith('.css')) {
          assert(contentType.includes('text/css'), `${baseUrl}${assetPath} returned ${contentType}.`)
        }

        return { assetPath, body }
      }),
    )

    results.forEach(({ assetPath, body }) => {
      checked.add(assetPath)
      if (!assetPath.endsWith('.js')) return
      collectAssetPaths(body).forEach((dependencyPath) => {
        if (!checked.has(dependencyPath)) queued.push(dependencyPath)
      })
    })
  }

  return checked.size
}

async function checkEnvironment(baseUrl) {
  const routes = ['/', '/tr/', '/tr/loop', '/tr/posts/deployment-smoke-test']
  const routeResults = []

  for (const route of routes) {
    routeResults.push(await checkHtmlRoute(baseUrl, route))
  }

  const assetCount = await checkPublishedAssets(baseUrl, routeResults[0].body)
  return {
    baseUrl,
    routes: routeResults.map(({ url, durationMs }) => ({ url, durationMs })),
    assetCount,
  }
}

const baseUrls = configuredBaseUrls()
const settledResults = await Promise.allSettled(baseUrls.map(checkEnvironment))
const results = []
const failures = []

settledResults.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    results.push(result.value)
    return
  }

  failures.push({
    baseUrl: baseUrls[index],
    message: result.reason?.message || String(result.reason),
  })
})

console.log(
  JSON.stringify(
    {
      ok: failures.length === 0,
      checkedAt: new Date().toISOString(),
      results,
      failures,
    },
    null,
    2,
  ),
)

if (failures.length) process.exitCode = 1
