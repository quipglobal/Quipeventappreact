import { request, USE_MOCK } from '@/lib/apiClient';
import type { ApiResponse, Meeting } from '@/lib/api/types';

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_ATTENDEE_PROFILES = {
  'a1': { id: 'a1', name: 'Jessica Williams', title: 'Product Designer', company: 'Stripe', role: 'attendee' as const, points: 120, tier: 'Silver', interests: [] },
  'a2': { id: 'a2', name: 'Michael Chen', title: 'CTO', company: 'StartupX', role: 'attendee' as const, points: 350, tier: 'Gold', interests: [] },
  'a3': { id: 'a3', name: 'Aisha Kamara', title: 'Founder & CEO', company: 'Nexus Labs', role: 'attendee' as const, points: 680, tier: 'Platinum', interests: [] },
};

const MOCK_MEETINGS: Meeting[] = [
  { id: 'm1', type: 'incoming', attendee: MOCK_ATTENDEE_PROFILES['a1'], status: 'pending', proposedTime: '2:00 PM - 2:30 PM', message: 'I would love to discuss potential design partnerships.', createdAt: '2026-01-16T09:15:00Z' },
  { id: 'm2', type: 'incoming', attendee: MOCK_ATTENDEE_PROFILES['a2'], status: 'pending', proposedTime: '3:30 PM - 4:00 PM', message: 'Let\'s chat about engineering collaboration.', createdAt: '2026-01-16T10:30:00Z' },
  { id: 'm3', type: 'outgoing', attendee: MOCK_ATTENDEE_PROFILES['a3'], status: 'accepted', proposedTime: '11:00 AM - 11:30 AM', message: 'Would love to learn from your journey building Nexus Labs.', createdAt: '2026-01-15T14:00:00Z' },
];

export async function listMeetings(): Promise<ApiResponse<Meeting[]>> {
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_MEETINGS };
  }
  return request<Meeting[]>('/api/meetings');
}

export interface SendMeetingRequest {
  attendeeId: string;
  proposedTime: string;
  message?: string;
}

export async function sendMeetingRequest(input: SendMeetingRequest): Promise<ApiResponse<Meeting>> {
  if (USE_MOCK) {
    await delay(700);
    const attendee = Object.values(MOCK_ATTENDEE_PROFILES).find((a) => a.id === input.attendeeId);
    if (!attendee) return { success: false, error: { code: 'NOT_FOUND', message: 'Attendee not found' } };
    const meeting: Meeting = {
      id: `m-${Date.now()}`,
      type: 'outgoing',
      attendee,
      status: 'pending',
      proposedTime: input.proposedTime,
      message: input.message,
      createdAt: new Date().toISOString(),
    };
    return { success: true, data: meeting };
  }
  return request<Meeting>('/api/meetings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function respondToMeeting(meetingId: string, action: 'accept' | 'decline'): Promise<ApiResponse<Meeting>> {
  if (USE_MOCK) {
    await delay(500);
    const meeting = MOCK_MEETINGS.find((m) => m.id === meetingId);
    if (!meeting) return { success: false, error: { code: 'NOT_FOUND', message: 'Meeting not found' } };
    return { success: true, data: { ...meeting, status: action === 'accept' ? 'accepted' : 'declined' } };
  }
  return request<Meeting>(`/api/meetings/${meetingId}/${action}`, { method: 'POST' });
}
