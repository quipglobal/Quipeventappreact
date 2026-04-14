/**
 * Audience / Event Members API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/v1/events/:id/members   → paginated list of event members
 *
 * API response per member:
 * {
 *   id, event_id, user_id, role, status, checked_in, checked_in_at,
 *   joined_at, badge_code, networking_opt_in, metadata,
 *   user: { id, name, email, profile_image, phone }
 * }
 */

import { apiGet } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawMemberUser {
  id: number;
  name: string;
  email: string;
  profile_image: string | null;
  phone?: string | null;
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
  role: string;
  status: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  joinedAt: string | null;
  badgeCode: string | null;
  networkingOptIn: boolean;
}

export interface EventMembersResponse {
  success: boolean;
  data?: EventMember[];
  total?: number;
  error?: { message: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derives a company name from an email address domain.
 * e.g. scott@nbc.com → NBC, john@globalfinance.example.com → GlobalFinance
 */
function companyFromEmail(email: string): string {
  if (!email) return '';
  const domain = email.split('@')[1] ?? '';
  const parts = domain.split('.');
  // Remove the TLD (last segment, e.g. "com", "net")
  const meaningful = parts.slice(0, -1);
  const name = meaningful[0] ?? '';
  if (!name) return '';
  // Short names (≤ 4 chars) → uppercase (NBC, IBM), longer → Title case
  return name.length <= 4
    ? name.toUpperCase()
    : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function normalizeRole(role: string): string {
  const map: Record<string, string> = {
    attendee: 'Attendee',
    speaker: 'Speaker',
    sponsor: 'Sponsor',
    organizer: 'Organizer',
    vip: 'VIP',
    staff: 'Staff',
    moderator: 'Moderator',
    exhibitor: 'Exhibitor',
  };
  return map[role?.toLowerCase()] ?? (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Attendee');
}

function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Active',
    confirmed: 'Confirmed',
    pending: 'Pending',
    cancelled: 'Cancelled',
    waitlisted: 'Waitlisted',
  };
  return map[status?.toLowerCase()] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Active');
}

function normalizeMember(raw: RawEventMember): EventMember {
  const email = raw.user?.email ?? '';
  return {
    memberId: raw.id,
    userId: raw.user_id,
    eventId: raw.event_id,
    name: raw.user?.name ?? 'Unknown',
    email,
    phone: raw.user?.phone ?? null,
    avatar: raw.user?.profile_image ?? null,
    company: companyFromEmail(email),
    role: normalizeRole(raw.role),
    status: normalizeStatus(raw.status),
    isCheckedIn: Boolean(raw.checked_in),
    checkedInAt: raw.checked_in_at ?? null,
    joinedAt: raw.joined_at ?? raw.created_at ?? null,
    badgeCode: raw.badge_code ?? null,
    networkingOptIn: Boolean(raw.networking_opt_in),
  };
}

// ─── API Headers ──────────────────────────────────────────────────────────────

const AUDIENCE_HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:id/members?per_page=100
 * Returns members registered to a specific event (up to 100 per call).
 */
export async function getEventMembersApi(eventId: string | number): Promise<EventMembersResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/members?per_page=100`, AUDIENCE_HEADERS);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch audience.' } };
  }

  const body = res.data as Record<string, unknown>;
  const rawList: unknown[] = Array.isArray(body?.data)
    ? (body.data as unknown[])
    : Array.isArray(res.data)
      ? (res.data as unknown[])
      : [];

  const total = typeof body?.total === 'number' ? body.total : rawList.length;
  const members = rawList.map(m => normalizeMember(m as RawEventMember));

  return { success: true, data: members, total };
}
