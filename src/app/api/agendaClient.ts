/**
 * Agenda & Sessions API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Typed functions for: list sessions (with filters), get session detail,
 * bookmark a session.
 *
 * API CONTRACT (planned):
 *   GET  /agenda/sessions            ?day=&track=  → SessionsResponse
 *   GET  /agenda/sessions/:id                      → SessionDetailResponse
 *   POST /agenda/sessions/:id/bookmark             → BookmarkResponse
 *   DELETE /agenda/sessions/:id/bookmark           → BookmarkResponse
 */

import { BASE_URL } from './authClient';
import type { Session } from '@/app/types/config';

// ─── Response Types ───────────────────────────────────────────────────────────

export interface SessionsResponse {
  success: boolean;
  data?: Session[];
  error?: { message: string };
}

export interface SessionDetailResponse {
  success: boolean;
  data?: Session;
  error?: { message: string };
}

export interface BookmarkResponse {
  success: boolean;
  data?: { sessionId: string; bookmarked: boolean };
  error?: { message: string };
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SESSIONS: Session[] = [
  {
    id: '1',
    title: 'Keynote: The Future of AI & Humanity',
    startTime: '09:00 AM',
    endTime: '10:00 AM',
    date: '2026-01-16',
    room: 'Main Hall',
    track: 'Keynote',
    type: 'Keynote',
    tags: ['AI', 'Future Tech', 'Innovation'],
    speakers: [
      {
        id: 's1',
        name: 'Dr. Sarah Chen',
        title: 'Chief AI Officer',
        company: 'TechCorp',
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=6366f1&color=fff',
      },
    ],
    description: 'Join Dr. Sarah Chen as she explores the intersection of artificial intelligence and human potential.',
    pollId: '1',
  },
  {
    id: '2',
    title: 'Workshop: Building Scalable ML Pipelines',
    startTime: '10:30 AM',
    endTime: '12:00 PM',
    date: '2026-01-16',
    room: 'Workshop A',
    track: 'AI & ML',
    type: 'Workshop',
    tags: ['Machine Learning', 'DevOps', 'Hands-on'],
    speakers: [
      {
        id: 's2',
        name: 'Prof. Michael Roberts',
        title: 'ML Research Lead',
        company: 'DataFlow Systems',
        avatar: 'https://ui-avatars.com/api/?name=Michael+Roberts&background=8b5cf6&color=fff',
      },
    ],
    description: 'Hands-on workshop to build production-ready machine learning pipelines.',
    surveyId: '2',
  },
  {
    id: '3',
    title: 'Panel: Sustainability in Technology',
    startTime: '02:00 PM',
    endTime: '03:30 PM',
    date: '2026-01-16',
    room: 'Main Hall',
    track: 'Sustainability',
    type: 'Panel',
    tags: ['Green Tech', 'Climate', 'ESG'],
    speakers: [
      {
        id: 's3',
        name: 'Emma Wilson',
        title: 'Sustainability Director',
        company: 'GreenTech Inc',
        avatar: 'https://ui-avatars.com/api/?name=Emma+Wilson&background=10b981&color=fff',
      },
      {
        id: 's4',
        name: 'James Lee',
        title: 'CTO',
        company: 'EcoCloud',
        avatar: 'https://ui-avatars.com/api/?name=James+Lee&background=f59e0b&color=fff',
      },
    ],
    description: 'Industry leaders discuss sustainable technology practices and carbon-neutral computing.',
  },
  {
    id: '4',
    title: 'Startup Pitch Competition Finals',
    startTime: '04:00 PM',
    endTime: '05:30 PM',
    date: '2026-01-16',
    room: 'Innovation Stage',
    track: 'Startups',
    type: 'Competition',
    tags: ['Startups', 'Pitch', 'Innovation'],
    speakers: [],
    description: 'Watch as the top 10 startups pitch their groundbreaking ideas to investors.',
  },
  {
    id: '5',
    title: 'Deep Dive: LLMs in Production',
    startTime: '09:30 AM',
    endTime: '11:00 AM',
    date: '2026-01-17',
    room: 'Workshop B',
    track: 'AI & ML',
    type: 'Workshop',
    tags: ['LLMs', 'Production', 'Scaling'],
    speakers: [
      {
        id: 's5',
        name: 'Alex Park',
        title: 'Principal Engineer',
        company: 'NeuraStack',
        avatar: 'https://ui-avatars.com/api/?name=Alex+Park&background=ec4899&color=fff',
      },
    ],
    description: 'Practical strategies for running large language models reliably and cost-effectively in production.',
  },
  {
    id: '6',
    title: 'Keynote: Web3 and the Decentralized Future',
    startTime: '10:00 AM',
    endTime: '11:00 AM',
    date: '2026-01-17',
    room: 'Main Hall',
    track: 'Keynote',
    type: 'Keynote',
    tags: ['Web3', 'Blockchain', 'Decentralization'],
    speakers: [
      {
        id: 's6',
        name: 'Ravi Mehta',
        title: 'Co-Founder',
        company: 'ChainLabs',
        avatar: 'https://ui-avatars.com/api/?name=Ravi+Mehta&background=3b82f6&color=fff',
      },
    ],
    description: 'Exploring the practical applications of decentralized technologies beyond the hype.',
  },
];

const delay = (ms = 700) => new Promise<void>(res => setTimeout(res, ms));

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /agenda/sessions
 * Returns sessions filtered by optional day and/or track parameters.
 */
export async function listSessionsApi(filters?: { day?: string; track?: string }): Promise<SessionsResponse> {
  await delay();

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const params = new URLSearchParams(filters as Record<string, string>).toString();
  const res = await fetch(`${BASE_URL}/agenda/sessions${params ? '?' + params : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<SessionsResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  let data = MOCK_SESSIONS;
  if (filters?.day) data = data.filter(s => s.date === filters.day);
  if (filters?.track && filters.track !== 'all') data = data.filter(s => s.track === filters.track);
  return { success: true, data };
}

/**
 * GET /agenda/sessions/:id
 * Returns full detail for a single session including speakers and linked poll/survey.
 */
export async function getSessionApi(id: string): Promise<SessionDetailResponse> {
  await delay(500);

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/agenda/sessions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<SessionDetailResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  const session = MOCK_SESSIONS.find(s => s.id === id);
  if (!session) return { success: false, error: { message: 'Session not found' } };
  return { success: true, data: session };
}

/**
 * POST /agenda/sessions/:id/bookmark
 * Toggles a bookmark on a session. The backend persists the state per user.
 */
export async function bookmarkSessionApi(id: string, bookmarked: boolean): Promise<BookmarkResponse> {
  await delay(400);

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const method = bookmarked ? 'POST' : 'DELETE';
  const res = await fetch(`${BASE_URL}/agenda/sessions/${id}/bookmark`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<BookmarkResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  return { success: true, data: { sessionId: id, bookmarked } };
}
