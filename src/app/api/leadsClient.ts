/**
 * Leads (Badge Scan) API Client — Universal, available to ALL roles
 * ─────────────────────────────────────────────────────────────────────────────
 * Any audience member can scan another attendee's badge. Each successful scan:
 *   1. Creates a Lead row owned by the scanning user (visible only to them in
 *      "My Leads"), including any conversation notes captured at scan time.
 *   2. Awards the scanning user the points configured for the
 *      `lead_scan` activity in the event's Gamification config (returned in the
 *      response as `pointsAwarded`).
 *   3. Surfaces the scanned-user → scanner relationship to the backend so the
 *      organizer/admin can report on who scanned whom (the Lead row IS that
 *      record — the backend can aggregate by scannerUserId / scannedUserCode).
 *
 * API CONTRACT (real backend):
 *   POST /api/v1/events/:eventId/leads/scan
 *     Body:    { code, name?, company?, title?, notes?, tags?, priority?, avatar? }
 *              `code` is the only required field (decoded from the badge QR);
 *              the backend resolves the attendee profile from the code and
 *              returns the canonical name/company/title/avatar.
 *     Returns: { success: true, data: Lead & {
 *                 pointsAwarded?: number,
 *                 checkedIn?: boolean,    // true iff the backend just auto
 *                                         //   checked-in this attendee as part
 *                                         //   of the scan
 *                 memberId?: number,      // resolved event member id (used by
 *                                         //   the client to fall back to a
 *                                         //   manual check-in call if needed)
 *               } }
 *
 *   GET  /api/v1/events/:eventId/leads                  → { success, data: Lead[] }
 *   PUT  /api/v1/events/:eventId/leads/:id
 *     Body:    { notes?, tags?, priority? }
 *     Returns: { success, data: Lead }
 *
 *   POST /api/v1/events/:eventId/leads/draw
 *     Body:    { giveawayId?, excludeIds? }
 *     Returns: { success, data: DrawWinner }
 *
 * Headers: X-Tenant-ID (from VITE_TENANT_ID, default '1') + Bearer token
 *          (handled by client.ts).
 *
 * Set VITE_USE_MOCK_API=true in .env to run without a live backend.
 */

import { apiGet, apiPost, apiPut } from './client';
import type { Lead } from '@/app/context/AppContext';

const USE_MOCK = false;
const TENANT_ID = (import.meta.env.VITE_TENANT_ID ?? '1') as string;
const HEADERS: Record<string, string> = { 'X-Tenant-ID': TENANT_ID };
const delay = (ms = 0) => new Promise<void>(r => setTimeout(r, ms));

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SaveLeadPayload {
  code: string;
  name?: string;
  company?: string;
  title?: string;
  notes?: string;
  tags?: string[];
  priority?: 'hot' | 'warm' | 'cold';
  avatar?: string;
}

export interface SaveLeadResponse {
  success: boolean;
  data?: Lead & { pointsAwarded?: number; checkedIn?: boolean; memberId?: number };
  error?: { code?: string; message: string };
}

export interface ListLeadsResponse {
  success: boolean;
  data?: Lead[];
  error?: { code?: string; message: string };
}

export interface DrawWinner {
  id: string;
  name: string;
  company: string;
  title: string;
  avatar: string;
}

export interface LuckyDrawResponse {
  success: boolean;
  data?: DrawWinner;
  error?: { code?: string; message: string };
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeLead(raw: Lead & { timestamp: Date | string }): Lead {
  return {
    ...raw,
    timestamp: raw.timestamp instanceof Date ? raw.timestamp : new Date(raw.timestamp),
  };
}

// ─── In-memory mock state ──────────────────────────────────────────────────

const mockLeads: Lead[] = [
  {
    id: 'pre-1', code: 'ATT-4419', name: 'Olivia Martinez', title: 'Head of Procurement',
    company: 'Global Logistics Corp', avatar: 'https://ui-avatars.com/api/?name=Olivia+Martinez&background=ec4899&color=fff',
    notes: '', tags: ['Decision Maker'], priority: 'hot', timestamp: new Date(Date.now() - 45 * 60000),
  },
  {
    id: 'pre-2', code: 'ATT-2781', name: 'James Park', title: 'Senior DevOps Engineer',
    company: 'Fintech Innovations', avatar: 'https://ui-avatars.com/api/?name=James+Park&background=3b82f6&color=fff',
    notes: '', tags: ['Technical Lead'], priority: 'warm', timestamp: new Date(Date.now() - 90 * 60000),
  },
  {
    id: 'pre-3', code: 'ATT-6155', name: 'Amara Osei', title: 'Innovation Manager',
    company: 'Deloitte Digital', avatar: 'https://ui-avatars.com/api/?name=Amara+Osei&background=10b981&color=fff',
    notes: '', tags: ['Referral'], priority: 'warm', timestamp: new Date(Date.now() - 150 * 60000),
  },
  {
    id: 'pre-4', code: 'ATT-8830', name: 'Chen Wei', title: 'Staff Software Engineer',
    company: 'ByteScale', avatar: 'https://ui-avatars.com/api/?name=Chen+Wei&background=8b5cf6&color=fff',
    notes: '', tags: [], priority: 'cold', timestamp: new Date(Date.now() - 200 * 60000),
  },
  {
    id: 'pre-5', code: 'ATT-3372', name: 'Fatima Al-Rashid', title: 'VP of Technology',
    company: 'Emirates Digital', avatar: 'https://ui-avatars.com/api/?name=Fatima+AlRashid&background=f59e0b&color=fff',
    notes: '', tags: ['Decision Maker', 'Budget Holder'], priority: 'hot', timestamp: new Date(Date.now() - 25 * 60000),
  },
];

// ─── Leads ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/events/:eventId/leads/scan
 * Submits a scanned QR badge payload to create a lead on the backend.
 */
export async function scanBadgeLead(
  eventId: string | number,
  payload: SaveLeadPayload,
): Promise<SaveLeadResponse> {
  if (USE_MOCK) {
    await delay(800);
    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      code: payload.code,
      name: payload.name ?? 'Unknown Attendee',
      company: payload.company ?? '',
      title: payload.title ?? '',
      notes: payload.notes ?? '',
      tags: payload.tags ?? [],
      priority: payload.priority ?? 'warm',
      avatar: payload.avatar,
      timestamp: new Date(),
    };
    mockLeads.unshift(newLead);
    return { success: true, data: newLead };
  }

