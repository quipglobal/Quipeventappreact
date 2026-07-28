import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, AuthUser, Attendee, LeaderboardEntry } from '@/lib/api/types';

const TIER_COLORS: Record<string, string> = {
  Platinum: '#e5e4e2',
  Gold: '#ffd700',
  Silver: '#c0c0c0',
  Bronze: '#cd7f32',
};

const ROLE_MAP: Record<string, string> = {
  attendee: 'Attendee', speaker: 'Speaker', sponsor: 'Sponsor',
  sponsor_rep: 'Sponsor', exhibitor: 'Sponsor', organizer: 'Organizer',
  vip: 'VIP', staff: 'Staff', moderator: 'Moderator', member: 'Attendee',
};

function normalizeRole(roles: string[]): string {
  if (!roles?.length) return 'Attendee';
  const normalized = roles.map(
    r => ROLE_MAP[r?.toLowerCase()] ?? (r ? r[0].toUpperCase() + r.slice(1) : 'Attendee'),
  );
  return normalized.find(r => r !== 'Attendee') ?? 'Attendee';
}

function normalizeAttendee(raw: any): Attendee {
  const fullName = (raw.name ?? `${raw.first_name ?? ''} ${raw.last_name ?? ''}`.trim()) || 'Unknown';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = raw.first_name ?? nameParts[0] ?? null;
  const lastName = raw.last_name ?? (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null);

  const company =
    (typeof raw.company_name === 'string' ? raw.company_name : null) ||
    (raw.company && typeof raw.company === 'object' ? (raw.company as any).name : null) ||
    (typeof raw.company === 'string' ? raw.company : null) ||
    (raw.organization ?? '');

  const roles: string[] = Array.isArray(raw.roles) ? raw.roles : raw.role ? [raw.role] : [];
  const isCheckedIn = Boolean(raw.joined_at) || (raw.status ?? '').toUpperCase() === 'ACTIVE';
  const avatar = raw.avatar_url || raw.profile_image || raw.avatar || null;

  const interestedTopics: string[] = Array.isArray(raw.interested_topics)
    ? raw.interested_topics.filter((t: any) => typeof t === 'string' && t)
    : [];

  const socialLinks: Record<string, string> = (() => {
    const sl = raw.social_links;
    if (!sl || Array.isArray(sl) || typeof sl !== 'object') return {};
    return Object.fromEntries(
      Object.entries(sl as Record<string, unknown>)
        .map(([k, v]) => [k, typeof v === 'string' ? v : ''])
        .filter(([, v]) => v),
    );
  })();

  return {
    id: String(raw.membership_id ?? raw.id ?? ''),
    userId: String(raw.id ?? raw.user_id ?? ''),
    memberId: String(raw.membership_id ?? raw.id ?? ''),
    name: fullName,
    firstName,
    lastName,
    title: raw.title ?? raw.job_title ?? raw.position ?? '',
    company,
    industry: raw.industry ?? null,
    role: normalizeRole(roles),
    points: Number(raw.points ?? raw.gamification_points ?? 0),
    tier: raw.tier ?? raw.membership_tier ?? 'Bronze',
    interests: Array.isArray(raw.interests) ? raw.interests : [],
    interestedTopics,
    avatar,
    bio: raw.bio ?? raw.about ?? null,
    isCheckedIn,
    status: raw.status ?? '',
    badgeCode: raw.badge_code ?? null,
    linkedinUrl: raw.linkedin_url ?? null,
    socialLinks,
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

/** Extracts the flat member array from any Laravel paginator envelope shape. */
function extractRawList(res: { success: boolean; data?: unknown }): any[] {
  if (!res.success) return [];
  const body = res.data as any;
  const paginator = body?.data ?? body;
  if (Array.isArray(paginator?.data)) return paginator.data;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(res.data)) return res.data as any[];
  return [];
}

const AUDIENCE_PAGE_SIZE = 15;

/**
 * Fetches one page of checked-in attendees for the current event.
 * Primary:  GET /api/v1/events/:id/attendees?checked_in_only=true&per_page=15&page=N
 * Fallback: GET /api/v1/events/:id/members?checked_in_only=true&per_page=15&page=N
 *
 * ALL members returned are trusted as checked-in (server filters).
 * Returns { data, hasMore } so callers can drive server-side pagination.
 */
export async function listAttendees(
  filters?: { page?: number; search?: string },
): Promise<ApiResponse<Attendee[]> & { hasMore: boolean }> {
  const eventId = getEventId();
  const page = filters?.page ?? 1;
  if (__DEV__) console.log(`[Users] listAttendees eventId=${eventId} page=${page}`);
  if (!eventId) return { success: true, data: [], hasMore: false };

  const params = new URLSearchParams();
  params.set('per_page', String(AUDIENCE_PAGE_SIZE));
  params.set('page', String(page));
  params.set('checked_in_only', 'true');
  if (filters?.search) params.set('search', filters.search);

  // Try /attendees first (role-filtered endpoint)
  const res = await request<any>(`/api/v1/events/${eventId}/attendees?${params.toString()}`);
  const rawList = extractRawList(res);
  if (res.success && rawList.length > 0) {
    return { success: true, data: rawList.map(normalizeAttendee), hasMore: rawList.length >= AUDIENCE_PAGE_SIZE };
  }

  // Fall back to /members if /attendees fails or returns empty
  if (__DEV__) console.log('[Users] /attendees failed or empty — falling back to /members');
  const fbParams = new URLSearchParams();
  fbParams.set('per_page', String(AUDIENCE_PAGE_SIZE));
  fbParams.set('page', String(page));
  fbParams.set('checked_in_only', 'true');
  if (filters?.search) fbParams.set('search', filters.search);

  const fb = await request<any>(`/api/v1/events/${eventId}/members?${fbParams.toString()}`);
  if (!fb.success) return { ...(fb as ApiResponse<Attendee[]>), hasMore: false };
  const rawFb = extractRawList(fb);
  return { success: true, data: rawFb.map(normalizeAttendee), hasMore: rawFb.length >= AUDIENCE_PAGE_SIZE };
}

export async function getAttendee(userId: string): Promise<ApiResponse<Attendee>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Users] getAttendee(${userId}) eventId=${eventId}`);
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/attendees/${userId}`);
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

