#!/usr/bin/env node
/**
 * CXO API 1 000-VU Concurrency Load Test — zero external dependencies
 *
 * Model: true concurrent VU workers.
 *   Each of the 1 000 workers loops continuously:
 *     acquire → fire request → wait for response → repeat
 *   This caps in-flight connections at exactly 1 000 and matches how
 *   k6 / Artillery model "virtual users" — one request at a time per VU,
 *   but 1 000 VUs running in parallel.
 *
 * Timeline (total ≈ 65 s):
 *   00 – 10 s   ramp-up    VUs staggered at 10 ms intervals (100 VU/s)
 *   10 – 60 s   sustained  all 1 000 VUs active simultaneously
 *   60 – 68 s   drain      wait for last in-flight requests (≤ timeout)
 *
 * Environment variables
 * ─────────────────────
 *   LOAD_TEST_TOKEN       Bearer token  (required)
 *   LOAD_TEST_EVENT_ID    Numeric event id  (required)
 *   LOAD_TEST_BASE_URL    API host  (default: https://app.cxocollaborate.com)
 *   LOAD_TEST_TIMEOUT_MS  Per-request timeout ms  (default: 8000)
 *
 * Exit codes
 *   0 — all SLO thresholds passed
 *   1 — p95 > 3 000 ms  OR  error rate > 1 %
 */

import https from 'https';
import http from 'http';

// ─── Config ───────────────────────────────────────────────────────────────────
const TOKEN      = process.env.LOAD_TEST_TOKEN;
const EVENT_ID   = process.env.LOAD_TEST_EVENT_ID;
const BASE_URL   = process.env.LOAD_TEST_BASE_URL || 'https://app.cxocollaborate.com';
const TIMEOUT_MS = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? 8_000);

if (!TOKEN || !EVENT_ID) {
  console.error('ERROR: LOAD_TEST_TOKEN and LOAD_TEST_EVENT_ID must be set.');
  console.error('  export LOAD_TEST_TOKEN="<bearer-token>"');
  console.error('  export LOAD_TEST_EVENT_ID=21');
  process.exit(1);
}

const TOTAL_VUS    = 1_000;
const RAMP_MS      = 10_000;   // stagger VU starts over 10 s
const SUSTAIN_MS   = 50_000;   // hold all 1 000 VUs for 50 s
const THRESHOLDS   = { p95Ms: 3_000, maxErrorRate: 0.01 };

// Scenarios — weights must sum to 100.
const SCENARIOS = [
  { name: 'GET attendees',    weight: 25, path: `/api/v1/events/${EVENT_ID}/attendees` },
  { name: 'GET polls',        weight: 20, path: `/api/v1/events/${EVENT_ID}/mobile-polls` },
  { name: 'GET surveys',      weight: 15, path: `/api/v1/events/${EVENT_ID}/mobile-surveys` },
  { name: 'GET events',       weight: 15, path: `/api/v1/tenants/3/events` },
  { name: 'GET giveaways',    weight: 10, path: `/api/v1/events/${EVENT_ID}/giveaways` },
  { name: 'GET leaderboard',  weight: 10, path: `/api/v1/events/${EVENT_ID}/leaderboard` },
  { name: 'GET members',      weight:  5, path: `/api/v1/events/${EVENT_ID}/members?checked_in_only=true&per_page=20` },
];

// ─── HTTP agent ───────────────────────────────────────────────────────────────
const baseUrlObj = new URL(BASE_URL);
const isHttps    = baseUrlObj.protocol === 'https:';
const agent      = new (isHttps ? https.Agent : http.Agent)({
  keepAlive:      true,
  keepAliveMsecs: 1_000,
  maxSockets:     Infinity,
  maxFreeSockets: 256,
});
const transport  = isHttps ? https : http;

// ─── Metrics ──────────────────────────────────────────────────────────────────
const metrics = { requests: 0, errors: 0, latencies: [] };
const perScenario = Object.fromEntries(
  SCENARIOS.map((s) => [s.name, { requests: 0, errors: 0, latencies: [] }])
);
let peakInFlight  = 0;
let curInFlight   = 0;
let testStartMs   = 0;

