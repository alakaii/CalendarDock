/**
 * Standalone Vite config for renderer-only dev server (browser preview).
 * Used by `npm run preview:web` — does NOT launch Electron.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: '127.0.0.1'
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  }
})
