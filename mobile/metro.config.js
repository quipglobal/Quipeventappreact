const { getDefaultConfig } = require('expo/metro-config');
const https = require('https');
const http = require('http');

// Stores the last /reader/documents response so we can curl /debug/reader-response
let _lastReaderResponse = { url: null, status: null, body: null, ts: null };

const BACKEND =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://app.cxocollaborate.com';

console.log(`[metro-proxy] Proxying /api/* → ${BACKEND}`);

const backendUrl = new URL(BACKEND);
const transport = backendUrl.protocol === 'https:' ? https : http;

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      // Debug endpoint — curl http://localhost:8080/debug/reader-response
      if (req.url === '/debug/reader-response') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(_lastReaderResponse, null, 2));
        return;
      }

      if (!req.url || (!req.url.startsWith('/api') && !req.url.startsWith('/mobile'))) {
        return metroMiddleware(req, res, next);
      }

      // Answer CORS preflight directly
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

        const isReaderRoute = req.url && req.url.includes('/reader/documents');
        if (isReaderRoute) {
          const chunks = [];
          proxyRes.on('data', (chunk) => chunks.push(chunk));
          proxyRes.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            console.log(`[metro-proxy] ${req.method} ${req.url} → ${proxyRes.statusCode}`);
            try {
              const parsed = JSON.parse(body);
              _lastReaderResponse = { url: req.url, status: proxyRes.statusCode, body: parsed, ts: new Date().toISOString() };
              console.log('[metro-proxy] READER RESPONSE:', JSON.stringify(parsed, null, 2));
            } catch {
              _lastReaderResponse = { url: req.url, status: proxyRes.statusCode, body: body.slice(0, 4000), ts: new Date().toISOString() };
              console.log('[metro-proxy] READER RESPONSE (raw):', body.slice(0, 2000));
            }
            res.writeHead(proxyRes.statusCode || 200, responseHeaders);
            res.end(body);
          });
        } else {
          res.writeHead(proxyRes.statusCode || 200, responseHeaders);
          proxyRes.pipe(res);
        }
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
