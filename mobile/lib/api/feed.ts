import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, FeedPage, FeedItem, FeedVideo, FeedPoll } from '@/lib/api/types';

const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

function normalizeFeedItem(raw: any, index: number): FeedItem | null {
  const type = raw.type ?? (raw.video_url || raw.stream_url ? 'video' : 'poll');
  if (type === 'video' || raw.video_url || raw.stream_url) {
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
    } as FeedVideo;
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

export async function markVideoWatched(videoId: string): Promise<ApiResponse<{ points: number }>> {
  const eventId = getEventId();
  if (!eventId) return { success: true, data: { points: 0 } };
  return request<{ points: number }>(`/api/v1/events/${eventId}/videos/${videoId}/view`, {
    method: 'POST',
  });
}

export async function submitPollVote(pollId: string, optionId: string): Promise<ApiResponse<{ points: number; results: Array<{ id: string; votes: number }> }>> {
  const eventId = getEventId();
  if (!eventId) return { success: true, data: { points: 0, results: [] } };
  return request(`/api/v1/events/${eventId}/mobile-polls/${pollId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  });
}
