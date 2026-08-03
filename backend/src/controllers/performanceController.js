const crypto = require('crypto')
const { ClientError } = require('../models/ClientError')
const { WebVital } = require('../models/WebVital')

const METRIC_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
}

const METRIC_MAX_VALUES = {
  LCP: 120000,
  CLS: 10,
  INP: 120000,
  FCP: 120000,
  TTFB: 120000,
}

function resolveRating(name, value) {
  const thresholds = METRIC_THRESHOLDS[name]
  if (!thresholds || value <= thresholds.good) return 'good'
  if (value <= thresholds.poor) return 'needs-improvement'
  return 'poor'
}

function normalizeMetricRoute(value = '/') {
  const pathname = String(value || '/')
    .split(/[?#]/, 1)[0]
    .slice(0, 180)

  return (pathname || '/')
    .replace(/\/posts\/[^/]+/gi, '/posts/:id')
    .replace(/\/u\/[^/]+/gi, '/u/:username')
    .replace(/\/groups\/(manage|joined)\/[^/]+/gi, '/groups/$1/:slug')
    .replace(/\/[a-f\d]{24}(?=\/|$)/gi, '/:id')
}

function percentile75(values = []) {
  if (!values.length) return null
  const sortedValues = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sortedValues.length * 0.75) - 1)
  return Number(sortedValues[index].toFixed(sortedValues[index] < 1 ? 3 : 0))
}

async function recordWebVitals(req, res) {
  const payload = req.validated.body
  const now = new Date()
  const route = normalizeMetricRoute(payload.route)
  const operations = payload.metrics
    .filter((metric) => metric.value <= METRIC_MAX_VALUES[metric.name])
    .map((metric) => ({
      updateOne: {
        filter: {
          pageViewId: payload.pageViewId,
          name: metric.name,
        },
        update: {
          $set: {
            value: metric.value,
            rating: resolveRating(metric.name, metric.value),
            route,
            navigationType: payload.navigationType,
            deviceClass: payload.deviceClass,
            connectionType: payload.connectionType,
            saveData: payload.saveData,
            updatedAt: now,
          },
          $setOnInsert: {
            pageViewId: payload.pageViewId,
            name: metric.name,
            createdAt: now,
          },
        },
        upsert: true,
      },
    }))

  if (operations.length) {
    await WebVital.bulkWrite(operations, { ordered: false })
  }

  res.status(202).json({ accepted: operations.length })
}

async function recordClientError(req, res) {
  const payload = req.validated.body
  const route = normalizeMetricRoute(payload.route)
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${payload.kind}|${payload.source}|${payload.message}`)
    .digest('hex')

  await ClientError.create({
    fingerprint,
    kind: payload.kind,
    source: payload.source,
    message: payload.message,
    stack: payload.stack,
    route,
    userAgent: payload.userAgent,
  })

  res.status(202).json({ accepted: true })
}

async function getWebVitalsSummary(req, res) {
  const { days, route: requestedRoute } = req.validated.query
  const createdAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const query = { createdAt: { $gte: createdAfter } }

  if (requestedRoute) {
    query.route = normalizeMetricRoute(requestedRoute)
  }

  const samples = await WebVital.find(query)
    .select('name value rating route deviceClass createdAt')
    .sort({ createdAt: -1 })
    .limit(20000)
    .lean()
  const clientErrorSamples = await ClientError.find(query)
    .select('fingerprint kind message route createdAt')
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean()

  const metricGroups = new Map()
  const routeGroups = new Map()

  samples.forEach((sample) => {
    if (!metricGroups.has(sample.name)) {
      metricGroups.set(sample.name, [])
    }
    metricGroups.get(sample.name).push(sample)

    const routeKey = `${sample.route}|${sample.name}`
    if (!routeGroups.has(routeKey)) {
      routeGroups.set(routeKey, [])
    }
    routeGroups.get(routeKey).push(sample)
  })

  const metrics = [...metricGroups.entries()].map(([name, items]) => ({
    name,
    samples: items.length,
    p75: percentile75(items.map((item) => item.value)),
    rating: resolveRating(name, percentile75(items.map((item) => item.value)) || 0),
    goodRate: Number(
      ((items.filter((item) => item.rating === 'good').length / items.length) * 100).toFixed(1),
    ),
  }))

  const routes = [...routeGroups.entries()]
    .map(([key, items]) => {
      const separatorIndex = key.lastIndexOf('|')
      const route = key.slice(0, separatorIndex)
      const name = key.slice(separatorIndex + 1)
      const p75 = percentile75(items.map((item) => item.value))
      return {
        route,
        name,
        samples: items.length,
        p75,
        rating: resolveRating(name, p75 || 0),
      }
    })
    .sort((left, right) => right.samples - left.samples)
    .slice(0, 30)

  const clientErrorGroups = new Map()
  clientErrorSamples.forEach((sample) => {
    const key = `${sample.fingerprint}|${sample.route}`
    const current = clientErrorGroups.get(key) || {
      kind: sample.kind,
      message: sample.message,
      route: sample.route,
      count: 0,
      lastSeenAt: sample.createdAt,
    }
    current.count += 1
    clientErrorGroups.set(key, current)
  })

  res.json({
    periodDays: days,
    totalSamples: samples.length,
    capped: samples.length === 20000,
    metrics,
    routes,
    clientErrors: {
      total: clientErrorSamples.length,
      capped: clientErrorSamples.length === 5000,
      groups: [...clientErrorGroups.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 30),
    },
  })
}

module.exports = {
  METRIC_THRESHOLDS,
  getWebVitalsSummary,
  normalizeMetricRoute,
  percentile75,
  recordClientError,
  recordWebVitals,
  resolveRating,
}
