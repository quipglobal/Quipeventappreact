import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lead } from '@/lib/api/types';

const KEY = 'cxo:offline_leads:v1';

/**
 * Load any previously-cached leads from AsyncStorage. Returns an empty
 * array if no cache exists, the cache is malformed, or storage is
 * unavailable. Never throws — callers can use the result directly.
 */
export async function loadCachedLeads(): Promise<Lead[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
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
 * Persist the leads cache to AsyncStorage. Silently swallows errors —
 * if storage fails we keep the in-memory cache and the user just loses
 * the persistence guarantee for this session.
 */
export async function saveCachedLeads(leads: Lead[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(leads));
  } catch {
    // ignore
  }
}

export async function clearCachedLeads(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
