import type { Lead } from '@/app/context/AppContext';

/**
 * Leads storage — keyed by (userId, eventId) so a sponsor who attends
 * multiple events gets a completely separate local cache per event.
 *
 * v2 key: cxo:offline_leads:v2:<userId>:<eventId>
 * v1 key (user-only, no event): cxo:offline_leads:v1:<userId>
 *
 * On first load we purge any v1 user-only keys so stale cross-event
 * data can't leak into the display while the API fetch is in flight.
 */

const KEY_V2_PREFIX = 'cxo:offline_leads:v2';
const KEY_V1_PREFIX = 'cxo:offline_leads:v1'; // legacy — user-only, no event scope

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function keyFor(userId: string, eventId: string): string {
  return `${KEY_V2_PREFIX}:${userId}:${eventId}`;
}

type StoredLead = Omit<Lead, 'timestamp'> & { timestamp: string };

function toStored(lead: Lead): StoredLead {
  return { ...lead, timestamp: lead.timestamp.toISOString() };
}

function fromStored(stored: StoredLead): Lead | null {
  if (!stored || typeof stored !== 'object') return null;
  if (typeof stored.id !== 'string' || typeof stored.code !== 'string') return null;
  const ts = new Date(stored.timestamp);
  if (Number.isNaN(ts.getTime())) return null;
  return { ...stored, timestamp: ts };
}

/**
 * One-shot cleanup for legacy v1 keys (user-scoped, no event ID).
 * Called on every load — no-op when the key is absent.
 * Also removes the bare unscoped "cxo:offline_leads:v1" key from
 * an even older iteration that landed briefly in production.
 */
function purgeLegacyKeys(userId: string): void {
  if (!isBrowser()) return;
  try {
    // Bare unscoped key (earliest iteration)
    window.localStorage.removeItem('cxo:offline_leads:v1');
    // User-only v1 key
    window.localStorage.removeItem(`${KEY_V1_PREFIX}:${userId}`);
  } catch {
    // ignore
  }
}

/**
 * Load any previously-cached leads for (userId, eventId).
 * Returns an empty array on cache miss, parse error, or missing IDs.
 * Side-effect: purges legacy v1 keys for this user on every call.
 */
export function loadLeadsFromStorage(
  userId: string | null | undefined,
  eventId: string | null | undefined,
): Lead[] {
  if (!isBrowser()) return [];
  if (!userId) return [];
  purgeLegacyKeys(userId);
  if (!eventId) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(userId, eventId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const leads: Lead[] = [];
    for (const entry of parsed) {
      const lead = fromStored(entry as StoredLead);
      if (lead) leads.push(lead);
    }
    return leads;
  } catch {
    return [];
  }
}

/**
 * Persist the lead list for (userId, eventId).
 * Silently no-ops when either ID is missing so anonymous / pre-event
 * data never leaks into a scoped slot.
 */
export function saveLeadsToStorage(
  userId: string | null | undefined,
  eventId: string | null | undefined,
  leads: Lead[],
): void {
  if (!isBrowser() || !userId || !eventId) return;
  try {
    window.localStorage.setItem(keyFor(userId, eventId), JSON.stringify(leads.map(toStored)));
  } catch {
    // Storage may be full or disabled. Silently fall back to in-memory only.
  }
}

/**
 * Wipe the lead cache for (userId, eventId).
 * Called on logout so another user on the same browser can't see prior leads.
 */
export function clearLeadsStorage(
  userId: string | null | undefined,
  eventId: string | null | undefined,
): void {
  if (!isBrowser() || !userId || !eventId) return;
  try {
    window.localStorage.removeItem(keyFor(userId, eventId));
  } catch {
    // ignore
  }
}
