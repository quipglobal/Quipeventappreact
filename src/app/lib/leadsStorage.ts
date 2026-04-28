import type { Lead } from '@/app/context/AppContext';

const KEY_PREFIX = 'cxo:offline_leads:v1';
// Legacy unscoped key from an earlier in-progress version of this work
// before user-scoping landed. We delete it on first load so leads that
// got written under it can't leak across user accounts on this device.
const LEGACY_UNSCOPED_KEY = 'cxo:offline_leads:v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function keyFor(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
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
 * One-shot cleanup for the legacy unscoped key. Safe to call on every
 * load — if the key isn't there, this is a no-op.
 */
function purgeLegacyUnscopedKey(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(LEGACY_UNSCOPED_KEY);
  } catch {
    // ignore
  }
}

/**
 * Load any previously-cached leads for the given user. Returns an empty
 * array if there's no cache, the cache is malformed, storage is
 * unavailable, or no userId is provided. Never throws — callers can use
 * the result directly. Side effect: also purges the legacy unscoped key
 * once it's seen.
 */
export function loadLeadsFromStorage(userId: string | null | undefined): Lead[] {
  if (!isBrowser()) return [];
  purgeLegacyUnscopedKey();
  if (!userId) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
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
 * Persist the lead list for the given user. Silently no-ops when no
 * userId is provided (e.g. before /me has resolved) so anonymous data
 * never leaks into a user-scoped slot.
 */
export function saveLeadsToStorage(userId: string | null | undefined, leads: Lead[]): void {
  if (!isBrowser() || !userId) return;
  try {
    const serialized = JSON.stringify(leads.map(toStored));
    window.localStorage.setItem(keyFor(userId), serialized);
  } catch {
    // Storage may be full or disabled (incognito quotas, etc). Silently
    // fall back to in-memory only — pending leads won't survive a reload
    // in that case but the app continues to work.
  }
}

/**
 * Wipe the lead cache for the given user. Called on logout / auth reset
 * so a different user on the same device/browser can't see prior leads.
 */
export function clearLeadsStorage(userId: string | null | undefined): void {
  if (!isBrowser() || !userId) return;
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}
