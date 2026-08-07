/**
 * Lightweight in-memory page data cache with per-event TTL.
 *
 * Pages initialize their state from here so they render instantly on the first
 * visit (no spinner). The preloader fills the cache right after the user joins
 * an event and refreshes it every 3 minutes in the background.
 *
 * Custom TTLs
 * ───────────
 * `setCached` accepts an optional `ttlMs` parameter so callers can choose a
 * shorter freshness window for high-churn endpoints (leaderboard: 60 s,
 * meetings list: 90 s) without changing the default 15-minute window used by
 * static event content (agenda, speakers, sponsors).
 */

/** Default TTL — matches the preloader refresh cadence. */
export const TTL_MS = 15 * 60 * 1000;

/** Short TTL for frequently-changing data: meetings, leaderboard, feed page 1. */
export const SHORT_TTL_MS = 90 * 1_000;  // 90 s
/** Very short TTL for leaderboard — points change often during the event. */
export const LEADERBOARD_TTL_MS = 60 * 1_000; // 60 s

interface Entry {
  data: unknown;
  ts: number;
  /** Per-entry TTL (ms). Falls back to TTL_MS when absent. */
  ttl?: number;
}

const _store = new Map<string, Entry>();

function makeKey(name: string, eventId: string | number): string {
  return `${name}::${String(eventId)}`;
}

/**
 * Retrieve a cached value. Returns `null` if the entry is absent or expired.
 * An explicit `overrideTtlMs` overrides the per-entry TTL stored at write time
 * (useful for read-side freshness tuning without changing the write path).
 */
export function getCached<T>(
  name: string,
  eventId: string | number,
  overrideTtlMs?: number,
): T | null {
  const k = makeKey(name, eventId);
  const entry = _store.get(k);
  if (!entry) return null;
  const ttl = overrideTtlMs ?? entry.ttl ?? TTL_MS;
  if (Date.now() - entry.ts > ttl) {
    _store.delete(k);
    return null;
  }
  return entry.data as T;
}

/**
 * Store a value in the cache, tagged to a specific event.
 * @param ttlMs  Custom time-to-live in milliseconds. Defaults to TTL_MS (15 min).
 */
export function setCached<T>(
  name: string,
  eventId: string | number,
  data: T,
  ttlMs?: number,
): void {
  _store.set(makeKey(name, eventId), { data, ts: Date.now(), ttl: ttlMs });
}

/**
 * Immediately remove a single cache entry. Use after a mutation to force the
 * next read to fetch fresh data (e.g. after a poll vote or lead save).
 */
export function deleteCached(name: string, eventId: string | number): void {
  _store.delete(makeKey(name, eventId));
}

/**
 * Invalidate all cache entries for a given event (call on event switch).
 */
export function invalidateEvent(eventId: string | number): void {
  const suffix = `::${String(eventId)}`;
  for (const k of _store.keys()) {
    if (k.endsWith(suffix)) _store.delete(k);
  }
}
