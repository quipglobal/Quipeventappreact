/**
 * Audience helper for mobile — currently used as a client-side fallback for
 * the badge scanner. Mirrors the web's `findMemberByBadgeCodeApi` so a
 * sponsor can still capture a lead even when the backend's
 * /events/:id/leads/scan endpoint reports "No attendee found for this
 * badge code" (most often because of case-sensitivity, leading/trailing
 * whitespace, or a badge_code lookup quirk).
 */

import { request } from '@/lib/apiClient';

export interface AudienceMember {
  memberId: number | null;
  userId: number | null;
  name: string;
  email: string;
  company: string;
  title: string;
  avatar: string;
  badgeCode: string | null;
  isCheckedIn: boolean;
}

function normalize(raw: any): AudienceMember {
  const company =
    raw.company_name ||
    (raw.company && typeof raw.company === 'object' ? raw.company.name : raw.company) ||
    '';
  const isCheckedIn =
    Boolean(raw.joined_at) || String(raw.status ?? '').toUpperCase() === 'ACTIVE';
  return {
    memberId:
      typeof raw.membership_id === 'number'
        ? raw.membership_id
        : typeof raw.member_id === 'number'
          ? raw.member_id
          : null,
    userId: typeof raw.id === 'number' ? raw.id : (raw.user_id ?? null),
    name: raw.name ?? raw.full_name ?? '',
    email: raw.email ?? '',
    company: typeof company === 'string' ? company : '',
    title: raw.title ?? raw.job_title ?? '',
    avatar: raw.avatar_url ?? raw.profile_image ?? raw.avatar ?? '',
    badgeCode: raw.badge_code ?? raw.badgeCode ?? null,
    isCheckedIn,
  };
}

/**
 * Paginated, case-insensitive scan of the event audience for a member whose
 * badge_code matches `badgeCode`. Returns null if not found or on any API
 * failure (caller treats failure as "not in audience").
 */
export async function findMemberByBadgeCode(
  eventId: string | number,
  badgeCode: string,
): Promise<AudienceMember | null> {
  const target = badgeCode.trim().toLowerCase();
  if (!target) return null;
  const PAGE_SIZE = 200;
  const MAX_PAGES = 10; // up to 2,000 attendees scanned

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await request<any>(
      `/api/v1/events/${eventId}/members?per_page=${PAGE_SIZE}&page=${page}&checked_in_only=false`,
    );
    if (!res.success) return null;

    const body = res.data as Record<string, unknown>;
    const paginator = (body?.data ?? body) as Record<string, unknown>;
    const list: any[] = Array.isArray(paginator?.data)
      ? (paginator.data as any[])
      : Array.isArray(body?.data)
        ? (body.data as any[])
        : [];

    const hit = list.find(
      (m) => String((m as any).badge_code ?? '').trim().toLowerCase() === target,
    );
    if (hit) return normalize(hit);
    if (list.length < PAGE_SIZE) return null;
  }
  return null;
}

/**
 * Attempts to mark a member as checked-in for an event. Best-effort: returns
 * false on any failure (caller proceeds without check-in).
 */
export async function checkInMember(
  eventId: string | number,
  memberId: number,
): Promise<boolean> {
  const res = await request<any>(
    `/api/v1/events/${eventId}/members/${memberId}/check-in`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return !!res.success;
}
