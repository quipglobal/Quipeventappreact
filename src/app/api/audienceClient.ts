/**
 * Audience / Event Members API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend v2 API — flat member+user shape (no nested `user` object):
 *
 * Audience display (role-filtered: Attendee / Speaker / Moderator / Sponsor):
 *   GET /api/v1/events/:id/attendees              → paginated list
 *   GET /api/v1/events/:id/attendees/:userId      → single attendee detail
 *
 * Admin / role-lookup (all roles including Organizer/Staff):
 *   GET /api/v1/events/:id/members                → still used for role detection
 *   GET /api/v1/events/:id/members/:memberId      → check-in & role scan only
 *
 * Response shape per member (v2):
 * {
 *   membership_id, status, joined_at, badge_code, roles[],
 *   id (userId), name, first_name, last_name, email, phone,
 *   title, bio, linkedin_url, social_links ({}|[]), avatar_url, profile_image,
 *   company: { id, name } | null, company_name: string | null
 * }
 *
 * NOTE: checked_in / checked_in_at / networking_opt_in removed from v2 API.
 * isCheckedIn is inferred: joined_at != null OR status === 'ACTIVE'.
 *
 * NOTE: /attendees returns Cache-Control: no-store — always fetch fresh.
 */

import { apiGet, apiPost } from './client';

const TENANT_ID = (import.meta.env.VITE_TENANT_ID ?? '3') as string;
const HEADERS: Record<string, string> = { 'X-Tenant-ID': TENANT_ID };

// ─── Raw API shape (v2 flat) ──────────────────────────────────────────────────

export interface RawFlatMember {
  membership_id: number;
  status: string;
  joined_at: string | null;
  badge_code: string | null;
  roles: string[];
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  title: string | null;
  bio: string | null;
  linkedin_url: string | null;
  social_links: Record<string, string> | unknown[] | null;
  avatar_url: string | null;
  profile_image: string | null;
  company: { id: number; name: string } | null;
  company_name: string | null;
}

// ─── Normalized types ─────────────────────────────────────────────────────────

export interface EventMember {
  memberId: number;
  userId: number;
  eventId: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  company: string;
  title: string | null;
  bio: string | null;
  role: string;
  status: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  joinedAt: string | null;
  badgeCode: string | null;
  networkingOptIn: boolean;
}

export interface MemberDetail extends EventMember {
  firstName: string | null;
  lastName: string | null;
  industry: string | null;
  interestedTopics: string[];
  socialLinks: Record<string, string>;
  linkedinUrl: string | null;
}

export interface MemberDetailResponse {
  success: boolean;
  data?: MemberDetail;
  error?: { message: string };
}

export interface EventMembersResponse {
  success: boolean;
  data?: EventMember[];
  total?: number;
  error?: { message: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Safely extracts a string from a value that may be a plain string,
 * a relation object {id, name, …}, null, or undefined.
 */
export function extractString(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val || null;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const name = obj.name ?? obj.label ?? obj.title ?? obj.display_name;
    if (typeof name === 'string' && name) return name;
  }
  return null;
}

/**
 * Safely extracts an array of strings from a field that may be
 * null, string[], or object[].
 */
function extractStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.reduce<string[]>((acc, item) => {
    const s = extractString(item) ?? (typeof item === 'string' ? item : null);
    if (s) acc.push(s);
    return acc;
  }, []);
}

/**
 * Derives a display company name from an email address domain as a last resort.
 * e.g. scott@nbc.com → NBC, john@globalfinance.com → Globalfinance
 */
function companyFromEmail(email: string): string {
  if (!email) return '';
  const domain = email.split('@')[1] ?? '';
  const parts = domain.split('.');
  const name = parts[0] ?? '';
  if (!name) return '';
  return name.length <= 4
    ? name.toUpperCase()
    : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function normalizeRole(role: string): string {
  const map: Record<string, string> = {
    attendee: 'Attendee', speaker: 'Speaker', sponsor: 'Sponsor',
    sponsor_rep: 'Sponsor', exhibitor: 'Sponsor',
    organizer: 'Organizer', vip: 'VIP', staff: 'Staff',
    moderator: 'Moderator',
  };
  return map[role?.toLowerCase()] ?? (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Attendee');
}

function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Active', confirmed: 'Confirmed', pending: 'Pending',
    cancelled: 'Cancelled', waitlisted: 'Waitlisted', registered: 'Registered',
  };
  return map[status?.toLowerCase()] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Active');
}

