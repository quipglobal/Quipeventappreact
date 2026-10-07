const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const requireMobile = createRequire(path.join(__dirname, '..', 'package.json'));
const requireMicromatch = createRequire(requireMobile.resolve('micromatch'));

test('compatibility patches are idempotent', () => {
  execFileSync(process.execPath, [path.join(__dirname, 'patch-security-deps.js')]);
  execFileSync(process.execPath, [path.join(__dirname, 'patch-security-deps.js')]);
});

test('all locked braces consumers resolve the pinned depth-guard backport', () => {
  const lock = requireMobile('./package-lock.json');
  const entries = Object.entries(lock.packages).filter(([key]) => /(^|\/)node_modules\/braces$/.test(key));
  assert.ok(entries.length > 0);
  for (const [, entry] of entries) {
    assert.equal(entry.name, '@dieub/braces-depth-guard');
    assert.equal(entry.version, '3.0.3-pn.3');
  }
  const braces = requireMicromatch('braces');
  assert.deepEqual(braces.expand('assets/{icons,fonts}/*.{png,ttf}'), [
    'assets/icons/*.png', 'assets/icons/*.ttf', 'assets/fonts/*.png', 'assets/fonts/*.ttf'
  ]);
  assert.deepEqual(braces.expand('file{01..03}.png'), ['file01.png', 'file02.png', 'file03.png']);
  assert.deepEqual(braces.expand('{a,{b,c}}'), ['a', 'b', 'c']);
  assert.equal(braces.compile('{a,b}'), '(a|b)');
  assert.equal(braces.stringify(braces.parse('{a,b}')), '{a,b}');
  assert.deepEqual(braces.expand('\\{literal\\}'), ['{literal}']);
});

test('deep braces, parentheses, and caller-supplied ASTs fail before stack exhaustion', () => {
  const braces = requireMicromatch('braces');
  for (const [open, close] of [['{', '}'], ['(', ')'], ['{(', ')}']]) {
    const pattern = open.repeat(1500) + 'a,b' + close.repeat(1500);
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      for (const maxDepth of [undefined, Infinity, NaN, 100000]) {
        assert.throws(() => braces[method](pattern, { maxDepth }), /exceeds max depth/);
      }
    }
  }
  assert.doesNotThrow(() => braces.parse('{'.repeat(100) + 'a,b' + '}'.repeat(100)));
  assert.throws(() => braces.parse('{'.repeat(101) + 'a,b' + '}'.repeat(101)), /exceeds max depth/);
  assert.deepEqual(braces.expand('"{literal}"'), ['{literal}']);
  let ast = { type: 'text', value: 'a' };
  for (let i = 0; i < 1500; i++) ast = { type: 'paren', nodes: [ast] };
  ast = { type: 'root', nodes: [ast] };
  for (const method of ['compile', 'expand', 'stringify']) {
    assert.throws(() => braces[method](ast), /exceeds max depth/);
  }
});

test('Metro watchers and Expo Updates globs retain normal matching behavior', async () => {
  const { includedByGlob } = requireMobile('metro-file-map/src/watchers/common');
  assert.equal(includedByGlob('f', ['**/*.{js,tsx}'], false, 'app/index.tsx'), true);
  assert.equal(includedByGlob('f', ['**/*.{js,tsx}'], false, 'assets/logo.png'), false);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-glob-security-'));
  try {
    await fs.writeFile(path.join(dir, 'one.png'), '');
    await fs.writeFile(path.join(dir, 'two.ttf'), '');
    await fs.writeFile(path.join(dir, 'ignored.txt'), '');
    assert.deepEqual(
      (await requireMobile('fast-glob')('*.{png,ttf}', { cwd: dir })).sort(),
      ['one.png', 'two.ttf']
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('Metro reads image dimensions from buffers and filesystem paths', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCBsAAAAASUVORK5CYII=',
    'base64'
  );
  const { getAssetSize, getAssetData } = requireMobile('metro/src/Assets');
  assert.deepEqual(getAssetSize('png', png, 'test.png'), { width: 1, height: 1 });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'metro-security-'));
  try {
    const file = path.join(dir, 'test.png');
    await fs.writeFile(file, png);
    const data = await getAssetData(file, 'test.png', [], null, '/assets');
    assert.equal(data.width, 1);
    assert.equal(data.height, 1);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('query-string decodes valid and malformed URI components with the ESM dependency', () => {
  const query = requireMobile('query-string');
  assert.equal(query.parse('name=Hello%20World').name, 'Hello World');
  assert.equal(typeof query.parse('name=%E0%A4%A').name, 'string');
});

test('xcode still generates uppercase 24-character project identifiers', () => {
  const project = requireMobile('xcode').project('test.pbxproj');
  project.hash = { project: { objects: {} } };
  assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
});

test('Expo JS tar fallback extracts an archive using tar 7', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-tar-security-'));
  const spawnPath = requireMobile.resolve('@expo/spawn-async');
  const originalSpawn = requireMobile(spawnPath);
  const originalCache = require.cache[spawnPath].exports;
  try {
    await fs.mkdir(path.join(dir, 'source'));
    await fs.mkdir(path.join(dir, 'output'));
    await fs.writeFile(path.join(dir, 'source', 'test.txt'), 'safe archive');
    const archive = path.join(dir, 'test.tar');
    await requireMobile('tar').create({ file: archive, cwd: path.join(dir, 'source') }, ['test.txt']);
    // Force Expo's native extraction to fail so its JS fallback runs on Linux too.
    require.cache[spawnPath].exports = Object.assign(
      async () => { throw new Error('Native tar deliberately unavailable in test'); },
      originalSpawn
    );
    const expoTarPath = requireMobile.resolve('@expo/cli/build/src/utils/tar.js');
    delete require.cache[expoTarPath];
    await requireMobile(expoTarPath).extractAsync(archive, path.join(dir, 'output'));
    assert.equal(await fs.readFile(path.join(dir, 'output', 'test.txt'), 'utf8'), 'safe archive');
  } finally {
    require.cache[spawnPath].exports = originalCache;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
