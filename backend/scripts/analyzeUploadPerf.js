const fs = require('fs')
const path = require('path')

function percentile(values, p) {
  if (!values.length) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  const safeIndex = Math.max(0, Math.min(index, sorted.length - 1))
  return sorted[safeIndex]
}

function parseLine(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed) {
    return null
  }

  // Backend logs: {"tag":"upload_perf", ...}
  if (trimmed.startsWith('{') && trimmed.includes('"upload_perf"')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && parsed.tag === 'upload_perf') {
        return parsed
      }
    } catch {
      return null
    }
  }

  // Frontend logs: [upload-perf] {"flow":"create_post", ...}
  const frontendPrefix = '[upload-perf]'
  if (trimmed.includes(frontendPrefix)) {
    const jsonStart = trimmed.indexOf('{')
    if (jsonStart >= 0) {
      const rawJson = trimmed.slice(jsonStart)
      try {
        const parsed = JSON.parse(rawJson)
        if (parsed && parsed.flow) {
          return {
            tag: 'upload_perf_frontend',
            ...parsed,
          }
        }
      } catch {
        return null
      }
    }
  }

  return null
}

function buildGroupKey(entry) {
  const parts = [
    entry.tag || 'unknown',
    entry.flow || 'unknown',
    typeof entry.ok === 'boolean' ? `ok:${entry.ok}` : 'ok:na',
    entry.contentType ? `contentType:${entry.contentType}` : null,
    entry.target ? `target:${entry.target}` : null,
    entry.mode ? `mode:${entry.mode}` : null,
  ].filter(Boolean)

  return parts.join(' | ')
}

function toMs(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function summarizeGroup(items) {
  const totals = items.map((item) => toMs(item.totalMs ?? item.durationMs)).filter((v) => v !== null)
  const result = {
    count: items.length,
    totalMs: {
      p50: percentile(totals, 50),
      p95: percentile(totals, 95),
      min: totals.length ? Math.min(...totals) : 0,
      max: totals.length ? Math.max(...totals) : 0,
    },
    stepMs: {},
  }

  const stepBuckets = {}
  items.forEach((item) => {
    const timeline = item.timeline && typeof item.timeline === 'object' ? item.timeline : {}
    Object.entries(timeline).forEach(([step, value]) => {
      const ms = toMs(value)
      if (ms === null) {
        return
      }
      if (!stepBuckets[step]) {
        stepBuckets[step] = []
      }
      stepBuckets[step].push(ms)
    })
  })

  Object.entries(stepBuckets).forEach(([step, values]) => {
    result.stepMs[step] = {
      p50: percentile(values, 50),
      p95: percentile(values, 95),
    }
  })

  return result
}

function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: node scripts/analyzeUploadPerf.js <log-file-path>')
    process.exit(1)
  }

  const resolved = path.resolve(process.cwd(), inputPath)
  if (!fs.existsSync(resolved)) {
    console.error(`Log file not found: ${resolved}`)
    process.exit(1)
  }

  const lines = fs.readFileSync(resolved, 'utf8').split(/\r?\n/)
  const parsedEntries = lines.map(parseLine).filter(Boolean)

  if (!parsedEntries.length) {
    console.error('No upload perf entries found in log file.')
    process.exit(1)
  }

  const grouped = {}
  parsedEntries.forEach((entry) => {
    const key = buildGroupKey(entry)
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(entry)
  })

  const report = {
    sourceFile: resolved,
    totalEntries: parsedEntries.length,
    generatedAt: new Date().toISOString(),
    groups: Object.fromEntries(
      Object.entries(grouped).map(([key, items]) => [key, summarizeGroup(items)]),
    ),
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
