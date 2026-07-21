const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 5000;
const BACKEND = process.env.VITE_API_BASE_URL || 'https://app.cxocollaborate.com';
const DIST = path.join(__dirname, 'dist');
const backendUrl = new URL(BACKEND);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.webp': 'image/webp',
  '.gz':   'application/gzip',
};

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const target = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(DIST, target);

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat || !stat.isFile()) {
      fs.readFile(path.join(DIST, 'index.html'), (err2, data) => {
        if (err2) { res.writeHead(500); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyRequest(req, res) {
  const fullPath = backendUrl.pathname.replace(/\/$/, '') + req.url;
  const opts = {
    hostname: backendUrl.hostname,
    port: backendUrl.port || (backendUrl.protocol === 'https:' ? 443 : 80),
    path: fullPath,
    method: req.method,
    headers: { ...req.headers, host: backendUrl.hostname },
  };
  const transport = backendUrl.protocol === 'https:' ? https : http;
  const proxyReq = transport.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('[proxy error]', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: { code: 'PROXY_ERROR', message: 'Backend unavailable.' } }));
    }
  });
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url.startsWith('/api') || url.startsWith('/storage')) {
    proxyRequest(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Proxying /api \u2192 ${BACKEND}`);
});
