// Expo SDK 52 / Metro 0.81 use APIs from vulnerable dependency versions.
// Keep the SDK stable while adapting those call sites to the patched packages.
// EAS also runs this in eas-build-post-install when install scripts are disabled.
const fs = require('node:fs');
const path = require('node:path');

function patch(relativePath, before, after) {
  const file = path.join(__dirname, '..', 'node_modules', relativePath);
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`[patch-security-deps] Unexpected dependency source: ${relativePath}`);
  }
  fs.writeFileSync(file, source.replace(before, after));
  console.log(`[patch-security-deps] Patched ${relativePath}`);
}

// image-size 2 exposes a named function rather than a callable module.
patch(
  'metro/src/Assets.js',
  'const getImageSize = require("image-size");',
  'const { imageSize: getImageSize } = require("image-size");'
);
// image-size 2 accepts byte buffers only, not filesystem paths.
patch(
  'metro/src/Assets.js',
  'const dimensions = isImage ? getImageSize(isImageInput) : null;',
  'const dimensions = isImage ? getImageSize(typeof isImageInput === "string" ? fs.readFileSync(isImageInput) : isImageInput) : null;'
);

// decode-uri-component 0.5 is ESM; Metro and modern Node expose its default.
patch(
  'query-string/index.js',
  "const decodeComponent = require('decode-uri-component');",
  "const decodeComponent = require('decode-uri-component').default;"
);

// tar 7 has named CJS exports and __esModule, but no default export.
for (const file of ['tar.js', 'npm.js']) {
  patch(
    `@expo/cli/build/src/utils/${file}`,
    'const data = /*#__PURE__*/ _interopRequireDefault(require("tar"));',
    'const data = { default: require("tar") };'
  );
}