/** Picks the best display role from a roles array. Prefers non-Attendee roles. */
function pickRole(roles: string[]): string {
  if (!roles?.length) return 'Attendee';
  const normalized = roles.map(r => normalizeRole(r));
  return normalized.find(r => r !== 'Attendee') ?? 'Attendee';
}

/** Normalizes social_links which may be an empty array [] or a key→url object. */
function normalizeSocialLinks(raw: unknown): Record<string, string> {
  if (!raw || Array.isArray(raw)) return {};
  if (typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => [k, typeof v === 'string' ? v : (v != null ? String(v) : '')])
      .filter(([, v]) => v),
  ) as Record<string, string>;
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeFlatMember(raw: RawFlatMember, eventId: string | number): EventMember {
  const email = raw.email ?? '';
  // Company: flat company_name is cleanest; fall back to relation object, then email domain
  const company =
    raw.company_name ||
    (raw.company && typeof raw.company === 'object' ? (raw.company as { name: string }).name : null) ||
    companyFromEmail(email);
  // isCheckedIn: joined_at being set is the primary signal; ACTIVE status as backup
  const isCheckedIn = Boolean(raw.joined_at) || (raw.status ?? '').toUpperCase() === 'ACTIVE';
  // Avatar: prefer avatar_url, fall back to profile_image
  const avatar = raw.avatar_url || raw.profile_image || null;

  return {
    memberId: raw.membership_id,
    userId: raw.id,
    eventId: Number(eventId),
    name: raw.name ?? 'Unknown',
    email,
    phone: raw.phone ?? null,
    avatar,
    company,
    title: raw.title ?? null,
    bio: raw.bio ?? null,
    role: pickRole(raw.roles ?? []),
    status: normalizeStatus(raw.status),
    isCheckedIn,
    checkedInAt: raw.joined_at ?? null,
    joinedAt: raw.joined_at ?? null,
    badgeCode: raw.badge_code ?? null,
    networkingOptIn: false,
  };
}

function normalizeFlatMemberDetail(raw: RawFlatMember, eventId: string | number): MemberDetail {
  const base = normalizeFlatMember(raw, eventId);
  const fullName = raw.name ?? '';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = raw.first_name ?? nameParts[0] ?? null;
  const lastName = raw.last_name ?? (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null);

  return {
    ...base,
    firstName,
    lastName,
    industry: null,
    interestedTopics: extractStringArray((raw as unknown as Record<string, unknown>).interested_topics),
    socialLinks: normalizeSocialLinks(raw.social_links),
    linkedinUrl: raw.linkedin_url ?? null,
  };
}

// ─── Audience membership check ────────────────────────────────────────────────

export async function checkEmailInAudience(email: string): Promise<boolean> {
  const eventIds = [21, 20, 3];
  const normalizedEmail = email.trim().toLowerCase();
  for (const eventId of eventIds) {
    try {
      const res = await apiGet<unknown>(`/api/v1/events/${eventId}/members?per_page=200`, HEADERS);
      if (!res.success) continue;
      const body = res.data as Record<string, unknown>;
      const paginator = (body?.data ?? body) as Record<string, unknown>;
      const list: unknown[] = Array.isArray(paginator?.data)
        ? (paginator.data as unknown[])
        : Array.isArray(body?.data)
          ? (body.data as unknown[])
          : [];
      const found = list.some(
        m => ((m as RawFlatMember).email ?? '').toLowerCase() === normalizedEmail,
      );
      if (found) return true;
    } catch {
      // non-fatal
    }
  }
  return false;
}

/**
 * Looks up the current user's per-event role by scanning the event audience.
 * Iterates pages until the user is found or the audience is exhausted.
 *
 * Returns a discriminated result:
 *   { ok: true, found: true,  role }   — user is a member; role is normalized
 *   { ok: true, found: false }         — audience fully scanned, user absent
 *   { ok: false }                      — API error (caller should leave state alone)
 */
