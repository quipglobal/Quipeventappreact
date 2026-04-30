/**
 * Connections / Meeting Requests API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Event-scoped, multi-tenant. Uses the routes the Laravel backend
 * actually deploys (verified live with method-probes, see notes on
 * each function below) — NOT the `/connections` aliases the earlier
 * version of this client guessed at:
 *
 *   GET   /api/v1/events/:eventId/my-meetings
 *   POST  /api/v1/events/:eventId/meeting-requests
 *           body: { to_user_id, message? }
 *   PATCH /api/v1/events/:eventId/meeting-requests/:id/respond
 *           body: { status: 'accepted' | 'declined' }
 *
 * Why the rename
 * ──────────────
 * A user reported "I sent a request from the audience tab and the
 * other person never received it." Direct probe of the deployed
 * backend showed our `POST /…/connections` was 404-ing — the real
 * route is `POST /…/meeting-requests`. The old client was silently
 * short-circuiting to NOT_IMPLEMENTED and storing every request
 * locally, so the recipient never saw it.
 *
 * NOT_IMPLEMENTED fallback
 * ────────────────────────
 * Kept for the case where a future tenant doesn't have the routes
 * provisioned: a single 404/405 from the list endpoint flips a
 * session-scoped flag that short-circuits subsequent calls. In the
 * normal case (routes deployed) this never fires.
 */

import { apiGet, apiPost, apiPatch } from './client';
import type { ConnectionRequest } from '@/app/context/AppContext';

let listEndpointMissing = false;
let warnedListMissing = false;

export interface ListRequestsResponse {
  success: boolean;
  data?: ConnectionRequest[];
  error?: { code?: string; message: string };
}

export interface SendRequestPayload {
  toUserId: string;
  message?: string;
  /** Local-only — used by AppContext to render the optimistic row;
   *  not forwarded to the backend. */
  toUser: ConnectionRequest['fromUser'];
}

export interface SendRequestResponse {
  success: boolean;
  data?: ConnectionRequest;
  error?: { code?: string; message: string };
}

export interface ActionResponse {
  success: boolean;
  error?: { code?: string; message: string };
}

/** Reset on event change — backend may have shipped the routes since
 *  this session started. */
export function resetMeetingsEndpointMissing(): void {
  listEndpointMissing = false;
  warnedListMissing = false;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

/**
 * Normalize a meeting-request row into the shape AppContext expects.
 * Tolerates the multiple casings the backend uses across different
 * controllers (snake_case in the request resource, sometimes
 * `requester` / `recipient` aliases for the relations).
 *
 * The `direction` field (incoming vs outgoing) is computed by the
 * caller because it needs the current user id to be deterministic;
 * the backend doesn't ship a per-row direction flag.
 */
function normalizeRequest(raw: any, currentUserId?: string): ConnectionRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = pickStr(raw.id, raw.uuid, raw.meeting_request_id, raw.meetingRequestId);
  if (!id) return null;
  const fromRaw = raw.from_user ?? raw.fromUser ?? raw.requester ?? raw.from ?? raw.requested_by ?? {};
  const toRaw = raw.to_user ?? raw.toUser ?? raw.recipient ?? raw.to ?? raw.requested_to ?? {};
  const fromUser = {
    id: pickStr(fromRaw.id, fromRaw.user_id, fromRaw.userId, raw.from_user_id, raw.fromUserId, raw.requested_by_id),
    name: pickStr(fromRaw.name, fromRaw.full_name, fromRaw.fullName),
    title: pickStr(fromRaw.title, fromRaw.job_title, fromRaw.jobTitle, fromRaw.role),
    company: pickStr(fromRaw.company?.name, fromRaw.company, fromRaw.company_name, fromRaw.companyName),
    avatar: pickStr(fromRaw.avatar, fromRaw.avatar_url, fromRaw.avatarUrl, fromRaw.photo),
  };
  const toUserId = pickStr(toRaw.id, toRaw.user_id, raw.to_user_id, raw.toUserId, raw.requested_to_id);
  const status = (pickStr(raw.status) || 'pending').toLowerCase();
  const ts = raw.timestamp ?? raw.created_at ?? raw.createdAt ?? raw.requested_at;

  // Direction: if the backend pre-computed it, use that. Otherwise
  // infer from `currentUserId` — outgoing iff *I* am the requester.
  let direction = (pickStr(raw.direction) || '').toLowerCase();
  if (!direction && currentUserId) {
    direction = fromUser.id === currentUserId ? 'outgoing' : 'incoming';
  }

  return {
    id,
    fromUser,
    toUserId,
    status: (['pending', 'accepted', 'declined'] as const).includes(status as any)
      ? (status as ConnectionRequest['status'])
      : 'pending',
    timestamp: ts ? new Date(ts) : new Date(),
    message: typeof raw.message === 'string' ? raw.message : (typeof raw.note === 'string' ? raw.note : undefined),
    direction: direction === 'outgoing' ? 'outgoing' : 'incoming',
  };
}

