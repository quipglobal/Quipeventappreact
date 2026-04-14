/**
 * Feed API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET  /api/v1/events/:eventId/feed   ?page=1&limit=10   → FeedResponse
 *   POST /api/v1/events/:eventId/feed/:id/watch            → WatchResponse
 *
 * Falls back to event-specific curated demo videos when the backend feed is
 * unavailable (e.g. event membership not yet established).
 */

import { apiGet, apiPost } from './client';
import type { FeedItem, FeedVideoPost, FeedPoll } from '@/app/data/mockFeed';

const FEED_TENANT_HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

// ─── Sample video library (Google Test Streams — free, no auth) ───────────────

const SAMPLE_VIDEOS = [
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: '0:15',
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    duration: '0:15',
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    duration: '0:15',
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    duration: '0:15',
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    duration: '1:00',
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    duration: '1:00',
  },
];

// ─── Event-specific curated content ──────────────────────────────────────────

interface DemoVideo {
  id: string;
  title: string;
  presenter: { name: string; title: string };
  content: string;
  thumbnail: string;
  videoIndex: number;
  points: number;
}

const EVENT_CONTENT: Record<string, DemoVideo[]> = {
  // CISOMeet Los Angeles (21)
  '21': [
    {
      id: 'ciso21-v1',
      title: 'Zero Trust Architecture in 2026',
      presenter: { name: 'Rachel Kim', title: 'CISO · Apex Financial' },
      content: 'How leading CISOs are rethinking perimeter security with zero-trust frameworks. Watch to earn points!',
      thumbnail: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80',
      videoIndex: 0,
      points: 75,
    },
    {
      id: 'ciso21-v2',
      title: 'Ransomware Response Playbook',
      presenter: { name: 'Marcus Webb', title: 'VP of Security · CloudCore' },
      content: 'Step-by-step incident response strategies your security team can action immediately.',
      thumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80',
      videoIndex: 1,
      points: 60,
    },
    {
      id: 'ciso21-v3',
      title: 'AI-Powered Threat Detection',
      presenter: { name: 'Priya Nair', title: 'Head of Threat Intel · Sentinel Labs' },
      content: 'Machine learning models that cut mean-time-to-detect from days to minutes.',
      thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
      videoIndex: 2,
      points: 80,
    },
    {
      id: 'ciso21-poll1',
      title: 'poll',
      presenter: { name: '', title: '' },
      content: '',
      thumbnail: '',
      videoIndex: -1,
      points: 0,
    },
    {
      id: 'ciso21-v4',
      title: 'Securing the Hybrid Workforce',
      presenter: { name: 'James O\'Brien', title: 'CISO · HorizonTech' },
      content: 'Practical security frameworks for remote and hybrid teams handling sensitive data.',
      thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80',
      videoIndex: 3,
      points: 65,
    },
  ],

  // Globex Annual Conference (3)
  '3': [
    {
      id: 'globex3-v1',
      title: 'Executive Leadership in the AI Era',
      presenter: { name: 'Sandra Patel', title: 'CEO · Globex Corporation' },
      content: 'Opening keynote: navigating disruptive technology as a C-suite leader in 2026.',
      thumbnail: 'https://images.unsplash.com/photo-1573339887617-d674bc961c31?w=800&q=80',
      videoIndex: 4,
      points: 100,
    },
    {
      id: 'globex3-v2',
      title: 'Building High-Performance Teams',
      presenter: { name: 'David Okonkwo', title: 'CHRO · NexGen Ventures' },
      content: 'Culture, retention, and performance in the distributed-first organisation.',
      thumbnail: 'https://images.unsplash.com/photo-1560439514-4e9645039924?w=800&q=80',
      videoIndex: 5,
      points: 75,
    },
    {
      id: 'globex3-poll1',
      title: 'poll',
      presenter: { name: '', title: '' },
      content: '',
      thumbnail: '',
      videoIndex: -1,
      points: 0,
    },
    {
      id: 'globex3-v3',
      title: 'Digital Transformation Success Stories',
      presenter: { name: 'Emma Larsson', title: 'CTO · ScaleUp Group' },
      content: 'Real case studies: what separates digital transformation winners from laggards.',
      thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
      videoIndex: 0,
      points: 80,
    },
    {
      id: 'globex3-v4',
      title: 'Investor Roundtable: Future of B2B',
      presenter: { name: 'Carlos Rivera', title: 'Managing Partner · Vantage Capital' },
      content: 'Where institutional investors are placing bets in the next technology cycle.',
      thumbnail: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80',
      videoIndex: 1,
      points: 70,
    },
  ],

  // CIOmeet Chicago (20)
  '20': [
    {
      id: 'ciomeet20-v1',
      title: 'CIO Agenda 2026: Priorities That Matter',
      presenter: { name: 'Angela Torres', title: 'CIO · Midwest Health Systems' },
      content: 'What top-performing CIOs are prioritising — and de-prioritising — this year.',
      thumbnail: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
      videoIndex: 2,
      points: 75,
    },
    {
      id: 'ciomeet20-v2',
      title: 'Cloud Strategy for Legacy Enterprises',
      presenter: { name: 'Raj Mehta', title: 'CIO · Century Manufacturing' },
      content: 'Phased cloud migration that keeps the lights on while modernising at pace.',
      thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80',
      videoIndex: 3,
      points: 65,
    },
    {
      id: 'ciomeet20-poll1',
      title: 'poll',
      presenter: { name: '', title: '' },
      content: '',
      thumbnail: '',
      videoIndex: -1,
      points: 0,
    },
    {
      id: 'ciomeet20-v3',
      title: 'Data Governance That Enables Growth',
      presenter: { name: 'Lisa Chen', title: 'CDO · National Commerce Bank' },
      content: 'Governance frameworks that protect without blocking innovation teams.',
      thumbnail: 'https://images.unsplash.com/photo-1543286386-713bdd548da4?w=800&q=80',
      videoIndex: 4,
      points: 70,
    },
  ],
};

