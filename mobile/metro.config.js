const { getDefaultConfig } = require('expo/metro-config');
const { createProxyMiddleware } = require('http-proxy-middleware');

const BACKEND =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://bef44c34-7df5-4c09-93a2-5684b5888527-00-3s6pvdiz19h8o.spock.replit.dev';

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    const proxy = createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
      secure: true,
      pathFilter: '/api',
    });

    return (req, res, next) => {
      if (req.url && req.url.startsWith('/api')) {
        return proxy(req, res, next);
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
