import http from 'http';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;

const BACKEND =
  process.env.VITE_API_BASE_URL ||
  'https://app.cxocollaborate.com';

const backendUrl = new URL(BACKEND);

const FALLBACK_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>Loading…</title></head>' +
  '<body><div id="root"></div></body></html>';

// Placeholder request handler — replaced with the full Express app once it
// finishes loading. Any health-check probe that fires during startup gets an
// immediate 200 so the autoscale promote step does not see "connection refused"
// or 500.
let handle = (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(FALLBACK_HTML);
};

// Bind the port immediately using only built-in modules (no package loading
// needed). This keeps the startup window — before Express has loaded — short
// enough for the autoscale health-check probe to succeed.
const server = http.createServer((req, res) => handle(req, res));
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Proxying /api → ${BACKEND}`);
});

// ── Dynamic Express setup ────────────────────────────────────────────────────
// Top-level await suspends this module's execution and yields to the event
// loop, so the http server above can start accepting connections while Express
// (and its dependencies) finish loading from disk.
const { default: express } = await import('express');

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

const app = express();

app.use('/api',     proxyTo('/api'));
app.use('/storage', proxyTo('/storage'));

// ── SPA root handler ─────────────────────────────────────────────────────────
// Must come before express.static so GET / is always handled here.
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

// SPA catch-all: deep links and direct navigation get the index.html shell.
app.use((_req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err && !res.headersSent) {
      res.status(200).send(FALLBACK_HTML);
    }
  });
});

// Hand off: all subsequent requests are handled by Express.
handle = (req, res) => app(req, res);
