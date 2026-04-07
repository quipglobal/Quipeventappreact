import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Meeting } from '@/lib/api/types';

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
  const eventId = getEventId();
  if (__DEV__) console.log(`[Meetings] listMeetings eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };
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
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/meetings/${meetingId}/respond`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
  if (!res.success || !res.data) return res as ApiResponse<Meeting>;
  return { success: true, data: normalizeMeeting(res.data) };
}
