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
 * Fetches one page of checked-in attendees from the event_members table.
 * GET /api/v1/events/:id/members?checked_in_only=true&per_page=15&page=N
 *
 * Uses /members (not /attendees) because only /members is backed by
 * event_members and returns `status` + `joined_at` — the fields that
 * record true check-in state. /attendees omits these fields entirely.
 *
 * Defense-in-depth: server sends checked_in_only=true; client also filters
 * by isCheckedIn (status=ACTIVE || joined_at≠null) in case the backend
 * hasn't implemented the param yet.
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

  // /members is backed by event_members — the table that stores check-in
  // status (status=ACTIVE, joined_at). /attendees does not expose these fields.
  const res = await request<any>(`/api/v1/events/${eventId}/members?${params.toString()}`);
  if (!res.success) return { success: false, data: [], hasMore: false, error: res.error };

  const rawList = extractRawList(res);
  // Normalize and apply client-side check-in filter as defense-in-depth.
  // /members returns status + joined_at so isCheckedIn is reliably computed.
  const data = rawList.map(normalizeAttendee).filter(a => a.isCheckedIn);
  return { success: true, data, hasMore: rawList.length >= AUDIENCE_PAGE_SIZE };
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

/** @deprecated Use updateProfileFull instead — this hits the wrong endpoint. */
export async function updateProfile(data: Partial<AuthUser>): Promise<ApiResponse<AuthUser>> {
  return request<AuthUser>('/api/v1/profile', { method: 'PATCH', body: JSON.stringify(data) });
}

// ─── Extended profile types ──────────────────────────────────────────────────

export interface Lookup { id: number; name: string; slug?: string }

export interface FullProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  bio: string;
  company: string;
  companyId: number | null;
  industry: string;
  industryId: number | null;
  linkedinUrl: string;
  socialLinks: Record<string, string>;
  interestedTopics: Array<{ id: number; name: string }>;
  avatar: string;
}

export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  bio?: string;
  linkedin_url?: string;
  company_id?: number | null;
  company?: string;
  company_name?: string;
  industry_id?: number | null;
  social_links?: Record<string, string>;
  interested_topic_ids?: number[];
  topic_ids?: number[];
  interests?: string[];
}

function normalizeFullProfile(raw: any): FullProfile {
  const company = raw.company;
  const companyName =
    typeof company === 'string' ? company :
    company && typeof company === 'object' ? String(company.name ?? '') : '';
  const companyId =
    company && typeof company === 'object' && company.id != null ? Number(company.id) :
    raw.company_id != null ? Number(raw.company_id) : null;

  const industry = raw.industry;
  const industryName =
    typeof industry === 'string' ? industry :
    industry && typeof industry === 'object' ? String(industry.name ?? '') : '';
  const industryId =
    industry && typeof industry === 'object' && industry.id != null ? Number(industry.id) :
    raw.industry_id != null ? Number(raw.industry_id) : null;

  const topicsRaw = raw.interested_topics ?? raw.interestedTopics ?? [];
  const interestedTopics = Array.isArray(topicsRaw)
    ? topicsRaw.map((t: any) =>
        typeof t === 'string' ? { id: 0, name: t } :
        { id: Number(t.id ?? 0), name: String(t.name ?? '') }
      ).filter((t: any) => t.name)
    : [];

  const socialLinksRaw = raw.social_links ?? raw.socialLinks;
  const socialLinks: Record<string, string> = {};
  if (socialLinksRaw && typeof socialLinksRaw === 'object' && !Array.isArray(socialLinksRaw)) {
    for (const [k, v] of Object.entries(socialLinksRaw)) {
      if (typeof v === 'string' && v && k !== 'linkedin') socialLinks[k] = v;
    }
  }

  const firstName = raw.first_name ?? raw.firstName ?? '';
  const lastName = raw.last_name ?? raw.lastName ?? '';
  const linkedinFromSocial =
    typeof socialLinksRaw?.linkedin === 'string' ? socialLinksRaw.linkedin : '';

  return {
    id: String(raw.id ?? ''),
    firstName,
    lastName,
    email: raw.email ?? '',
    phone: raw.phone ?? '',
    title: raw.title ?? raw.job_title ?? raw.position ?? '',
    bio: raw.bio ?? '',
    company: companyName,
    companyId,
    industry: industryName,
    industryId,
    linkedinUrl: raw.linkedin_url ?? raw.linkedinUrl ?? linkedinFromSocial ?? '',
    socialLinks,
    interestedTopics,
    avatar: raw.avatar_url ?? raw.avatar ?? raw.profile_image ?? '',
  };
}

/** GET /api/v1/me — fetches the current user's full profile including
 *  company, industry, social links, and interested topics. */
export async function fetchFullProfile(): Promise<ApiResponse<FullProfile>> {
  const res = await request<any>('/api/v1/me');
  if (!res.success) return res as ApiResponse<FullProfile>;
  const raw = res.data?.user ?? res.data?.data ?? res.data;
  return { success: true, data: normalizeFullProfile(raw) };
}

/** PUT /api/v1/me/profile — saves all editable profile fields.
 *  Re-fetches GET /api/v1/me afterward to return the authoritative persisted state. */
export async function updateProfileFull(payload: ProfileUpdatePayload): Promise<ApiResponse<FullProfile>> {
  const res = await request<any>('/api/v1/me/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.success) return res as ApiResponse<FullProfile>;
  // Re-fetch to confirm what the backend persisted.
  return fetchFullProfile();
}

// ─── Lookup helpers (used by edit-profile screen) ───────────────────────────

function unwrapLookupList(raw: any): Lookup[] {
  const list: any[] = Array.isArray(raw) ? raw
    : Array.isArray(raw?.data) ? raw.data
    : Array.isArray(raw?.data?.data) ? raw.data.data
    : [];
  return list
    .map((item: any) => ({ id: Number(item.id ?? 0), name: String(item.name ?? ''), slug: item.slug }))
    .filter(x => x.id && x.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listIndustries(): Promise<ApiResponse<Lookup[]>> {
  const res = await request<any>('/api/v1/industries');
  if (!res.success) return { success: true, data: [] };
  return { success: true, data: unwrapLookupList(res.data) };
}

export async function listTopics(): Promise<ApiResponse<Lookup[]>> {
  const res = await request<any>('/api/v1/tags');
  if (!res.success) return { success: true, data: [] };
  return { success: true, data: unwrapLookupList(res.data) };
}

export async function listCompanies(perPage = 500): Promise<ApiResponse<Lookup[]>> {
  const res = await request<any>(`/api/v1/companies?per_page=${perPage}`);
  if (!res.success) return { success: true, data: [] };
  return { success: true, data: unwrapLookupList(res.data) };
}

export async function searchCompanies(query: string, perPage = 20): Promise<ApiResponse<Lookup[]>> {
  const q = query.trim();
  if (!q) return { success: true, data: [] };
  const res = await request<any>(`/api/v1/companies?per_page=${perPage}&search=${encodeURIComponent(q)}`);
  if (!res.success) return { success: true, data: [] };
  const list = unwrapLookupList(res.data)
    .filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
  return { success: true, data: list };
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
