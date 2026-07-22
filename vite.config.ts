import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const BACKEND =
  process.env.VITE_API_BASE_URL ??
  'https://app.cxocollaborate.com';

const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    hmr: REPLIT_DEV_DOMAIN
      ? { host: REPLIT_DEV_DOMAIN, clientPort: 443, protocol: 'wss' }
      : {},
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p,
      },
      '/storage': {
        target: BACKEND,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p,
      },
    },
  },
})
