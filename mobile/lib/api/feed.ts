import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, FeedPage, FeedItem, FeedVideo, FeedPoll } from '@/lib/api/types';

const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

let videoFeedsNotImplemented = false;

function normalizeVideoItem(raw: any, index: number): FeedVideo {
  return {
    id: String(raw.id ?? index),
    type: 'video',
    title: raw.title ?? raw.name ?? '',
    speaker: raw.speaker ?? raw.presenter ?? raw.host ?? '',
    company: raw.company ?? raw.organization ?? '',
    duration: raw.duration ?? raw.length ?? '00:00',
    views: String(raw.views ?? raw.view_count ?? 0),
    accentColor: raw.accent_color ?? ACCENT_COLORS[index % ACCENT_COLORS.length],
    live: Boolean(raw.live ?? raw.is_live ?? false),
    videoUrl: raw.video_url ?? raw.stream_url ?? raw.url ?? '',
  };
}

function normalizeFeedItem(raw: any, index: number): FeedItem | null {
  const type = raw.type ?? (raw.video_url || raw.stream_url ? 'video' : 'poll');
  if (type === 'video' || raw.video_url || raw.stream_url) {
    return normalizeVideoItem(raw, index) as FeedVideo;
  }
  if (type === 'poll' || raw.options || raw.answers) {
    return {
      id: String(raw.id ?? index),
      type: 'poll',
      question: raw.question ?? raw.title ?? '',
      session: raw.session ?? raw.session_title ?? '',
      points: Number(raw.points ?? 10),
      options: (raw.options ?? raw.answers ?? []).map((o: any) => ({
        id: String(o.id),
        text: o.text ?? o.answer ?? o.label ?? '',
        votes: Number(o.votes ?? o.vote_count ?? 0),
      })),
    } as FeedPoll;
  }
  return null;
}

