/**
 * Messages API Client (encrypted) — native port of web `messagesClient.ts`
 * ─────────────────────────────────────────────────────────────────────────────
 * Event-scoped, multi-tenant. Lives under each accepted connection
 * (= conversation). The backend MUST NOT receive plaintext — every
 * payload that crosses the network is `{ ciphertext, iv, scheme }`
 * produced by `lib/messageCrypto.ts`. The server is treated as a
 * dumb relay that stores ciphertext and orders messages by
 * `created_at`.
 *
 * Routes
 * ──────
 *   GET    /api/v1/events/:eventId/conversations
 *   GET    /api/v1/events/:eventId/conversations/:cid/messages?since=<ms>
 *   POST   /api/v1/events/:eventId/conversations/:cid/messages
 *   PUT    /api/v1/events/:eventId/conversations/:cid/messages/:mid
 *   DELETE /api/v1/events/:eventId/conversations/:cid/messages/:mid
 *
 * Like the other v1 clients we ship, every method short-circuits to
 * NOT_IMPLEMENTED on the first 404/405 and the UI gracefully falls back
 * to local-only conversations until the backend deploys these routes.
 */

import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { EncryptedPayload } from '@/lib/messageCrypto';

let endpointMissing = false;
let warnedMissing = false;

/** Reset on event change / sign-out. */
export function resetMessagesEndpointMissing(): void {
  endpointMissing = false;
  warnedMissing = false;
}

export interface MessagesResult<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message: string };
}

const NOT_IMPL = { code: 'NOT_IMPLEMENTED', message: 'Messages endpoint not deployed.' } as const;

// The apiClient surfaces HTTP 404/405 as a generic REQUEST_FAILED whose
// *message* carries the "not found"/"not supported" text (see leads.ts,
// which detects the same way). So we match on both code and message.
function isMissing(code: string | undefined, message: string | undefined): boolean {
  if (code === '404' || code === '405' || code === 'NOT_FOUND' || code === 'METHOD_NOT_ALLOWED') {
    return true;
  }
  return /could not be found|not found|404|405|not supported|method not allowed/i.test(message ?? '');
}

function flagMissing(err: { code?: string; message: string } | undefined, label: string): boolean {
  if (isMissing(err?.code, err?.message)) {
    endpointMissing = true;
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn(
        `[messages] ${label} unavailable (${err?.code ?? ''} ${err?.message ?? ''}). ` +
          'Falling back to local-only conversations. Backend needs the v1 messages routes.',
      );
    }
    return true;
  }
  return false;
}

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function unwrapList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'conversations', 'messages', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as any[];
    }
  }
  return [];
}

// ─── Conversation list ──────────────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  connectionId: string;
  participantId: string;
  participantName: string;
  participantTitle: string;
  participantCompany: string;
  participantAvatar: string;
  lastActivityAt: string;
}

function normalizeConversation(raw: any): ConversationSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = pickStr(raw.id, raw.uuid);
  const connectionId = pickStr(raw.connectionId, raw.connection_id);
  if (!id || !connectionId) return null;
  const p = raw.participant ?? raw.peer ?? raw.other_user ?? {};
  const companyRaw = p.company ?? p.company_name ?? p.companyName ?? '';
  const company =
    companyRaw && typeof companyRaw === 'object'
      ? String((companyRaw as any).name ?? '')
      : String(companyRaw ?? '');
  const ts = raw.lastActivityAt ?? raw.last_activity_at ?? raw.updated_at ?? raw.created_at;
  return {
    id,
    connectionId,
    participantId: pickStr(p.id, p.user_id, raw.participantId, raw.participant_id),
    participantName: pickStr(p.name, p.full_name, p.fullName),
    participantTitle: pickStr(p.title, p.job_title, p.jobTitle),
    participantCompany: company,
    participantAvatar: pickStr(p.avatar, p.avatar_url, p.avatarUrl, p.photo),
    lastActivityAt: ts ? String(ts) : new Date().toISOString(),
  };
}

export async function listConversations(): Promise<MessagesResult<ConversationSummary[]>> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const eventId = getEventId();
  if (!eventId) return { success: true, data: [] };
  const res = await request<unknown>(`/api/v1/events/${eventId}/conversations`);
  if (!res.success || !res.data) {
    if (flagMissing(res.error, 'GET /conversations')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to load conversations.' } };
  }
  return {
    success: true,
    data: unwrapList(res.data).map(normalizeConversation).filter((c): c is ConversationSummary => c !== null),
  };
}

