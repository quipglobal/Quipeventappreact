/**
 * Feed API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET  /api/v1/events/:eventId/feed   ?page=1&limit=10   → FeedResponse
 *   POST /api/v1/events/:eventId/feed/:id/watch            → WatchResponse
 */

import { apiGet, apiPost } from './client';
import type { FeedItem, FeedVideoPost, FeedPoll } from '@/app/data/mockFeed';

// ─── Types ────────────────────────────────────────────────────────────────────

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

function normalizeFeedItem(raw: Record<string, unknown>): FeedItem | null {
  const type = (raw.type as string) ?? '';

  if (type === 'video' || raw.video_url || raw.videoUrl) {
    return {
      id: String(raw.id ?? ''),
      type: 'video',
      user: {
        name: (raw.user_name ?? raw.author_name ?? raw.organizer_name ?? '') as string,
        title: (raw.user_title ?? raw.author_title ?? '') as string,
        avatar: (raw.user_avatar ?? raw.author_avatar ?? raw.avatar ?? '') as string,
      },
      content: (raw.content ?? raw.description ?? raw.caption ?? '') as string,
      videoUrl: (raw.video_url ?? raw.videoUrl ?? '') as string,
      thumbnail: (raw.thumbnail ?? raw.thumbnail_url ?? '') as string,
      duration: (raw.duration ?? '') as string,
      timestamp: (raw.timestamp ?? raw.created_at ?? '') as string,
      likes: Number(raw.likes ?? raw.likes_count ?? 0),
      comments: [],
      shares: Number(raw.shares ?? raw.shares_count ?? 0),
      isLiked: Boolean(raw.is_liked ?? raw.isLiked),
      pointsReward: Number(raw.points_reward ?? raw.pointsReward ?? 50),
    } as FeedVideoPost;
  }

  if (type === 'poll' || Array.isArray(raw.options)) {
    const options = (Array.isArray(raw.options) ? raw.options : []) as Record<string, unknown>[];
    return {
      id: String(raw.id ?? ''),
      type: 'poll',
      question: (raw.question ?? raw.title ?? '') as string,
      options: options.map(o => ({
        id: String(o.id ?? ''),
        text: (o.text ?? o.label ?? o.option ?? '') as string,
        votes: Number(o.votes ?? o.vote_count ?? 0),
      })),
      totalVotes: Number(raw.total_votes ?? raw.totalVotes ?? 0),
      timestamp: (raw.timestamp ?? raw.created_at ?? '') as string,
      hasVoted: Boolean(raw.has_voted ?? raw.hasVoted),
    } as FeedPoll;
  }

  return null;
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:eventId/feed
 * Returns paginated feed items (videos + polls) for the event.
 */
export async function getFeedApi(eventId: string, page = 1): Promise<FeedResponse> {
  if (!eventId) {
    return { success: true, data: { items: [], page, hasMore: false, total: 0 } };
  }

  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/feed?page=${page}&limit=10`);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to load feed.' } };
  }

  const envelope = res.data as Record<string, unknown>;
  const rawItems: unknown[] = Array.isArray(envelope)
    ? envelope
    : (Array.isArray(envelope?.data) ? envelope.data as unknown[] : null)
      ?? (Array.isArray(envelope?.items) ? envelope.items as unknown[] : null)
      ?? (Array.isArray(envelope?.feed) ? envelope.feed as unknown[] : null)
      ?? [];

  const items = rawItems
    .map(r => normalizeFeedItem(r as Record<string, unknown>))
    .filter((i): i is FeedItem => i !== null);

  const totalRaw = Number(envelope?.total ?? envelope?.total_count ?? rawItems.length);
  const hasMore = Boolean(envelope?.has_more ?? envelope?.hasMore ?? (page * 10 < totalRaw));

  return {
    success: true,
    data: { items, page, hasMore, total: totalRaw },
  };
}

/**
 * POST /api/v1/events/:eventId/feed/:id/watch
 * Marks a video as watched; the backend awards points and returns the amount.
 */
export async function markVideoWatchedApi(eventId: string, videoId: string, pointsReward: number): Promise<WatchResponse> {
  if (!eventId) return { success: true, data: { pointsAwarded: 0 } };

  const res = await apiPost<unknown>(`/api/v1/events/${eventId}/feed/${videoId}/watch`, {});
  if (!res.success) {
    return { success: true, data: { pointsAwarded: 0 } };
  }
  const raw = res.data as Record<string, unknown>;
  return {
    success: true,
    data: { pointsAwarded: Number(raw?.points_awarded ?? raw?.pointsAwarded ?? pointsReward) },
  };
}
