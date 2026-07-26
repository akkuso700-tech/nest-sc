const rawAppEnvironment = `${import.meta.env.VITE_APP_ENV || 'live'}`
  .trim()
  .toLowerCase()

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