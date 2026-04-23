/**
 * Sponsor Reviews API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * POST   /api/v1/events/:eventId/companies/:companyId/reviews   → submit/update review
 * GET    /api/v1/events/:eventId/companies/:companyId/reviews   → list reviews
 * DELETE /api/v1/events/:eventId/companies/:companyId/reviews/me → delete own review
 * GET    /api/v1/events/:eventId/companies/:companyId/reviews/export?format=csv
 *
 * Each successful POST awards points (server-side via points_ledger).
 *
 * Until the backend exposes these endpoints, the UI keeps a localStorage cache
 * so reviews are not lost — but the POST is still attempted on every submit so
 * the moment backend is ready it'll start persisting automatically.
 */

import { apiGet, apiPost, API_BASE_URL, type ApiEnvelope } from './client';

const TENANT_ID = (import.meta.env.VITE_TENANT_ID ?? '1') as string;

export interface SponsorReviewDTO {
  id: string;
  authorName: string;
  authorEmail: string;
  rating: number;
  comment: string;
  createdAt: number;
  pointsAwarded?: number;
}

export interface SponsorReviewsListDTO {
  averageRating: number;
  totalReviews: number;
  myReview: SponsorReviewDTO | null;
  reviews: SponsorReviewDTO[];
}

function reviewsPath(eventId: number, companyId: number): string {
  return `/api/v1/events/${eventId}/companies/${companyId}/reviews`;
}

function normalizeReview(raw: Record<string, unknown>): SponsorReviewDTO {
  const created = (raw.createdAt ?? raw.created_at ?? raw.submitted_at) as
    | string
    | number
    | undefined;
  const ts =
    typeof created === 'number'
      ? created
      : typeof created === 'string'
        ? Date.parse(created)
        : Date.now();
  return {
    id: String(raw.id ?? `rev_${ts}`),
    authorName: (raw.authorName ?? raw.author_name ?? raw.reviewer_name ?? '') as string,
    authorEmail: (raw.authorEmail ?? raw.author_email ?? raw.reviewer_email ?? '') as string,
    rating: Number(raw.rating ?? 0),
    comment: (raw.comment ?? '') as string,
    createdAt: Number.isFinite(ts) ? ts : Date.now(),
    pointsAwarded: raw.pointsAwarded as number | undefined,
  };
}

export async function submitSponsorReviewApi(
  eventId: number,
  companyId: number,
  body: { rating: number; comment: string },
): Promise<ApiEnvelope<SponsorReviewDTO>> {
  const res = await apiPost<unknown>(reviewsPath(eventId, companyId), body, {
    'X-Tenant-ID': TENANT_ID,
  });
  if (res.success && res.data && typeof res.data === 'object') {
    return { success: true, data: normalizeReview(res.data as Record<string, unknown>) };
  }
  return { success: false, error: res.error ?? { message: 'Failed to submit review.' } };
}

export async function getSponsorReviewsApi(
  eventId: number,
  companyId: number,
): Promise<ApiEnvelope<SponsorReviewsListDTO>> {
  const res = await apiGet<unknown>(reviewsPath(eventId, companyId), {
    'X-Tenant-ID': TENANT_ID,
  });
  if (res.success && res.data && typeof res.data === 'object') {
    const obj = res.data as Record<string, unknown>;
    const list = Array.isArray(obj.reviews) ? obj.reviews : [];
    const reviews = list.map((r) => normalizeReview(r as Record<string, unknown>));
    return {
      success: true,
      data: {
        averageRating: Number(obj.averageRating ?? obj.average_rating ?? 0),
        totalReviews: Number(obj.totalReviews ?? obj.total_reviews ?? reviews.length),
        myReview: obj.myReview
          ? normalizeReview(obj.myReview as Record<string, unknown>)
          : obj.my_review
            ? normalizeReview(obj.my_review as Record<string, unknown>)
            : null,
        reviews,
      },
    };
  }
  return { success: false, error: res.error ?? { message: 'Failed to load reviews.' } };
}

export async function deleteMySponsorReviewApi(
  eventId: number,
  companyId: number,
): Promise<ApiEnvelope<unknown>> {
  try {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE_URL}${reviewsPath(eventId, companyId)}/me`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Tenant-ID': TENANT_ID,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.ok) return { success: true };
    return { success: false, error: { message: `Delete failed (${res.status})` } };
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error.' } };
  }
}

/** Returns the URL the browser should hit to download the report (organizer only). */
export function sponsorReviewsExportUrl(
  eventId: number,
  companyId: number,
  format: 'csv' | 'xlsx' = 'csv',
): string {
  return `${reviewsPath(eventId, companyId)}/export?format=${format}`;
}
