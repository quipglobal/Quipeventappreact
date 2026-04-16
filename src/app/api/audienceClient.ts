/**
 * Audience / Event Members API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/v1/events/:id/members?per_page=100  → paginated member list
 * GET /api/v1/events/:id/companies              → event companies (for title lookup)
 * GET /api/v1/companies/:id                     → company detail with sponsorReps & titles
 *
 * Member user object: { id, name, email, profile_image, phone? }
 * Title is cross-referenced from the companies API sponsorReps by user_id.
 * Bio is returned directly if the API provides it; falls back to null.
 */

import { apiGet } from './client';

const HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawMemberUser {
  id: number;
  name: string;
  email: string;
  profile_image: string | null;
  phone?: string | null;
  title?: string | null;
  bio?: string | null;
}

export interface RawEventMember {
  id: number;
  event_id: number;
  user_id: number;
  role: string;
  status: string;
  checked_in: boolean;
  checked_in_at: string | null;
  joined_at: string | null;
  badge_code: string | null;
  networking_opt_in: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user: RawMemberUser;
}

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

/** Rich profile returned by GET /api/v1/events/:id/members/:memberId */
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
 * Derives a display company name from an email address domain.
 * e.g. scott@nbc.com → NBC, john@globalfinance.example.com → Globalfinance
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
    organizer: 'Organizer', vip: 'VIP', staff: 'Staff',
    moderator: 'Moderator', exhibitor: 'Exhibitor',
  };
  return map[role?.toLowerCase()] ?? (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Attendee');
}

function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Active', confirmed: 'Confirmed', pending: 'Pending',
    cancelled: 'Cancelled', waitlisted: 'Waitlisted',
  };
  return map[status?.toLowerCase()] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Active');
}

function normalizeMember(
  raw: RawEventMember,
  titleLookup: Map<number, string>,
): EventMember {
  const email = raw.user?.email ?? '';
  // Title: prefer direct API field, then cross-referenced companies data
  const title =
    raw.user?.title ??
    titleLookup.get(raw.user_id) ??
    null;

  return {
    memberId: raw.id,
    userId: raw.user_id,
    eventId: raw.event_id,
    name: raw.user?.name ?? 'Unknown',
    email,
    phone: raw.user?.phone ?? null,
    avatar: raw.user?.profile_image ?? null,
    company: companyFromEmail(email),
    title,
    bio: raw.user?.bio ?? null,
    role: normalizeRole(raw.role),
    status: normalizeStatus(raw.status),
    isCheckedIn: Boolean(raw.checked_in),
    checkedInAt: raw.checked_in_at ?? null,
    joinedAt: raw.joined_at ?? raw.created_at ?? null,
    badgeCode: raw.badge_code ?? null,
    networkingOptIn: Boolean(raw.networking_opt_in),
  };
}

// ─── Title lookup via companies API ──────────────────────────────────────────

/**
 * Builds a map of userId → jobTitle by fetching event companies and their reps.
 * The companies API (GET /api/v1/companies/:id) includes sponsorReps[].title.
 */
async function buildTitleLookup(eventId: string | number): Promise<Map<number, string>> {
  const lookup = new Map<number, string>();
  try {
    const listRes = await apiGet<unknown>(`/api/v1/events/${eventId}/companies?per_page=100`, HEADERS);
    const envelope = (listRes.data as Record<string, unknown>)?.data ?? listRes.data;
    const companies: unknown[] = Array.isArray(envelope)
      ? envelope
      : Array.isArray((envelope as Record<string, unknown>)?.data)
        ? ((envelope as Record<string, unknown>).data as unknown[])
        : [];

    await Promise.all(
      companies.map(async (c: unknown) => {
        const companyId = (c as Record<string, unknown>).company_id as number;
        if (!companyId) return;
        const detailRes = await apiGet<unknown>(`/api/v1/companies/${companyId}`, HEADERS);
        const detail = ((detailRes.data as Record<string, unknown>)?.data ?? detailRes.data) as Record<string, unknown>;
        const reps = Array.isArray(detail?.sponsorReps) ? detail.sponsorReps as Record<string, unknown>[] : [];
        for (const rep of reps) {
          const userId = rep.id as number;
          const title = rep.title as string | undefined;
          if (userId && title) lookup.set(userId, title);
        }
      }),
    );
  } catch {
    // Non-fatal: title cross-reference is best-effort
  }
  return lookup;
}

