import { request, USE_MOCK } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Lead } from '@/lib/api/types';

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_LEADS: Lead[] = [
  { id: 'l1', name: 'Alex Thompson', title: 'CTO', company: 'StartupXYZ', email: 'alex@startupxyz.com', scannedAt: '9:32 AM', color: '#7c3aed', status: 'hot' },
  { id: 'l2', name: 'Rachel Kim', title: 'VP Product', company: 'ScaleUp Co', email: 'rachel@scaleup.com', scannedAt: '10:15 AM', color: '#06b6d4', status: 'warm' },
  { id: 'l3', name: 'Tom Bradley', title: 'Head of IT', company: 'Enterprise Corp', email: 'tom@enterprise.com', scannedAt: '11:48 AM', color: '#10b981', status: 'cold' },
  { id: 'l4', name: 'Sophie Laurent', title: 'Director of Engineering', company: 'Innovatech', email: 'sophie@innovatech.fr', scannedAt: '1:20 PM', color: '#f59e0b', status: 'warm' },
  { id: 'l5', name: 'James Wu', title: 'CEO', company: 'FinEdge', email: 'james@finedge.com', scannedAt: '2:05 PM', color: '#ec4899', status: 'hot' },
];

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
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_LEADS };
  }
  const eventId = getEventId();
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
  if (USE_MOCK) {
    await delay(600);
    const lead: Lead = {
      id: `l-${Date.now()}`,
      name: payload.name ?? 'Unknown Attendee',
      title: payload.title ?? '',
      company: payload.company ?? '',
      scannedAt: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      color: '#7c3aed',
      status: 'warm',
    };
    return { success: true, data: lead };
  }
  const eventId = getEventId();
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
  if (USE_MOCK) {
    await delay(300);
    const lead = MOCK_LEADS.find((l) => l.id === leadId);
    if (!lead) return { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } };
    return { success: true, data: { ...lead, status } };
  }
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  return request<Lead>(`/api/v1/events/${eventId}/leads/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function triggerLuckyDraw(giveawayId?: string): Promise<ApiResponse<{ winner: Lead }>> {
  if (USE_MOCK) {
    await delay(1500);
    const winner = MOCK_LEADS[Math.floor(Math.random() * MOCK_LEADS.length)];
    return { success: true, data: { winner } };
  }
  return request<{ winner: Lead }>('/api/v1/sponsor/lucky-draw', {
    method: 'POST',
    body: JSON.stringify({ giveawayId }),
  });
}