// ─── Weighted scenario picker ─────────────────────────────────────────────────
const cumulative = (() => {
  let c = 0;
  return SCENARIOS.map((s) => { c += s.weight; return { s, c }; });
})();
const pick = () => {
  const r = Math.random() * 100;
  return cumulative.find(({ c }) => r < c).s;
};

// ─── Single request ───────────────────────────────────────────────────────────
function request(path) {
  return new Promise((resolve) => {
    const t0  = Date.now();
    const req = transport.request(
      {
        hostname: baseUrlObj.hostname,
        port:     baseUrlObj.port || (isHttps ? 443 : 80),
        path,
        method:   'GET',
        headers:  {
          Authorization: `Bearer ${TOKEN}`,
          'X-Tenant-ID': '3',
          Accept:        'application/json',
          Connection:    'keep-alive',
        },
        agent,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ ms: Date.now() - t0, status: res.statusCode }));
      }
    );
    req.on('timeout', () => { req.destroy(); resolve({ ms: Date.now() - t0, status: 0 }); });
    req.on('error',   ()  => resolve({ ms: Date.now() - t0, status: 0 }));
    req.end();
  });
}

// ─── VU iteration ─────────────────────────────────────────────────────────────
async function iteration() {
  const sc = pick();
  curInFlight++;
  if (curInFlight > peakInFlight) peakInFlight = curInFlight;

  const r       = await request(sc.path);
  const isError = r.status === 0 || r.status >= 500;
  curInFlight--;

  metrics.requests++;
  metrics.latencies.push(r.ms);
  if (isError) metrics.errors++;

  const pm = perScenario[sc.name];
  pm.requests++;
  pm.latencies.push(r.ms);
  if (isError) pm.errors++;
}

// ─── VU worker (runs continuously until stopMs) ───────────────────────────────
async function vuWorker(startDelay, stopMs) {
  await new Promise((r) => setTimeout(r, startDelay));
  while (Date.now() < stopMs) {
    await iteration();
  }
}

// ─── Progress printer ─────────────────────────────────────────────────────────
function startProgressPrinter() {
  return setInterval(() => {
    const elapsed = ((Date.now() - testStartMs) / 1000).toFixed(0);
    const rps     = metrics.requests / Math.max(1, (Date.now() - testStartMs) / 1000);
    process.stdout.write(
      `\r  t=${String(elapsed).padStart(4)}s` +
      `  in-flight=${String(curInFlight).padStart(5)}` +
      `  reqs=${String(metrics.requests).padStart(7)}` +
      `  errs=${String(metrics.errors).padStart(6)}` +
      `  rps=${rps.toFixed(1).padStart(8)}  `
    );
  }, 1_000);
}

// ─── Statistics ───────────────────────────────────────────────────────────────
function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

