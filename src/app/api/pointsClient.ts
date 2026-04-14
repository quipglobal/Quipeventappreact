/**
 * Points Sync API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores and retrieves the user's accumulated social points via the backend
 * profile endpoint, using the `social_links.cxo_points` field as persistent
 * storage since the backend has no dedicated points endpoint.
 *
 * API CONTRACT:
 *   GET  /api/v1/me/profile  → { success, data: { social_links: { cxo_points?: number } } }
 *   PUT  /api/v1/me/profile  → { name?, title?, bio?, social_links? }  → { success }
 */

import { apiGet, apiPut } from './client';

export interface PointsRecord {
  points: number;
  lastSynced: string;
}

// ─── Fetch points from backend ────────────────────────────────────────────────

export async function fetchPointsFromBackend(): Promise<number> {
  try {
    const res = await apiGet<Record<string, unknown>>('/api/v1/me/profile');
    if (!res.success || !res.data) return 0;
    const data = res.data as Record<string, unknown>;
    const links = data.social_links as Record<string, unknown> | undefined;
    return Number(links?.cxo_points ?? 0) || 0;
  } catch {
    return 0;
  }
}

// ─── Push points to backend ───────────────────────────────────────────────────

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPoints = 0;

/**
 * Schedules a debounced points sync to the backend (300 ms window).
 * Multiple rapid calls coalesce into a single request.
 */
export function scheduleSyncPoints(totalPoints: number): void {
  pendingPoints = totalPoints;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    pushPoints(pendingPoints).catch(() => {/* silent — don't block UI */});
  }, 300);
}

async function pushPoints(points: number): Promise<void> {
  await apiPut('/api/v1/me/profile', {
    social_links: {
      cxo_points: points,
      cxo_points_synced_at: new Date().toISOString(),
    },
  });
}
