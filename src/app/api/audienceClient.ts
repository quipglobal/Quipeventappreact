/**
 * Audience / Event Members API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend v2 API — flat member+user shape (no nested `user` object):
 *
 * GET /api/v1/events/:id/members → paginated list, full profile data included
 * GET /api/v1/events/:id/members/:memberId → single member full profile
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
 */

import { apiGet } from './client';

const HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

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

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:id/members?per_page=100&checked_in_only=<bool>
 *
 * Returns all event members with full profile data (v2 API).
 * checkedInOnly=false → all registrations
 * checkedInOnly=true  → checked-in members only
 */
export async function getEventMembersApi(
  eventId: string | number,
  checkedInOnly: boolean = false,
): Promise<EventMembersResponse> {
  const qs = `per_page=100&checked_in_only=${checkedInOnly}`;
  const membersRes = await apiGet<unknown>(`/api/v1/events/${eventId}/members?${qs}`, HEADERS);

  if (!membersRes.success) {
    return { success: false, error: membersRes.error ?? { message: 'Failed to fetch audience.' } };
  }

  const body = membersRes.data as Record<string, unknown>;
  const paginator = (body?.data ?? body) as Record<string, unknown>;

  const rawList: unknown[] = Array.isArray(paginator?.data)
    ? (paginator.data as unknown[])
    : Array.isArray(body?.data)
      ? (body.data as unknown[])
      : Array.isArray(membersRes.data)
        ? (membersRes.data as unknown[])
        : [];

  const total = typeof paginator?.total === 'number' ? paginator.total : rawList.length;
  const members = rawList.map(m => normalizeFlatMember(m as RawFlatMember, eventId));

  return { success: true, data: members, total };
}

/**
 * GET /api/v1/events/:eventId/members/:memberId
 * Returns a single member's full profile (same flat v2 shape).
 */
export async function getMemberDetailApi(
  eventId: string | number,
  memberId: number,
): Promise<MemberDetailResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/members/${memberId}`, HEADERS);

  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch member profile.' } };
  }

  const raw = (res.data ?? {}) as RawFlatMember;
  const detail = normalizeFlatMemberDetail(raw, eventId);

  return { success: true, data: detail };
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
