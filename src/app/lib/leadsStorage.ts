import type { Lead } from '@/app/context/AppContext';

const KEY = 'cxo:offline_leads:v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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

export function loadLeadsFromStorage(): Lead[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
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

export function saveLeadsToStorage(leads: Lead[]): void {
  if (!isBrowser()) return;
  try {
    const serialized = JSON.stringify(leads.map(toStored));
    window.localStorage.setItem(KEY, serialized);
  } catch {
    // Storage may be full or disabled (incognito quotas, etc). Silently
    // fall back to in-memory only — pending leads won't survive a reload
    // in that case but the app continues to work.
  }
}

export function clearLeadsStorage(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