export type MyEventRoleResult =
  | { ok: true; found: true; role: string }
  | { ok: true; found: false }
  | { ok: false };

const ROLE_LOOKUP_PAGE_SIZE = 500;
const ROLE_LOOKUP_MAX_PAGES = 10; // hard ceiling: 5,000 members

export async function getMyEventRoleApi(
  eventId: string | number,
  email: string,
): Promise<MyEventRoleResult> {
  if (!email) return { ok: true, found: false };
  const target = email.trim().toLowerCase();

  for (let page = 1; page <= ROLE_LOOKUP_MAX_PAGES; page++) {
    let res;
    try {
      res = await apiGet<unknown>(
        `/api/v1/events/${eventId}/members?per_page=${ROLE_LOOKUP_PAGE_SIZE}&page=${page}&checked_in_only=false`,
        HEADERS,
      );
    } catch {
      return { ok: false };
    }
    if (!res.success) return { ok: false };

    const body = res.data as Record<string, unknown>;
    const paginator = (body?.data ?? body) as Record<string, unknown>;
    const list: unknown[] = Array.isArray(paginator?.data)
      ? (paginator.data as unknown[])
      : Array.isArray(body?.data)
        ? (body.data as unknown[])
        : [];

    const me = list.find(
      m => ((m as RawFlatMember).email ?? '').toLowerCase() === target,
    ) as RawFlatMember | undefined;

    if (me) {
      return { ok: true, found: true, role: pickRole(me.roles ?? []) };
    }

    // Stop when this page wasn't full — no more pages to fetch
    if (list.length < ROLE_LOOKUP_PAGE_SIZE) {
      return { ok: true, found: false };
    }
  }

  return { ok: true, found: false };
}

// ─── Shared pagination extractor ──────────────────────────────────────────────

