/**
 * Meetings & Networking API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET  /api/meetings/requests                                           → { requests }
 *   POST /api/meetings/requests         → { toUserId, message? }         → { success, request }
 *   POST /api/meetings/requests/:id/accept                               → { success }
 *   POST /api/meetings/requests/:id/decline                              → { success }
 *
 * Set VITE_USE_MOCK_API=true in .env to run without a live backend.
 */

import { apiGet, apiPost } from './client';
import type { ConnectionRequest } from '@/app/context/AppContext';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const delay = (ms = 600) => new Promise<void>(r => setTimeout(r, ms));

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ListRequestsResponse {
  success: boolean;
  data?: ConnectionRequest[];
  error?: { code?: string; message: string };
}

export interface SendRequestPayload {
  toUserId: string;
  message?: string;
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

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeRequest(raw: ConnectionRequest & { timestamp: Date | string }): ConnectionRequest {
  return {
    ...raw,
    timestamp: raw.timestamp instanceof Date ? raw.timestamp : new Date(raw.timestamp),
  };
}

// ─── In-memory mock state ──────────────────────────────────────────────────

const mockRequests: ConnectionRequest[] = [
  {
    id: 'cr-1', direction: 'incoming', status: 'pending',
    fromUser: { id: 'att-1', name: 'Dr. Sarah Chen', title: 'Chief AI Officer', company: 'TechCorp Solutions', avatar: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=6366f1&color=fff' },
    toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 12),
    message: 'Hi! I loved your talk on product design. Would love to connect and discuss collaboration opportunities.',
  },
  {
    id: 'cr-2', direction: 'incoming', status: 'pending',
    fromUser: { id: 'att-3', name: 'Priya Patel', title: 'Product Lead', company: 'DesignFlow', avatar: 'https://ui-avatars.com/api/?name=Priya+Patel&background=ec4899&color=fff' },
    toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 45),
    message: 'Hey! We should chat about the UX research panel.',
  },
  {
    id: 'cr-3', direction: 'incoming', status: 'pending',
    fromUser: { id: 'att-6', name: 'James Wilson', title: 'CTO', company: 'CloudNine Systems', avatar: 'https://ui-avatars.com/api/?name=James+Wilson&background=f59e0b&color=fff' },
    toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 90),
  },
  {
    id: 'cr-4', direction: 'outgoing', status: 'pending',
    fromUser: { id: 'user-001', name: '', title: '', company: '', avatar: '' },
    toUserId: 'att-5', timestamp: new Date(Date.now() - 1000 * 60 * 30),
    message: 'Would love to connect about your infrastructure work!',
  },
  {
    id: 'cr-5', direction: 'incoming', status: 'accepted',
    fromUser: { id: 'att-2', name: 'Marcus Johnson', title: 'VP of Engineering', company: 'InnovateLab', avatar: 'https://ui-avatars.com/api/?name=Marcus+Johnson&background=8b5cf6&color=fff' },
    toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
    message: 'Great meetup at the networking session!',
  },
  {
    id: 'cr-6', direction: 'incoming', status: 'accepted',
    fromUser: { id: 'att-4', name: 'Elena Rodriguez', title: 'Head of Data Science', company: 'QuantumLeap AI', avatar: 'https://ui-avatars.com/api/?name=Elena+Rodriguez&background=10b981&color=fff' },
    toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
  },
];

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/meetings/requests
 * Lists all connection/meeting requests for the current user.
 */
export async function listMeetingRequests(): Promise<ListRequestsResponse> {
  if (USE_MOCK) {
    await delay(400);
    return { success: true, data: [...mockRequests] };
  }

  const res = await apiGet<{ requests: ConnectionRequest[] } | ConnectionRequest[]>('/api/meetings/requests');
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch meeting requests.' } };
  }
  const data = res.data;
  const raw = Array.isArray(data) ? data : (data as { requests: ConnectionRequest[] }).requests ?? [];
  return { success: true, data: raw.map(r => normalizeRequest(r as ConnectionRequest & { timestamp: Date | string })) };
}

/**
 * POST /api/meetings/requests
 * Sends a new meeting/connection request to another attendee.
 */
export async function sendMeetingRequest(payload: SendRequestPayload): Promise<SendRequestResponse> {
  if (USE_MOCK) {
    await delay(600);

    const newRequest: ConnectionRequest = {
      id: `cr-${Date.now()}`,
      fromUser: { id: 'current-user', name: '', title: '', company: '', avatar: '' },
      toUserId: payload.toUserId,
      status: 'pending',
      timestamp: new Date(),
      message: payload.message,
      direction: 'outgoing',
    };
    mockRequests.unshift(newRequest);
    console.log(`[Mock] Meeting request sent to ${payload.toUserId}`);
    return { success: true, data: newRequest };
  }

  const res = await apiPost<ConnectionRequest>('/api/meetings/requests', {
    toUserId: payload.toUserId,
    message: payload.message,
  });
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'SEND_FAILED', message: 'Failed to send meeting request.' } };
  }
  return { success: true, data: normalizeRequest(res.data as ConnectionRequest & { timestamp: Date | string }) };
}

/**
 * POST /api/meetings/requests/:id/accept
 * Accepts an incoming meeting/connection request.
 */
export async function acceptMeetingRequest(requestId: string): Promise<ActionResponse> {
  if (USE_MOCK) {
    await delay(400);

    const idx = mockRequests.findIndex(r => r.id === requestId);
    if (idx !== -1) {
      mockRequests[idx] = { ...mockRequests[idx], status: 'accepted' };
    }
    console.log(`[Mock] Meeting request ${requestId} accepted`);
    return { success: true };
  }

  const res = await apiPost<void>(`/api/meetings/requests/${requestId}/accept`, {});
  if (!res.success) {
    return { success: false, error: res.error ?? { code: 'ACCEPT_FAILED', message: 'Failed to accept request.' } };
  }
  return { success: true };
}

/**
 * POST /api/meetings/requests/:id/decline
 * Declines an incoming meeting/connection request.
 */
export async function declineMeetingRequest(requestId: string): Promise<ActionResponse> {
  if (USE_MOCK) {
    await delay(400);

    const idx = mockRequests.findIndex(r => r.id === requestId);
    if (idx !== -1) {
      mockRequests[idx] = { ...mockRequests[idx], status: 'declined' };
    }
    console.log(`[Mock] Meeting request ${requestId} declined`);
    return { success: true };
  }

  const res = await apiPost<void>(`/api/meetings/requests/${requestId}/decline`, {});
  if (!res.success) {
    return { success: false, error: res.error ?? { code: 'DECLINE_FAILED', message: 'Failed to decline request.' } };
  }
  return { success: true };
}