function printReport() {
  const elapsedSec = (Date.now() - testStartMs) / 1000;
  const rps        = metrics.requests / elapsedSec;
  const sorted     = [...metrics.latencies].sort((a, b) => a - b);
  const avg        = sorted.length
    ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
  const p50        = pct(sorted, 50);
  const p95        = pct(sorted, 95);
  const p99        = pct(sorted, 99);
  const errRate    = metrics.requests ? metrics.errors / metrics.requests : 0;

  const W    = 68;
  const bar  = '═'.repeat(W);

  console.log(`\n╔${bar}╗`);
  console.log('  CXO API — 1 000-VU Concurrency Load Test  ·  Summary Report');
  console.log(`╠${bar}╣`);
  console.log(`  Target         : ${BASE_URL}`);
  console.log(`  Event          : ${EVENT_ID}`);
  console.log(`  Duration       : ${elapsedSec.toFixed(1)} s`);
  console.log(`  Model          : true concurrent VUs (1 request in-flight per VU)`);
  console.log(`  Peak VUs       : ${TOTAL_VUS.toLocaleString()}`);
  console.log(`  Peak in-flight : ${peakInFlight}`);
  console.log(`╠${bar}╣`);
  console.log(`  Total requests : ${metrics.requests.toLocaleString()}`);
  console.log(`  Requests/sec   : ${rps.toFixed(1)}`);
  console.log(`  HTTP errors    : ${metrics.errors.toLocaleString()}  (${(errRate * 100).toFixed(2)} %)`);
  console.log(`  Error types    : 5xx responses · connection errors · ${TIMEOUT_MS / 1000}s timeouts`);
  console.log(`╠${bar}╣`);
  console.log('  Latency (all completed requests):');
  console.log(`    avg          : ${avg} ms`);
  console.log(`    p50 (median) : ${p50} ms`);
  console.log(`    p95          : ${p95} ms    ← SLO < ${THRESHOLDS.p95Ms} ms`);
  console.log(`    p99          : ${p99} ms`);
  console.log(`╠${bar}╣`);
  console.log('  Per-scenario breakdown:');
  const header = `    ${'Scenario'.padEnd(22)} ${'reqs'.padStart(7)}  ${'p50'.padStart(7)}  ${'p95'.padStart(7)}  ${'p99'.padStart(7)}  ${'err%'.padStart(6)}`;
  console.log(header);
  console.log(`    ${'-'.repeat(60)}`);
  for (const [name, m] of Object.entries(perScenario)) {
    if (!m.requests) continue;
    const sl   = [...m.latencies].sort((a, b) => a - b);
    const serr = (m.errors / m.requests * 100).toFixed(2);
    console.log(
      `    ${name.padEnd(22)}` +
      ` ${String(m.requests).padStart(7)}` +
      `  ${(pct(sl, 50) + ' ms').padStart(7)}` +
      `  ${(pct(sl, 95) + ' ms').padStart(7)}` +
      `  ${(pct(sl, 99) + ' ms').padStart(7)}` +
      `  ${String(serr + '%').padStart(6)}`
    );
  }

  // ── Threshold check ───────────────────────────────────────────────────────
  const fails = [];
  if (p95 > THRESHOLDS.p95Ms)
    fails.push(`p95 latency ${p95} ms > SLO ${THRESHOLDS.p95Ms} ms`);
  if (errRate > THRESHOLDS.maxErrorRate)
    fails.push(`error rate ${(errRate * 100).toFixed(2)} % > SLO ${THRESHOLDS.maxErrorRate * 100} %`);

  console.log(`╠${bar}╣`);
  if (fails.length) {
    console.log('  ✗ SLO BREACH:');
    fails.forEach((f) => console.log(`    • ${f}`));
  } else {
    console.log('  ✓ All SLOs passed  (p95 < 3 000 ms  ·  error rate < 1 %)');
  }
  console.log(`╚${bar}╝\n`);
  return fails.length === 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('  CXO API — 1 000-VU Concurrency Load Test');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  Target   : ${BASE_URL}`);
  console.log(`  Event    : ${EVENT_ID}`);
  console.log(`  VUs      : ${TOTAL_VUS} (staggered over ${RAMP_MS / 1000}s, then sustained ${SUSTAIN_MS / 1000}s)`);
  console.log(`  Timeout  : ${TIMEOUT_MS / 1000}s / request`);
  console.log(`  SLOs     : p95 < ${THRESHOLDS.p95Ms} ms  ·  error rate < ${THRESHOLDS.maxErrorRate * 100} %`);
  console.log('  Scenarios:');
  SCENARIOS.forEach((s) => console.log(`    ${String(s.weight).padStart(3)} %  ${s.name}`));
  console.log();
  console.log(`  [ramp-up]   Adding 1 VU every ${(RAMP_MS / TOTAL_VUS).toFixed(0)} ms  (${TOTAL_VUS} VUs over ${RAMP_MS / 1000}s)`);
  console.log(`  [sustained] ${TOTAL_VUS} concurrent VUs for ${SUSTAIN_MS / 1000}s`);
  console.log();

  testStartMs = Date.now();
  const stopMs  = testStartMs + RAMP_MS + SUSTAIN_MS;

  const timer = startProgressPrinter();

  // Launch all VU workers — each starts after its stagger delay.
  // delay[i] = i × (RAMP_MS / TOTAL_VUS) spreads 1 000 VUs over 10 s.
  const stepMs  = RAMP_MS / TOTAL_VUS;
  const workers = Array.from(
    { length: TOTAL_VUS },
    (_, i) => vuWorker(Math.round(i * stepMs), stopMs)
  );
  await Promise.all(workers);

  clearInterval(timer);
  process.stdout.write('\n');

  const passed = printReport();
  agent.destroy();
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
