import { request, USE_MOCK } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, AuthUser, Attendee, LeaderboardEntry } from '@/lib/api/types';

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_ATTENDEES: Attendee[] = [
  { id: 'a1', name: 'Jessica Williams', title: 'Product Designer', company: 'Stripe', role: 'attendee', points: 120, tier: 'Silver', interests: ['Design', 'Product'], bio: 'Passionate about crafting intuitive user experiences.' },
  { id: 'a2', name: 'Michael Chen', title: 'CTO', company: 'StartupX', role: 'attendee', points: 350, tier: 'Gold', interests: ['Engineering', 'AI'], bio: 'Building the future of distributed systems.' },
  { id: 'a3', name: 'Aisha Kamara', title: 'Founder & CEO', company: 'Nexus Labs', role: 'attendee', points: 680, tier: 'Platinum', interests: ['Leadership', 'Innovation'], bio: 'Serial entrepreneur focused on AI-driven enterprise tools.' },
  { id: 'a4', name: 'Dev Sharma', title: 'VP Engineering', company: 'CloudNine', role: 'attendee', points: 540, tier: 'Gold', interests: ['Cloud', 'Infrastructure'], bio: 'Cloud infrastructure enthusiast with 12 years in distributed systems.' },
  { id: 'a5', name: 'Lena Fischer', title: 'Chief Sustainability Officer', company: 'GreenTech Global', role: 'attendee', points: 420, tier: 'Gold', interests: ['Sustainability', 'ESG'], bio: 'Making tech more sustainable, one product at a time.' },
  { id: 'a6', name: 'Omar Hassan', title: 'Product Manager', company: 'InnovateLab', role: 'attendee', points: 310, tier: 'Silver', interests: ['Product', 'Growth'], bio: 'Product thinker obsessed with user-centric design.' },
  { id: 'a7', name: 'Yuki Tanaka', title: 'Head of Data Science', company: 'QuantumLeap AI', role: 'attendee', points: 290, tier: 'Silver', interests: ['Data', 'ML'], bio: 'Turning noisy datasets into actionable insights.' },
  { id: 'a8', name: 'Marcus Johnson', title: 'CTO', company: 'InnovateLab', role: 'attendee', points: 180, tier: 'Silver', interests: ['Engineering', 'Remote Work'], bio: 'Remote-first engineering advocate and distributed teams expert.' },
  { id: 'a9', name: 'Priya Patel', title: 'VP Design', company: 'DesignFlow', role: 'attendee', points: 95, tier: 'Bronze', interests: ['UX', 'Design Systems'], bio: 'Crafting design systems that scale across enterprise products.' },
  { id: 'a10', name: 'Jordan Kim', title: 'CEO', company: 'GrowthOS', role: 'attendee', points: 420, tier: 'Gold', interests: ['Leadership', 'Innovation'], bio: 'Building the OS for high-growth companies.' },
];

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: 'a3', name: 'Aisha Kamara', points: 680, tier: 'Platinum', tierColor: '#e5e4e2' },
  { rank: 2, userId: 'a4', name: 'Dev Sharma', points: 540, tier: 'Gold', tierColor: '#ffd700' },
  { rank: 3, userId: 'a5', name: 'Lena Fischer', points: 420, tier: 'Gold', tierColor: '#ffd700' },
  { rank: 4, userId: 'a6', name: 'Omar Hassan', points: 310, tier: 'Silver', tierColor: '#c0c0c0' },
  { rank: 5, userId: 'a7', name: 'Yuki Tanaka', points: 290, tier: 'Silver', tierColor: '#c0c0c0' },
];

const TIER_COLORS: Record<string, string> = {
  Platinum: '#e5e4e2',
  Gold: '#ffd700',
  Silver: '#c0c0c0',
  Bronze: '#cd7f32',
};

function normalizeLeaderboardEntry(raw: any, index: number): LeaderboardEntry {
  const tier = raw.tier ?? raw.membership_tier ?? 'Bronze';
  return {
    rank: Number(raw.rank ?? raw.position ?? index + 1),
    userId: String(raw.user_id ?? raw.userId ?? raw.id ?? ''),
    name: raw.name ?? raw.full_name ?? '',
    points: Number(raw.points ?? raw.total_points ?? raw.gamification_points ?? 0),
    tier,
    tierColor: raw.tier_color ?? raw.tierColor ?? TIER_COLORS[tier] ?? '#cd7f32',
  };
}

export async function listAttendees(filters?: { tier?: string; search?: string }): Promise<ApiResponse<Attendee[]>> {
  if (USE_MOCK) {
    await delay();
    let attendees = MOCK_ATTENDEES;
    if (filters?.tier) attendees = attendees.filter((a) => a.tier === filters.tier);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      attendees = attendees.filter((a) =>
        a.name.toLowerCase().includes(q) || a.company.toLowerCase().includes(q) || a.title.toLowerCase().includes(q)
      );
    }
    return { success: true, data: attendees };
  }
  const params = new URLSearchParams();
  if (filters?.tier) params.set('tier', filters.tier);
  if (filters?.search) params.set('search', filters.search);
  return request<Attendee[]>(`/api/v1/attendees?${params.toString()}`);
}

export async function getAttendee(id: string): Promise<ApiResponse<Attendee>> {
  if (USE_MOCK) {
    await delay(400);
    const a = MOCK_ATTENDEES.find((x) => x.id === id);
    if (!a) return { success: false, error: { code: 'NOT_FOUND', message: 'Attendee not found' } };
    return { success: true, data: a };
  }
  return request<Attendee>(`/api/v1/attendees/${id}`);
}

export async function updateProfile(data: Partial<AuthUser>): Promise<ApiResponse<AuthUser>> {
  if (USE_MOCK) {
    await delay(700);
    return { success: true, data: data as AuthUser };
  }
  return request<AuthUser>('/api/v1/profile', { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getLeaderboard(): Promise<ApiResponse<LeaderboardEntry[]>> {
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_LEADERBOARD };
  }
  const eventId = getEventId();
  if (!eventId) return { success: true, data: MOCK_LEADERBOARD };
  const res = await request<any>(`/api/v1/events/${eventId}/leaderboard`);
  if (!res.success) return res as ApiResponse<LeaderboardEntry[]>;
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.leaderboard ?? []);
  return { success: true, data: raw.map((r, i) => normalizeLeaderboardEntry(r, i)) };
}

export async function getUserPoints(): Promise<ApiResponse<{ points: number; tier: string }>> {
  if (USE_MOCK) {
    await delay(400);
    return { success: true, data: { points: 0, tier: 'Bronze' } };
  }
  const eventId = getEventId();
  if (!eventId) return { success: true, data: { points: 0, tier: 'Bronze' } };
  const res = await request<any>(`/api/v1/events/${eventId}/my-rank`);
  if (!res.success) return res as ApiResponse<{ points: number; tier: string }>;
  const raw = res.data;
  return {
    success: true,
    data: {
      points: Number(raw?.points ?? raw?.total_points ?? raw?.gamification_points ?? 0),
      tier: raw?.tier ?? raw?.membership_tier ?? 'Bronze',
    },
  };
}

export async function syncPoints(delta: number, reason: string): Promise<ApiResponse<{ points: number; tier: string }>> {
  if (USE_MOCK) {
    await delay(300);
    return { success: true, data: { points: delta, tier: 'Bronze' } };
  }
  return request<{ points: number; tier: string }>('/api/v1/profile/points/sync', {
    method: 'POST',
    body: JSON.stringify({ delta, reason }),
  });
}