export interface VideoFeedsPage {
  items: FeedVideo[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * GET /api/v1/events/:eventId/event-video-feeds
 *
 * Paginated list of published video feeds for the event. The backend
 * supports both cursor pagination (`?cursor=…` → `next_cursor`) and
 * Laravel-style page pagination (`?page=N` → `next_page_url` /
 * `current_page`+`last_page`). We accept either: if the response
 * carries an explicit cursor we use it verbatim; otherwise we fall
 * back to bumping a numeric page counter.
 *
 * Short-circuits to an empty page on 404/405 (NOT_IMPLEMENTED) for the
 * session so subsequent calls don't spam the backend while the route
 * is not yet deployed. Flag resets on event change.
 */
export async function getVideoFeedsPage(
  cursor?: string,
): Promise<ApiResponse<VideoFeedsPage>> {
  const eventId = getEventId();
  if (__DEV__)
    console.log(
      `[Feed] getVideoFeedsPage eventId=${eventId} cursor=${cursor} skip=${videoFeedsNotImplemented}`,
    );
  const empty: VideoFeedsPage = { items: [], nextCursor: null, hasMore: false };
  if (!eventId) return { success: true, data: empty };
  if (videoFeedsNotImplemented) return { success: true, data: empty };

  // Cursor may be either an opaque string ("cursor=…") or a numeric
  // page index ("page=N"). Detect numeric-only and use `page=`; else
  // pass through as `cursor=`.
  const qs = cursor
    ? /^\d+$/.test(cursor)
      ? `?page=${cursor}`
      : `?cursor=${encodeURIComponent(cursor)}`
    : '';
  const res = await request<any>(
    `/api/v1/events/${eventId}/event-video-feeds${qs}`,
  );

  if (!res.success) {
    const status = (res as any).status ?? (res.error as any)?.status;
    if (status === 404 || status === 405) {
      videoFeedsNotImplemented = true;
      if (__DEV__)
        console.log(
          '[Feed] event-video-feeds endpoint not implemented — short-circuiting',
        );
    }
    return { success: true, data: empty };
  }

  const envelope = res.data;
  const rawItems: any[] = Array.isArray(envelope)
    ? envelope
    : Array.isArray(envelope?.data)
      ? envelope.data
      : Array.isArray(envelope?.items)
        ? envelope.items
        : Array.isArray(envelope?.videos)
          ? envelope.videos
          : Array.isArray(envelope?.data?.data)
            ? envelope.data.data
            : [];

  const items: FeedVideo[] = rawItems.map((r, i) => normalizeVideoItem(r, i));

  // Pagination: prefer explicit cursor, then Laravel page metadata,
  // then `next_page_url`. If none, assume single-page response.
  const meta = envelope?.meta ?? envelope?.pagination ?? envelope ?? {};
  const explicitCursor =
    envelope?.next_cursor ??
    envelope?.nextCursor ??
    meta?.next_cursor ??
    meta?.nextCursor ??
    null;
  const currentPage = Number(meta?.current_page ?? meta?.page ?? 0);
  const lastPage = Number(meta?.last_page ?? meta?.total_pages ?? 0);
  const nextPageUrl = envelope?.next_page_url ?? meta?.next_page_url ?? null;

  let nextCursor: string | null = null;
  if (explicitCursor) {
    nextCursor = String(explicitCursor);
  } else if (currentPage && lastPage && currentPage < lastPage) {
    nextCursor = String(currentPage + 1);
  } else if (nextPageUrl) {
    // Extract the `page` query param if present, else just bump the
    // numeric counter we used to fetch this page.
    const m = String(nextPageUrl).match(/[?&]page=(\d+)/);
    nextCursor = m ? m[1] : cursor ? String(Number(cursor) + 1) : '2';
  }

  return {
    success: true,
    data: { items, nextCursor, hasMore: !!nextCursor },
  };
}

/**
 * Back-compat shim: callers that don't care about pagination get a
 * flat first-page list. Kept so existing screens keep working while
 * we migrate the home Feed tab to infinite scroll.
 */
export async function getVideoFeeds(): Promise<ApiResponse<FeedVideo[]>> {
  const page = await getVideoFeedsPage();
  return {
    success: page.success,
    data: page.data?.items ?? [],
    error: (page as any).error,
  };
}

/**
 * GET /api/v1/events/:eventId/event-video-feeds/:feedId
 * Single feed detail — used for deep-link / detail screens.
 */
export async function getVideoFeed(
  feedId: string,
): Promise<ApiResponse<FeedVideo | null>> {
  const eventId = getEventId();
  if (!eventId) return { success: true, data: null };
  if (videoFeedsNotImplemented) return { success: true, data: null };

  const res = await request<any>(
    `/api/v1/events/${eventId}/event-video-feeds/${feedId}`,
  );
  if (!res.success) {
    const status = (res as any).status ?? (res.error as any)?.status;
    if (status === 404 || status === 405) {
      videoFeedsNotImplemented = true;
    }
    return { success: true, data: null };
  }
  const raw = res.data?.data ?? res.data;
  if (!raw) return { success: true, data: null };
  return { success: true, data: normalizeVideoItem(raw, 0) };
}

/** Resets the NOT_IMPLEMENTED flag so a newly-deployed route is picked up after event switch. */
export function resetVideoFeedsFlag() {
  videoFeedsNotImplemented = false;
}

export async function getFeedPage(cursor?: string): Promise<ApiResponse<FeedPage>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Feed] getFeedPage eventId=${eventId} cursor=${cursor}`);
  if (!eventId) {
    return { success: true, data: { items: [], nextCursor: null, hasMore: false } };
  }
  const params = cursor ? `?cursor=${cursor}` : '';
  const res = await request<any>(`/api/v1/events/${eventId}/feed${params}`);
  if (!res.success) return res as ApiResponse<FeedPage>;

  const envelope = res.data;
  const rawItems: any[] = Array.isArray(envelope)
    ? envelope
    : Array.isArray(envelope?.data) ? envelope.data
    : Array.isArray(envelope?.items) ? envelope.items
    : [];

  const items: FeedItem[] = rawItems
    .map((r, i) => normalizeFeedItem(r, i))
    .filter((x): x is FeedItem => x !== null);

  const nextCursor = envelope?.next_cursor ?? envelope?.nextCursor ?? null;
  return {
    success: true,
    data: { items, nextCursor, hasMore: !!nextCursor },
  };
}

/**
 * POST /api/v1/events/:eventId/event-video-feeds/:feedId/view
 *
 * Records a watch event (the backend awards points server-side based
 * on its own rules). Tolerates 404/405 silently — if the route isn't
 * deployed yet we don't want to surface an error toast to the user
 * just because they scrolled past a video.
 */
export async function markVideoWatched(
  videoId: string,
): Promise<ApiResponse<{ points: number }>> {
  const eventId = getEventId();
  if (!eventId) return { success: true, data: { points: 0 } };
  if (videoFeedsNotImplemented) return { success: true, data: { points: 0 } };

  const res = await request<any>(
    `/api/v1/events/${eventId}/event-video-feeds/${videoId}/view`,
    { method: 'POST' },
  );
  if (!res.success) {
    const status = (res as any).status ?? (res.error as any)?.status;
    if (status === 404 || status === 405) {
      return { success: true, data: { points: 0 } };
    }
    return res as ApiResponse<{ points: number }>;
  }
  const points = Number(res.data?.points ?? res.data?.data?.points ?? 0);
  return { success: true, data: { points } };
}

export async function submitPollVote(pollId: string, optionId: string): Promise<ApiResponse<{ points: number; results: Array<{ id: string; votes: number }> }>> {
  const eventId = getEventId();
  if (!eventId) return { success: true, data: { points: 0, results: [] } };
  return request(`/api/v1/events/${eventId}/mobile-polls/${pollId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  });
}