// ─── Audience membership check ────────────────────────────────────────────────

/**
 * Checks whether an email address is already registered as a member of ANY
 * active event in the Globex tenant. Used during signup to prevent duplicates.
 * Returns true if the email is already in the audience.
 */
export async function checkEmailInAudience(email: string): Promise<boolean> {
  const eventIds = [21, 20, 3];
  const normalizedEmail = email.trim().toLowerCase();
  for (const eventId of eventIds) {
    try {
      const res = await apiGet<unknown>(`/api/v1/events/${eventId}/members?per_page=200`, HEADERS);
      if (!res.success) continue;
      const body = res.data as Record<string, unknown>;
      const list: unknown[] = Array.isArray(body?.data) ? (body.data as unknown[]) : [];
      const found = list.some(
        m => ((m as RawEventMember).user?.email ?? '').toLowerCase() === normalizedEmail,
      );
      if (found) return true;
    } catch {
      // non-fatal
    }
  }
  return false;
}

// ─── API Method ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:id/members?per_page=100&checked_in_only=<bool>
 * Returns event members enriched with titles from the companies API.
 *
 * IMPORTANT: The API defaults to checked-in members only when the param is
 * omitted. We always send it explicitly so the caller's intent always wins:
 *   checkedInOnly=false → checked_in_only=false → all registrations
 *   checkedInOnly=true  → checked_in_only=true  → checked-in only
 */
export async function getEventMembersApi(
  eventId: string | number,
  checkedInOnly: boolean = false,
): Promise<EventMembersResponse> {
  const qs = `per_page=100&checked_in_only=${checkedInOnly}`;
  const [membersRes, titleLookup] = await Promise.all([
    apiGet<unknown>(`/api/v1/events/${eventId}/members?${qs}`, HEADERS),
    buildTitleLookup(eventId),
  ]);

  if (!membersRes.success) {
    return { success: false, error: membersRes.error ?? { message: 'Failed to fetch audience.' } };
  }

  // Response shape: { data: { data: [...members], total, current_page, … }, checked_in_only }
  // The outer `data` key is a Laravel paginator object, the actual array is one level deeper.
  const body = membersRes.data as Record<string, unknown>;
  const paginator = (body?.data ?? body) as Record<string, unknown>;

  const rawList: unknown[] = Array.isArray(paginator?.data)
    ? (paginator.data as unknown[])          // nested paginator: body.data.data
    : Array.isArray(body?.data)
      ? (body.data as unknown[])             // flat array at body.data
      : Array.isArray(membersRes.data)
        ? (membersRes.data as unknown[])     // flat array as the whole response
        : [];

  const total = typeof paginator?.total === 'number'
    ? paginator.total
    : rawList.length;
  const members = rawList.map(m => normalizeMember(m as RawEventMember, titleLookup));

  return { success: true, data: members, total };
}

// ─── Me Profile (rich self-profile) ───────────────────────────────────────────

/**
 * Safely extracts a string from a field that the backend may return as either
 * a plain string OR a relation object like { id, name, logo, website }.
 * Returns null for null / undefined / empty.
 */
export function extractString(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val || null;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // Try common name-bearing keys
    const name = obj.name ?? obj.label ?? obj.title ?? obj.display_name;
    if (typeof name === 'string' && name) return name;
    // Last resort: stringify if it's a primitive-like value
    return null;
  }
  return String(val) || null;
}

