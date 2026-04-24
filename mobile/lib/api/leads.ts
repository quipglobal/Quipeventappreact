import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import { findMemberByBadgeCode, checkInMember } from '@/lib/api/audience';
import type { ApiResponse, Lead } from '@/lib/api/types';

const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

// Session-scoped flag mirroring the web `scanEndpointMissing` pattern.
// If the backend hasn't shipped the GET /events/:id/leads route yet, we set
// this on the first 404 and stop pestering the server. We also throw from
// listLeads() so React Query preserves whatever's already in cache (e.g. a
// lead the user just scanned and we optimistically inserted) instead of
// overwriting it with a `{success:false}` response.
let leadsListEndpointMissing = false;
let warnedListMissing = false;

function normalizeLead(raw: any, index = 0): Lead {
  return {
    id: String(raw.id ?? raw.lead_id ?? raw.code ?? Date.now()),
    name: raw.name ?? raw.full_name ?? '',
    title: raw.title ?? raw.job_title ?? raw.position ?? '',
    company: raw.company ?? raw.organization ?? '',
    email: raw.email ?? '',
    scannedAt: raw.scanned_at ?? raw.created_at ?? raw.timestamp
      ? new Date(raw.scanned_at ?? raw.created_at ?? raw.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    color: raw.color ?? ACCENT_COLORS[index % ACCENT_COLORS.length],
    status: raw.status ?? raw.priority ?? 'warm',
  };
}

/**
 * Extra fields we surface from the scan response so the caller can:
 *  - award the actual server-side points (`pointsAwarded`)
 *  - tell the user whether the attendee was auto checked-in (`checkedIn`)
 *  - decide if a fallback `/members/:id/check-in` call is needed
 *    (`isCheckedIn`, `memberId`)
 */
export interface ScanResultExtras {
  pointsAwarded?: number;
  checkedIn?: boolean;
  isCheckedIn?: boolean;
  memberId?: number;
}

export async function listLeads(): Promise<ApiResponse<Lead[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Leads] listLeads eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };

  // Backend hasn't shipped GET /events/:id/leads yet — short-circuit and
  // throw so React Query's existing (optimistic) cache survives.
  if (leadsListEndpointMissing) {
    throw new Error('LEADS_LIST_NOT_IMPLEMENTED');
  }

  const res = await request<any>(`/api/v1/events/${eventId}/leads`);
  if (!res.success) {
    const msg = res.error?.message ?? '';
    // Laravel returns "The route ... could not be found." on a missing route.
    if (/could not be found|not found|404/i.test(msg)) {
      leadsListEndpointMissing = true;
      if (!warnedListMissing && __DEV__) {
        warnedListMissing = true;
        console.warn(
          '[Leads] GET /events/:id/leads returned 404. Falling back to local-only ' +
            'leads cache. Backend needs to register the leads index route to enable ' +
            'cross-device sync.',
        );
      }
      throw new Error('LEADS_LIST_NOT_IMPLEMENTED');
    }
    return res as ApiResponse<Lead[]>;
  }
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  return { success: true, data: raw.map((r, i) => normalizeLead(r, i)) };
}

export interface ScanPayload {
  badgeData?: string;
  attendeeId?: string;
  name?: string;
  company?: string;
  title?: string;
  eventId?: string;
}

/**
 * Heuristic: was this server error a "badge code didn't match any attendee"
 * rejection (vs. a generic 500, auth issue, etc)? When true, we fall back to
 * a client-side audience scan so case-sensitivity, whitespace, or a backend
 * lookup quirk don't strand the sponsor.
 */
function isAttendeeNotFoundError(err?: { code?: string; message?: string }): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === 'ATTENDEE_NOT_FOUND' ||
    err.code === 'NOT_FOUND' ||
    msg.includes('no attendee') ||
    msg.includes('not in audience') ||
    (msg.includes('badge') && msg.includes('not'))
  );
}

