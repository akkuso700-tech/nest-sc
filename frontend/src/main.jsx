import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { startWebVitalsReporting } from './lib/webVitalsReporter.js'

startWebVitalsReporting()

const root = createRoot(document.getElementById('root'))

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
  ] = await Promise.all([
    import('react-router-dom'),
    import('react-helmet-async'),
    import('./App.jsx'),
    import('./store/AuthContext.jsx'),
    import('./store/ThemeContext.jsx'),
    import('./features/uploads/UploadManagerContext.jsx'),
    import('./i18n/index.js'),
  ])

  root.render(
    <StrictMode>
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
    </StrictMode>,
  )
}

bootstrapApp()
