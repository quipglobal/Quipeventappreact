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
  'https://bef44c34-7df5-4c09-93a2-5684b5888527-00-3s6pvdiz19h8o.spock.replit.dev';

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

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Proxying /api → ${BACKEND}`);
});
