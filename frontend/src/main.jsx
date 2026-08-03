import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { startWebVitalsReporting } from './lib/webVitalsReporter.js'
import {
  installGlobalErrorReporting,
  reportClientError,
} from './lib/clientErrorReporter.js'

const APP_BOOTSTRAP_TIMEOUT_MS = 15000

startWebVitalsReporting()

const root = createRoot(document.getElementById('root'))
let applicationMounted = false
let bootstrapFailureRendered = false

function BootstrapFailure() {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-5 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <section
        className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-7 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900"
        role="alert"
      >
        <h1 className="text-xl font-semibold">Uygulama yüklenemedi</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Bağlantı beklenenden uzun sürdü veya gerekli bir dosya alınamadı.
        </p>
        <button
          type="button"
          className="mt-6 rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-zinc-950"
          onClick={() => window.location.reload()}
        >
          Tekrar dene
        </button>
      </section>
    </main>
  )
}

function renderBootstrapFailure(error) {
  if (applicationMounted || bootstrapFailureRendered) return
  bootstrapFailureRendered = true
  reportClientError(error, { kind: 'bootstrap' })
  root.render(
    <StrictMode>
      <BootstrapFailure />
    </StrictMode>,
  )
}

function withTimeout(promise, timeoutMs) {
  let timerId
  const timeoutPromise = new Promise((_, reject) => {
    timerId = window.setTimeout(() => {
      const error = new Error('Application bootstrap timed out.')
      error.code = 'APP_BOOTSTRAP_TIMEOUT'
      reject(error)
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timerId))
}

installGlobalErrorReporting({ onFatalBootstrapError: renderBootstrapFailure })

root.render(
  <StrictMode>
    <main
      className="min-h-screen grid place-items-center bg-zinc-50 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
      aria-busy="true"
      aria-live="polite"
    >
      Yükleniyor...
    </main>
  </StrictMode>,
)

async function bootstrapApp() {
  const [
    { BrowserRouter },
    { HelmetProvider },
    { default: App },
    { AuthProvider },
    { ThemeProvider },
    { UploadManagerProvider },
  ] = await withTimeout(
    Promise.all([
      import('react-router-dom'),
      import('react-helmet-async'),
      import('./App.jsx'),
      import('./store/AuthContext.jsx'),
      import('./store/ThemeContext.jsx'),
      import('./features/uploads/UploadManagerContext.jsx'),
      import('./i18n/index.js'),
    ]),
    APP_BOOTSTRAP_TIMEOUT_MS,
  )

  const { default: AppErrorBoundary } = await withTimeout(
    import('./components/common/AppErrorBoundary.jsx'),
    APP_BOOTSTRAP_TIMEOUT_MS,
  )

  applicationMounted = true

  root.render(
    <StrictMode>
      <AppErrorBoundary>
        <HelmetProvider>
          <ThemeProvider>
            <AuthProvider>
              <UploadManagerProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </UploadManagerProvider>
            </AuthProvider>
          </ThemeProvider>
        </HelmetProvider>
      </AppErrorBoundary>
    </StrictMode>,
  )
}

bootstrapApp().catch(renderBootstrapFailure)
