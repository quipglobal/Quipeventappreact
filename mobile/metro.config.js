const { getDefaultConfig } = require('expo/metro-config');
const https = require('https');
const http = require('http');

// Sniffed bearer token from any authenticated request
let _bearerToken = null;
// Last /reader/* response
let _lastReaderResponse = { url: null, status: null, body: null, ts: null };

const BACKEND =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://app.cxocollaborate.com';

console.log(`[metro-proxy] Proxying /api/* → ${BACKEND}`);

const backendUrl = new URL(BACKEND);
const transport = backendUrl.protocol === 'https:' ? https : http;

/** Make a direct authenticated request to the backend and return parsed JSON. */
function backendGet(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: backendUrl.hostname,
      port: backendUrl.port || 443,
      path,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': process.env.EXPO_PUBLIC_TENANT_ID || '3',
      },
    };
    const req = transport.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
        catch (e) { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {

      // ── Debug: last reader response ───────────────────────────────────────
      if (req.url === '/debug/reader-response') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(_lastReaderResponse, null, 2));
        return;
      }

      // ── Debug: fetch reader docs with sniffed token ───────────────────────
      if (req.url === '/debug/fetch-reader' && req.method === 'GET') {
        if (!_bearerToken) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No token sniffed yet — make any authenticated call in the web app first' }));
          return;
        }
        backendGet('/api/v1/mobile/reader/documents', _bearerToken)
          .then(({ status, body }) => {
            console.log(`\n[metro-proxy] /debug/fetch-reader → ${status}`);
            console.log(JSON.stringify(body, null, 2));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status, body }, null, 2));
          })
          .catch((e) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          });
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

      // ── Sniff bearer token ────────────────────────────────────────────────
      const auth = req.headers['authorization'];
      if (auth && auth.startsWith('Bearer ') && !_bearerToken) {
        _bearerToken = auth.slice(7);
        console.log('[metro-proxy] 🔑 Bearer token captured — /debug/fetch-reader is ready');
        // Immediately fetch reader docs to confirm what the backend returns
        backendGet('/api/v1/mobile/reader/documents', _bearerToken)
          .then(({ status, body }) => {
            _lastReaderResponse = { url: '/api/v1/mobile/reader/documents', status, body, ts: new Date().toISOString() };
            console.log(`\n[metro-proxy] AUTO READER FETCH → ${status}`);
            const items = body?.data?.data ?? body?.data ?? [];
            if (Array.isArray(items)) {
              items.slice(0, 3).forEach((item, i) => {
                console.log(`  [${i}] id=${item.id} title="${item.title}" file_url=${JSON.stringify(item.file_url ?? item.pdf_url ?? item.url ?? 'N/A')}`);
              });
            } else {
              console.log(JSON.stringify(body, null, 2));
            }
          })
          .catch((e) => console.error('[metro-proxy] auto reader fetch error:', e.message));
      }

      const targetPath = backendUrl.pathname.replace(/\/$/, '') + req.url;

      const options = {
        hostname: backendUrl.hostname,
        port: backendUrl.port || (backendUrl.protocol === 'https:' ? 443 : 80),
        path: targetPath,
        method: req.method,
        headers: { ...req.headers, host: backendUrl.hostname },
      };

      const proxyReq = transport.request(options, (proxyRes) => {
        const responseHeaders = {
          ...proxyRes.headers,
          'Access-Control-Allow-Origin': '*',
        };

        const isReaderRoute = req.url && req.url.includes('/reader/');
        if (isReaderRoute) {
          const chunks = [];
          proxyRes.on('data', (chunk) => chunks.push(chunk));
          proxyRes.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            console.log(`[metro-proxy] ${req.method} ${req.url} → ${proxyRes.statusCode}`);
            try {
              const parsed = JSON.parse(body);
              _lastReaderResponse = { url: req.url, status: proxyRes.statusCode, body: parsed, ts: new Date().toISOString() };
              // Log file_url field specifically for quick diagnosis
              const data = parsed?.data?.data ?? parsed?.data;
              if (Array.isArray(data)) {
                data.slice(0, 5).forEach((item, i) => {
                  console.log(`  [${i}] "${item.title}" file_url=${JSON.stringify(item.file_url ?? null)}`);
                });
              } else if (data && typeof data === 'object') {
                console.log(`  file_url=${JSON.stringify(data.file_url ?? null)} url=${JSON.stringify(data.url ?? null)}`);
              }
            } catch {
              _lastReaderResponse = { url: req.url, status: proxyRes.statusCode, body: body.slice(0, 4000), ts: new Date().toISOString() };
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
        res.end(JSON.stringify({ success: false, error: { code: 'PROXY_ERROR', message: 'Backend unavailable.' } }));
      });

      req.pipe(proxyReq);
    };
  },
};

module.exports = config;
