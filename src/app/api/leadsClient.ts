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

import { apiGet, apiPost, apiPut, apiPatch } from './client';
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
  data?: Lead & {
    pointsAwarded?: number;
    /** True iff the backend just auto-checked-in the attendee on this scan. */
    checkedIn?: boolean;
    /** True iff the attendee is currently checked-in to the event (regardless
     *  of whether this scan is what flipped them). Used by the client to
     *  decide whether to call the explicit check-in fallback. */
    isCheckedIn?: boolean;
    memberId?: number;
  };
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

/**
 * Coerce a raw backend lead row into the strict `Lead` shape the UI
 * relies on.
 *
 * The Laravel backend serializes leads as a top-level lead row plus a
 * nested attendee/member object that holds the contact's profile
 * fields (mirrors how `meetings.ts` normalizes its rows). So the
 * raw shape is roughly:
 *   { id, code, scanned_at, notes, tags, priority,
 *     attendee: { name, title, company, email, avatar } }
 * Older mock and scan responses were flat (no nesting), and the
 * scan endpoint sometimes returns the contact under `member` or
 * `user`, so we probe several aliases for each visible field. The
 * UI also requires every defaulted field present (priority, tags,
 * timestamp) — without that, the leads list either crashes (the
 * priorityConfig lookup throws) or renders blank cards.
 */
