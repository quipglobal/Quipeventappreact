/**
 * Leads (Sponsor Badge Scan) API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   POST /api/leads/scan                → { code, name, company, title, notes, tags, priority, avatar }
 *                                       → { success, lead }
 *   GET  /api/leads                                                       → { leads }
 *   PUT  /api/leads/:id                 → { notes, tags, priority }       → { success, lead }
 *   POST /api/leads/draw                → { giveawayId?, excludeIds? }    → { success, winner }
 *
 * Set VITE_USE_MOCK_API=true in .env to run without a live backend.
 */

import { apiGet, apiPost, apiPut } from './client';
import type { Lead } from '@/app/context/AppContext';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const delay = (ms = 700) => new Promise<void>(r => setTimeout(r, ms));

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SaveLeadPayload {
  code: string;
  name: string;
  company: string;
  title: string;
  notes: string;
  tags: string[];
  priority: 'hot' | 'warm' | 'cold';
  avatar?: string;
}

export interface SaveLeadResponse {
  success: boolean;
  data?: Lead;
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
 * POST /api/leads/scan
 * Submits a scanned QR badge payload to create a lead on the backend.
 */
export async function scanBadgeLead(payload: SaveLeadPayload): Promise<SaveLeadResponse> {
  if (USE_MOCK) {
    await delay(800);

    const newLead: Lead = {
      ...payload,
      id: `lead-${Date.now()}`,
      timestamp: new Date(),
    };
    mockLeads.unshift(newLead);
    console.log(`[Mock] Lead created:`, newLead);
    return { success: true, data: newLead };
  }

  const res = await apiPost<Lead>('/api/leads/scan', payload);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'SCAN_FAILED', message: 'Failed to save scanned lead.' } };
  }
  return { success: true, data: normalizeLead(res.data as Lead & { timestamp: Date | string }) };
}

/**
 * GET /api/leads
 * Fetches all leads captured by the authenticated sponsor.
 */
export async function listLeads(): Promise<ListLeadsResponse> {
  if (USE_MOCK) {
    await delay(500);
    return { success: true, data: [...mockLeads] };
  }

  const res = await apiGet<{ leads: Lead[] } | Lead[]>('/api/leads');
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch leads.' } };
  }
  const data = res.data;
  const raw = Array.isArray(data) ? data : (data as { leads: Lead[] }).leads ?? [];
  return { success: true, data: raw.map(l => normalizeLead(l as Lead & { timestamp: Date | string })) };
}

/**
 * PUT /api/leads/:id
 * Updates notes, tags, or priority for an existing lead.
 */
export async function updateLeadApi(
  id: string,
  updates: Partial<Pick<Lead, 'notes' | 'tags' | 'priority'>>
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

  const res = await apiPut<Lead>(`/api/leads/${id}`, updates);
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
 * POST /api/leads/draw
 * Selects a winner server-side from the sponsor's lead pool.
 */
export async function triggerLuckyDraw(params: {
  giveawayId?: string;
  excludeIds?: string[];
}): Promise<LuckyDrawResponse> {
  if (USE_MOCK) {
    await delay(1200);

    const pool = mockLeads.filter(l => !params.excludeIds?.includes(l.id));
    if (pool.length === 0) {
      return { success: false, error: { code: 'EMPTY_POOL', message: 'No eligible participants in the draw pool.' } };
    }

    const winner = pool[Math.floor(Math.random() * pool.length)];
    console.log(`[Mock] Lucky draw winner:`, winner.name);
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

  const res = await apiPost<DrawWinner>('/api/leads/draw', params);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'DRAW_FAILED', message: 'Failed to select a winner.' } };
  }
  return { success: true, data: res.data };
}
