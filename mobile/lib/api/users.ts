import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, AuthUser, Attendee, LeaderboardEntry } from '@/lib/api/types';

const TIER_COLORS: Record<string, string> = {
  Platinum: '#e5e4e2',
  Gold: '#ffd700',
  Silver: '#c0c0c0',
  Bronze: '#cd7f32',
};

function normalizeAttendee(a: any): Attendee {
  return {
    id: String(a.id),
    name: a.name ?? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim(),
    title: a.title ?? a.job_title ?? a.position ?? '',
    company: a.company ?? a.organization ?? '',
    role: a.role === 'sponsor' ? 'sponsor' : 'attendee',
    points: Number(a.points ?? a.gamification_points ?? 0),
    tier: a.tier ?? a.membership_tier ?? 'Bronze',
    interests: Array.isArray(a.interests) ? a.interests : [],
    bio: a.bio ?? a.about ?? '',
  };
}

function normalizeLeaderboardEntry(raw: any, index: number): LeaderboardEntry {
  const tier = raw.tier ?? raw.membership_tier ?? 'Bronze';
  return {
    rank: Number(raw.rank ?? raw.position ?? index + 1),
    userId: String(raw.user_id ?? raw.userId ?? raw.id ?? ''),
    name: raw.name ?? raw.full_name ?? '',
    points: Number(raw.points ?? raw.total_points ?? raw.gamification_points ?? 0),
    tier,
    tierColor: raw.tier_color ?? raw.tierColor ?? TIER_COLORS[tier] ?? '#cd7f32',
    company: raw.company_name ?? raw.companyName ?? (typeof raw.company === 'string' ? raw.company : raw.company?.name) ?? '',
  };
}

export async function listAttendees(filters?: { tier?: string; search?: string }): Promise<ApiResponse<Attendee[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Users] listAttendees eventId=${eventId} filters=`, filters);
  if (!eventId) return { success: true, data: [] };
  const params = new URLSearchParams();
  if (filters?.tier) params.set('tier', filters.tier);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await request<any>(`/api/v1/events/${eventId}/attendees${query}`);
  if (!res.success) return res as ApiResponse<Attendee[]>;
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.attendees ?? []);
  return { success: true, data: raw.map(normalizeAttendee) };
}

export async function getAttendee(id: string): Promise<ApiResponse<Attendee>> {
  if (__DEV__) console.log(`[Users] getAttendee(${id}) — live`);
  const res = await request<any>(`/api/v1/attendees/${id}`);
  if (!res.success) return res as ApiResponse<Attendee>;
  const raw = res.data?.data ?? res.data;
  return { success: true, data: normalizeAttendee(raw) };
}

export async function updateProfile(data: Partial<AuthUser>): Promise<ApiResponse<AuthUser>> {
  return request<AuthUser>('/api/v1/profile', { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getLeaderboard(): Promise<ApiResponse<LeaderboardEntry[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Users] getLeaderboard eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };
  const res = await request<any>(`/api/v1/events/${eventId}/leaderboard`);
  if (!res.success) return res as ApiResponse<LeaderboardEntry[]>;
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.leaderboard ?? []);
  return { success: true, data: raw.map((r, i) => normalizeLeaderboardEntry(r, i)) };
}

export async function getUserPoints(): Promise<ApiResponse<{ points: number; tier: string }>> {
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
  return request<{ points: number; tier: string }>('/api/v1/profile/points/sync', {
    method: 'POST',
    body: JSON.stringify({ delta, reason }),
  });
}
