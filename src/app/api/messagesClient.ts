/**
 * Messages API Client (encrypted)
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
 *           body: { ciphertext, iv, scheme }
 *   PUT    /api/v1/events/:eventId/conversations/:cid/messages/:mid
 *           body: { ciphertext, iv, scheme }   (re-encrypted edited content)
 *   DELETE /api/v1/events/:eventId/conversations/:cid/messages/:mid
 *           → soft-delete; subsequent GETs return the row with
 *             `deleted_at` populated and `ciphertext` set to null so
 *             history stays consistent across devices.
 *
 * Like the rest of the v1 clients we ship, every method short-circuits
 * to NOT_IMPLEMENTED on the first 404/405 and the UI gracefully falls
 * back to in-memory state until the backend deploys these routes.
 */

import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { EncryptedPayload } from '@/app/lib/messageCrypto';

let endpointMissing = false;
let warnedMissing = false;

/** Reset on event change. */
export function resetMessagesEndpointMissing(): void {
  endpointMissing = false;
  warnedMissing = false;
}

const NOT_IMPL = { code: 'NOT_IMPLEMENTED', message: 'Messages endpoint not deployed.' } as const;

function flagMissing(code: string | undefined, label: string): boolean {
  if (code === '404' || code === '405') {
    endpointMissing = true;
    if (!warnedMissing && typeof console !== 'undefined') {
      warnedMissing = true;
      console.warn(
        `[messagesClient] ${label} returned ${code}. ` +
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

// ─── Conversation list ──────────────────────────────────────────────────────

/** Slim shape returned by the conversations list — the actual message
 *  bodies are fetched lazily per conversation so the index stays
 *  cheap. `lastActivityAt` drives the inbox sort order. */
export interface ConversationSummary {
  id: string;
  connectionId: string;
  participantId: string;
  participantName: string;
  participantTitle: string;
  participantCompany: string;
  participantAvatar: string;
  lastActivityAt: Date;
}

export interface ListConversationsResponse {
  success: boolean;
  data?: ConversationSummary[];
  error?: { code?: string; message: string };
}

function normalizeConversation(raw: any): ConversationSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = pickStr(raw.id, raw.uuid);
  const connectionId = pickStr(raw.connectionId, raw.connection_id);
  if (!id || !connectionId) return null;
  const p = raw.participant ?? raw.peer ?? raw.other_user ?? {};
  const ts = raw.lastActivityAt ?? raw.last_activity_at ?? raw.updated_at ?? raw.created_at;
  return {
    id,
    connectionId,
    participantId: pickStr(p.id, p.user_id, raw.participantId, raw.participant_id),
    participantName: pickStr(p.name, p.full_name, p.fullName),
    participantTitle: pickStr(p.title, p.job_title, p.jobTitle),
    participantCompany: pickStr(p.company, p.company_name, p.companyName),
    participantAvatar: pickStr(p.avatar, p.avatar_url, p.avatarUrl, p.photo),
    lastActivityAt: ts ? new Date(ts) : new Date(),
  };
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

export async function listConversations(eventId: string | number): Promise<ListConversationsResponse> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/conversations`);
  if (!res.success || !res.data) {
    if (flagMissing(res.error?.code, 'GET /events/:id/conversations')) {
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

/** Server-side encrypted message — the wire format. The plaintext
 *  `text` only ever exists in client memory after `decryptMessage`. */
export interface EncryptedMessage {
  id: string;
  senderId: string;
  ciphertext: string | null; // null when soft-deleted
  iv: string;
  scheme: string;
  timestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

export interface ListMessagesResponse {
  success: boolean;
  data?: EncryptedMessage[];
  error?: { code?: string; message: string };
}

export interface SendMessageResponse {
  success: boolean;
  data?: EncryptedMessage;
  error?: { code?: string; message: string };
}

export interface MutateResponse {
  success: boolean;
  data?: EncryptedMessage;
  error?: { code?: string; message: string };
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
    timestamp: ts ? new Date(ts) : new Date(),
    editedAt: editedAt && (!ts || new Date(editedAt).getTime() !== new Date(ts).getTime()) ? new Date(editedAt) : undefined,
    deletedAt: deletedAt ? new Date(deletedAt) : undefined,
  };
}

export async function listMessages(
  eventId: string | number,
  conversationId: string,
  sinceMs?: number,
): Promise<ListMessagesResponse> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const qs = sinceMs ? `?since=${sinceMs}` : '';
  const res = await apiGet<unknown>(
    `/api/v1/events/${eventId}/conversations/${conversationId}/messages${qs}`,
  );
  if (!res.success || !res.data) {
    if (flagMissing(res.error?.code, 'GET /conversations/:id/messages')) {
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
  eventId: string | number,
  conversationId: string,
  payload: EncryptedPayload,
): Promise<SendMessageResponse> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiPost<unknown>(
    `/api/v1/events/${eventId}/conversations/${conversationId}/messages`,
    payload,
  );
  if (!res.success || !res.data) {
    if (flagMissing(res.error?.code, 'POST /conversations/:id/messages')) {
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
  eventId: string | number,
  conversationId: string,
  messageId: string,
  payload: EncryptedPayload,
): Promise<MutateResponse> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiPut<unknown>(
    `/api/v1/events/${eventId}/conversations/${conversationId}/messages/${messageId}`,
    payload,
  );
  if (!res.success || !res.data) {
    if (flagMissing(res.error?.code, 'PUT /conversations/:id/messages/:id')) {
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
  eventId: string | number,
  conversationId: string,
  messageId: string,
): Promise<MutateResponse> {
  if (endpointMissing) return { success: false, error: { ...NOT_IMPL } };
  const res = await apiDelete<unknown>(
    `/api/v1/events/${eventId}/conversations/${conversationId}/messages/${messageId}`,
  );
  if (!res.success) {
    if (flagMissing(res.error?.code, 'DELETE /conversations/:id/messages/:id')) {
      return { success: false, error: { ...NOT_IMPL } };
    }
    return { success: false, error: res.error ?? { code: 'DELETE_FAILED', message: 'Failed to delete message.' } };
  }
  return { success: true };
}
