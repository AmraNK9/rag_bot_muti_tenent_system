declare module 'vite' {
  export function defineConfig(config: any): any
}

declare module '@vitejs/plugin-react' {
  const reactPlugin: any
  export default reactPlugin
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /api/* to backend during development — avoids CORS issues
      '/api': {
        target: 'http://localhost:4321',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4321',
        changeOrigin: true,
      },
    },
  },
})
