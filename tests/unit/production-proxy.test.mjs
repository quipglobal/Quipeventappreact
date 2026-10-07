import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const shell = '<!doctype html><html><body>production-proxy-test-shell</body></html>';
const asset = 'console.log("production-proxy-test-asset");\n';
const media = Buffer.from([0, 255, 10, 13, 128, 42]);

function request(port, url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port, path: url, method, headers,
      agent: false,
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    // Longer than the production proxy's real 6 s timeout; never patch it.
    req.setTimeout(10_000, () => req.destroy(new Error(`Request stalled: ${url}`)));
    req.end(body);
  });
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function close(server) {
  if (!server.listening) return;
  const closed = new Promise((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve());
  });
  server.closeAllConnections();
  await closed;
}

test('production server serves the SPA and forwards API/media without a live backend',
  { timeout: 30_000 }, async t => {
    // An isolated dist fixture exercises the actual, unchanged server.js without
    // requiring a Vite build or overwriting the developer's existing dist.
    const directory = await mkdtemp(path.join(os.tmpdir(), 'production-proxy-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await copyFile(path.join(root, 'server.js'), path.join(directory, 'server.js'));
    await writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
    await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    await mkdir(path.join(directory, 'dist', 'assets'), { recursive: true });
    await writeFile(path.join(directory, 'dist', 'index.html'), shell);
    await writeFile(path.join(directory, 'dist', 'assets', 'smoke.js'), asset);

    const received = [];
    const upstream = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const record = {
        method: req.method, url: req.url, headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      };
      received.push(record);
      if (req.url.includes('/stall')) return; // Leave the socket idle for 504.
      if (req.url.startsWith('/backend/storage/')) {
        res.writeHead(206, {
          'Content-Type': 'application/octet-stream',
          'Content-Range': 'bytes 0-5/12',
          'Cache-Control': 'public, max-age=60',
          'X-Upstream': 'media',
        });
        res.end(media);
      } else if (req.url.startsWith('/backend/api/rejected')) {
        res.writeHead(422, {
          'Content-Type': 'application/json',
          'X-Upstream': 'validation',
          'Retry-After': '3',
          'Set-Cookie': ['first=one; Path=/', 'second=two; Path=/'],
        });
        res.end('{"success":false,"error":"upstream validation"}');
      } else {
        res.writeHead(201, { 'Content-Type': 'application/json', 'X-Upstream': 'api' });
        res.end(JSON.stringify(record));
      }
    });
    t.after(() => close(upstream));
    const upstreamPort = await listen(upstream);

    // Reserve an OS-assigned port rather than colliding with the preview server.
    const reservation = http.createServer();
    t.after(() => close(reservation));
    const port = await listen(reservation);
    await close(reservation);
    const child = spawn(process.execPath, ['server.js'], {
      cwd: directory,
      env: {
        ...process.env, NODE_ENV: 'production', PORT: String(port),
        VITE_API_BASE_URL: `http://127.0.0.1:${upstreamPort}/backend/`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let startupError;
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', err => { startupError = err; });
    const exited = new Promise(resolve => child.once('close', resolve));
    t.after(async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), 2000);
      try { await exited; } finally { clearTimeout(force); }
    });

    await t.test('startup advances beyond the temporary loading handler', async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        assert.ifError(startupError);
        assert.equal(child.exitCode, null, `Server exited during startup:\n${output}`);
        let response;
        try { response = await request(port, '/'); } catch { /* Not listening yet. */ }
        if (response?.body.toString() === shell) {
          assert.equal(response.status, 200);
          assert.match(response.headers['content-type'], /text\/html/);
          return;
        }
        // A 200 alone is insufficient: the temporary loading handler also
        // returns 200. Wait for our dist shell to prove Express took over.
        await delay(25);
      }
      assert.fail(`Production handler did not become ready:\n${output}`);
    });

    await t.test('dist assets and SPA deep links reach the production handlers', async () => {
      const js = await request(port, '/assets/smoke.js');
      assert.equal(js.status, 200);
      assert.match(js.headers['content-type'], /javascript/);
      assert.equal(js.body.toString(), asset);
      const deepLink = await request(port, '/events/example/leads/123?tab=notes');
      assert.equal(deepLink.status, 200);
      assert.match(deepLink.headers['content-type'], /text\/html/);
      assert.equal(deepLink.body.toString(), shell);
    });

    await t.test('/api preserves POST body, query, auth and upstream base path', async () => {
      const url = '/api/echo?tag=one&tag=two&encoded=a%2Fb+space';
      const body = '{"note":"café & + /","nested":{"count":2}}';
      const response = await request(port, url, {
        method: 'POST', body,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: 'Bearer smoke-test-only',
          Cookie: 'session=smoke-test-only',
        },
      });
      assert.equal(response.status, 201);
      assert.equal(response.headers['x-upstream'], 'api');
      const forwarded = JSON.parse(response.body.toString());
      assert.equal(forwarded.method, 'POST');
      assert.equal(forwarded.url, `/backend${url}`);
      assert.equal(forwarded.body, body);
      assert.equal(forwarded.headers.authorization, 'Bearer smoke-test-only');
      assert.equal(forwarded.headers.cookie, 'session=smoke-test-only');
      assert.equal(forwarded.headers['content-type'], 'application/json');
      assert.equal(Number(forwarded.headers['content-length']), Buffer.byteLength(body));
      assert.equal(forwarded.headers.host, '127.0.0.1');
    });

    await t.test('/storage preserves media bytes, path/query and range headers', async () => {
      const url = '/storage/videos/clip.bin?download=1&name=a%2Fb';
      const response = await request(port, url, {
        headers: { Range: 'bytes=0-5', Authorization: 'Bearer media-smoke-test-only' },
      });
      assert.equal(response.status, 206);
      assert.deepEqual(response.body, media);
      assert.equal(response.headers['content-type'], 'application/octet-stream');
      assert.equal(response.headers['content-range'], 'bytes 0-5/12');
      assert.equal(response.headers['cache-control'], 'public, max-age=60');
      assert.equal(response.headers['x-upstream'], 'media');
      const forwarded = received.at(-1);
      assert.equal(forwarded.url, `/backend${url}`);
      assert.equal(forwarded.method, 'GET');
      assert.equal(forwarded.headers.range, 'bytes=0-5');
      assert.equal(forwarded.headers.authorization, 'Bearer media-smoke-test-only');
    });

    await t.test('upstream errors retain their status, body and response headers', async () => {
      const response = await request(port, '/api/rejected');
      assert.equal(response.status, 422);
      assert.equal(response.body.toString(), '{"success":false,"error":"upstream validation"}');
      assert.equal(response.headers['content-type'], 'application/json');
      assert.equal(response.headers['x-upstream'], 'validation');
      assert.equal(response.headers['retry-after'], '3');
      assert.deepEqual(response.headers['set-cookie'], ['first=one; Path=/', 'second=two; Path=/']);
    });

    await t.test('idle upstream requests return 504 for both proxy mounts', async () => {
      await Promise.all(['/api', '/storage'].map(async prefix => {
        const response = await request(port, `${prefix}/stall`);
        assert.equal(response.status, 504, prefix);
        assert.match(response.headers['content-type'], /application\/json/);
        assert.deepEqual(JSON.parse(response.body.toString()), {
          success: false,
          error: { code: 'GATEWAY_TIMEOUT', message: 'Backend did not respond in time.' },
        });
        assert.ok(received.some(record => record.url === `/backend${prefix}/stall`));
      }));
    });

    await t.test('refused upstream connections return 502 for both proxy mounts', async () => {
      await close(upstream);
      await Promise.all(['/api', '/storage'].map(async prefix => {
        const response = await request(port, `${prefix}/unavailable`);
        assert.equal(response.status, 502, prefix);
        assert.match(response.headers['content-type'], /application\/json/);
        assert.deepEqual(JSON.parse(response.body.toString()), {
          success: false,
          error: { code: 'PROXY_ERROR', message: 'Backend unavailable.' },
        });
      }));
      // Failure handling must not terminate the child or prevent SPA responses.
      assert.equal((await request(port, '/')).body.toString(), shell);
      assert.equal(child.exitCode, null, output);
    });
  });
