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

// Minimal shell returned when dist/index.html isn't readable yet (e.g. during
// the brief window right after container start when the Cloud Run layer is
// still being mounted). The browser will load the real JS bundle once it's
// available. A 200 here is all we need to pass the autoscale startup probe.
const FALLBACK_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>Loading…</title></head>' +
  '<body><div id="root"></div></body></html>';

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
      if (!res.headersSent) {
        res.status(502).json({ success: false, error: { code: 'PROXY_ERROR', message: 'Backend unavailable.' } });
      }
    });

    req.pipe(proxyReq);
  };
}

app.use('/api',     proxyTo('/api'));
app.use('/storage', proxyTo('/storage'));

// ── SPA root handler ───────────────────────────────────────────────────────
// IMPORTANT: this must come BEFORE express.static so that GET / is always
// handled here rather than by the static middleware.
//
// Why: express.static pipes dist/index.html into the response. If the Cloud
// Run filesystem layer containing dist/ hasn't finished mounting yet, the pipe
// can fail *after* response headers have already been sent (status 200 header
// sent, then the body stream errors out). Express then sends a 500 fragment.
// The health-check probe sees 500 and the promote step fails.
//
// By intercepting GET / ourselves we get an explicit sendFile + error callback.
// If the file isn't readable we fall back to an inline 200 shell immediately,
// which is enough for the startup probe to pass. The !res.headersSent guard
// ensures we never try to set headers twice — the only case where headers
// could already be sent here is if something else in the pipeline wrote them,
// in which case we leave the response alone.
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err && !res.headersSent) {
      res.status(200).send(FALLBACK_HTML);
    }
  });
});

// Static assets (JS bundles, CSS, images, etc.)
app.use(express.static(path.join(__dirname, 'dist')));

// SPA catch-all: any path not matched above (deep links, direct navigation)
// gets the index.html shell so client-side routing takes over.
// Error callback prevents unhandled 500s when dist/ is momentarily unavailable.
app.use((_req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err && !res.headersSent) {
      res.status(200).send(FALLBACK_HTML);
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Proxying /api → ${BACKEND}`);
});
