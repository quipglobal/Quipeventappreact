import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lead } from '@/lib/api/types';

const KEY_PREFIX = 'cxo:offline_leads:v1';
// Legacy unscoped key from an in-progress version of this work before
// per-user scoping landed. Cleared on first load so any leads that got
// written under it can't leak across user accounts on this device.
const LEGACY_UNSCOPED_KEY = 'cxo:offline_leads:v1';

function keyFor(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

/**
 * One-shot cleanup for the legacy unscoped key. Safe to call on every
 * load — if the key isn't there, this is a no-op.
 */
async function purgeLegacyUnscopedKey(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_UNSCOPED_KEY);
  } catch {
    // ignore
  }
}

/**
 * Load any previously-cached leads for the given user. Returns an empty
 * array if no cache exists, the cache is malformed, storage is
 * unavailable, or no userId is provided. Never throws.
 */
export async function loadCachedLeads(userId: string | null | undefined): Promise<Lead[]> {
  await purgeLegacyUnscopedKey();
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
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
 * Persist the leads cache for the given user. Silently no-ops when no
 * userId is provided so anonymous data never lands in a user slot.
 */
export async function saveCachedLeads(userId: string | null | undefined, leads: Lead[]): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(leads));
  } catch {
    // ignore
  }
}

/**
 * Wipe the leads cache for the given user. Called on logout so a
 * different user signing in on the same device can't see prior leads.
 */
export async function clearCachedLeads(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}
