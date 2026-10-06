const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const requireMobile = createRequire(path.join(__dirname, '..', 'package.json'));

test('compatibility patches are idempotent', () => {
  execFileSync(process.execPath, [path.join(__dirname, 'patch-security-deps.js')]);
  execFileSync(process.execPath, [path.join(__dirname, 'patch-security-deps.js')]);
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
