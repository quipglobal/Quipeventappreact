import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lead } from '@/lib/api/types';

// Versioned, per-(user, event) prefix. Bumping from `v1` (which only
// scoped by user) to `v2` keeps two events worth of leads from
// commingling in a single AsyncStorage slot — the central bug in the
// "All users data must not show other event leads" report.
const KEY_PREFIX = 'cxo:offline_leads:v2';
// Legacy keys we proactively delete on first load so stale data from
// before the (user, event) scoping landed can't leak across events:
//   * `cxo:offline_leads:v1`           — initial unscoped key
//   * `cxo:offline_leads:v1:<userId>`  — user-only scoped key
// The v1 entries can't be migrated cleanly because we don't know which
// event they belong to (that's the whole reason for the bump). The
// next online refetch will repopulate the appropriate (user, event)
// slot from the server, so deletion is safe.
const LEGACY_UNSCOPED_KEY = 'cxo:offline_leads:v1';
const LEGACY_USER_PREFIX = 'cxo:offline_leads:v1:';

function keyFor(userId: string, eventId: string): string {
  return `${KEY_PREFIX}:${userId}:${eventId}`;
}

/**
 * One-shot cleanup for legacy keys (unscoped + user-only). Safe to
 * call on every load — if the keys aren't there, this is a no-op.
 * We don't migrate v1 data into v2 because the v1 schema doesn't
 * record which event each lead belongs to; preserving it would be the
 * exact cross-event leak the v2 schema exists to prevent.
 */
async function purgeLegacyKeys(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_UNSCOPED_KEY);
    const allKeys = await AsyncStorage.getAllKeys();
    const legacyUserKeys = allKeys.filter((k) => k.startsWith(LEGACY_USER_PREFIX));
    if (legacyUserKeys.length > 0) {
      await AsyncStorage.multiRemove(legacyUserKeys);
    }
  } catch {
    // ignore
  }
}

/**
 * Load any previously-cached leads for the given `(user, event)`
 * pair. Returns an empty array if no cache exists, the cache is
 * malformed, storage is unavailable, or either id is missing. Never
 * throws.
 */
export async function loadCachedLeads(
  userId: string | null | undefined,
  eventId: string | null | undefined,
): Promise<Lead[]> {
  await purgeLegacyKeys();
  if (!userId || !eventId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, eventId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic shape validation: every entry must have a string id. Drop
    // anything that doesn't so a stale/corrupt cache can't crash the UI.
    return parsed.filter(
      (l): l is Lead =>
        l != null && typeof l === 'object' && typeof (l as Lead).id === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Persist the leads cache for the given `(user, event)` pair.
 * Silently no-ops when either id is missing so anonymous / unscoped
 * data never lands in a user/event slot.
 */
export async function saveCachedLeads(
  userId: string | null | undefined,
  eventId: string | null | undefined,
  leads: Lead[],
): Promise<void> {
  if (!userId || !eventId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId, eventId), JSON.stringify(leads));
  } catch {
    // ignore
  }
}
