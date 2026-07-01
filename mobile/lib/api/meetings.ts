import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Meeting } from '@/lib/api/types';

/**
 * Normalize a raw meeting-request row from the backend.
 *
 * Backend shape (GET /my-meetings):
 *   { id, from_user_id, to_user_id, status, message, created_at,
 *     from_user: { id, name, title, company: { name } | string, avatar_url },
 *     to_user:   { id, name, title, company: { name } | string, avatar_url } }
 *
 * Direction is computed from from_user_id vs currentUserId when provided;
 * falls back to raw.type if present, otherwise 'incoming'.
 * The "attendee" field is always the OTHER person in the conversation.
 */
function normalizeMeeting(raw: any, currentUserId?: string): Meeting {
  const fromUserId = String(raw.from_user_id ?? raw.fromUserId ?? raw.from_user?.id ?? '');
  const toUserId   = String(raw.to_user_id   ?? raw.toUserId   ?? raw.to_user?.id   ?? '');

  let direction: 'incoming' | 'outgoing';
  if (currentUserId && (fromUserId || toUserId)) {
    direction = String(currentUserId) === fromUserId ? 'outgoing' : 'incoming';
  } else {
    direction = raw.type === 'outgoing' ? 'outgoing' : 'incoming';
  }

  const counterparty =
    direction === 'incoming'
      ? (raw.from_user   ?? raw.requester ?? raw.sender   ?? raw.attendee ?? {})
      : (raw.to_user     ?? raw.receiver  ?? raw.recipient ?? raw.attendee ?? {});

  const companyRaw = counterparty.company ?? counterparty.company_name ?? '';
  const company =
    companyRaw && typeof companyRaw === 'object'
      ? String((companyRaw as any).name ?? '')
      : String(companyRaw ?? '');

  return {
    id:   String(raw.id),
    type: direction,
    attendee: {
      id:        String(counterparty.id ?? counterparty.user_id ?? ''),
      name:      counterparty.name ?? counterparty.full_name ?? '',
      title:     counterparty.title ?? counterparty.job_title ?? '',
      company,
      role:      'attendee' as const,
      points:    Number(counterparty.points ?? 0),
      tier:      counterparty.tier ?? 'Bronze',
      interests: [],
    },
    status:       raw.status ?? 'pending',
    proposedTime: raw.proposed_time ?? raw.proposedTime ?? raw.scheduled_at ?? '',
    message:      raw.message ?? raw.note ?? '',
    createdAt:    raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  };
}

function extractList(res: any): any[] {
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.requests)) return d.requests;
  if (Array.isArray(d?.meeting_requests)) return d.meeting_requests;
  if (Array.isArray(d?.meetings)) return d.meetings;
  if (Array.isArray(d?.items)) return d.items;
  return [];
}

/**
 * GET /api/v1/events/:eventId/my-meetings
 * Lists the current user's incoming and outgoing meeting requests.
 * Accepts an optional currentUserId so direction (incoming vs outgoing)
 * can be computed from from_user_id vs to_user_id.
 */
export async function listMeetings(currentUserId?: string): Promise<ApiResponse<Meeting[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Meetings] listMeetings eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };
  const res = await request<any>(`/api/v1/events/${eventId}/my-meetings`);
  if (!res.success) return res as ApiResponse<Meeting[]>;
  const raw: any[] = extractList(res);
  return { success: true, data: raw.map((r) => normalizeMeeting(r, currentUserId)) };
}

export interface SendMeetingRequest {
  attendeeId:    string;
  proposedTime?: string;
  message?:      string;
}

/**
 * POST /api/v1/events/:eventId/meeting-requests
 * Body: { to_user_id, message? }
 */
export async function sendMeetingRequest(
  input: SendMeetingRequest,
): Promise<ApiResponse<Meeting>> {
  const eventId = getEventId();
  if (!eventId)
    return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };

  const body: Record<string, unknown> = {
    to_user_id: input.attendeeId,
    toUserId:   input.attendeeId,
  };
  const note = [input.message, input.proposedTime ? `Proposed time: ${input.proposedTime}` : '']
    .filter(Boolean)
    .join(' · ');
  if (note) body.message = note;

  const res = await request<any>(`/api/v1/events/${eventId}/meeting-requests`, {
    method: 'POST',
    body:   JSON.stringify(body),
  });
  if (!res.success || !res.data) return res as ApiResponse<Meeting>;
  const raw = res.data?.data ?? res.data;
  return { success: true, data: normalizeMeeting(raw) };
}

/**
 * PATCH /api/v1/events/:eventId/meeting-requests/:id/respond
 * Body: { status: 'accepted' | 'declined' }
 */
export async function respondToMeeting(
  meetingId: string,
  action: 'accept' | 'decline',
): Promise<ApiResponse<Meeting>> {
  const eventId = getEventId();
  if (!eventId)
    return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };

  const status = action === 'accept' ? 'accepted' : 'declined';

  const res = await request<any>(
    `/api/v1/events/${eventId}/meeting-requests/${meetingId}/respond`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
  if (!res.success || !res.data) return res as ApiResponse<Meeting>;
  const raw = res.data?.data ?? res.data;
  return { success: true, data: normalizeMeeting(raw) };
}
