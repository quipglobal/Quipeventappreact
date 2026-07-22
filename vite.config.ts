import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const BACKEND =
  process.env.VITE_API_BASE_URL ??
  'https://app.cxocollaborate.com';

/**
 * Keeps the Vite HMR WebSocket alive through the Replit proxy.
 * The Replit proxy drops idle WS connections after ~4 seconds, which Vite's
 * client misinterprets as a server restart and triggers a full page reload,
 * causing the splash screen loop in development.
 * Sending a WebSocket ping every 2.5 s prevents the proxy from treating
 * the connection as idle.
 */
function wsKeepAlive(): Plugin {
  return {
    name: 'ws-keep-alive',
    configureServer(server) {
      // Send a Vite custom event every 2 s as a real TEXT data frame.
      // The Replit proxy drops idle WebSocket connections after ~4 s;
      // sending actual data keeps it alive. Vite clients silently ignore
      // custom events that have no registered handler.
      const iv = setInterval(() => {
        server.ws.send({ type: 'custom', event: 'keepalive', data: {} });
      }, 2000);
      server.httpServer?.once('close', () => clearInterval(iv));
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wsKeepAlive(),
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
