#!/usr/bin/env node
/**
 * CXO API load test — pure Node.js, no external dependencies.
 *
 * Ramps from 0 → 100 virtual users over 30 s, holds for 60 s,
 * ramps down over 15 s. Tests four endpoints:
 *   - GET /events/:id/attendees
 *   - GET /events/:id/mobile-surveys
 *   - GET /events/:id/mobile-polls
 *   - GET /tenants/3/events  (event listing)
 *
 * Environment variables
 * ---------------------
 *   LOAD_TEST_TOKEN     Bearer token (required)
 *   LOAD_TEST_EVENT_ID  Numeric event id (required)
 *   LOAD_TEST_BASE_URL  API host (default: https://app.cxocollaborate.com)
 *
 * Exit codes
 *   0 — all thresholds passed
 *   1 — p95 latency > 3000 ms OR error rate > 1 %
 */

import https from 'https';
import http from 'http';

// ─── Config ───────────────────────────────────────────────────────────────────
const TOKEN = process.env.LOAD_TEST_TOKEN;
const EVENT_ID = process.env.LOAD_TEST_EVENT_ID;
const BASE_URL = process.env.LOAD_TEST_BASE_URL || 'https://app.cxocollaborate.com';

if (!TOKEN || !EVENT_ID) {
  console.error('ERROR: LOAD_TEST_TOKEN and LOAD_TEST_EVENT_ID must be set.');
  console.error('  export LOAD_TEST_TOKEN="<bearer-token>"');
  console.error('  export LOAD_TEST_EVENT_ID=21');
  process.exit(1);
}

const THRESHOLDS = {
  p95Ms: 3000,
  maxErrorRate: 0.01,
};

const PHASES = [
  { name: 'ramp-up',   durationMs: 30_000, startVUs: 1,   endVUs: 100 },
  { name: 'sustained', durationMs: 60_000, startVUs: 100, endVUs: 100 },
  { name: 'ramp-down', durationMs: 15_000, startVUs: 100, endVUs: 1   },
];

const baseUrlObj = new URL(BASE_URL);
const isHttps = baseUrlObj.protocol === 'https:';
const requestLib = isHttps ? https : http;

// Scenarios weighted to match Artillery config (weights sum to 100)
const SCENARIOS = [
  { name: 'GET attendees',       weight: 30, path: `/api/v1/events/${EVENT_ID}/attendees` },
  { name: 'GET surveys',         weight: 20, path: `/api/v1/events/${EVENT_ID}/mobile-surveys` },
  { name: 'GET polls',           weight: 25, path: `/api/v1/events/${EVENT_ID}/mobile-polls` },
  { name: 'GET events (tenant)', weight: 25, path: `/api/v1/tenants/3/events` },
];

// ─── Metrics ──────────────────────────────────────────────────────────────────
const metrics = {
  requests: 0,
  errors: 0,
  latencies: [],
};

const perScenario = Object.fromEntries(
  SCENARIOS.map((s) => [s.name, { requests: 0, errors: 0, latencies: [] }])
);

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function makeRequest(path) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const options = {
      hostname: baseUrlObj.hostname,
      port: baseUrlObj.port || (isHttps ? 443 : 80),
      path,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'X-Tenant-ID': '3',
        Accept: 'application/json',
      },
      timeout: 15_000,
    };

    const req = requestLib.request(options, (res) => {
      // Drain response body so the socket can be reused
      res.on('data', () => {});
      res.on('end', () => {
        resolve({ latency: Date.now() - t0, status: res.statusCode });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ latency: Date.now() - t0, status: 0, timedOut: true });
    });

    req.on('error', () => {
      resolve({ latency: Date.now() - t0, status: 0, networkError: true });
    });

    req.end();
  });
}

// ─── Scenario picker (weighted random) ────────────────────────────────────────
const cumulativeWeights = (() => {
  let cumulative = 0;
  return SCENARIOS.map((s) => {
    cumulative += s.weight;
    return { scenario: s, cumulative };
  });
})();

function pickScenario() {
  const r = Math.random() * 100;
  return cumulativeWeights.find(({ cumulative }) => r < cumulative).scenario;
}