// ─── Messages ──────────────────────────────────────────────────────────────

export interface EncryptedMessage {
  id: string;
  senderId: string;
  ciphertext: string | null; // null when soft-deleted
  iv: string;
  scheme: string;
  timestamp: string;
  editedAt?: string;
  deletedAt?: string;
}

function normalizeMessage(raw: any): EncryptedMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = pickStr(raw.id, raw.uuid);
  if (!id) return null;
  const ts = raw.timestamp ?? raw.created_at ?? raw.createdAt;
  const editedAt = raw.editedAt ?? raw.edited_at ?? raw.updated_at;
  const deletedAt = raw.deletedAt ?? raw.deleted_at;
  return {
    id,
    senderId: pickStr(raw.senderId, raw.sender_id, raw.user_id, raw.userId, raw.from_user_id),
    ciphertext: typeof raw.ciphertext === 'string' ? raw.ciphertext : null,
    iv: pickStr(raw.iv),
    scheme: pickStr(raw.scheme) || 'aes-gcm-hkdf-v1',
    timestamp: ts ? String(ts) : new Date().toISOString(),
    editedAt: editedAt && (!ts || String(editedAt) !== String(ts)) ? String(editedAt) : undefined,
    deletedAt: deletedAt ? String(deletedAt) : undefined,
  };
}

export async function listMessages(
  conversationId: string,
  sinceMs?: number,
): Promise<MessagesResult<EncryptedMessage[]>> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const eventId = getEventId();
  if (!eventId) return { success: true, data: [] };
  const qs = sinceMs ? `?since=${sinceMs}` : '';
  const res = await request<unknown>(
    `/api/v1/events/${eventId}/conversations/${conversationId}/messages${qs}`,
  );
  if (!res.success || !res.data) {
    if (flagMissing(res.error, 'GET /conversations/:id/messages')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to load messages.' } };
  }
  return {
    success: true,
    data: unwrapList(res.data).map(normalizeMessage).filter((m): m is EncryptedMessage => m !== null),
  };
}

export async function sendMessageApi(
  conversationId: string,
  payload: EncryptedPayload,
): Promise<MessagesResult<EncryptedMessage>> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(
    `/api/v1/events/${eventId}/conversations/${conversationId}/messages`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  if (!res.success || !res.data) {
    if (flagMissing(res.error, 'POST /conversations/:id/messages')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'SEND_FAILED', message: 'Failed to send message.' } };
  }
  const data: any = res.data;
  const row = data && typeof data === 'object' && 'id' in data ? data : data?.data;
  const normalized = normalizeMessage(row);
  if (!normalized) return { success: false, error: { code: 'PARSE_ERROR', message: 'Server returned an unexpected message shape.' } };
  return { success: true, data: normalized };
}

export async function editMessageApi(
  conversationId: string,
  messageId: string,
  payload: EncryptedPayload,
): Promise<MessagesResult<EncryptedMessage>> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(
    `/api/v1/events/${eventId}/conversations/${conversationId}/messages/${messageId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  );
  if (!res.success || !res.data) {
    if (flagMissing(res.error, 'PUT /conversations/:id/messages/:id')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'EDIT_FAILED', message: 'Failed to edit message.' } };
  }
  const data: any = res.data;
  const row = data && typeof data === 'object' && 'id' in data ? data : data?.data;
  const normalized = normalizeMessage(row);
  if (!normalized) return { success: false, error: { code: 'PARSE_ERROR', message: 'Server returned an unexpected message shape.' } };
  return { success: true, data: normalized };
}

export async function deleteMessageApi(
  conversationId: string,
  messageId: string,
): Promise<MessagesResult<void>> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<unknown>(
    `/api/v1/events/${eventId}/conversations/${conversationId}/messages/${messageId}`,
    { method: 'DELETE' },
  );
  if (!res.success) {
    if (flagMissing(res.error, 'DELETE /conversations/:id/messages/:id')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'DELETE_FAILED', message: 'Failed to delete message.' } };
  }
  return { success: true };
}
