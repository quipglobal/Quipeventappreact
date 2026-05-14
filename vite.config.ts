import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const BACKEND =
  process.env.VITE_API_BASE_URL ??
  'https://bef44c34-7df5-4c09-93a2-5684b5888527-00-3s6pvdiz19h8o.spock.replit.dev';

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
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p,
      },
      // Backend serves uploaded media (avatars, etc.) from /storage/...
      '/storage': {
        target: BACKEND,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p,
      },
    },
  },
})
