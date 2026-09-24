const mongoose = require('mongoose')
const { env } = require('../src/config/env')
const { User } = require('../src/models/User')
const { lookupIpLocation } = require('../src/services/locationService')

async function runBackfill() {
  console.log(`[backfillIpLocations] Connecting to MongoDB...`)
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
  })
  console.log(`[backfillIpLocations] Connected to database: ${mongoose.connection.name}`)

  const users = await User.find({
    'signupConsent.ipAddress': { $exists: true, $ne: '' },
  })

  console.log(`[backfillIpLocations] Found ${users.length} users with ipAddress.`)

  let updatedCount = 0
  let unchangedCount = 0

  for (const user of users) {
    const ip = user.signupConsent?.ipAddress
    if (!ip || ip === 'Unknown') {
      unchangedCount++
      continue
    }

    const geo = lookupIpLocation(ip)
    const existingCity = user.signupConsent.city || ''
    const existingCountry = user.signupConsent.country || ''

    const newCity = existingCity && existingCity !== 'Unknown' ? existingCity : geo.city
    const newCountry = existingCountry && existingCountry !== 'Unknown' ? existingCountry : geo.country

    let needsSave = false

    if (newCity !== existingCity) {
      user.signupConsent.city = newCity
      needsSave = true
    }

    if (newCountry !== existingCountry) {
      user.signupConsent.country = newCountry
      needsSave = true
    }

    if (needsSave) {
      await user.save()
      console.log(`Updated user @${user.username} (${ip}) -> ${newCity || '-'}, ${newCountry || '-'}`)
      updatedCount++
    } else {
      unchangedCount++
    }
  }

  console.log(`\n[backfillIpLocations] Finished! Updated: ${updatedCount}, Unchanged: ${unchangedCount}`)
  await mongoose.disconnect()
}

runBackfill().catch((err) => {
  console.error('[backfillIpLocations] Error:', err)
  process.exit(1)
})
