import { request, USE_MOCK } from '@/lib/apiClient';
import type { ApiResponse, Lead } from '@/lib/api/types';

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_LEADS: Lead[] = [
  { id: 'l1', name: 'Alex Thompson', title: 'CTO', company: 'StartupXYZ', email: 'alex@startupxyz.com', scannedAt: '9:32 AM', color: '#7c3aed', status: 'hot' },
  { id: 'l2', name: 'Rachel Kim', title: 'VP Product', company: 'ScaleUp Co', email: 'rachel@scaleup.com', scannedAt: '10:15 AM', color: '#06b6d4', status: 'warm' },
  { id: 'l3', name: 'Tom Bradley', title: 'Head of IT', company: 'Enterprise Corp', email: 'tom@enterprise.com', scannedAt: '11:48 AM', color: '#10b981', status: 'cold' },
  { id: 'l4', name: 'Sophie Laurent', title: 'Director of Engineering', company: 'Innovatech', email: 'sophie@innovatech.fr', scannedAt: '1:20 PM', color: '#f59e0b', status: 'warm' },
  { id: 'l5', name: 'James Wu', title: 'CEO', company: 'FinEdge', email: 'james@finedge.com', scannedAt: '2:05 PM', color: '#ec4899', status: 'hot' },
];

export async function listLeads(): Promise<ApiResponse<Lead[]>> {
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_LEADS };
  }
  return request<Lead[]>('/api/v1/sponsor/leads');
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
  return request<Lead>('/api/v1/sponsor/scan', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateLeadStatus(leadId: string, status: Lead['status']): Promise<ApiResponse<Lead>> {
  if (USE_MOCK) {
    await delay(300);
    const lead = MOCK_LEADS.find((l) => l.id === leadId);
    if (!lead) return { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } };
    return { success: true, data: { ...lead, status } };
  }
  return request<Lead>(`/api/v1/sponsor/leads/${leadId}`, {
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
