/**
 * Lightweight in-memory page data cache with per-event TTL.
 *
 * Pages initialize their state from here so they render instantly on the first
 * visit (no spinner). The preloader fills the cache right after the user joins
 * an event and refreshes it every 3 minutes in the background.
 */

const TTL_MS = 15 * 60 * 1000; // 15 minutes — matches the preloader refresh cadence

interface Entry {
  data: unknown;
  ts: number;
}

const _store = new Map<string, Entry>();

function makeKey(name: string, eventId: string | number): string {
  return `${name}::${String(eventId)}`;
}

/**
 * Retrieve a cached value. Returns `null` if the entry is absent or expired.
 */
export function getCached<T>(name: string, eventId: string | number): T | null {
  const k = makeKey(name, eventId);
  const entry = _store.get(k);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    _store.delete(k);
    return null;
  }
  return entry.data as T;
}

/**
 * Store a value in the cache, tagged to a specific event.
 */
export function setCached<T>(name: string, eventId: string | number, data: T): void {
  _store.set(makeKey(name, eventId), { data, ts: Date.now() });
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
