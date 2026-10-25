import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_URL || env.BACKEND_URL || 'http://10.0.10.52:8080'

  return {
    plugins: [react()],
    build: {
      target: 'esnext'
    },
    optimizeDeps: {
      exclude: ['@novnc/novnc']
    },
    server: {
      host: '0.0.0.0',
      proxy: {
        '/auth': backendTarget,
        '/ping': backendTarget,
        '/nodes': backendTarget,
        '/projects': backendTarget,
        '/vms': {
          target: backendTarget,
          ws: true
        },
        '/labs': backendTarget,
        '/teacher': backendTarget
      }
    }
  }
})

