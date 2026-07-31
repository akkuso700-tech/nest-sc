import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const frontendDirectory = path.resolve(scriptDirectory, '..')
const outputDirectory = path.resolve(frontendDirectory, '../backend/public')
const indexPath = path.join(outputDirectory, 'index.html')

const budgets = {
  htmlGzipBytes: 5 * 1024,
  initialCssGzipBytes: 24 * 1024,
  initialJavaScriptGzipBytes: 145 * 1024,
  largestJavaScriptChunkGzipBytes: 65 * 1024,
  lazyHlsChunkGzipBytes: 115 * 1024,
}

function gzipSize(filePath) {
  return gzipSync(fs.readFileSync(filePath)).length
}

function formatKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`
}

function resolveOutputAsset(assetUrl) {
  return path.join(outputDirectory, assetUrl.replace(/^\/+/, ''))
}

if (!fs.existsSync(indexPath)) {
  throw new Error(`Production output was not found: ${indexPath}`)
}

const indexHtml = fs.readFileSync(indexPath, 'utf8')
const initialAssetUrls = [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
  (match) => match[1],
)
const initialJavaScriptFiles = initialAssetUrls
  .filter((assetUrl) => assetUrl.endsWith('.js'))
  .map(resolveOutputAsset)
const initialCssFiles = initialAssetUrls
  .filter((assetUrl) => assetUrl.endsWith('.css'))
  .map(resolveOutputAsset)
const allJavaScriptFiles = fs
  .readdirSync(path.join(outputDirectory, 'assets'))
  .filter((fileName) => fileName.endsWith('.js'))
  .map((fileName) => path.join(outputDirectory, 'assets', fileName))
const regularJavaScriptFiles = allJavaScriptFiles.filter(
  (filePath) => !path.basename(filePath).startsWith('vendor-hls-'),
)
const hlsJavaScriptFiles = allJavaScriptFiles.filter(
  (filePath) => path.basename(filePath).startsWith('vendor-hls-'),
)

const measurements = {
  htmlGzipBytes: gzipSize(indexPath),
  initialCssGzipBytes: initialCssFiles.reduce((total, filePath) => total + gzipSize(filePath), 0),
  initialJavaScriptGzipBytes: initialJavaScriptFiles.reduce(
    (total, filePath) => total + gzipSize(filePath),
    0,
  ),
  largestJavaScriptChunkGzipBytes: Math.max(...regularJavaScriptFiles.map(gzipSize), 0),
  lazyHlsChunkGzipBytes: Math.max(...hlsJavaScriptFiles.map(gzipSize), 0),
}

const failures = Object.entries(measurements).filter(
  ([metricName, measuredBytes]) => measuredBytes > budgets[metricName],
)

console.log('Performance budget report:')
Object.entries(measurements).forEach(([metricName, measuredBytes]) => {
  console.log(
    `- ${metricName}: ${formatKilobytes(measuredBytes)} / ${formatKilobytes(budgets[metricName])}`,
  )
})

if (failures.length) {
  console.error('\nPerformance budget exceeded:')
  failures.forEach(([metricName, measuredBytes]) => {
    console.error(
      `- ${metricName}: ${formatKilobytes(measuredBytes)} > ${formatKilobytes(budgets[metricName])}`,
    )
  })
  process.exitCode = 1
}
