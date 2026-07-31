/**
 * Lightweight in-process request telemetry for the mobile API layer.
 *
 * Every call that flows through apiClient.request() is recorded here.
 * In __DEV__ builds call logReport() (e.g. from a shake-menu button or a
 * debug screen) to see:
 *   • which endpoints are called most often (staleTime candidates)
 *   • duplicate storms — identical calls within DEDUP_WINDOW_MS of each
 *     other, which almost always means staleTime: 0 + refetchOnFocus
 *   • slow requests (> SLOW_THRESHOLD_MS) that freeze the UI
 *
 * Zero overhead in production: __DEV__ guards wrap every write path.
 * The ring buffer caps at MAX_ENTRIES so memory is bounded.
 */

export interface RequestEntry {
  readonly id: number;
  readonly method: string;
  /** Path with dynamic IDs normalised to placeholders for grouping. */
  readonly pattern: string;
  readonly path: string;
  readonly startMs: number;
  readonly durationMs: number;
  readonly success: boolean;
}

export interface EndpointStat {
  pattern: string;
  count: number;
  avgMs: number;
  slowCount: number;
}

export interface DuplicateSample {
  pattern: string;
  gapMs: number;
  at: string;
}

export interface SlowSample {
  pattern: string;
  durationMs: number;
  at: string;
}

export interface RequestReport {
  totalRequests: number;
  /** Calls fired within DEDUP_WINDOW_MS of an identical call — refetchOnFocus / missing staleTime storms. */
  duplicateCount: number;
  slowCount: number;
  topEndpoints: EndpointStat[];
  duplicateSamples: DuplicateSample[];
  slowSamples: SlowSample[];
  generatedAt: string;
}

const MAX_ENTRIES = 300;
/** Two identical calls within this window are almost certainly a storm, not intentional. */
const DEDUP_WINDOW_MS = 800;
const SLOW_THRESHOLD_MS = 3000;

let _nextId = 0;
const _ring: RequestEntry[] = [];

/**
 * Normalise path so per-entity IDs don't fragment groupings.
 * "/api/v1/events/53/sessions" → "/api/v1/events/:eventId/sessions"
 */
function normalise(path: string): string {
  return path
    .replace(/\/events\/[^/?#]+/g, '/events/:eventId')
    .replace(/\/sessions\/[^/?#]+/g, '/sessions/:id')
    .replace(/\/surveys\/[^/?#]+/g, '/surveys/:id')
    .replace(/\/polls\/[^/?#]+/g, '/polls/:id')
    .replace(/\/giveaways\/[^/?#]+/g, '/giveaways/:id')
    .replace(/\/leads\/[^/?#]+/g, '/leads/:id')
    .replace(/\/users\/[^/?#]+/g, '/users/:id')
    .replace(/\/sponsors\/[^/?#]+/g, '/sponsors/:id')
    .replace(/\/event-video-feeds\/[^/?#]+/g, '/event-video-feeds/:id')
    .replace(/[?#].*$/, '');
}

export function recordRequest(
  method: string,
  path: string,
  startMs: number,
  durationMs: number,
  success: boolean,
): void {
  const m = method.toUpperCase();
  const entry: RequestEntry = {
    id: _nextId++,
    method: m,
    pattern: `${m} ${normalise(path)}`,
    path,
    startMs,
    durationMs,
    success,
  };
  if (_ring.length >= MAX_ENTRIES) _ring.shift();
  _ring.push(entry);
}

export function clearRequests(): void {
  _ring.length = 0;
}

export function getEntries(): readonly RequestEntry[] {
  return [..._ring];
}

export function getReport(): RequestReport {
  const now = Date.now();
  const entries = [..._ring];

  const byPattern = new Map<string, { count: number; totalMs: number; slowCount: number }>();
  for (const e of entries) {
    const s = byPattern.get(e.pattern) ?? { count: 0, totalMs: 0, slowCount: 0 };
    s.count++;
    s.totalMs += e.durationMs;
    if (e.durationMs >= SLOW_THRESHOLD_MS) s.slowCount++;
    byPattern.set(e.pattern, s);
  }

  const topEndpoints: EndpointStat[] = [...byPattern.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([pattern, v]) => ({
      pattern,
      count: v.count,
      avgMs: Math.round(v.totalMs / v.count),
      slowCount: v.slowCount,
    }));

  const sorted = [...entries].sort(
    (a, b) => a.pattern.localeCompare(b.pattern) || a.startMs - b.startMs,
  );
  let duplicateCount = 0;
  const duplicateSamples: DuplicateSample[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.pattern === curr.pattern) {
      const gap = curr.startMs - prev.startMs;
      if (gap >= 0 && gap < DEDUP_WINDOW_MS) {
        duplicateCount++;
        if (duplicateSamples.length < 10) {
          duplicateSamples.push({
            pattern: curr.pattern,
            gapMs: gap,
            at: new Date(curr.startMs).toISOString(),
          });
        }
      }
    }
  }

  const allSlow = entries.filter((e) => e.durationMs >= SLOW_THRESHOLD_MS);
  const slowSamples: SlowSample[] = allSlow.slice(-10).map((e) => ({
    pattern: e.pattern,
    durationMs: e.durationMs,
    at: new Date(e.startMs).toISOString(),
  }));

  return {
    totalRequests: entries.length,
    duplicateCount,
    slowCount: allSlow.length,
    topEndpoints,
    duplicateSamples,
    slowSamples,
    generatedAt: new Date(now).toISOString(),
  };
}

/**
 * Pretty-print the audit report to the Metro console.
 * Call from a dev button, shake menu, or the debug screen.
 * No-op in production builds.
 */
export function logReport(): void {
  if (!__DEV__) return;
  const r = getReport();
  console.log('═══════════ REQUEST AUDIT REPORT ═══════════');
  console.log(`Generated : ${r.generatedAt}`);
  console.log(`Requests  : ${r.totalRequests}   Duplicates: ${r.duplicateCount}   Slow(>${SLOW_THRESHOLD_MS / 1000}s): ${r.slowCount}`);

  console.log('\n─── Top Endpoints (by call count) ──────────');
  for (const ep of r.topEndpoints) {
    const slow = ep.slowCount ? `  ⚠ slow=${ep.slowCount}` : '';
    console.log(`  [${String(ep.count).padStart(3)}]  avg=${String(ep.avgMs).padStart(5)}ms${slow}  ${ep.pattern}`);
  }

  if (r.duplicateSamples.length) {
    console.log('\n─── Duplicate Storms (within 800 ms) ───────');
    for (const d of r.duplicateSamples) {
      console.log(`  gap=${d.gapMs}ms  ${d.pattern}  @ ${d.at}`);
    }
  }

  if (r.slowSamples.length) {
    console.log('\n─── Slow Requests (>3 s) ────────────────────');
    for (const s of r.slowSamples) {
      console.log(`  ${s.durationMs}ms  ${s.pattern}  @ ${s.at}`);
    }
  }

  console.log('════════════════════════════════════════════');
}