function normalizeLead(raw: any): Lead {
  // Walk the raw row and find ANY nested object that looks like a
  // contact profile (has at least one of name/full_name/first_name/
  // email). This covers every Laravel naming convention the backend
  // might use without us having to guess: `attendee`, `member`,
  // `user`, `scanned_user`, `contact`, `lead`, `member_profile`,
  // `attendee_profile`, `scannedAttendee`, etc. Falls back to the
  // raw row itself for the legacy flat scan response.
  const isContactish = (o: any): boolean =>
    o && typeof o === 'object' && !Array.isArray(o) &&
    (typeof o.name === 'string' || typeof o.full_name === 'string' ||
     typeof o.first_name === 'string' || typeof o.email === 'string');
  // Recursive search up to a small depth so shapes like
  // `attendee.user.name`, `member.profile.name`, or `lead.contact.email`
  // still resolve. Cycle-guarded with a `seen` set; capped at depth 3
  // so we don't accidentally walk an entire JSON graph.
  const findContactProfile = (obj: any, depth: number, seen: Set<any>): any => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || seen.has(obj) || depth < 0) return null;
    if (isContactish(obj)) return obj;
    seen.add(obj);
    for (const v of Object.values(obj)) {
      const found = findContactProfile(v, depth - 1, seen);
      if (found) return found;
    }
    return null;
  };
  let profile: any = raw;
  if (raw && typeof raw === 'object') {
    // Prefer well-known keys in order (each searched recursively), then
    // fall back to any nested object that smells like a contact profile.
    const preferredRoots = [
      raw.attendee, raw.member, raw.user, raw.scanned_user,
      raw.scannedUser, raw.scannedAttendee, raw.contact, raw.lead,
      raw.attendee_profile, raw.member_profile,
    ];
    let picked: any = null;
    for (const root of preferredRoots) {
      picked = findContactProfile(root, 3, new Set());
      if (picked) break;
    }
    if (!picked) picked = findContactProfile(raw, 3, new Set());
    if (picked) profile = picked;
  }

  const pickString = (...candidates: unknown[]): string => {
    for (const v of candidates) {
      if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return '';
  };

  const name = pickString(
    raw?.name, profile?.name,
    raw?.full_name, profile?.full_name,
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' '),
    [raw?.first_name, raw?.last_name].filter(Boolean).join(' '),
  );
  const title = pickString(
    raw?.title, profile?.title,
    raw?.job_title, profile?.job_title,
    raw?.position, profile?.position,
  );
  const company = pickString(
    raw?.company, profile?.company,
    raw?.organization, profile?.organization,
    raw?.company_name, profile?.company_name,
  );
  const email = pickString(raw?.email, profile?.email) || undefined;
  const avatar = pickString(raw?.avatar, profile?.avatar, raw?.avatar_url, profile?.avatar_url) || undefined;

  const priorityRaw = (raw?.priority ?? raw?.status ?? '').toString().toLowerCase();
  const priority: Lead['priority'] =
    priorityRaw === 'hot' || priorityRaw === 'warm' || priorityRaw === 'cold'
      ? priorityRaw
      : 'warm';
  const tsSource = raw?.timestamp ?? raw?.scanned_at ?? raw?.created_at;
  const timestamp = tsSource instanceof Date
    ? tsSource
    : tsSource
      ? new Date(tsSource)
      : new Date();
  // Prefer real backend ids in order of specificity, but also accept
  // ids carried under the nested profile (`attendee.id`, etc) and the
  // backend's `attendee_id` foreign key. We deliberately exclude
  // `scanner_user_id` — that identifies the *scanning user* (i.e. me),
  // so it would be identical for every row in `/my-leads` and would
  // collapse all cards under one React key. As a last resort, generate
  // a deterministic-but-unique fallback so React's reconciler doesn't
  // collapse multiple rows under the same key (which would also break
  // dedupe by id and make the list look like one row repeated).
  const idCandidate =
    raw?.id ?? raw?.lead_id ??
    raw?.attendee_id ?? raw?.member_id ?? raw?.user_id ??
    profile?.id ?? raw?.code ?? raw?.badge_code ?? profile?.badge_code;
  const id = idCandidate != null && String(idCandidate).trim() !== ''
    ? String(idCandidate)
    : `lead-fallback-${Date.now()}-${++leadIdFallbackCounter}`;

  return {
    id,
    code: String(raw?.code ?? raw?.badge_code ?? profile?.badge_code ?? ''),
    name,
    company,
    title,
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
    timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
    avatar,
    tags: Array.isArray(raw?.tags) ? raw.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
    priority,
    pendingSync: raw?.pendingSync === true ? true : undefined,
    email,
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
/**
 * Session-scoped flag: once the backend confirms `/leads/scan` is not yet
 * deployed (HTTP 404), we skip the round-trip on subsequent scans. The
 * SponsorScannerPage already has a graceful audience-list fallback path.
 */
let scanEndpointMissing = false;
let loggedFirstRawLead = false;
let leadIdFallbackCounter = 0;

/**
 * Clear the session-scoped "scan endpoint is missing" short-circuit. Call
 * this when there's evidence the backend may have come online since the
 * flag was set (e.g. a successful `GET /leads` round-trip), so subsequent
 * reconciliation pushes actually hit the network instead of being silently
 * dropped.
 */
export function resetScanEndpointMissing(): void {
  scanEndpointMissing = false;
}

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

  if (scanEndpointMissing) {
    return {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Scan endpoint not deployed.' },
    };
  }

  const res = await apiPost<Lead & {
    pointsAwarded?: number;
    points_awarded?: number;
    checkedIn?: boolean;
    checked_in?: boolean;
    isCheckedIn?: boolean;
    is_checked_in?: boolean;
    memberId?: number;
    member_id?: number;
  }>(
    `/api/v1/events/${eventId}/leads/scan`,
    payload,
    HEADERS,
  );
  if (!res.success || !res.data) {
    // If the backend hasn't deployed `/leads/scan` yet (404), remember that
    // for the rest of the session so we don't keep round-tripping. Surface a
    // distinct error code so callers can degrade gracefully (audience-list
    // fallback + local-only save) instead of alerting the raw Laravel
    // "route ... could not be found" message.
    if (res.error?.code === '404') {
      scanEndpointMissing = true;
      return {
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Scan endpoint not deployed.' },
      };
    }
    return { success: false, error: res.error ?? { code: 'SCAN_FAILED', message: 'Failed to save scanned lead.' } };
  }
  const raw = res.data as Lead & {
    timestamp: Date | string;
    pointsAwarded?: number;
    points_awarded?: number;
    checkedIn?: boolean;
    checked_in?: boolean;
    isCheckedIn?: boolean;
    is_checked_in?: boolean;
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
  // `isCheckedIn` reflects current state; `checkedIn` reflects "we just did it
  // on this scan". If the server says it just checked them in, that also
  // implies they're now checked-in.
  const isCheckedIn =
    typeof raw.isCheckedIn === 'boolean' ? raw.isCheckedIn :
    typeof raw.is_checked_in === 'boolean' ? raw.is_checked_in :
    checkedIn === true ? true :
    undefined;
  const memberId =
    typeof raw.memberId === 'number' ? raw.memberId :
    typeof raw.member_id === 'number' ? raw.member_id :
    undefined;
  return { success: true, data: { ...lead, pointsAwarded, checkedIn, isCheckedIn, memberId } };
}

/**
 * GET /api/v1/events/:eventId/my-leads
 * Fetches the leads the authenticated user personally scanned at this event.
 *
 * Backend contract (Task #(backend my-leads)): the route is open to any
 * event member (not just sponsor reps), and the controller filters on
 * `scanner_user_id = auth()->id()` so a member can only ever see their
 * own scans. The previous `/leads` route was sponsor-rep-gated and
 * returned the org's pooled leads — wrong shape for this UI, and 403
 * for non-sponsor members.
 */
export async function listLeads(eventId: string | number): Promise<ListLeadsResponse> {
  if (USE_MOCK) {
    await delay(500);
    return { success: true, data: [...mockLeads] };
  }

  const res = await apiGet<{ leads: Lead[] } | { data: Lead[] } | Lead[]>(
    `/api/v1/events/${eventId}/my-leads`,
    HEADERS,
  );
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch leads.' } };
  }
  // Pick the first array-shaped slot in the response. Backend may return
  // a bare array, `{ data: [...] }` (Laravel resource collection), or
  // `{ leads: [...] }`. We validate each candidate with Array.isArray
  // so a malformed object envelope can't slip through and crash the map
  // below — and so an unrecognized shape returns a typed error rather
  // than rendering as "no leads yet" and hiding a backend regression.
  const data = res.data as Lead[] | { data?: Lead[] } | { leads?: Lead[] };
  let raw: Lead[] | null = null;
  if (Array.isArray(data)) raw = data;
  else if (Array.isArray((data as { data?: Lead[] }).data)) raw = (data as { data: Lead[] }).data;
  else if (Array.isArray((data as { leads?: Lead[] }).leads)) raw = (data as { leads: Lead[] }).leads;
  if (raw === null) {
    if (typeof console !== 'undefined') {
      console.warn('[leadsClient] unrecognized list response shape:', data);
    }
    return { success: false, error: { code: 'LIST_FAILED', message: 'Unexpected leads response.' } };
  }
  // One-time raw-row dump so any remaining shape mismatch (e.g. the
  // contact profile lives under a key we don't probe yet) is
  // discoverable from the browser console without having to attach
  // a debugger. Gated to Vite's `import.meta.env.DEV` because lead
  // rows contain PII (name/email/notes) and we do NOT want this
  // landing in production error-tracking. Uses console.error because
  // our dev log capture only retains error-level entries; this is
  // explicitly *not* an error, just a diagnostic dump.
  const isDev = (() => {
    try { return Boolean((import.meta as any)?.env?.DEV); } catch { return false; }
  })();
  if (isDev && !loggedFirstRawLead && raw.length > 0 && typeof console !== 'undefined') {
    loggedFirstRawLead = true;
    try {
      console.error(
        '[leadsClient] first raw lead row from backend (DIAG, not an error):',
        JSON.stringify(raw[0]),
      );
    } catch {
      console.error('[leadsClient] first raw lead row from backend (unstringifiable):', raw[0]);
    }
  }
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
 * Session-scoped short-circuit: the live Laravel backend doesn't have a
 * dedicated `/leads/draw` route. POST returns 405 (the only registered
 * verb for `/leads/{scanId}` is PATCH), and PATCH crashes inside
 * `MobileEventController::leadsUpdate` because Laravel matches the
 * literal string "draw" against the typed `int $scanId` route param
 * ("Argument #3 ($scanId) must be of type int, string given").
 *
 * Until the backend ships an actual draw endpoint, we detect any of
 * those signatures on the first call and remember it for the rest of
 * the session, so subsequent draws skip the round-trip and go straight
 * to the client-side fallback in `SponsorDrawPage`.
 */
let drawEndpointMissing = false;

/** A heuristic check: does this error look like "the draw route doesn't exist"? */
function isMissingDrawRouteError(error: { code?: string; message?: string } | undefined): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  // 404 = no such route. 405 = wrong verb (Laravel reports allowed methods).
  // 500 with the int-cast TypeError = "draw" matched `/leads/{scanId int}`.
  if (code === '404' || code === '405') return true;
  const msg = (error.message ?? '').toLowerCase();
  if (msg.includes('leadsupdate') && msg.includes('int')) return true;
  if (msg.includes('method is not supported') && msg.includes('leads/draw')) return true;
  if (msg.includes('route') && msg.includes('leads/draw') && msg.includes('not')) return true;
  return false;
}

/**
 * POST /api/v1/events/:eventId/leads/draw
 *
 * Server-side draw is OPTIONAL per BACKEND_SCAN_ENDPOINTS.md, and the
 * live backend hasn't shipped it yet. We still attempt the call so the
 * draw is server-arbitrated the moment the backend gains the route, but
 * we degrade gracefully on the well-known "missing route" signatures
 * (see `isMissingDrawRouteError`) by returning a typed `NOT_IMPLEMENTED`
 * response — `SponsorDrawPage` interprets that as "do the draw locally".
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

  if (drawEndpointMissing) {
    return {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Draw endpoint not deployed.' },
    };
  }

  const res = await apiPost<DrawWinner>(
    `/api/v1/events/${eventId}/leads/draw`,
    params,
    HEADERS,
  );
  if (!res.success || !res.data) {
    if (isMissingDrawRouteError(res.error)) {
      drawEndpointMissing = true;
      return {
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Draw endpoint not deployed.' },
      };
    }
    return { success: false, error: res.error ?? { code: 'DRAW_FAILED', message: 'Failed to select a winner.' } };
  }
  return { success: true, data: res.data };
}
