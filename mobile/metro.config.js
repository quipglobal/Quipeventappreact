const { getDefaultConfig } = require('expo/metro-config');
const https = require('https');
const http = require('http');

const BACKEND =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://bef44c34-7df5-4c09-93a2-5684b5888527-00-3s6pvdiz19h8o.spock.replit.dev';

const backendUrl = new URL(BACKEND);
const transport = backendUrl.protocol === 'https:' ? https : http;

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (!req.url || !req.url.startsWith('/api')) {
        return metroMiddleware(req, res, next);
      }

      // Answer CORS preflight directly — never let it reach Expo's CorsMiddleware
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-Tenant-ID,Authorization,Accept',
          'Access-Control-Max-Age': '86400',
        });
        res.end();
        return;
      }

      // Proxy all other /api/* requests to the backend
      const targetPath =
        backendUrl.pathname.replace(/\/$/, '') + req.url;

      const options = {
        hostname: backendUrl.hostname,
        port: backendUrl.port || (backendUrl.protocol === 'https:' ? 443 : 80),
        path: targetPath,
        method: req.method,
        headers: {
          ...req.headers,
          host: backendUrl.hostname,
        },
      };

      const proxyReq = transport.request(options, (proxyRes) => {
        const responseHeaders = {
          ...proxyRes.headers,
          'Access-Control-Allow-Origin': '*',
        };
        res.writeHead(proxyRes.statusCode || 200, responseHeaders);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('[metro-proxy error]', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: { code: 'PROXY_ERROR', message: 'Backend unavailable.' },
        }));
      });

      req.pipe(proxyReq);
    };
  },
};

module.exports = config;
