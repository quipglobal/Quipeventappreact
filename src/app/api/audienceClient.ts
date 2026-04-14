/**
 * Audience / Event Members API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/v1/events/:id/members   → paginated list of event members
 *
 * Response shape:
 * {
 *   data: [{
 *     id, event_id, user_id, role, status, checked_in, checked_in_at,
 *     joined_at, badge_code, networking_opt_in,
 *     user: { id, name, email, profile_image }
 *   }],
 *   total, current_page, last_page
 * }
 */

import { apiGet } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawMemberUser {
  id: number;
  name: string;
  email: string;
  profile_image: string | null;
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
  avatar: string | null;
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

// ─── Normalizer ───────────────────────────────────────────────────────────────

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
  return map[status?.toLowerCase()] ?? status ?? 'Active';
}

function normalizeMember(raw: RawEventMember): EventMember {
  return {
    memberId: raw.id,
    userId: raw.user_id,
    eventId: raw.event_id,
    name: raw.user?.name ?? 'Unknown',
    email: raw.user?.email ?? '',
    avatar: raw.user?.profile_image ?? null,
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
 * GET /api/v1/events/:id/members
 * Returns all members registered to a specific event.
 */
export async function getEventMembersApi(eventId: string | number): Promise<EventMembersResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/members`, AUDIENCE_HEADERS);
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