/**
 * Safely extracts an array of strings from a field that may be:
 * - null / undefined → []
 * - string[] → as-is
 * - object[] → each item's .name/.label extracted
 */
function extractStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.reduce<string[]>((acc, item) => {
    const s = extractString(item);
    if (s) acc.push(s);
    return acc;
  }, []);
}

/** Shape returned by GET /api/v1/me/profile */
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
  /** May be a string OR a relation object { id, name, logo, website } */
  company: unknown;
  /** May be a string OR a relation object { id, name } */
  industry: unknown;
  interested_topics: unknown[] | null;
}

/**
 * GET /api/v1/me/profile
 * Returns the rich profile of the currently authenticated user.
 * Backend response: { success: true, data: MeProfile }
 * apiGet's parseResponse returns the full body as ApiEnvelope<MeProfile>,
 * so res.data IS the MeProfile object.
 */
/** Normalized safe version of MeProfile with all fields guaranteed to be primitives */
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
  // Normalize: extract safe strings from any field that may be an object relation
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
    // company and industry may be relation objects { id, name, logo, website }
    company: extractString(raw.company),
    industry: extractString(raw.industry),
    interested_topics: extractStringArray(raw.interested_topics),
  };
  return { success: true, data: normalized };
}

// ─── Member Detail ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:eventId/members/:memberId
 * Fetches a single member's full profile. Fields like industry, bio,
 * interestedTopics, and socialLinks are returned when the backend provides them;
 * otherwise they fall back to null / empty.
 */
export async function getMemberDetailApi(
  eventId: string | number,
  memberId: number,
): Promise<MemberDetailResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/members/${memberId}`, HEADERS);

  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch member profile.' } };
  }

  // Use unknown for fields that may be relation objects, not just scalars
  const raw = (res.data ?? {}) as RawEventMember & {
    user?: RawMemberUser & {
      first_name?: unknown;
      last_name?: unknown;
      title?: unknown;
      bio?: unknown;
      company?: unknown;
      industry?: unknown;
      interested_topics?: unknown;
      social_links?: Record<string, unknown> | null;
      linkedin_url?: unknown;
    };
  };

  const u = raw.user ?? ({} as NonNullable<typeof raw.user>);
  const email = u.email ?? '';

  // Derive first/last name: use dedicated fields if available, else split full name
  const fullName = u.name ?? '';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = extractString(u.first_name) ?? nameParts[0] ?? null;
  const lastName = extractString(u.last_name) ?? (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null);

  const detail: MemberDetail = {
    memberId: raw.id,
    userId: raw.user_id,
    eventId: typeof raw.event_id === 'number' ? raw.event_id : Number(eventId),
    name: fullName,
    email,
    phone: u.phone ?? null,
    avatar: u.profile_image ?? null,
    // company may be a relation object { id, name, logo, website }
    company: extractString(u.company) ?? companyFromEmail(email),
    title: extractString(u.title),
    bio: extractString(u.bio),
    role: normalizeRole(raw.role),
    status: normalizeStatus(raw.status),
    isCheckedIn: Boolean(raw.checked_in),
    checkedInAt: raw.checked_in_at ?? null,
    joinedAt: raw.joined_at ?? raw.created_at ?? null,
    badgeCode: raw.badge_code ?? null,
    networkingOptIn: Boolean(raw.networking_opt_in),
    // Rich profile fields — all normalized to safe scalar types
    firstName,
    lastName,
    industry: extractString(u.industry),
    interestedTopics: extractStringArray(u.interested_topics),
    socialLinks: Object.fromEntries(
      Object.entries(u.social_links ?? {})
        .map(([k, v]) => [k, typeof v === 'string' ? v : (v != null ? String(v) : '')])
        .filter(([, v]) => v),
    ) as Record<string, string>,
    linkedinUrl: extractString(u.linkedin_url),
  };

  return { success: true, data: detail };
}