export interface Speaker {
  id: string;
  name: string;
  title: string;
  company: string;
  avatar: string;
  bio: string;
}

function normalizeSpeaker(raw: any): Speaker {
  const name = raw.name ?? raw.full_name ?? `${raw.first_name ?? ''} ${raw.last_name ?? ''}`.trim();
  return {
    id: String(raw.id ?? raw.user_id ?? raw.membership_id ?? ''),
    name,
    title: raw.title ?? raw.job_title ?? raw.position ?? raw.designation ?? '',
    company: typeof raw.company === 'object' ? (raw.company?.name ?? '') : (raw.company ?? raw.company_name ?? raw.organization ?? ''),
    avatar: raw.avatar_url ?? raw.profile_image ?? raw.avatar ?? raw.photo ?? '',
    bio: raw.bio ?? raw.about ?? '',
  };
}

export async function listSpeakers(): Promise<ApiResponse<Speaker[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Users] listSpeakers eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };

  const PAGE_SIZE = 200;
  const MAX_PAGES = 5;
  const speakers: Speaker[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await request<any>(
      `/api/v1/events/${eventId}/members?per_page=${PAGE_SIZE}&page=${page}&checked_in_only=false`,
    );
    if (!res.success) break;

    const rawList = extractRawList(res);
    for (const m of rawList) {
      const roles: string[] = Array.isArray(m.roles) ? m.roles : [];
      const isSpeaker = roles.some((r) => String(r).toLowerCase() === 'speaker') ||
        String(m.member_type ?? m.memberType ?? '').toLowerCase() === 'speaker' ||
        String(m.role ?? '').toLowerCase() === 'speaker';
      if (isSpeaker) speakers.push(normalizeSpeaker(m));
    }

    if (rawList.length < PAGE_SIZE) break;
  }

  return { success: true, data: speakers };
}
