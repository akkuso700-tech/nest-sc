const fs = require('fs')
const path = require('path')

function getHealth(req, res) {
  const backendRootDir = path.resolve(__dirname, '../..')
  const frontendReady = ['frontend-dist', 'public'].some((directoryName) =>
    fs.existsSync(path.join(backendRootDir, directoryName, 'index.html')),
  )

  res.json({
    status: 'ok',
    service: 'my-social-1-api',
    frontendReady,
    release: 'frontend-bundle-v1',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  })
}

module.exports = { getHealth }
