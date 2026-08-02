const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { env } = require('../src/config/env')
const { publishToMountedMediaRoot } = require('../src/services/loopVideoPublishingService')

test('publishes a completed HLS package atomically to a mounted Hostinger media root', async () => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'loop-mounted-publish-'))
  const outputDirectory = path.join(temporaryRoot, 'adaptive')
  const renditionDirectory = path.join(outputDirectory, '360p')
  const previousMediaRoot = env.loopHostingerMediaRoot
  const previousPublicBaseUrl = env.hostingerPublicBaseUrl

  try {
    await fs.promises.mkdir(renditionDirectory, { recursive: true })
    await Promise.all([
      fs.promises.writeFile(path.join(outputDirectory, 'master.m3u8'), '#EXTM3U\n360p/index.m3u8\n'),
      fs.promises.writeFile(path.join(outputDirectory, 'poster.webp'), 'poster'),
      fs.promises.writeFile(path.join(renditionDirectory, 'index.m3u8'), '#EXTM3U\nsegment-00000.ts\n'),
      fs.promises.writeFile(path.join(renditionDirectory, 'segment-00000.ts'), 'segment'),
      fs.promises.writeFile(path.join(renditionDirectory, '360p.mp4'), 'fallback'),
    ])
    env.loopHostingerMediaRoot = path.join(temporaryRoot, 'media')
    env.hostingerPublicBaseUrl = 'https://upload.nest-sc.com'

    const published = await publishToMountedMediaRoot({
      outputDirectory,
      masterPath: path.join(outputDirectory, 'master.m3u8'),
      posterPath: path.join(outputDirectory, 'poster.webp'),
      fallbackMp4Path: path.join(renditionDirectory, '360p.mp4'),
      durationSeconds: 12,
      width: 720,
      height: 1280,
      renditions: [{
        name: '360p',
        width: 360,
        height: 640,
        bitrateKbps: 600,
        manifestPath: path.join(renditionDirectory, 'index.m3u8'),
      }],
    })

    assert.match(published.hlsUrl, /^https:\/\/upload\.nest-sc\.com\/media\/loops\/[0-9a-f-]+\/master\.m3u8$/)
    assert.match(published.url, /\/360p\/360p\.mp4$/)
    const packageId = new URL(published.hlsUrl).pathname.split('/')[3]
    const publishedRoot = path.join(env.loopHostingerMediaRoot, 'loops', packageId)
    assert.equal(await fs.promises.readFile(path.join(publishedRoot, 'poster.webp'), 'utf8'), 'poster')
    assert.equal(await fs.promises.readFile(path.join(publishedRoot, '360p', 'segment-00000.ts'), 'utf8'), 'segment')
    const entries = await fs.promises.readdir(path.join(env.loopHostingerMediaRoot, 'loops'))
    assert.equal(entries.some((entry) => entry.startsWith('.publishing-')), false)
  } finally {
    env.loopHostingerMediaRoot = previousMediaRoot
    env.hostingerPublicBaseUrl = previousPublicBaseUrl
    await fs.promises.rm(temporaryRoot, { recursive: true, force: true })
  }
})
