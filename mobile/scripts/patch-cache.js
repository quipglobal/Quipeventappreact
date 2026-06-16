const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules/@expo/cli/build/src/start/server/middleware/ManifestMiddleware.js'
);

if (!fs.existsSync(file)) {
  console.log('[patch-cache] ManifestMiddleware.js not found, skipping.');
} else {
  let src = fs.readFileSync(file, 'utf8');

  if (src.includes('patchedNoCacheHeaders')) {
    console.log('[patch-cache] Already patched.');
  } else {
    // 1. Add no-cache headers to the HTML response so browsers never cache index.html
    src = src.replace(
      `async handleWebRequestAsync(req, res) {
        res.setHeader("Content-Type", "text/html");
        res.end(await this.getSingleHtmlTemplateAsync());
    }`,
      `async handleWebRequestAsync(req, res) {
        // patchedNoCacheHeaders
        res.setHeader("Content-Type", "text/html");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.end(await this.getSingleHtmlTemplateAsync());
    }`
    );

    // 2. Append a build-time timestamp to the bundle URL so the browser treats
    //    each Metro restart as a new resource — busting any JS cache entry.
    src = src.replace(
      `getSingleHtmlTemplateAsync() {
        // Read from headers
        const bundleUrl = this.getWebBundleUrl();`,
      `getSingleHtmlTemplateAsync() {
        // Read from headers
        const bundleUrl = this.getWebBundleUrl() + "&_v=" + Date.now();`
    );

    fs.writeFileSync(file, src, 'utf8');
    console.log('[patch-cache] Successfully patched ManifestMiddleware.js');
  }
}
