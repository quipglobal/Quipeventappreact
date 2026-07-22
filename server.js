import express from 'express';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

const BACKEND =
  process.env.VITE_API_BASE_URL ||
  'https://app.cxocollaborate.com';

const backendUrl = new URL(BACKEND);
const DIST_DIR = path.join(__dirname, 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

console.log(`[server] dist dir: ${DIST_DIR}`);
console.log(`[server] backend:  ${BACKEND}`);

function proxyTo(prefix) {
  return (req, res) => {
    const fullPath = backendUrl.pathname.replace(/\/$/, '') + prefix + req.url;
    const options = {
      hostname: backendUrl.hostname,
      port: backendUrl.port || (backendUrl.protocol === 'https:' ? 443 : 80),
      path: fullPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: backendUrl.hostname,
      },
    };

    const transport = backendUrl.protocol === 'https:' ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      Object.entries(proxyRes.headers).forEach(([k, v]) => {
        if (v !== undefined) res.setHeader(k, v);
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[proxy error]', err.message);
      res.status(502).json({ success: false, error: { code: 'PROXY_ERROR', message: 'Backend unavailable.' } });
    });

    req.pipe(proxyReq);
  };
}

app.use('/api',     proxyTo('/api'));
app.use('/storage', proxyTo('/storage'));

app.use(express.static(DIST_DIR));

app.use((_req, res) => {
  res.sendFile(INDEX_HTML, (err) => {
    if (err) {
      console.error('[server] sendFile error:', err.message, '| path:', INDEX_HTML);
      if (!res.headersSent) {
        res.status(200).send(
          '<!DOCTYPE html><html><head><meta charset="utf-8">' +
          '<title>CXO</title></head><body>' +
          '<script>window.location.reload();</script>' +
          '</body></html>'
        );
      }
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on port ${PORT}`);
  console.log(`[server] proxying /api → ${BACKEND}`);
});
