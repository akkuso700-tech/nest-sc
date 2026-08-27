import { defineConfig, devices } from '@playwright/test'
import process from 'node:process'

const externalBaseUrl = String(process.env.E2E_BASE_URL || '').trim()
const localBaseUrl = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 20000 },
  fullyParallel: true,
  workers: process.env.CI ? 3 : 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'gfx.webrender.all': false,
            'gfx.webrender.software': false,
            'layers.acceleration.disabled': true,
          },
        },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
