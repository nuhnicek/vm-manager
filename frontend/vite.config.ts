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
      '/auth': 'http://localhost:8080',
      '/ping': 'http://localhost:8080',
      '/vms': 'http://localhost:8080',
    }
  }
})

