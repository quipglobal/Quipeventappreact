import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Lead } from '@/lib/api/types';

const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

function normalizeLead(raw: any, index = 0): Lead {
  return {
    id: String(raw.id),
    name: raw.name ?? raw.full_name ?? '',
    title: raw.title ?? raw.job_title ?? raw.position ?? '',
    company: raw.company ?? raw.organization ?? '',
    email: raw.email ?? '',
    scannedAt: raw.scanned_at ?? raw.created_at
      ? new Date(raw.scanned_at ?? raw.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    color: raw.color ?? ACCENT_COLORS[index % ACCENT_COLORS.length],
    status: raw.status ?? 'warm',
  };
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

export async function submitScan(payload: ScanPayload): Promise<ApiResponse<Lead>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Leads] submitScan eventId=${eventId} payload=`, payload);
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/scan`, {
    method: 'POST',
    body: JSON.stringify({
      badge_code: payload.badgeData,
      user_id: payload.attendeeId,
    }),
  });
  if (!res.success || !res.data) return res as ApiResponse<Lead>;
  return { success: true, data: normalizeLead(res.data) };
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
