/**
 * Feed API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Typed functions for paginated feed fetching and video watch tracking.
 *
 * API CONTRACT (planned):
 *   GET  /feed              ?page=1&limit=10&type=video|poll  → FeedResponse
 *   POST /feed/video/:id/watch                                → WatchResponse
 */

import { BASE_URL } from './authClient';
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

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_FEED_PAGE_1: FeedItem[] = [
  {
    id: 'v1',
    type: 'video',
    user: {
      name: 'Tech Summit 2026',
      title: 'Official Event Channel',
      avatar: 'https://images.unsplash.com/photo-1644088379091-d574269d422f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHRlY2hub2xvZ3klMjBiYWNrZ3JvdW5kfGVufDF8fHx8MTc3MTUyODg4Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    content: "🎤 Opening Keynote Highlights — don't miss the best moments from this morning's session! Watch till the end for the big product reveal. 🚀",
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1573339887617-d674bc961c31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25mZXJlbmNlJTIwc3RhZ2UlMjBsaWdodGluZ3xlbnwxfHx8fDE3NzE1NjExNzB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '0:15',
    timestamp: '30m ago',
    likes: 214,
    comments: [],
    shares: 38,
    isLiked: false,
    pointsReward: 50,
  } as FeedVideoPost,
  {
    id: 'poll1',
    type: 'poll',
    question: "Which topic are you most excited about for tomorrow's sessions?",
    options: [
      { id: 'opt1', text: 'Generative AI in Design', votes: 145 },
      { id: 'opt2', text: 'Sustainable Tech', votes: 89 },
      { id: 'opt3', text: 'Web3 & Decentralization', votes: 62 },
      { id: 'opt4', text: 'Future of Remote Work', votes: 112 },
    ],
    totalVotes: 408,
    timestamp: '1h ago',
    hasVoted: false,
  } as FeedPoll,
  {
    id: 'v2',
    type: 'video',
    user: {
      name: 'Elena Rodriguez',
      title: 'Head of Innovation · FutureCorp',
      avatar: 'https://images.unsplash.com/photo-1760611656007-f767a8082758?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBtZWV0aW5nfGVufDF8fHx8MTc3MTU1NDgyM3ww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    content: "My 60-second take on why AI + human collaboration is the real game-changer this decade. Would love to hear your thoughts in the comments! 💡",
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1560439514-4e9645039924?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXR3b3JraW5nJTIwZXZlbnQlMjBjcm93ZHxlbnwxfHx8fDE3NzE1NDk1OTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '0:15',
    timestamp: '5h ago',
    likes: 89,
    comments: [],
    shares: 14,
    isLiked: false,
    pointsReward: 50,
  } as FeedVideoPost,
];

const MOCK_FEED_PAGE_2: FeedItem[] = [
  {
    id: 'v3',
    type: 'video',
    user: {
      name: 'David Kim',
      title: 'Founder & CEO · NeuraStack',
      avatar: 'https://images.unsplash.com/photo-1649433658557-54cf58577c68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwcm9maWxlJTIwcG9ydHJhaXQlMjBtYW58ZW58MXx8fHwxNzcxNTU2MTkyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    content: "Behind the scenes of our live demo this afternoon 🎬 It almost didn't happen — watch to find out why! 🙌 #StartupLife",
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1573339887617-d674bc961c31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25mZXJlbmNlJTIwc3RhZ2UlMjBsaWdodGluZ3xlbnwxfHx8fDE3NzE1NjExNzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    duration: '0:15',
    timestamp: '6h ago',
    likes: 176,
    comments: [],
    shares: 21,
    isLiked: false,
    pointsReward: 50,
  } as FeedVideoPost,
  {
    id: 'poll2',
    type: 'poll',
    question: 'Best time for networking breaks?',
    options: [
      { id: 'a', text: 'Morning (10:00 AM)', votes: 123 },
      { id: 'b', text: 'Lunch (12:00 PM)', votes: 267 },
      { id: 'c', text: 'Afternoon (3:00 PM)', votes: 156 },
      { id: 'd', text: 'Evening (5:00 PM)', votes: 98 },
    ],
    totalVotes: 644,
    timestamp: '8h ago',
    hasVoted: false,
  } as FeedPoll,
  {
    id: 'v4',
    type: 'video',
    user: {
      name: 'Marcus Johnson',
      title: 'VP Engineering · InnovateLab',
      avatar: 'https://ui-avatars.com/api/?name=Marcus+Johnson&background=8b5cf6&color=fff',
    },
    content: "Quick recap of the best talks from today's AI track. Save this for later! 🤖✨",
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1644088379091-d574269d422f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHRlY2hub2xvZ3klMjBiYWNrZ3JvdW5kfGVufDF8fHx8MTc3MTUyODg4Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '0:20',
    timestamp: '10h ago',
    likes: 312,
    comments: [],
    shares: 45,
    isLiked: false,
    pointsReward: 50,
  } as FeedVideoPost,
];

const PAGES: FeedItem[][] = [MOCK_FEED_PAGE_1, MOCK_FEED_PAGE_2];

const delay = (ms = 700) => new Promise<void>(res => setTimeout(res, ms));

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /feed
 * Returns a paginated list of feed items (videos + polls only).
 */
export async function getFeedApi(page = 1): Promise<FeedResponse> {
  await delay();

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/feed?page=${page}&limit=10&type=video,poll`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<FeedResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  const pageIndex = page - 1;
  const items = PAGES[pageIndex] ?? [];
  return {
    success: true,
    data: {
      items,
      page,
      hasMore: pageIndex < PAGES.length - 1,
      total: PAGES.flat().length,
    },
  };
}

/**
 * POST /feed/video/:id/watch
 * Marks a video as watched; the backend awards points and returns the amount.
 */
export async function markVideoWatchedApi(videoId: string, pointsReward: number): Promise<WatchResponse> {
  await delay(400);

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/feed/video/${videoId}/watch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<WatchResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  return { success: true, data: { pointsAwarded: pointsReward } };
}
