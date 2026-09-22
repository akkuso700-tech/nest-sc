/**
 * acquisitionTracker.js
 * Endüstri standardı first-touch (ilk temas) ve kayıt noktası (conversion point) takip modülü.
 */

const STORAGE_KEY = 'ns_acquisition_data'

/**
 * Referrer ve UTM verisine göre trafik platformunu normalize eder.
 */
export function normalizePlatform(referrerUrl = '', utmSource = '') {
  const cleanUtm = String(utmSource || '').trim().toLowerCase()
  if (cleanUtm) {
    if (cleanUtm.includes('instagram') || cleanUtm === 'ig') return 'instagram'
    if (cleanUtm.includes('google')) return 'google'
    if (cleanUtm.includes('twitter') || cleanUtm === 'x' || cleanUtm === 'x.com') return 'twitter'
    if (cleanUtm.includes('tiktok')) return 'tiktok'
    if (cleanUtm.includes('facebook') || cleanUtm === 'fb') return 'facebook'
    if (cleanUtm.includes('youtube') || cleanUtm === 'yt') return 'youtube'
    if (cleanUtm.includes('linkedin')) return 'linkedin'
    return cleanUtm.slice(0, 40)
  }

  if (!referrerUrl) {
    return 'direct'
  }

  try {
    const url = new URL(referrerUrl)
    const hostname = url.hostname.toLowerCase()

    if (typeof window !== 'undefined' && hostname === window.location.hostname.toLowerCase()) {
      return 'direct'
    }

    if (hostname.includes('instagram.com') || hostname === 'l.instagram.com') return 'instagram'
    if (hostname.includes('google.')) return 'google'
    if (hostname.includes('t.co') || hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter'
    if (hostname.includes('tiktok.com')) return 'tiktok'
    if (hostname.includes('facebook.com') || hostname.includes('fb.com') || hostname.includes('l.facebook.com')) return 'facebook'
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
    if (hostname.includes('linkedin.com') || hostname.includes('lnkd.in')) return 'linkedin'
    if (hostname.includes('threads.net')) return 'threads'
    if (hostname.includes('whatsapp.com') || hostname.includes('wa.me')) return 'whatsapp'
    if (hostname.includes('t.me') || hostname.includes('telegram.org')) return 'telegram'
    if (hostname.includes('yandex.')) return 'yandex'
    if (hostname.includes('bing.com')) return 'bing'

    return hostname.replace(/^www\./, '').slice(0, 40) || 'referral'
  } catch {
    return 'referral'
  }
}

/**
 * Uygulama açılışında çağrılır. İlk temas verisini (First-touch attribution) kaydeder.
 */
export function initAcquisitionTracking() {
  if (typeof window === 'undefined') return

  try {
    const existingSession = sessionStorage.getItem(STORAGE_KEY)
    if (existingSession) {
      return // Zaten bu oturumda ilk temas kaydedilmiş
    }

    const searchParams = new URLSearchParams(window.location.search)
    const utmSource = searchParams.get('utm_source') || searchParams.get('ref') || ''
    const utmMedium = searchParams.get('utm_medium') || ''
    const utmCampaign = searchParams.get('utm_campaign') || ''
    const referrer = document.referrer || ''
    const platform = normalizePlatform(referrer, utmSource)
    const landingPage = window.location.pathname + window.location.search

    const payload = {
      platform,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      landingPage,
      recordedAt: Date.now(),
    }

    const serialized = JSON.stringify(payload)
    sessionStorage.setItem(STORAGE_KEY, serialized)

    // Tarayıcı sekmesi değişse bile kaybolmaması için localStorage yedeği (eğer 24 saatten eskiyse yenilenir)
    const existingLocal = localStorage.getItem(STORAGE_KEY)
    if (!existingLocal) {
      localStorage.setItem(STORAGE_KEY, serialized)
    }
  } catch {
    // Storage engelli durumlarda sessizce geç
  }
}

/**
 * Kayıt sayfasının veya butonun nereden tetiklendiğini belirler.
 */
export function resolveSourcePage(explicitHint = '') {
  if (explicitHint) {
    if (['shadow_mode', 'about', 'creators', 'login', 'normal'].includes(explicitHint)) {
      return explicitHint
    }
    if (explicitHint.includes('shadow') || explicitHint.includes('lounge') || explicitHint.includes('hidden-profile')) {
      return 'shadow_mode'
    }
    if (explicitHint.includes('about')) return 'about'
    if (explicitHint.includes('creator')) return 'creators'
    if (explicitHint.includes('login')) return 'login'
  }

  if (typeof window === 'undefined') return 'normal'

  try {
    const searchParams = new URLSearchParams(window.location.search)
    const querySource = (searchParams.get('source') || searchParams.get('from') || '').toLowerCase()
    const returnTo = (searchParams.get('returnTo') || '').toLowerCase()

    if (querySource.includes('shadow') || querySource.includes('lounge') || returnTo.includes('hidden-profile') || returnTo.includes('lounge')) {
      return 'shadow_mode'
    }
    if (querySource.includes('about') || returnTo.includes('about')) {
      return 'about'
    }
    if (querySource.includes('creator') || returnTo.includes('creator')) {
      return 'creators'
    }
    if (querySource.includes('login')) {
      return 'login'
    }

    const internalReferrer = (document.referrer || '').toLowerCase()
    if (internalReferrer.includes('/about')) return 'about'
    if (internalReferrer.includes('/hidden-profile') || internalReferrer.includes('/lounge')) return 'shadow_mode'
    if (internalReferrer.includes('/login')) return 'login'
  } catch {
    // pass
  }

  return 'normal'
}

/**
 * Kayıt esnasında sunucuya gönderilecek eksiksiz edinme nesnesini döndürür.
 */
export function getAcquisitionData(explicitSourcePage = '') {
  let stored = null

  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY)
      if (raw) {
        stored = JSON.parse(raw)
      }
    } catch {
      // pass
    }
  }

  const sourcePage = resolveSourcePage(explicitSourcePage)
  const currentReferrer = typeof document !== 'undefined' ? (document.referrer || '') : ''

  return {
    sourcePage,
    platform: stored?.platform || normalizePlatform(currentReferrer),
    referrer: stored?.referrer || currentReferrer,
    utmSource: stored?.utmSource || '',
    utmMedium: stored?.utmMedium || '',
    utmCampaign: stored?.utmCampaign || '',
    landingPage: stored?.landingPage || (typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : ''),
  }
}
