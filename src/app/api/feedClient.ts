/**
 * Feed API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT:
 *   GET  /api/v1/events/:eventId/event-video-feeds?page=N&per_page=N → paginated VideoFeed list
 *   POST /api/v1/events/:eventId/event-video-feeds/:id/view          → view record
 *
 * No hardcoded fallback data — the UI renders a genuine empty state when the
 * backend returns no videos for an event. This ensures Austin (0 feeds) and
 * LA (4 feeds) always show their actual data instead of demo content.
 *
 * Pagination params:
 *   page     — 1-based page number
 *   per_page — records per page (mobile: 4, tablet: 6, desktop: 10)
 *   limit    — alias sent alongside per_page for backend compatibility
 */

import { apiGet, apiPost } from './client';
import type { FeedVideoPost, FeedPoll, FeedItem } from '@/app/data/mockFeed';

const FEED_TENANT_HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

const ACCENT_COLORS = [
  '#7c3aed', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6',
];

// ─── Response Types ───────────────────────────────────────────────────────────

export interface FeedPage {
  items: FeedItem[];
  page: number;
  hasMore: boolean;
  total: number;
}

export interface FeedResponse {
  success: boolean;
  data?: FeedPage;
  error?: { message: string };
}

export interface WatchResponse {
  success: boolean;
  data?: { pointsAwarded: number };
  error?: { message: string };
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeVideoFeedItem(raw: Record<string, unknown>, index: number): FeedVideoPost {
  const speakerName = String(
    raw.speaker ?? raw.speaker_name ?? raw.presenter ?? raw.presenter_name ??
    raw.host ?? raw.author_name ?? raw.user_name ?? '',
  );
  const speakerTitle = String(
    raw.speaker_title ?? raw.speakerTitle ?? raw.presenter_title ??
    raw.job_title ?? raw.user_title ?? raw.company ?? raw.organization ?? '',
  );
  const avatarUrl = String(
    raw.speaker_avatar ?? raw.avatar ?? raw.author_avatar ??
    raw.user_avatar ?? raw.profile_image ?? '',
  ) || (speakerName
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(speakerName)}&background=7c3aed&color=fff&size=128`
    : '');

  const videoUrl = String(
    raw.video_url ?? raw.videoUrl ?? raw.stream_url ?? raw.url ?? '',
  );
  const thumbnail = String(
    raw.thumbnail_url ?? raw.thumbnail ?? raw.thumbnailUrl ??
    raw.cover_image ?? raw.image ?? raw.poster ?? '',
  );
  const content = String(
    raw.description ?? raw.content ?? raw.caption ?? raw.summary ?? raw.title ?? '',
  );
  const accentColor: string = ACCENT_COLORS[index % ACCENT_COLORS.length];
  void accentColor;

  return {
    id: String(raw.id ?? index),
    type: 'video',
    user: {
      name: speakerName,
      title: speakerTitle,
      avatar: avatarUrl,
    },
    content,
    videoUrl,
    thumbnail,
    duration: String(raw.duration ?? raw.length ?? ''),
    timestamp: String(raw.created_at ?? raw.published_at ?? raw.timestamp ?? ''),
    likes: Number(raw.likes ?? raw.likes_count ?? raw.view_count ?? raw.views ?? 0),
    comments: [],
    shares: Number(raw.shares ?? raw.shares_count ?? 0),
    isLiked: Boolean(raw.is_liked ?? raw.isLiked ?? false),
    pointsReward: Number(raw.points_reward ?? raw.pointsReward ?? raw.points ?? 50),
  } as FeedVideoPost;
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:eventId/event-video-feeds?page=N&per_page=N
 *
 * Returns a paginated list of video feeds for the event. Uses Laravel-style
 * page pagination (?page=N) as well as cursor pagination if the backend
 * supplies a next_cursor field.
 *
 * perPage defaults to 10 but the caller passes a responsive value:
 *   mobile (<768px): 4 | tablet (768–1024px): 6 | desktop: 10
 *
 * signal — optional AbortSignal for request cancellation on event/filter changes.
 *
 * Returns an empty list (no error, no demo data) when the backend has no
 * videos for the event — Austin legitimately has 0, LA has 4, etc.
 */
export async function getFeedApi(
  eventId: string,
  page = 1,
  perPage = 10,
  signal?: AbortSignal,
): Promise<FeedResponse> {
  if (!eventId) {
    return { success: true, data: { items: [], page: 1, hasMore: false, total: 0 } };
  }

  if (signal?.aborted) {
    return { success: true, data: { items: [], page, hasMore: false, total: 0 } };
  }

  const res = await apiGet<unknown>(
    `/api/v1/events/${eventId}/event-video-feeds?page=${page}&per_page=${perPage}&limit=${perPage}`,
    FEED_TENANT_HEADERS,
  );

  // If the signal was aborted while the request was in-flight, discard the result
  if (signal?.aborted) {
    return { success: true, data: { items: [], page, hasMore: false, total: 0 } };
  }

  if (!res.success) {
    if (page > 1) {
      return { success: true, data: { items: [], page, hasMore: false, total: 0 } };
    }
    return {
      success: false,
      error: { message: res.error?.message ?? 'Failed to load video feeds' },
    };
  }

  const envelope = res.data as Record<string, unknown>;

  // Accept both a flat array and wrapped { data: [...] } envelopes
  const rawItems: unknown[] = Array.isArray(envelope)
    ? envelope
    : (Array.isArray(envelope?.data)   ? envelope.data   as unknown[] : null)
      ?? (Array.isArray(envelope?.items) ? envelope.items as unknown[] : null)
      ?? (Array.isArray(envelope?.videos) ? envelope.videos as unknown[] : null)
      ?? (Array.isArray((envelope?.data as Record<string, unknown>)?.data)
          ? (envelope.data as Record<string, unknown>).data as unknown[]
          : null)
      ?? [];

  const items: FeedVideoPost[] = rawItems.map((r, i) =>
    normalizeVideoFeedItem(r as Record<string, unknown>, i),
  );

  // Pagination: prefer explicit cursor metadata, then Laravel page headers
  const meta = (envelope?.meta ?? envelope?.pagination ?? {}) as Record<string, unknown>;
  const currentPage = Number(meta?.current_page ?? envelope?.current_page ?? page);
  const lastPage = Number(meta?.last_page ?? envelope?.last_page ?? 0);
  const nextPageUrl = String(meta?.next_page_url ?? envelope?.next_page_url ?? '');
  const nextCursor = envelope?.next_cursor ?? envelope?.nextCursor ?? meta?.next_cursor;

  const hasMore = Boolean(
    nextCursor
      ? true
      : lastPage ? currentPage < lastPage
      : nextPageUrl && nextPageUrl !== 'null',
  );

  const total = Number(
    meta?.total ?? envelope?.total ?? envelope?.total_count ?? rawItems.length,
  );

  return { success: true, data: { items, page: currentPage, hasMore, total } };
}

/**
 * POST /api/v1/events/:eventId/event-video-feeds/:id/view
 * Records that the user has watched the video. Points awarded server-side.
 */
export async function markVideoWatchedApi(
  eventId: string,
  videoId: string,
  pointsReward: number,
): Promise<WatchResponse> {
  if (!eventId) return { success: true, data: { pointsAwarded: pointsReward } };

  const res = await apiPost<unknown>(
    `/api/v1/events/${eventId}/event-video-feeds/${videoId}/view`,
    {},
    FEED_TENANT_HEADERS,
  );

  if (!res.success) {
    return { success: true, data: { pointsAwarded: pointsReward } };
  }

  const raw = res.data as Record<string, unknown>;
  return {
    success: true,
    data: {
      pointsAwarded: Number(
        raw?.points_awarded ?? raw?.pointsAwarded ?? raw?.points ?? pointsReward,
      ),
    },
  };
}
