import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext'
  },
  optimizeDeps: {
    exclude: ['@novnc/novnc']
  },
  server: {
    proxy: {
      '/auth': 'http://127.0.0.1:8080',
      '/ping': 'http://127.0.0.1:8080',
      '/nodes': 'http://127.0.0.1:8080',
      '/vms': {
        target: 'http://127.0.0.1:8080',
        ws: true
      },
      '/labs': 'http://127.0.0.1:8080',
      '/teacher': 'http://127.0.0.1:8080'
    }
  }
})

