import { request, USE_MOCK } from '@/lib/apiClient';
import type { ApiResponse, FeedPage, FeedItem, FeedVideo, FeedPoll } from '@/lib/api/types';

const SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const MOCK_FEED_ITEMS: FeedItem[] = [
  { id: 'v1', type: 'video', title: 'Opening Keynote: The Future of AI', speaker: 'Dr. Sarah Chen', company: 'TechCorp Solutions', duration: '58:22', views: '1.2K', accentColor: '#7c3aed', live: true, videoUrl: SAMPLE_VIDEO } as FeedVideo,
  { id: 'poll1', type: 'poll', question: 'Which topic are you most excited about today?', session: 'Opening Keynote', points: 10, options: [{ id: 'o1', text: 'AI & Machine Learning', votes: 48 }, { id: 'o2', text: 'Startup Ecosystem', votes: 31 }, { id: 'o3', text: 'Sustainable Tech', votes: 22 }, { id: 'o4', text: 'Leadership & Culture', votes: 19 }] } as FeedPoll,
  { id: 'v2', type: 'video', title: 'Scaling Engineering Teams in a Remote World', speaker: 'Marcus Johnson', company: 'InnovateLab', duration: '42:10', views: '847', accentColor: '#06b6d4', live: false, videoUrl: SAMPLE_VIDEO } as FeedVideo,
  { id: 'poll2', type: 'poll', question: 'How productive is your remote team vs. in-office?', session: 'Engineering Workshop', points: 10, options: [{ id: 'o1', text: 'More productive', votes: 62 }, { id: 'o2', text: 'About the same', votes: 28 }, { id: 'o3', text: 'Slightly less', votes: 18 }, { id: 'o4', text: 'Much less', votes: 9 }] } as FeedPoll,
  { id: 'v3', type: 'video', title: 'UX Research That Actually Influences Product', speaker: 'Priya Patel', company: 'DesignFlow', duration: '29:45', views: '532', accentColor: '#ec4899', live: false, videoUrl: SAMPLE_VIDEO } as FeedVideo,
  { id: 'v4', type: 'video', title: 'ML Applications in Enterprise Products', speaker: 'Elena Rodriguez', company: 'QuantumLeap AI', duration: '35:00', views: '412', accentColor: '#10b981', live: false, videoUrl: SAMPLE_VIDEO } as FeedVideo,
];

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

export async function getFeedPage(cursor?: string): Promise<ApiResponse<FeedPage>> {
  if (USE_MOCK) {
    await delay();
    const PAGE_SIZE = 6;
    const pageNum = cursor ? parseInt(cursor, 10) : 0;
    const items = MOCK_FEED_ITEMS.map((item) =>
      pageNum === 0 ? item : { ...item, id: `${item.id}_p${pageNum}` }
    );
    return {
      success: true,
      data: {
        items,
        nextCursor: pageNum < 4 ? String(pageNum + 1) : null,
        hasMore: pageNum < 4,
      },
    };
  }
  const params = cursor ? `?cursor=${cursor}` : '';
  return request<FeedPage>(`/api/feed${params}`);
}

export async function markVideoWatched(videoId: string): Promise<ApiResponse<{ points: number }>> {
  if (USE_MOCK) {
    await delay(300);
    return { success: true, data: { points: 20 } };
  }
  return request<{ points: number }>('/api/feed/video/watched', {
    method: 'POST',
    body: JSON.stringify({ videoId }),
  });
}

export async function submitPollVote(pollId: string, optionId: string): Promise<ApiResponse<{ points: number; results: Array<{ id: string; votes: number }> }>> {
  if (USE_MOCK) {
    await delay(400);
    return { success: true, data: { points: 10, results: [] } };
  }
  return request('/api/polls/vote', {
    method: 'POST',
    body: JSON.stringify({ pollId, optionId }),
  });
}
