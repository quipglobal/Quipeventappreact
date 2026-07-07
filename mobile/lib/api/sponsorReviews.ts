import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse } from '@/lib/api/types';
import type { SponsorReview } from '@/lib/sponsorReviewsStorage';

/**
 * Sponsor Reviews API Client (mobile port of web `sponsorReviewsClient.ts`).
 * ─────────────────────────────────────────────────────────────────────────
 * POST /api/v1/events/:eventId/companies/:companyId/reviews   → submit/update
 * GET  /api/v1/events/:eventId/companies/:companyId/reviews   → list reviews
 *
 * Each successful POST awards points (server-side via points_ledger).
 *
 * Session-scoped NOT_IMPLEMENTED short-circuit: the moment the backend
 * answers a review call with 404/405 we set a flag and stop round-tripping
 * for the rest of the session. Callers keep the AsyncStorage overlay so the
 * user's review is never lost — it just won't sync cross-device yet. The flag
 * is reset on event switch via `resetSponsorReviewsEndpointMissing`.
 */

let reviewsEndpointMissing = false;

export function resetSponsorReviewsEndpointMissing(): void {
  reviewsEndpointMissing = false;
}

export interface SponsorReviewsList {
  averageRating: number;
  totalReviews: number;
  reviews: SponsorReview[];
}

function reviewsPath(eventId: string, companyId: string): string {
  return `/api/v1/events/${eventId}/companies/${companyId}/reviews`;
}

function normalizeReview(raw: any): SponsorReview {
  const created = raw?.createdAt ?? raw?.created_at ?? raw?.submitted_at;
  const ts =
    typeof created === 'number'
      ? created
      : typeof created === 'string'
        ? Date.parse(created)
        : Date.now();
  return {
    id: String(raw?.id ?? `rev_${ts}`),
    authorName: String(raw?.authorName ?? raw?.author_name ?? raw?.reviewer_name ?? ''),
    authorEmail: String(raw?.authorEmail ?? raw?.author_email ?? raw?.reviewer_email ?? ''),
    rating: Number(raw?.rating ?? 0),
    comment: String(raw?.comment ?? ''),
    createdAt: Number.isFinite(ts) ? ts : Date.now(),
    pointsAwarded:
      typeof raw?.pointsAwarded === 'number'
        ? raw.pointsAwarded
        : typeof raw?.points_awarded === 'number'
          ? raw.points_awarded
          : undefined,
  };
}

function isMissingRoute(msg: string): boolean {
  return /could not be found|not found|404|405|not supported/i.test(msg);
}

export async function listSponsorReviews(
  companyId: string,
): Promise<ApiResponse<SponsorReviewsList>> {
  const eventId = getEventId();
  if (!eventId) return { success: true, data: { averageRating: 0, totalReviews: 0, reviews: [] } };
  if (reviewsEndpointMissing) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Reviews endpoint not deployed.' } };
  }
  const res = await request<any>(reviewsPath(eventId, companyId));
  if (!res.success) {
    const msg = res.error?.message ?? '';
    if (isMissingRoute(msg)) {
      reviewsEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Reviews endpoint not deployed.' } };
    }
    return res as ApiResponse<SponsorReviewsList>;
  }
  const obj = (res.data ?? {}) as Record<string, any>;
  const listRaw: any[] = Array.isArray(obj.reviews)
    ? obj.reviews
    : Array.isArray(res.data)
      ? (res.data as any[])
      : Array.isArray(obj.data)
        ? obj.data
        : [];
  const reviews = listRaw.map(normalizeReview);
  return {
    success: true,
    data: {
      averageRating: Number(obj.averageRating ?? obj.average_rating ?? 0),
      totalReviews: Number(obj.totalReviews ?? obj.total_reviews ?? reviews.length),
      reviews,
    },
  };
}

export async function submitSponsorReview(
  companyId: string,
  body: { rating: number; comment: string },
): Promise<ApiResponse<SponsorReview>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  if (reviewsEndpointMissing) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Reviews endpoint not deployed.' } };
  }
  const res = await request<any>(reviewsPath(eventId, companyId), {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.success) {
    const msg = res.error?.message ?? '';
    if (isMissingRoute(msg)) {
      reviewsEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Reviews endpoint not deployed.' } };
    }
    return res as ApiResponse<SponsorReview>;
  }
  return { success: true, data: normalizeReview(res.data?.data ?? res.data) };
}