function extractPage(
  res: { success: boolean; data?: unknown; error?: { message: string } },
  eventId: string | number,
): { data: EventMember[]; total: number } | null {
  if (!res.success) return null;
  const body = res.data as Record<string, unknown>;
  const paginator = (body?.data ?? body) as Record<string, unknown>;
  const list: unknown[] = Array.isArray(paginator?.data)
    ? (paginator.data as unknown[])
    : Array.isArray(body?.data)
      ? (body.data as unknown[])
      : Array.isArray(res.data)
        ? (res.data as unknown[])
        : [];
  const total = typeof paginator?.total === 'number' ? paginator.total : list.length;
  const data = list.map(m => normalizeFlatMember(m as RawFlatMember, eventId));
  return { data, total };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

export interface PagedMembersResult {
  data: EventMember[];
  total: number;
  hasMore: boolean;
}

/**
 * Session-scoped cache of the endpoint that returned data for each event.
 * Populated on the first successful page-1 fetch; subsequent pages skip the
 * sequential /attendees → /members fallback and go directly to the right route.
 */
const _endpointPref = new Map<string | number, 'attendees' | 'members'>();

/**
 * GET /api/v1/events/:id/attendees?per_page=<n>&page=<p>&checked_in_only=<bool>
 *
 * Paginated audience fetch. Returns one page of members plus metadata about
 * whether more pages exist. Use this for infinite-scroll UI.
 *
 * Page 1 with no cached preference: fires /attendees AND /members in parallel
 * and uses the first one that returns data, eliminating the sequential
 * /attendees → /members waterfall that added 2-4 s on every cold load.
 *
 * After page 1 the winning endpoint is cached in _endpointPref so all
 * subsequent pages go direct (no wasted parallel request).
 */
export async function getEventMembersPaginatedApi(
  eventId: string | number,
  checkedInOnly: boolean,
  page: number = 1,
  perPage: number = 25,
): Promise<{ success: true; result: PagedMembersResult } | { success: false; error: { message: string } }> {
  const qs = `per_page=${perPage}&page=${page}&checked_in_only=${checkedInOnly}`;

  // ── Pages 2+: go directly to the known-good endpoint ──────────────────────
  if (page > 1) {
    const ep = _endpointPref.get(eventId) ?? 'attendees';
    const res = await apiGet<unknown>(`/api/v1/events/${eventId}/${ep}?${qs}`, HEADERS);
    const parsed = extractPage(res, eventId);
    if (!parsed) {
      return { success: false, error: (res as { error?: { message: string } }).error ?? { message: 'Failed to fetch audience.' } };
    }
    return {
      success: true,
      result: { data: parsed.data, total: parsed.total, hasMore: page * perPage < parsed.total },
    };
  }

  // ── Page 1, known preference: go direct ───────────────────────────────────
  const knownEp = _endpointPref.get(eventId);
  if (knownEp) {
    const res = await apiGet<unknown>(`/api/v1/events/${eventId}/${knownEp}?${qs}`, HEADERS);
    const parsed = extractPage(res, eventId);
    if (parsed && parsed.data.length > 0) {
      return {
        success: true,
        result: { data: parsed.data, total: parsed.total, hasMore: perPage < parsed.total },
      };
    }
    // Preference stale (e.g. after an event switch) — drop it and re-probe
    _endpointPref.delete(eventId);
  }

  // ── Page 1, no preference: race both endpoints simultaneously ─────────────
  // Fires /attendees and /members in parallel so the first endpoint that
  // returns data wins, eliminating the 2-4 s sequential fallback penalty.
  const [attendeesRes, membersRes] = await Promise.all([
    apiGet<unknown>(`/api/v1/events/${eventId}/attendees?${qs}`, HEADERS),
    apiGet<unknown>(`/api/v1/events/${eventId}/members?${qs}`, HEADERS),
  ]);

  const parsedAttendees = extractPage(attendeesRes, eventId);
  const parsedMembers   = extractPage(membersRes,   eventId);

  if (parsedAttendees && parsedAttendees.data.length > 0) {
    _endpointPref.set(eventId, 'attendees');
    return {
      success: true,
      result: { data: parsedAttendees.data, total: parsedAttendees.total, hasMore: perPage < parsedAttendees.total },
    };
  }

  if (parsedMembers && parsedMembers.data.length > 0) {
    _endpointPref.set(eventId, 'members');
    return {
      success: true,
      result: { data: parsedMembers.data, total: parsedMembers.total, hasMore: perPage < parsedMembers.total },
    };
  }

  // Both returned empty or failed
  if (!parsedAttendees && !parsedMembers) {
    const err =
      (attendeesRes as { error?: { message: string } }).error ??
      (membersRes   as { error?: { message: string } }).error ??
      { message: 'Failed to fetch audience.' };
    return { success: false, error: err };
  }

  // Endpoints responded but returned empty data (no members yet)
  return { success: true, result: { data: [], total: 0, hasMore: false } };
}

/**
 * GET /api/v1/events/:id/attendees?per_page=100&checked_in_only=<bool>
 *
 * Legacy single-page fetch kept for badge scanner, role lookup, and other
 * callers that need the full list. New UI should use getEventMembersPaginatedApi.
 */
export async function getEventMembersApi(
  eventId: string | number,
  checkedInOnly: boolean = false,
): Promise<EventMembersResponse> {
  const qs = `per_page=100&checked_in_only=${checkedInOnly}`;

  const membersRes = await apiGet<unknown>(`/api/v1/events/${eventId}/attendees?${qs}`, HEADERS);
  const primary = extractPage(membersRes, eventId);
  if (primary && primary.data.length > 0) {
    return { success: true, data: primary.data, total: primary.total };
  }

  const fallbackRes = await apiGet<unknown>(`/api/v1/events/${eventId}/members?${qs}`, HEADERS);
  const fb = extractPage(fallbackRes, eventId);
  if (!fb) {
    return { success: false, error: (fallbackRes as { error?: { message: string } }).error ?? { message: 'Failed to fetch audience.' } };
  }
  return { success: true, data: fb.data, total: fb.total };
}

/**
 * GET /api/v1/events/:id/attendees?per_page=…  (paginated)
 * Returns just the members whose role is "Speaker". Useful for the
 * Speaker Spotlight on the home screen.
 * Speakers are included in the server-side role filter on /attendees.
 */
export async function getEventSpeakersApi(
  eventId: string | number,
  limit: number = 20,
): Promise<EventMembersResponse> {
  const all: EventMember[] = [];
  const PAGE_SIZE = 200;
  const MAX_PAGES = 5; // up to 1,000 members scanned

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await apiGet<unknown>(
      `/api/v1/events/${eventId}/attendees?per_page=${PAGE_SIZE}&page=${page}`,
      HEADERS,
    );
    if (!res.success) {
      return { success: false, error: res.error ?? { message: 'Failed to fetch speakers.' } };
    }

    const body = res.data as Record<string, unknown>;
    const paginator = (body?.data ?? body) as Record<string, unknown>;
    const list: unknown[] = Array.isArray(paginator?.data)
      ? (paginator.data as unknown[])
      : Array.isArray(body?.data)
        ? (body.data as unknown[])
        : [];

    for (const raw of list) {
      const m = raw as RawFlatMember;
      if ((m.roles ?? []).some(r => String(r).toLowerCase() === 'speaker')) {
        all.push(normalizeFlatMember(m, eventId));
        if (all.length >= limit) break;
      }
    }

    if (all.length >= limit || list.length < PAGE_SIZE) break;
  }

  return { success: true, data: all, total: all.length };
}

