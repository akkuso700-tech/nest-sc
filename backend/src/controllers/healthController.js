function getHealth(req, res) {
  res.json({
    status: 'ok',
    service: 'my-social-1-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  })
}

module.exports = { getHealth }
