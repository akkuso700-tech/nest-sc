const geoip = require('geoip-lite')
const { LocationConsentLog } = require('../models/LocationConsentLog')

let trCountryDisplay = null
try {
  trCountryDisplay = new Intl.DisplayNames(['tr'], { type: 'region' })
} catch {
  trCountryDisplay = null
}

function isPrivateIp(ip) {
  if (!ip) return true
  const cleanIp = String(ip).trim()
  if (['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'].includes(cleanIp)) return true
  if (cleanIp.startsWith('10.') || cleanIp.startsWith('192.168.')) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)) return true
  if (cleanIp.startsWith('fc00:') || cleanIp.startsWith('fe80:')) return true
  return false
}

function lookupIpLocation(ipAddress) {
  if (!ipAddress) {
    return {
      city: '',
      country: '',
      countryCode: '',
      region: '',
      latitude: null,
      longitude: null,
      isLocal: false,
    }
  }

  let cleanIp = String(ipAddress).split(',')[0].trim()
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.replace('::ffff:', '')
  }

  if (isPrivateIp(cleanIp)) {
    return {
      city: 'Yerel Ağ',
      country: 'Localhost',
      countryCode: 'LOCAL',
      region: '',
      latitude: null,
      longitude: null,
      isLocal: true,
    }
  }

  try {
    const geo = geoip.lookup(cleanIp)
    if (!geo) {
      return {
        city: '',
        country: '',
        countryCode: '',
        region: '',
        latitude: null,
        longitude: null,
        isLocal: false,
      }
    }

    let countryName = geo.country || ''
    if (trCountryDisplay && geo.country) {
      try {
        countryName = trCountryDisplay.of(geo.country) || geo.country
      } catch {
        countryName = geo.country || ''
      }
    }

    let city = (geo.city || '').trim()
    if (city.toLowerCase() === 'istanbul') {
      city = 'İstanbul'
    } else if (city.toLowerCase() === 'izmir') {
      city = 'İzmir'
    }

    return {
      city,
      country: countryName,
      countryCode: geo.country || '',
      region: geo.region || '',
      latitude: Array.isArray(geo.ll) ? geo.ll[0] : null,
      longitude: Array.isArray(geo.ll) ? geo.ll[1] : null,
      isLocal: false,
    }
  } catch {
    return {
      city: '',
      country: '',
      countryCode: '',
      region: '',
      latitude: null,
      longitude: null,
      isLocal: false,
    }
  }
}

function roundCoordinate(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {

    return null
  }

  return Number(value.toFixed(2))
}

function normalizeAccuracy(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  return Math.max(Math.round(value), 0)
}

function normalizeApproximateLocation(payload = {}, fallbackLocation = {}) {
  const status = payload.status === 'denied' ? 'denied' : 'granted'
  const now = new Date()
  const city = (payload.city || fallbackLocation.city || '').trim()
  const country = (payload.country || fallbackLocation.country || '').trim()
  const latitude =
    typeof payload.latitude === 'number' && !Number.isNaN(payload.latitude)
      ? Number(payload.latitude)
      : null
  const longitude =
    typeof payload.longitude === 'number' && !Number.isNaN(payload.longitude)
      ? Number(payload.longitude)
      : null
  const latRounded = roundCoordinate(payload.latitude)
  const lngRounded = roundCoordinate(payload.longitude)
  const accuracy = normalizeAccuracy(payload.accuracy)
  const source = (payload.source || 'browser-geolocation').trim()

  return {
    status,
    source,
    city,
    country,
    latitude,
    longitude,
    latRounded,
    lngRounded,
    accuracy,
    consentGivenAt: now,
    lastSeenAt: now,
  }
}

function calculateDistanceKm(origin = {}, target = {}) {
  const lat1 = typeof origin.latitude === 'number' ? origin.latitude : origin.latRounded
  const lng1 = typeof origin.longitude === 'number' ? origin.longitude : origin.lngRounded
  const lat2 = typeof target.latitude === 'number' ? target.latitude : target.latRounded
  const lng2 = typeof target.longitude === 'number' ? target.longitude : target.lngRounded

  if (
    typeof lat1 !== 'number' ||
    typeof lng1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lng2 !== 'number'
  ) {
    return null
  }

  const toRadians = (value) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const deltaLat = toRadians(lat2 - lat1)
  const deltaLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Number((earthRadiusKm * c).toFixed(1))
}

async function logLocationConsent({
  userId,
  status,
  source,
  city,
  country,
  latitude,
  longitude,
  latRounded,
  lngRounded,
  accuracy,
  consentGivenAt,
  lastSeenAt,
}) {
  return LocationConsentLog.create({
    user: userId,
    status,
    source,
    city,
    country,
    latitude,
    longitude,
    latRounded,
    lngRounded,
    accuracy,
    consentGivenAt,
    lastSeenAt,
  })
}

module.exports = {
  normalizeApproximateLocation,
  calculateDistanceKm,
  logLocationConsent,
  lookupIpLocation,
  isPrivateIp,
}