/**
 * GET /api/v1/events/:eventId/attendees/:userId
 * Returns a single attendee's full profile (same flat v2 shape).
 * Pass the user's userId (raw.id), not membership_id.
 */
export async function getMemberDetailApi(
  eventId: string | number,
  userId: number,
): Promise<MemberDetailResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/attendees/${userId}`, HEADERS);

  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch member profile.' } };
  }

  const raw = (res.data ?? {}) as RawFlatMember;
  const detail = normalizeFlatMemberDetail(raw, eventId);

  return { success: true, data: detail };
}

// ─── Badge code lookup + check-in ─────────────────────────────────────────────

/**
 * GET /api/v1/events/:eventId/attendees?per_page=…  (paginated)
 *
 * Convenience client-side fallback: scans the audience pages and returns the
 * first member whose `badgeCode` matches. Used when the scan endpoint cannot
 * resolve a code so the lead form can still pre-fill the attendee profile.
 */
export async function findMemberByBadgeCodeApi(
  eventId: string | number,
  badgeCode: string,
): Promise<EventMember | null> {
  const target = badgeCode.trim().toLowerCase();
  if (!target) return null;
  const PAGE_SIZE = 200;
  const MAX_PAGES = 10;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await apiGet<unknown>(
      `/api/v1/events/${eventId}/attendees?per_page=${PAGE_SIZE}&page=${page}`,
      HEADERS,
    );
    if (!res.success) return null;

    const body = res.data as Record<string, unknown>;
    const paginator = (body?.data ?? body) as Record<string, unknown>;
    const list: unknown[] = Array.isArray(paginator?.data)
      ? (paginator.data as unknown[])
      : Array.isArray(body?.data)
        ? (body.data as unknown[])
        : [];

    const hit = list.find(
      m => ((m as RawFlatMember).badge_code ?? '').toLowerCase() === target,
    ) as RawFlatMember | undefined;

    if (hit) return normalizeFlatMember(hit, eventId);
    if (list.length < PAGE_SIZE) return null;
  }
  return null;
}

/**
 * POST /api/v1/events/:eventId/members/:memberId/check-in
 *
 * Marks an attendee as checked-in to an event. Used by the badge scanner to
 * auto check-in attendees when they're scanned but haven't joined yet.
 *
 * Backend contract (to implement if not present):
 *   Request:  empty body
 *   Response: { success: true, data: { membership_id, status: 'ACTIVE', joined_at } }
 *
 * Returns true on success, false on any error (caller treats failure as a no-op
 * so the lead save still proceeds).
 */
export async function checkInMemberApi(
  eventId: string | number,
  memberId: number,
): Promise<boolean> {
  try {
    const res = await apiPost<unknown>(
      `/api/v1/events/${eventId}/members/${memberId}/check-in`,
      {},
      HEADERS,
    );
    return !!res.success;
  } catch {
    return false;
  }
}

/**
 * POST /api/v1/events/{eventId}/self-check-in
 * Marks the current user as physically checked in for an event.
 * Idempotent — safe to call even if already checked in.
 * No membership ID required; the backend resolves it from the bearer token.
 */
export async function selfCheckInApi(
  eventId: string | number,
): Promise<boolean> {
  try {
    const res = await apiPost<unknown>(
      `/api/v1/events/${eventId}/self-check-in`,
      {},
      HEADERS,
    );
    return !!res.success;
  } catch {
    return false;
  }
}

/**
 * Looks up the current user's membership_id for a given event.
 * Tries badge_code first (fast, single-record), then falls back to user_id
 * if badge_code is unavailable. Mirrors the mobile `getMyMembershipId` helper.
 * Returns null on any failure — callers must handle this gracefully.
 */
export async function getMyMembershipIdApi(
  eventId: string | number,
  badgeCode?: string | null,
  userId?: string | number | null,
): Promise<number | null> {
  const tryUrl = async (url: string): Promise<number | null> => {
    const res = await apiGet<unknown>(url, HEADERS);
    if (!res.success) return null;
    const body = res.data as Record<string, unknown>;
    const items: unknown[] = Array.isArray((body?.data as Record<string, unknown>)?.data)
      ? ((body?.data as Record<string, unknown>).data as unknown[])
      : Array.isArray(body?.data)
        ? (body.data as unknown[])
        : Array.isArray(body)
          ? (body as unknown[])
          : [];
    if (items.length === 0) return null;
    const first = items[0] as RawFlatMember;
    const raw = first.membership_id;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string' && raw) return Number(raw) || null;
    return null;
  };

  if (badgeCode?.trim()) {
    const id = await tryUrl(
      `/api/v1/events/${eventId}/members?badge_code=${encodeURIComponent(badgeCode.trim())}`,
    ).catch(() => null);
    if (id !== null) return id;
  }

  if (userId) {
    const id = await tryUrl(
      `/api/v1/events/${eventId}/members?user_id=${encodeURIComponent(String(userId))}`,
    ).catch(() => null);
    if (id !== null) return id;
  }

  return null;
}

// ─── Me Profile (rich self-profile) ───────────────────────────────────────────

export interface MeProfile {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  title: string | null;
  bio: string | null;
  linkedin_url: string | null;
  social_links: Record<string, unknown> | null;
  avatar_url: string | null;
  profile_image: string | null;
  company: unknown;
  industry: unknown;
  interested_topics: unknown[] | null;
}

export interface MeProfileNormalized {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  title: string | null;
  bio: string | null;
  linkedin_url: string | null;
  social_links: Record<string, unknown> | null;
  avatar_url: string | null;
  profile_image: string | null;
  company: string | null;
  industry: string | null;
  interested_topics: string[];
}

export async function getMeProfileApi(): Promise<{ success: boolean; data?: MeProfileNormalized }> {
  const res = await apiGet<unknown>('/api/v1/me/profile', HEADERS);
  if (!res.success || !res.data) return { success: false };
  const raw = res.data as Record<string, unknown>;
  const normalized: MeProfileNormalized = {
    id: typeof raw.id === 'number' ? raw.id : 0,
    name: typeof raw.name === 'string' ? raw.name : '',
    first_name: extractString(raw.first_name),
    last_name: extractString(raw.last_name),
    email: typeof raw.email === 'string' ? raw.email : '',
    phone: extractString(raw.phone),
    title: extractString(raw.title),
    bio: extractString(raw.bio),
    linkedin_url: extractString(raw.linkedin_url),
    social_links: (raw.social_links && typeof raw.social_links === 'object') ? (raw.social_links as Record<string, unknown>) : null,
    avatar_url: extractString(raw.avatar_url),
    profile_image: extractString(raw.profile_image),
    company: extractString(raw.company),
    industry: extractString(raw.industry),
    interested_topics: extractStringArray(raw.interested_topics),
  };
  return { success: true, data: normalized };
}
