const { LocationConsentLog } = require('../models/LocationConsentLog')

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
}