// ─── Single VU iteration ──────────────────────────────────────────────────────
async function runIteration() {
  const scenario = pickScenario();
  const result = await makeRequest(scenario.path);

  const isError = result.status === 0 || result.status >= 500;
  const is4xx = result.status >= 400 && result.status < 500;

  metrics.requests++;
  if (isError) metrics.errors++;
  metrics.latencies.push(result.latency);

  perScenario[scenario.name].requests++;
  if (isError) perScenario[scenario.name].errors++;
  perScenario[scenario.name].latencies.push(result.latency);

  if (is4xx) {
    process.stderr.write(`  [WARN] ${scenario.name} → ${result.status}\n`);
  }
}

// ─── Phase runner ─────────────────────────────────────────────────────────────
/**
 * Linearly ramp from startVUs to endVUs over durationMs.
 * Each VU fires one request per 1 s tick.
 */
async function runPhase({ name, durationMs, startVUs, endVUs }) {
  console.log(`\n[${name}] ${startVUs} → ${endVUs} VUs over ${durationMs / 1000}s`);
  const ticks = Math.round(durationMs / 1000);
  const vuStep = (endVUs - startVUs) / Math.max(ticks - 1, 1);

  for (let tick = 0; tick < ticks; tick++) {
    const vus = Math.max(1, Math.round(startVUs + tick * vuStep));
    process.stdout.write(`  tick ${tick + 1}/${ticks}  VUs=${vus}  requests=${metrics.requests}\r`);
    const iterations = Array.from({ length: vus }, () => runIteration());
    await Promise.all(iterations);
    // Pace to ~1 s per tick (rough; network latency also contributes)
    await new Promise((r) => setTimeout(r, 100));
  }
  process.stdout.write('\n');
}

// ─── Statistics ───────────────────────────────────────────────────────────────
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function printReport() {
  const sorted = [...metrics.latencies].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const avg = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
  const errorRate = metrics.requests ? metrics.errors / metrics.requests : 0;

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' CXO API Load Test Report');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Total requests : ${metrics.requests}`);
  console.log(`  Errors (5xx/TO): ${metrics.errors}  (${(errorRate * 100).toFixed(2)}%)`);
  console.log(`  Latency avg    : ${avg} ms`);
  console.log(`  Latency p50    : ${p50} ms`);
  console.log(`  Latency p95    : ${p95} ms  [threshold: <${THRESHOLDS.p95Ms} ms]`);
  console.log(`  Latency p99    : ${p99} ms`);

  console.log('\n  Per-scenario breakdown:');
  for (const [name, m] of Object.entries(perScenario)) {
    if (!m.requests) continue;
    const sl = [...m.latencies].sort((a, b) => a - b);
    const sp95 = percentile(sl, 95);
    const serr = m.errors / m.requests;
    console.log(
      `    ${name.padEnd(28)} reqs=${String(m.requests).padStart(5)}  p95=${sp95}ms  err=${(serr * 100).toFixed(1)}%`
    );
  }

  // ── Threshold evaluation ─────────────────────────────────────────────────
  const failures = [];
  if (p95 > THRESHOLDS.p95Ms) {
    failures.push(`p95 latency ${p95} ms > ${THRESHOLDS.p95Ms} ms`);
  }
  if (errorRate > THRESHOLDS.maxErrorRate) {
    failures.push(`error rate ${(errorRate * 100).toFixed(2)}% > ${(THRESHOLDS.maxErrorRate * 100).toFixed(0)}%`);
  }

  if (failures.length) {
    console.log('\n  ✗ THRESHOLDS BREACHED:');
    failures.forEach((f) => console.log(`    - ${f}`));
    console.log('══════════════════════════════════════════════════════════════\n');
    return false;
  }

  console.log('\n  ✓ All thresholds passed');
  console.log('══════════════════════════════════════════════════════════════\n');
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('CXO API Load Test');
  console.log(`  Target  : ${BASE_URL}`);
  console.log(`  Event   : ${EVENT_ID}`);
  console.log(`  Profile : ramp 0→100 VUs / hold 60s / ramp down`);
  console.log(`  p95 SLO : ${THRESHOLDS.p95Ms} ms   error SLO: <${THRESHOLDS.maxErrorRate * 100}%`);

  for (const phase of PHASES) {
    await runPhase(phase);
  }

  const passed = printReport();
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