export async function submitScan(
  payload: ScanPayload,
): Promise<ApiResponse<Lead & ScanResultExtras>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Leads] submitScan eventId=${eventId} payload=`, payload);
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const code = (payload.badgeData ?? '').trim();
  if (!code) {
    return { success: false, error: { code: 'INVALID_CODE', message: 'Empty badge code.' } };
  }

  // Match the web client + Task #11 backend contract: POST to
  // /api/v1/events/:eventId/leads/scan with `{ code }`. The backend resolves
  // the attendee, auto check-ins, persists the lead row, and returns
  // `pointsAwarded` (0 on duplicate scans) so the report tabs see all scans.
  const res = await request<any>(`/api/v1/events/${eventId}/leads/scan`, {
    method: 'POST',
    body: JSON.stringify({
      code,
      // Optional client hints — server prefers its own canonical resolution.
      name: payload.name,
      company: payload.company,
      title: payload.title,
    }),
  });

  if (res.success && res.data) {
    const raw = res.data as any;
    const lead = normalizeLead(raw);
    const pointsAwarded =
      typeof raw.pointsAwarded === 'number' ? raw.pointsAwarded :
      typeof raw.points_awarded === 'number' ? raw.points_awarded :
      undefined;
    const checkedIn =
      typeof raw.checkedIn === 'boolean' ? raw.checkedIn :
      typeof raw.checked_in === 'boolean' ? raw.checked_in :
      undefined;
    const isCheckedIn =
      typeof raw.isCheckedIn === 'boolean' ? raw.isCheckedIn :
      typeof raw.is_checked_in === 'boolean' ? raw.is_checked_in :
      checkedIn === true ? true :
      undefined;
    const memberId =
      typeof raw.memberId === 'number' ? raw.memberId :
      typeof raw.member_id === 'number' ? raw.member_id :
      undefined;
    return { success: true, data: { ...lead, pointsAwarded, checkedIn, isCheckedIn, memberId } };
  }

  // Server rejected the badge code. If it's the specific "no attendee found"
  // case, fall back to a client-side audience scan (case-insensitive). This
  // mirrors web's findMemberByBadgeCodeApi safety net so a sponsor still
  // captures the lead even when the backend lookup is overly strict.
  if (isAttendeeNotFoundError(res.error)) {
    if (__DEV__) console.log(`[Leads] submitScan fallback: scanning audience for code=${code}`);
    const member = await findMemberByBadgeCode(eventId, code);
    if (member) {
      // Best-effort auto check-in (mirrors web behaviour).
      let didCheckIn = false;
      if (member.memberId && !member.isCheckedIn) {
        didCheckIn = await checkInMember(eventId, member.memberId);
      }
      const lead = normalizeLead({
        id: member.memberId ?? member.userId ?? code,
        name: member.name,
        title: member.title,
        company: member.company,
        email: member.email,
      });
      return {
        success: true,
        data: {
          ...lead,
          pointsAwarded: 0, // server didn't award; we don't double-credit
          checkedIn: didCheckIn || member.isCheckedIn,
          isCheckedIn: didCheckIn || member.isCheckedIn,
          memberId: member.memberId ?? undefined,
        },
      };
    }
    // Truly not in the audience for this event — clearer message than the
    // raw backend "No attendee found for this badge code".
    return {
      success: false,
      error: {
        code: 'ATTENDEE_NOT_IN_AUDIENCE',
        message: `Badge "${code}" isn't in this event's audience. Ask the organizer to add the attendee, then try again.`,
      },
    };
  }

  return res as ApiResponse<Lead & ScanResultExtras>;
}

export async function updateLeadStatus(leadId: string, status: Lead['status']): Promise<ApiResponse<Lead>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  return request<Lead>(`/api/v1/events/${eventId}/leads/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function triggerLuckyDraw(giveawayId?: string): Promise<ApiResponse<{ winner: Lead }>> {
  if (__DEV__) console.log(`[Leads] triggerLuckyDraw giveawayId=${giveawayId}`);
  return request<{ winner: Lead }>('/api/v1/sponsor/lucky-draw', {
    method: 'POST',
    body: JSON.stringify({ giveawayId }),
  });
}
