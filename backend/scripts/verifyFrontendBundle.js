const fs = require('fs')
const path = require('path')

const frontendIndexPath = path.resolve(__dirname, '../frontend-dist/index.html')

if (!fs.existsSync(frontendIndexPath)) {
  console.error(`Bundled frontend is missing: ${frontendIndexPath}`)
  process.exit(1)
}

console.log('Bundled frontend is ready for Hostinger deployment.')
