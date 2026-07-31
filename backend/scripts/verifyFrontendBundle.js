const fs = require('fs')
const path = require('path')

const frontendDir = path.resolve(__dirname, '../frontend-dist')
const frontendIndexPath = path.join(frontendDir, 'index.html')
const frontendAssetsPath = path.join(frontendDir, 'assets')

if (!fs.existsSync(frontendIndexPath) || !fs.existsSync(frontendAssetsPath)) {
  console.error(`Bundled frontend is missing or incomplete: ${frontendDir}`)
  process.exit(1)
}

console.log('Bundled frontend is ready for Hostinger deployment.')
