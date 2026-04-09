import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

const BACKEND =
  process.env.VITE_API_BASE_URL ||
  'https://bef44c34-7df5-4c09-93a2-5684b5888527-00-3s6pvdiz19h8o.spock.replit.dev';

app.use(
  '/api',
  createProxyMiddleware({
    target: BACKEND,
    changeOrigin: true,
    secure: true,
  })
);

app.use(express.static(path.join(__dirname, 'dist')));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Proxying /api → ${BACKEND}`);
});
