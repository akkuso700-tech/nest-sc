function resolveAppEnvironment() {
  if (typeof window !== 'undefined') {
    const hostname = String(window.location.hostname || '')
      .trim()
      .toLowerCase()
      .replace(/^www\./, '')

    if (hostname === 'demo.nest-sc.com') {
      return 'demo'
    }

    if (hostname === 'nest-sc.com') {
      return 'live'
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'local'
    }
  }

  return `${import.meta.env.VITE_APP_ENV || 'live'}`.trim().toLowerCase()
}

const rawAppEnvironment = resolveAppEnvironment()

const appEnvironment = ['local', 'demo', 'live'].includes(rawAppEnvironment)
  ? rawAppEnvironment
  : 'live'
const isLocalEnvironment = appEnvironment === 'local'
const isDemoEnvironment = appEnvironment === 'demo'
const isLiveEnvironment = appEnvironment === 'live'
const appEnvironmentLabel = isLocalEnvironment
  ? 'Local Ortam'
  : isDemoEnvironment
    ? 'Demo Ortami'
    : 'Canli'

export {
  appEnvironment,
  appEnvironmentLabel,
  isDemoEnvironment,
  isLiveEnvironment,
  isLocalEnvironment,
}