  const res = await apiPost<Lead & {
    pointsAwarded?: number;
    points_awarded?: number;
    checkedIn?: boolean;
    checked_in?: boolean;
    memberId?: number;
    member_id?: number;
  }>(
    `/api/v1/events/${eventId}/leads/scan`,
    payload,
    HEADERS,
  );
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'SCAN_FAILED', message: 'Failed to save scanned lead.' } };
  }
  const raw = res.data as Lead & {
    timestamp: Date | string;
    pointsAwarded?: number;
    points_awarded?: number;
    checkedIn?: boolean;
    checked_in?: boolean;
    memberId?: number;
    member_id?: number;
  };
  const lead = normalizeLead(raw);
  const pointsAwarded =
    typeof raw.pointsAwarded === 'number' ? raw.pointsAwarded :
    typeof raw.points_awarded === 'number' ? raw.points_awarded :
    undefined;
  const checkedIn =
    typeof raw.checkedIn === 'boolean' ? raw.checkedIn :
    typeof raw.checked_in === 'boolean' ? raw.checked_in :
    undefined;
  const memberId =
    typeof raw.memberId === 'number' ? raw.memberId :
    typeof raw.member_id === 'number' ? raw.member_id :
    undefined;
  return { success: true, data: { ...lead, pointsAwarded, checkedIn, memberId } };
}

/**
 * GET /api/v1/events/:eventId/leads
 * Fetches all leads captured by the authenticated user.
 */
export async function listLeads(eventId: string | number): Promise<ListLeadsResponse> {
  if (USE_MOCK) {
    await delay(500);
    return { success: true, data: [...mockLeads] };
  }

  const res = await apiGet<{ leads: Lead[] } | Lead[]>(
    `/api/v1/events/${eventId}/leads`,
    HEADERS,
  );
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch leads.' } };
  }
  const data = res.data;
  const raw = Array.isArray(data) ? data : (data as { leads: Lead[] }).leads ?? [];
  return { success: true, data: raw.map(l => normalizeLead(l as Lead & { timestamp: Date | string })) };
}

/**
 * PUT /api/v1/events/:eventId/leads/:id
 * Updates notes, tags, or priority for an existing lead.
 */
export async function updateLeadApi(
  eventId: string | number,
  id: string,
  updates: Partial<Pick<Lead, 'notes' | 'tags' | 'priority'>>,
): Promise<SaveLeadResponse> {
  if (USE_MOCK) {
    await delay(500);
    const idx = mockLeads.findIndex(l => l.id === id);
    if (idx !== -1) {
      mockLeads[idx] = { ...mockLeads[idx], ...updates };
      return { success: true, data: mockLeads[idx] };
    }
    return { success: true };
  }

  const res = await apiPut<Lead>(
    `/api/v1/events/${eventId}/leads/${id}`,
    updates,
    HEADERS,
  );
  if (!res.success) {
    return { success: false, error: res.error ?? { code: 'UPDATE_FAILED', message: 'Failed to update lead.' } };
  }
  return {
    success: true,
    data: res.data ? normalizeLead(res.data as Lead & { timestamp: Date | string }) : undefined,
  };
}

// ─── Lucky Draw ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/events/:eventId/leads/draw
 * Selects a winner server-side from the user's lead pool.
 */
export async function triggerLuckyDraw(
  eventId: string | number,
  params: { giveawayId?: string; excludeIds?: string[] },
): Promise<LuckyDrawResponse> {
  if (USE_MOCK) {
    await delay(1200);
    const pool = mockLeads.filter(l => !params.excludeIds?.includes(l.id));
    if (pool.length === 0) {
      return { success: false, error: { code: 'EMPTY_POOL', message: 'No eligible participants in the draw pool.' } };
    }
    const winner = pool[Math.floor(Math.random() * pool.length)];
    return {
      success: true,
      data: {
        id: winner.id,
        name: winner.name,
        company: winner.company,
        title: winner.title,
        avatar: winner.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(winner.name)}&background=7c3aed&color=fff`,
      },
    };
  }

  const res = await apiPost<DrawWinner>(
    `/api/v1/events/${eventId}/leads/draw`,
    params,
    HEADERS,
  );
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'DRAW_FAILED', message: 'Failed to select a winner.' } };
  }
  return { success: true, data: res.data };
}