function unwrapList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'requests', 'meeting_requests', 'meetingRequests', 'meetings', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as any[];
    }
  }
  return [];
}

// ─── API Methods ──────────────────────────────────────────────────────────────

const NOT_IMPL = { code: 'NOT_IMPLEMENTED', message: 'Meeting requests endpoint not deployed.' } as const;

function flagMissing(code: string | undefined, label: string): boolean {
  if (code === '404' || code === '405') {
    listEndpointMissing = true;
    if (!warnedListMissing && typeof console !== 'undefined') {
      warnedListMissing = true;
      console.warn(
        `[meetingsClient] ${label} returned ${code}. ` +
          'Falling back to local-only state. Backend needs the v1 meeting-requests routes.',
      );
    }
    return true;
  }
  return false;
}

/**
 * GET /api/v1/events/:eventId/my-meetings
 *
 * Returns every meeting-request row that touches the current user
 * (incoming + outgoing, all statuses). The backend doesn't pre-tag
 * direction, so we pass `currentUserId` through to the normalizer to
 * compute it client-side.
 */
export async function listMeetingRequests(
  eventId: string | number,
  currentUserId?: string,
): Promise<ListRequestsResponse> {
  if (listEndpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/my-meetings`);
  if (!res.success || !res.data) {
    if (flagMissing(res.error?.code, 'GET /events/:id/my-meetings')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch meeting requests.' } };
  }
  const raw = unwrapList(res.data);
  return {
    success: true,
    data: raw
      .map(r => normalizeRequest(r, currentUserId))
      .filter((r): r is ConnectionRequest => r !== null),
  };
}

/**
 * POST /api/v1/events/:eventId/meeting-requests
 *           body: { to_user_id, message? }
 *
 * Creates a real meeting request the recipient will see in their
 * inbox. The backend echoes the canonical row back so we can swap
 * the optimistic temp id for the server-issued one.
 */
export async function sendMeetingRequest(
  eventId: string | number,
  payload: SendRequestPayload,
  currentUserId?: string,
): Promise<SendRequestResponse> {
  if (listEndpointMissing) return { success: false, error: { ...NOT_IMPL } };
  // Coerce to a number when possible — the backend's request validator
  // is strict about `integer` typing on `to_user_id`. Keep the string
  // form as a fallback so an alphanumeric tenant id wouldn't break.
  const numeric = Number(payload.toUserId);
  const toUserId = Number.isFinite(numeric) && String(numeric) === String(payload.toUserId)
    ? numeric
    : payload.toUserId;
  const res = await apiPost<unknown>(`/api/v1/events/${eventId}/meeting-requests`, {
    to_user_id: toUserId,
    message: payload.message,
  });
  if (!res.success || !res.data) {
    if (flagMissing(res.error?.code, 'POST /events/:id/meeting-requests')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'SEND_FAILED', message: 'Failed to send meeting request.' } };
  }
  const data: any = res.data;
  // Server may return either the bare resource or `{ data: {...} }`.
  const rawRow = data && typeof data === 'object' && 'id' in data ? data : data?.data ?? data?.meeting_request;
  const normalized = normalizeRequest(rawRow, currentUserId);
  if (!normalized) {
    return { success: false, error: { code: 'PARSE_ERROR', message: 'Server returned an unexpected meeting-request shape.' } };
  }
  // The just-sent row is by definition outgoing from this user.
  return { success: true, data: { ...normalized, direction: 'outgoing' } };
}

/**
 * PATCH /api/v1/events/:eventId/meeting-requests/:id/respond
 *           body: { status: 'accepted' | 'declined' }
 *
 * Single endpoint handles both accept and decline — the backend
 * branches on the body's `status` field. We expose two named
 * functions so the caller doesn't have to remember the body shape.
 */
async function respondMeetingRequest(
  eventId: string | number,
  requestId: string,
  status: 'accepted' | 'declined',
): Promise<ActionResponse> {
  if (listEndpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiPatch<unknown>(
    `/api/v1/events/${eventId}/meeting-requests/${requestId}/respond`,
    { status },
  );
  if (!res.success) {
    if (flagMissing(res.error?.code, `PATCH /events/:id/meeting-requests/:id/respond (${status})`)) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'RESPOND_FAILED', message: `Failed to ${status === 'accepted' ? 'accept' : 'decline'} request.` } };
  }
  return { success: true };
}

export function acceptMeetingRequest(eventId: string | number, requestId: string): Promise<ActionResponse> {
  return respondMeetingRequest(eventId, requestId, 'accepted');
}

export function declineMeetingRequest(eventId: string | number, requestId: string): Promise<ActionResponse> {
  return respondMeetingRequest(eventId, requestId, 'declined');
}
