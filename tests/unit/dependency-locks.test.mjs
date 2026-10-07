import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

// Minimum versions that address the requested advisories. Branch-specific
// floors preserve compatible APIs (notably js-yaml 3 vs 4 and ajv 6 vs 8).
const floors = {
  '@xmldom/xmldom': '0.9.12',
  'baseline-browser-mapping': '2.11.0',
  browserslist: '4.28.7',
  'decode-uri-component': '0.5.0',
  'fast-uri': '3.1.6',
  'image-size': '2.0.3',
  nanoid: '3.3.18',
  postcss: '8.5.23',
  qs: '6.16.0',
  sharp: '0.35.4',
  tar: '7.5.21',
  uuid: '11.1.1',
};

function atLeast(version, floor) {
  const a = version.split('.').map(Number);
  const b = floor.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

for (const directory of ['.', 'mobile']) {
  test(`${directory}: every nested affected dependency uses a patched version`, () => {
    const lock = JSON.parse(fs.readFileSync(`${directory}/package-lock.json`, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(`${directory}/package.json`, 'utf8'));
    assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
    assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
    for (const [location, pkg] of Object.entries(lock.packages)) {
      if (!location.includes('node_modules/')) continue;
      const name = location.split('node_modules/').at(-1);
      const major = Number(pkg.version?.split('.')[0]);
      let floor = floors[name];
      if (name === 'js-yaml') floor = major === 3 ? '3.15.2' : '4.3.2';
      if (name === 'ajv' && major >= 7) floor = '8.18.0';
      // Older brace-expansion branches are not in the requested findings.
      if (name === 'brace-expansion' && major >= 4) floor = '5.0.9';
      if (floor) {
        assert.ok(atLeast(pkg.version, floor), `${location}: ${pkg.version} must be >= ${floor}`);
      }
    }
  });
}

test('mobile has one canonical npm lockfile for local and EAS installs', () => {
  assert.equal(fs.existsSync('mobile/yarn.lock'), false);
  const lock = JSON.parse(fs.readFileSync('mobile/package-lock.json', 'utf8'));
  for (const pkg of Object.values(lock.packages)) {
    assert.ok(!pkg.resolved?.includes('package-firewall.replit.local'));
  }
});

test('web publishing cannot restore the firewall-blocked proxy-addr version', () => {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const entries = Object.entries(lock.packages)
    .filter(([location]) => location.endsWith('node_modules/proxy-addr'));
  assert.ok(entries.length > 0, 'Express must resolve proxy-addr');
  for (const [location, pkg] of entries) {
    assert.ok(atLeast(pkg.version, '2.0.8'), `${location}: ${pkg.version} must be >= 2.0.8`);
    assert.ok(!pkg.resolved?.includes('package-firewall.replit.'), 'Use the install environment registry, not a workspace-only URL');
  }
});

test('web locks patched source maps and compatible brace-expansion branches', () => {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const expected = {
    'brace-expansion': { 1: '1.1.21', 5: '5.0.12' },
    'source-map-js': { 1: '1.2.2' },
  };
  const seen = new Set();
  for (const [location, pkg] of Object.entries(lock.packages)) {
    if (!location.includes('node_modules/')) continue;
    const name = location.split('node_modules/').at(-1);
    if (!expected[name]) continue;
    seen.add(name);
    const major = Number(pkg.version.split('.')[0]);
    const floor = expected[name][major];
    assert.ok(floor, `${location}: unexpected major ${major}; check API compatibility`);
    assert.ok(atLeast(pkg.version, floor), `${location}: ${pkg.version} must be >= ${floor}`);
    assert.ok(!pkg.resolved?.includes('package-firewall.replit.'), `${location}: registry URL must be portable`);
  }
  assert.deepEqual([...seen].sort(), Object.keys(expected).sort());
});

test('web excludes the unused, vulnerable middleware chain without replacing its proxies', () => {
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  for (const name of ['http-proxy-middleware', 'micromatch', 'braces']) {
    assert.equal(manifest.dependencies[name], undefined);
    assert.equal(manifest.devDependencies[name], undefined);
    assert.ok(!Object.keys(lock.packages).some(location => location.endsWith(`node_modules/${name}`)),
      `${name} must not return to the web dependency tree`);
  }
  // Both web proxies are independent of http-proxy-middleware. Keep the
  // production mounts and Vite targets when removing the unused dependency.
  const server = fs.readFileSync('server.js', 'utf8');
  const vite = fs.readFileSync('vite.config.ts', 'utf8');
  assert.match(server, /transport\.request\(options/);
  for (const prefix of ['/api', '/storage']) {
    assert.ok(server.includes(`proxyTo('${prefix}')`));
    assert.ok(vite.includes(`'${prefix}': {`));
  }
});
