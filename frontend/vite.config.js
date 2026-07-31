import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../backend/public'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-router') || id.includes('@remix-run/router')) {
            return 'vendor-router'
          }
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'vendor-i18n'
          }
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
            return 'vendor-realtime'
          }
          if (id.includes('zod')) {
            return 'vendor-validation'
          }
          if (id.includes('react-helmet-async')) {
            return 'vendor-seo'
          }
          if (id.includes('/node_modules/hls.js/')) {
            return 'vendor-hls'
          }
          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
