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
 *   GET /api/v1/events/:id/members                → fallback if /attendees fails
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
  const company =
    raw.company_name ||
    (raw.company && typeof raw.company === 'object' ? (raw.company as { name: string }).name : null) ||
    companyFromEmail(email);
  // Prefer explicit isCheckedIn flag from backend (present on scan / check-in
  // responses). Fall back to deriving from joined_at / status for backends
  // that include those fields on the listing endpoint.
  const isCheckedIn =
    typeof raw.isCheckedIn === 'boolean' ? raw.isCheckedIn :
    typeof (raw as any).is_checked_in === 'boolean' ? (raw as any).is_checked_in :
    Boolean(raw.joined_at) || (raw.status ?? '').toUpperCase() === 'ACTIVE';
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
 */
export type MyEventRoleResult =
  | { ok: true; found: true; role: string }
  | { ok: true; found: false }
  | { ok: false };

const ROLE_LOOKUP_PAGE_SIZE = 500;
const ROLE_LOOKUP_MAX_PAGES = 10;

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

    if (list.length < ROLE_LOOKUP_PAGE_SIZE) {
      return { ok: true, found: false };
    }
  }

  return { ok: true, found: false };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/** Extracts the flat member array from any Laravel paginator envelope shape. */
function extractRawList(res: { success: boolean; data?: unknown }): unknown[] {
  if (!res.success) return [];
  const body = res.data as Record<string, unknown>;
  const paginator = (body?.data ?? body) as Record<string, unknown>;
  if (Array.isArray(paginator?.data)) return paginator.data as unknown[];
  if (Array.isArray(body?.data))      return body.data as unknown[];
  if (Array.isArray(res.data))        return res.data as unknown[];
  return [];
}

/**
 * GET /api/v1/events/:id/members?per_page=15&page=N[&checked_in_only=true]
 *
 * Uses /members (backed by the event_members table) rather than /attendees.
 * Only /members returns `status` and `joined_at` — the fields that record
 * true check-in status. /attendees omits them, making client-side isCheckedIn
 * always false and forcing blind trust in the server filter.
 *
 * Defense-in-depth when checkedInOnly=true:
 *   1. Server-side: checked_in_only=true query param
 *   2. Client-side: filter by isCheckedIn (status=ACTIVE or joined_at≠null)
 *      — guards against backends that haven't implemented the param yet.
 */
const AUDIENCE_PAGE_SIZE = 15;

export async function getEventMembersApi(
  eventId: string | number,
  checkedInOnly: boolean = false,
  page: number = 1,
): Promise<EventMembersResponse> {
  const base = `per_page=${AUDIENCE_PAGE_SIZE}&page=${page}`;
  const qs = checkedInOnly ? `${base}&checked_in_only=true` : base;

  // /members is backed by event_members — the only table that stores check-in
  // status (status=ACTIVE, joined_at). /attendees does not expose these fields.
  const membersRes = await apiGet<unknown>(`/api/v1/events/${eventId}/members?${qs}`, HEADERS);
  if (!membersRes.success) {
    return { success: false, error: { message: 'Failed to fetch audience.' } };
  }
  const rawList = extractRawList(membersRes);
  const body = membersRes.data as Record<string, unknown>;
  const paginator = (body?.data ?? body) as Record<string, unknown>;
  const total = typeof paginator?.total === 'number' ? paginator.total : rawList.length;

  let data = rawList.map(m => normalizeFlatMember(m as RawFlatMember, eventId));
  if (checkedInOnly) {
    // Defense-in-depth: /members returns status + joined_at, so isCheckedIn
    // is reliably set. Filter out anyone the server missed.
    data = data.filter(m => m.isCheckedIn);
  }

  return { success: true, data, total };
}

/**
 * GET /api/v1/events/:id/attendees?per_page=…  (paginated)
 * Returns just the members whose role is "Speaker".
 */
export async function getEventSpeakersApi(
  eventId: string | number,
  limit: number = 20,
): Promise<EventMembersResponse> {
  const all: EventMember[] = [];
  const PAGE_SIZE = 200;
  const MAX_PAGES = 5;

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
 * Scans audience pages and returns the first member whose badge_code matches.
 * Used as a fallback when the scan endpoint cannot resolve a code.
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
 * Marks an attendee as checked-in. Returns true on success, false on error.
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
 * Marks the current user as physically checked in. Idempotent.
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
 * Tries badge_code first, then falls back to user_id.
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
    first_name: typeof raw.first_name === 'string' ? raw.first_name : null,
    last_name: typeof raw.last_name === 'string' ? raw.last_name : null,
    email: typeof raw.email === 'string' ? raw.email : '',
    phone: typeof raw.phone === 'string' ? raw.phone : null,
    title: typeof raw.title === 'string' ? raw.title : null,
    bio: typeof raw.bio === 'string' ? raw.bio : null,
    linkedin_url: typeof raw.linkedin_url === 'string' ? raw.linkedin_url : null,
    social_links: raw.social_links != null && typeof raw.social_links === 'object' && !Array.isArray(raw.social_links)
      ? raw.social_links as Record<string, unknown>
      : null,
    avatar_url: typeof raw.avatar_url === 'string' ? raw.avatar_url : null,
    profile_image: typeof raw.profile_image === 'string' ? raw.profile_image : null,
    company: extractString(raw.company),
    industry: extractString(raw.industry),
    interested_topics: extractStringArray(raw.interested_topics),
  };
  return { success: true, data: normalized };
}
