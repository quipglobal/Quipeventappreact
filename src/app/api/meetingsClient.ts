/**
 * Connections (a.k.a. Meeting Requests) API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Event-scoped, multi-tenant. Replaces the legacy non-versioned
 * `/api/meetings/requests` paths the backend never had — now
 * mirrors the v1 convention used by giveaways / leads / leaderboard:
 *
 *   GET    /api/v1/events/:eventId/connections
 *   POST   /api/v1/events/:eventId/connections                → { toUserId, message? }
 *   POST   /api/v1/events/:eventId/connections/:id/accept
 *   POST   /api/v1/events/:eventId/connections/:id/decline
 *
 * Backend not deployed yet
 * ────────────────────────
 * As with the other v1 clients we land in this codebase, a single
 * 404/405 from the list endpoint flips a session-scoped flag that
 * short-circuits subsequent calls to `NOT_IMPLEMENTED`. The UI keeps
 * a local-only view of pending requests in that mode so the feature
 * is usable today and silently turns "real" the moment the backend
 * registers the routes.
 */

import { apiGet, apiPost } from './client';
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

function normalizeRequest(raw: any): ConnectionRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = pickStr(raw.id, raw.uuid, raw.connection_id, raw.connectionId);
  if (!id) return null;
  const fromRaw = raw.fromUser ?? raw.from_user ?? raw.from ?? raw.requester ?? {};
  const fromUser = {
    id: pickStr(fromRaw.id, fromRaw.user_id, fromRaw.userId, raw.from_user_id, raw.fromUserId),
    name: pickStr(fromRaw.name, fromRaw.full_name, fromRaw.fullName),
    title: pickStr(fromRaw.title, fromRaw.job_title, fromRaw.jobTitle),
    company: pickStr(fromRaw.company, fromRaw.company_name, fromRaw.companyName),
    avatar: pickStr(fromRaw.avatar, fromRaw.avatar_url, fromRaw.avatarUrl, fromRaw.photo),
  };
  const status = (pickStr(raw.status) || 'pending').toLowerCase();
  const direction = (pickStr(raw.direction) || 'incoming').toLowerCase();
  const ts = raw.timestamp ?? raw.created_at ?? raw.createdAt ?? raw.requested_at;
  return {
    id,
    fromUser,
    toUserId: pickStr(raw.toUserId, raw.to_user_id, raw.toUser?.id, raw.to?.id),
    status: (['pending', 'accepted', 'declined'] as const).includes(status as any)
      ? (status as ConnectionRequest['status'])
      : 'pending',
    timestamp: ts ? new Date(ts) : new Date(),
    message: typeof raw.message === 'string' ? raw.message : undefined,
    direction: direction === 'outgoing' ? 'outgoing' : 'incoming',
  };
}

function unwrapList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'requests', 'connections', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as any[];
    }
  }
  return [];
}

// ─── API Methods ──────────────────────────────────────────────────────────────

const NOT_IMPL = { code: 'NOT_IMPLEMENTED', message: 'Connections endpoint not deployed.' } as const;

function flagMissing(code: string | undefined, label: string): boolean {
  if (code === '404' || code === '405') {
    listEndpointMissing = true;
    if (!warnedListMissing && typeof console !== 'undefined') {
      warnedListMissing = true;
      console.warn(
        `[meetingsClient] ${label} returned ${code}. ` +
          'Falling back to local-only state. Backend needs the v1 connections routes.',
      );
    }
    return true;
  }
  return false;
}

/**
 * GET /api/v1/events/:eventId/connections
 * Lists pending + historical connection requests for the current user.
 */
export async function listMeetingRequests(eventId: string | number): Promise<ListRequestsResponse> {
  if (listEndpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/connections`);
  if (!res.success || !res.data) {
    if (flagMissing(res.error?.code, 'GET /events/:id/connections')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch connections.' } };
  }
  const raw = unwrapList(res.data);
  return {
    success: true,
    data: raw.map(normalizeRequest).filter((r): r is ConnectionRequest => r !== null),
  };
}

/**
 * POST /api/v1/events/:eventId/connections
 * Sends a new connection request. The backend MUST persist + echo
 * the canonical id so the client can swap its optimistic temp id.
 */
export async function sendMeetingRequest(
  eventId: string | number,
  payload: SendRequestPayload,
): Promise<SendRequestResponse> {
  if (listEndpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiPost<unknown>(`/api/v1/events/${eventId}/connections`, {
    to_user_id: payload.toUserId,
    toUserId: payload.toUserId, // tolerate either casing on the backend
    message: payload.message,
  });
  if (!res.success || !res.data) {
    if (flagMissing(res.error?.code, 'POST /events/:id/connections')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'SEND_FAILED', message: 'Failed to send connection request.' } };
  }
  const data: any = res.data;
  // Server may return either the bare resource or `{ data: {...} }`.
  const rawRow = data && typeof data === 'object' && 'id' in data ? data : data?.data;
  const normalized = normalizeRequest(rawRow);
  if (!normalized) {
    return { success: false, error: { code: 'PARSE_ERROR', message: 'Server returned an unexpected connection shape.' } };
  }
  return { success: true, data: normalized };
}

/** POST /api/v1/events/:eventId/connections/:id/accept */
export async function acceptMeetingRequest(
  eventId: string | number,
  requestId: string,
): Promise<ActionResponse> {
  if (listEndpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiPost<void>(`/api/v1/events/${eventId}/connections/${requestId}/accept`, {});
  if (!res.success) {
    if (flagMissing(res.error?.code, 'POST /events/:id/connections/:id/accept')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'ACCEPT_FAILED', message: 'Failed to accept request.' } };
  }
  return { success: true };
}

/** POST /api/v1/events/:eventId/connections/:id/decline */
export async function declineMeetingRequest(
  eventId: string | number,
  requestId: string,
): Promise<ActionResponse> {
  if (listEndpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiPost<void>(`/api/v1/events/${eventId}/connections/${requestId}/decline`, {});
  if (!res.success) {
    if (flagMissing(res.error?.code, 'POST /events/:id/connections/:id/decline')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'DECLINE_FAILED', message: 'Failed to decline request.' } };
  }
  return { success: true };
}
