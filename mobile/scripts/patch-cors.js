const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules/@expo/cli/build/src/start/server/middleware/CorsMiddleware.js'
);

if (!fs.existsSync(file)) {
  console.log('[patch-cors] CorsMiddleware.js not found, skipping.');
} else {
  let src = fs.readFileSync(file, 'utf8');

  if (src.includes('isReplitDomain')) {
    console.log('[patch-cors] Already patched.');
  } else {
    src = src.replace(
      'const isSameOrigin = host === req.headers.host;\n            if (!isSameOrigin && !allowedHostnames.includes(hostname)) {',
      'const isSameOrigin = host === req.headers.host;\n            const isReplitDomain = hostname.endsWith(\'.replit.dev\') || hostname.endsWith(\'.replit.app\') || hostname.endsWith(\'.kirk.replit.dev\') || hostname.endsWith(\'.spock.replit.dev\');\n            if (!isSameOrigin && !allowedHostnames.includes(hostname) && !isReplitDomain) {'
    );

    fs.writeFileSync(file, src, 'utf8');
    console.log('[patch-cors] Successfully patched CorsMiddleware.js');
  }
}
