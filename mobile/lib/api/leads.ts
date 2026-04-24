import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Lead } from '@/lib/api/types';

const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

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
  const res = await request<any>(`/api/v1/events/${eventId}/leads`);
  if (!res.success) return res as ApiResponse<Lead[]>;
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

export async function submitScan(
  payload: ScanPayload,
): Promise<ApiResponse<Lead & ScanResultExtras>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Leads] submitScan eventId=${eventId} payload=`, payload);
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  // Match the web client + Task #11 backend contract: POST to
  // /api/v1/events/:eventId/leads/scan with `{ code }`. The backend resolves
  // the attendee, auto check-ins, persists the lead row, and returns
  // `pointsAwarded` (0 on duplicate scans) so the report tabs see all scans.
  const res = await request<any>(`/api/v1/events/${eventId}/leads/scan`, {
    method: 'POST',
    body: JSON.stringify({
      code: payload.badgeData,
      // Optional client hints — server prefers its own canonical resolution.
      name: payload.name,
      company: payload.company,
      title: payload.title,
    }),
  });
  if (!res.success || !res.data) return res as ApiResponse<Lead & ScanResultExtras>;

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
