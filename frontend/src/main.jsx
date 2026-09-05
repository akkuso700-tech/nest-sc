import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import { AuthProvider } from './store/AuthContext.jsx'
import { ThemeProvider } from './store/ThemeContext.jsx'
import { UploadManagerProvider } from './features/uploads/UploadManagerContext.jsx'
import AppErrorBoundary from './components/common/AppErrorBoundary.jsx'
import './i18n/index.js'
import './index.css'
import { startWebVitalsReporting } from './lib/webVitalsReporter.js'
import {
  installGlobalErrorReporting,
  reportClientError,
} from './lib/clientErrorReporter.js'

startWebVitalsReporting()

const rootElement = document.getElementById('root')
const root = createRoot(rootElement)

installGlobalErrorReporting({
  onFatalBootstrapError: (error) => {
    reportClientError(error, { kind: 'bootstrap' })
  },
})

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

