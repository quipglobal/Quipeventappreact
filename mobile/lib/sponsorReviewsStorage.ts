import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-event, per-company overlay storage for sponsor reviews. Mirrors the web
 * `SponsorsListPage` localStorage cache pattern, but backed by AsyncStorage.
 *
 * Why this exists:
 *   The backend reviews route may not be deployed yet (see the
 *   sponsorReviews API NOT_IMPLEMENTED short-circuit). Persisting reviews
 *   locally keeps them across a reload / logout → login while the POST is
 *   still attempted on every submit so the moment backend is ready it starts
 *   persisting automatically.
 *
 * Storage shape:
 *   AsyncStorage key: `cxo:sponsorReviews:v1:<eventId>:<companyId>`
 *   value:            JSON `SponsorReview[]`
 */

export interface SponsorReview {
  id: string;
  authorName: string;
  authorEmail: string;
  rating: number;
  comment: string;
  createdAt: number;
  pointsAwarded?: number;
}

const KEY_PREFIX = 'cxo:sponsorReviews:v1';

function keyFor(eventId: string, companyId: string): string {
  return `${KEY_PREFIX}:${eventId}:${companyId}`;
}

/** Load the cached reviews for a company. Resolves to `[]` on any failure. */
export async function loadSponsorReviews(
  eventId: string | null | undefined,
  companyId: string | null | undefined,
): Promise<SponsorReview[]> {
  if (!eventId || !companyId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(eventId, companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SponsorReview[]) : [];
  } catch {
    return [];
  }
}

/** Overwrite the cached reviews for a company. Silently no-ops on failure. */
export async function saveSponsorReviews(
  eventId: string | null | undefined,
  companyId: string | null | undefined,
  reviews: SponsorReview[],
): Promise<void> {
  if (!eventId || !companyId) return;
  try {
    await AsyncStorage.setItem(keyFor(eventId, companyId), JSON.stringify(reviews));
  } catch {
    // Storage quota / disabled — the in-memory state still has the review
    // for this session; only cross-session persistence is lost.
  }
}
