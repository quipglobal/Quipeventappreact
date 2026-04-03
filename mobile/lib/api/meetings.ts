import { request, USE_MOCK } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
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

function normalizeMeeting(raw: any): Meeting {
  return {
    id: String(raw.id),
    type: raw.type ?? 'incoming',
    attendee: {
      id: String(raw.attendee?.id ?? raw.requester?.id ?? raw.receiver?.id ?? ''),
      name: raw.attendee?.name ?? raw.requester?.name ?? raw.receiver?.name ?? '',
      title: raw.attendee?.title ?? raw.requester?.title ?? raw.receiver?.title ?? '',
      company: raw.attendee?.company ?? raw.requester?.company ?? raw.receiver?.company ?? '',
      role: 'attendee',
      points: Number(raw.attendee?.points ?? 0),
      tier: raw.attendee?.tier ?? 'Bronze',
      interests: [],
    },
    status: raw.status ?? 'pending',
    proposedTime: raw.proposed_time ?? raw.proposedTime ?? raw.scheduled_at ?? '',
    message: raw.message ?? raw.note ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  };
}

export async function listMeetings(): Promise<ApiResponse<Meeting[]>> {
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_MEETINGS };
  }
  const eventId = getEventId();
  if (!eventId) return { success: true, data: MOCK_MEETINGS };
  const res = await request<any>(`/api/v1/events/${eventId}/meetings`);
  if (!res.success) return res as ApiResponse<Meeting[]>;
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  return { success: true, data: raw.map(normalizeMeeting) };
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
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/meetings`, {
    method: 'POST',
    body: JSON.stringify({
      attendee_id: input.attendeeId,
      proposed_time: input.proposedTime,
      message: input.message,
    }),
  });
  if (!res.success || !res.data) return res as ApiResponse<Meeting>;
  return { success: true, data: normalizeMeeting(res.data) };
}

export async function respondToMeeting(meetingId: string, action: 'accept' | 'decline'): Promise<ApiResponse<Meeting>> {
  if (USE_MOCK) {
    await delay(500);
    const meeting = MOCK_MEETINGS.find((m) => m.id === meetingId);
    if (!meeting) return { success: false, error: { code: 'NOT_FOUND', message: 'Meeting not found' } };
    return { success: true, data: { ...meeting, status: action === 'accept' ? 'accepted' : 'declined' } };
  }
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/meetings/${meetingId}/respond`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
  if (!res.success || !res.data) return res as ApiResponse<Meeting>;
  return { success: true, data: normalizeMeeting(res.data) };
}
