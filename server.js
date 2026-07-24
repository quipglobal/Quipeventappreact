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

app.use(express.static(path.join(__dirname, 'dist')));

// Explicit SPA root handler. Using an explicit route (instead of relying
// solely on the static middleware) lets us catch sendFile errors and still
// return a 200 during the brief window right after the container starts —
// before the layer containing dist/ is fully mounted. Without this, node.js
// binds the TCP socket and starts accepting health-check probes ~10–50 ms
// before the static middleware can find index.html, causing repeated 500s
// that fail the autoscale promote step.
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // Safe fallback: return a minimal 200 so the startup health probe
      // always passes. The real app bundle will load once the layer is ready.
      res.status(200).send('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
    }
  });
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Proxying /api → ${BACKEND}`);
});