// Shared poll content used in event-specific fallback feeds
const SHARED_POLL = (id: string): FeedPoll => ({
  id,
  type: 'poll',
  question: 'What topic would you like more sessions on?',
  options: [
    { id: `${id}-o1`, text: 'Artificial Intelligence', votes: 142 },
    { id: `${id}-o2`, text: 'Cybersecurity', votes: 98 },
    { id: `${id}-o3`, text: 'Digital Transformation', votes: 115 },
    { id: `${id}-o4`, text: 'Leadership & Culture', votes: 67 },
  ],
  totalVotes: 422,
  timestamp: '2h ago',
  hasVoted: false,
});

function buildDemoFeed(eventId: string): FeedItem[] {
  const demoVideos = EVENT_CONTENT[eventId] ?? EVENT_CONTENT['3'];
  const items: FeedItem[] = [];

  for (const demo of demoVideos) {
    if (demo.title === 'poll') {
      items.push(SHARED_POLL(demo.id));
      continue;
    }

    const vid = SAMPLE_VIDEOS[demo.videoIndex % SAMPLE_VIDEOS.length];
    items.push({
      id: demo.id,
      type: 'video',
      user: {
        name: demo.presenter.name,
        title: demo.presenter.title,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(demo.presenter.name)}&background=7c3aed&color=fff&size=128`,
      },
      content: demo.content,
      videoUrl: vid.url,
      thumbnail: demo.thumbnail,
      duration: vid.duration,
      timestamp: 'Just now',
      likes: Math.floor(Math.random() * 120) + 20,
      comments: [],
      shares: Math.floor(Math.random() * 30) + 5,
      isLiked: false,
      pointsReward: demo.points,
    } as FeedVideoPost);
  }

  return items;
}

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

function normalizeFeedItem(raw: Record<string, unknown>): FeedItem | null {
  const type = (raw.type as string) ?? '';

  if (type === 'video' || raw.video_url || raw.videoUrl) {
    return {
      id: String(raw.id ?? ''),
      type: 'video',
      user: {
        name:   (raw.user_name  ?? raw.author_name  ?? raw.organizer_name ?? '') as string,
        title:  (raw.user_title ?? raw.author_title ?? '') as string,
        avatar: (raw.user_avatar ?? raw.author_avatar ?? raw.avatar ?? '') as string,
      },
      content:      (raw.content     ?? raw.description ?? raw.caption ?? '') as string,
      videoUrl:     (raw.video_url   ?? raw.videoUrl     ?? '') as string,
      thumbnail:    (raw.thumbnail   ?? raw.thumbnail_url ?? '') as string,
      duration:     (raw.duration    ?? '') as string,
      timestamp:    (raw.timestamp   ?? raw.created_at   ?? '') as string,
      likes:        Number(raw.likes ?? raw.likes_count  ?? 0),
      comments:     [],
      shares:       Number(raw.shares ?? raw.shares_count ?? 0),
      isLiked:      Boolean(raw.is_liked ?? raw.isLiked),
      pointsReward: Number(raw.points_reward ?? raw.pointsReward ?? 50),
    } as FeedVideoPost;
  }

  if (type === 'poll' || Array.isArray(raw.options)) {
    const options = (Array.isArray(raw.options) ? raw.options : []) as Record<string, unknown>[];
    return {
      id:         String(raw.id ?? ''),
      type:       'poll',
      question:   (raw.question ?? raw.title ?? '') as string,
      options:    options.map(o => ({
        id:    String(o.id ?? ''),
        text:  (o.text ?? o.label ?? o.option ?? '') as string,
        votes: Number(o.votes ?? o.vote_count ?? 0),
      })),
      totalVotes: Number(raw.total_votes ?? raw.totalVotes ?? 0),
      timestamp:  (raw.timestamp ?? raw.created_at ?? '') as string,
      hasVoted:   Boolean(raw.has_voted ?? raw.hasVoted),
    } as FeedPoll;
  }

  return null;
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:eventId/feed
 * Returns paginated feed items (videos + polls) for the event.
 * Falls back to event-specific curated demo content when the backend
 * returns an error (e.g. membership required).
 */
export async function getFeedApi(eventId: string, page = 1): Promise<FeedResponse> {
  if (!eventId) {
    const items = buildDemoFeed('3');
    return { success: true, data: { items, page: 1, hasMore: false, total: items.length } };
  }

  const res = await apiGet<unknown>(
    `/api/v1/events/${eventId}/feed?page=${page}&limit=10`,
    FEED_TENANT_HEADERS
  );

  if (!res.success) {
    if (page > 1) {
      return { success: true, data: { items: [], page, hasMore: false, total: 0 } };
    }
    const items = buildDemoFeed(eventId);
    return { success: true, data: { items, page: 1, hasMore: false, total: items.length } };
  }

  const envelope = res.data as Record<string, unknown>;
  const rawItems: unknown[] = Array.isArray(envelope)
    ? envelope
    : (Array.isArray(envelope?.data)   ? envelope.data   as unknown[] : null)
      ?? (Array.isArray(envelope?.items) ? envelope.items as unknown[] : null)
      ?? (Array.isArray(envelope?.feed)  ? envelope.feed  as unknown[] : null)
      ?? [];

  const items = rawItems
    .map(r => normalizeFeedItem(r as Record<string, unknown>))
    .filter((i): i is FeedItem => i !== null);

  if (items.length === 0 && page === 1) {
    const demo = buildDemoFeed(eventId);
    return { success: true, data: { items: demo, page: 1, hasMore: false, total: demo.length } };
  }

  const totalRaw = Number(envelope?.total ?? envelope?.total_count ?? rawItems.length);
  const hasMore  = Boolean(envelope?.has_more ?? envelope?.hasMore ?? (page * 10 < totalRaw));

  return { success: true, data: { items, page, hasMore, total: totalRaw } };
}

/**
 * POST /api/v1/events/:eventId/feed/:id/watch
 * Logs that the user has watched >= 80 % of a video.
 * Points are awarded client-side and synced to backend via pointsClient.
 */
export async function markVideoWatchedApi(eventId: string, videoId: string, pointsReward: number): Promise<WatchResponse> {
  if (!eventId) return { success: true, data: { pointsAwarded: pointsReward } };

  const res = await apiPost<unknown>(
    `/api/v1/events/${eventId}/feed/${videoId}/watch`,
    { points_reward: pointsReward },
    FEED_TENANT_HEADERS
  );

  if (!res.success) {
    return { success: true, data: { pointsAwarded: pointsReward } };
  }

  const raw = res.data as Record<string, unknown>;
  return {
    success: true,
    data: { pointsAwarded: Number(raw?.points_awarded ?? raw?.pointsAwarded ?? pointsReward) },
  };
}
