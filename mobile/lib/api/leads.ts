import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import { findMemberByBadgeCode, checkInMember } from '@/lib/api/audience';
import type { ApiResponse, Lead } from '@/lib/api/types';

const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

// Session-scoped flag mirroring the web `scanEndpointMissing` pattern.
// If the backend hasn't shipped the GET /events/:id/my-leads route yet, we
// set this on the first 404 and stop pestering the server. We also throw
// from listLeads() so React Query preserves whatever's already in cache
// (e.g. a lead the user just scanned and we optimistically inserted)
// instead of overwriting it with a `{success:false}` response.
let leadsListEndpointMissing = false;
let warnedListMissing = false;
let loggedFirstRaw = false;
let leadIdFallbackCounter = 0;

/**
 * Clear the session-scoped "list endpoint is missing" short-circuit. Call
 * this when there's reason to believe the backend may now have the route
 * deployed (e.g. on foreground wake from the background reconciler) so
 * the next `listLeads()` actually hits the network instead of throwing
 * immediately.
 */
export function resetLeadsListEndpointMissing(): void {
  leadsListEndpointMissing = false;
}

function normalizeLead(raw: any, index = 0): Lead {
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
  // Recursive, depth-limited, cycle-guarded search so shapes like
  // `attendee.user.name` or `lead.contact.email` still resolve.
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
  const email = pickString(raw?.email, profile?.email);
  const tsSource = raw?.scanned_at ?? raw?.created_at ?? raw?.timestamp;
  const ts = tsSource ? new Date(tsSource) : new Date();
  // Same id-fallback strategy as the web normalizer: probe nested
  // ids first, then generate a unique placeholder so multiple
  // id-less rows don't collapse to the same React key.
  // Excludes `scanner_user_id` on purpose — it's the *scanning* user
  // (always identical for every row in `/my-leads`) so using it would
  // collapse every card under the same React key.
  const idCandidate =
    raw?.id ?? raw?.lead_id ??
    raw?.attendee_id ?? raw?.member_id ?? raw?.user_id ??
    profile?.id ?? raw?.code ?? raw?.badge_code ?? profile?.badge_code;
  const id = idCandidate != null && String(idCandidate).trim() !== ''
    ? String(idCandidate)
    : `lead-fallback-${Date.now()}-${++leadIdFallbackCounter}`;
  // priority and status are mirrors of each other on the v1 leads
  // endpoints — accept either field name from the backend, validate
  // against the allowed enum, and write both back so consumers can
  // pick whichever they prefer without an extra coalesce.
  const priorityRaw = String(raw?.priority ?? raw?.status ?? '').toLowerCase();
  const priority: Lead['status'] =
    priorityRaw === 'hot' || priorityRaw === 'warm' || priorityRaw === 'cold'
      ? priorityRaw
      : 'warm';
  // tags must be an array of strings; defensively coalesce malformed
  // backend responses (null, missing, mixed-type) to `[]` so callers
  // can iterate without guarding on every render.
  const tags: string[] = Array.isArray(raw?.tags)
    ? raw.tags.filter((t: unknown): t is string => typeof t === 'string')
    : [];
  return {
    id,
    name,
    title,
    company,
    email,
    scannedAt: (isNaN(ts.getTime()) ? new Date() : ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
    color: raw?.color ?? ACCENT_COLORS[index % ACCENT_COLORS.length],
    status: priority,
    priority,
    notes: typeof raw?.notes === 'string' ? raw.notes : undefined,
    tags,
    // Preserve the original badge code on the Lead so the reconciliation
    // flow can dedupe local-only leads against the server's view by code.
    code: raw?.code ?? raw?.badge_code ?? profile?.badge_code ?? undefined,
    pendingSync: raw?.pendingSync === true ? true : undefined,
  };
}

/**
 * Extra fields we surface from the scan response so the caller can:
 *  - award the actual server-side points (`pointsAwarded`)
 *  - tell the user whether the attendee was auto checked-in (`checkedIn`)
 *  - decide if a fallback `/members/:id/check-in` call is needed
 *    (`isCheckedIn`, `memberId`)
 */
export interface ScanResultExtras {
  pointsAwarded?: number;
  checkedIn?: boolean;
  isCheckedIn?: boolean;
  memberId?: number;
}

export async function listLeads(): Promise<ApiResponse<Lead[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Leads] listLeads eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };

  // Backend hasn't shipped GET /events/:id/my-leads yet — short-circuit
  // and throw so React Query's existing (optimistic) cache survives.
  if (leadsListEndpointMissing) {
    throw new Error('LEADS_LIST_NOT_IMPLEMENTED');
  }

  // `/my-leads` is the per-scanner endpoint: open to any event member,
  // filtered server-side to leads where `scanner_user_id = me`. This is
  // the right shape for the mobile leads tab — every member sees only
  // their own scans for the current event. The previous `/leads` route
  // was sponsor-rep-gated and returned org-pooled leads, which is wrong
  // here (and 403'd for non-sponsor members).
  const res = await request<any>(`/api/v1/events/${eventId}/my-leads`);
  if (!res.success) {
    const msg = res.error?.message ?? '';
    // Laravel returns "The route ... could not be found." on a missing route.
    if (/could not be found|not found|404/i.test(msg)) {
      leadsListEndpointMissing = true;
      if (!warnedListMissing && __DEV__) {
        warnedListMissing = true;
        console.warn(
          '[Leads] GET /events/:id/my-leads returned 404. Falling back to local-only ' +
            'leads cache. Backend needs to register the my-leads index route to enable ' +
            'cross-device sync.',
        );
      }
      throw new Error('LEADS_LIST_NOT_IMPLEMENTED');
    }
    return res as ApiResponse<Lead[]>;
  }
  // Backend may return either a bare array, `{ data: [...] }`, or
  // `{ leads: [...] }` (Laravel API resources commonly wrap collections
  // under a named key). Pick the first array-shaped slot we find.
  // Validate with Array.isArray on each candidate so a `{ leads: {...} }`
  // object can't slip through and crash on `.map` below — and so an
  // unrecognized envelope returns a typed error instead of silently
  // rendering as empty (which would look identical to "no leads yet"
  // and hide a real backend regression).
  let raw: any[] | null = null;
  if (Array.isArray(res.data)) raw = res.data;
  else if (Array.isArray(res.data?.data)) raw = res.data.data;
  else if (Array.isArray(res.data?.leads)) raw = res.data.leads;
  if (raw === null) {
    if (__DEV__) {
      console.warn('[Leads] unrecognized list response shape:', res.data);
    }
    return {
      success: false,
      error: { code: 'LEADS_LIST_UNEXPECTED_SHAPE', message: 'Unexpected leads response.' },
    };
  }
  // Log the first raw row once per session so we can see what fields
  // the backend actually returns. If the list re-renders blank again
  // (no name/title/company), this log tells us which key the contact
  // profile lives under so we can extend the alias list above.
  if (__DEV__ && !loggedFirstRaw && raw.length > 0) {
    loggedFirstRaw = true;
    console.log('[Leads] first raw lead row from backend:', raw[0]);
  }
  return { success: true, data: raw.map((r, i) => normalizeLead(r, i)) };
}

export interface ScanPayload {
  badgeData?: string;
  attendeeId?: string;
  name?: string;
  company?: string;
  title?: string;
  eventId?: string;
}

/**
 * Heuristic: was this server error a "badge code didn't match any attendee"
 * rejection (vs. a generic 500, auth issue, etc)? When true, we fall back to
 * a client-side audience scan so case-sensitivity, whitespace, or a backend
 * lookup quirk don't strand the sponsor.
 */
function isAttendeeNotFoundError(err?: { code?: string; message?: string }): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === 'ATTENDEE_NOT_FOUND' ||
    err.code === 'NOT_FOUND' ||
    msg.includes('no attendee') ||
    msg.includes('not in audience') ||
    (msg.includes('badge') && msg.includes('not'))
  );
}

export async function submitScan(
  payload: ScanPayload,
): Promise<ApiResponse<Lead & ScanResultExtras>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Leads] submitScan eventId=${eventId} payload=`, payload);
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const code = (payload.badgeData ?? '').trim();
  if (!code) {
    return { success: false, error: { code: 'INVALID_CODE', message: 'Empty badge code.' } };
  }

  // Match the web client + Task #11 backend contract: POST to
  // /api/v1/events/:eventId/leads/scan with `{ code }`. The backend resolves
  // the attendee, auto check-ins, persists the lead row, and returns
  // `pointsAwarded` (0 on duplicate scans) so the report tabs see all scans.
  const res = await request<any>(`/api/v1/events/${eventId}/leads/scan`, {
    method: 'POST',
    body: JSON.stringify({
      code,
      // Optional client hints — server prefers its own canonical resolution.
      name: payload.name,
      company: payload.company,
      title: payload.title,
    }),
  });

  if (res.success && res.data) {
    const raw = res.data as any;
    const lead = normalizeLead(raw);
    const pointsAwarded =
      typeof raw.pointsAwarded === 'number' ? raw.pointsAwarded :
      typeof raw.points_awarded === 'number' ? raw.points_awarded :
      undefined;
    const checkedIn =
      typeof raw.checkedIn === 'boolean' ? raw.checkedIn :
      typeof raw.checked_in === 'boolean' ? raw.checked_in :
      undefined;
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

  // Server rejected the badge code. If it's the specific "no attendee found"
  // case, fall back to a client-side audience scan (case-insensitive). This
  // mirrors web's findMemberByBadgeCodeApi safety net so a sponsor still
  // captures the lead even when the backend lookup is overly strict.
  if (isAttendeeNotFoundError(res.error)) {
    if (__DEV__) console.log(`[Leads] submitScan fallback: scanning audience for code=${code}`);
    const member = await findMemberByBadgeCode(eventId, code);
    if (member) {
      // Best-effort auto check-in (mirrors web behaviour).
      let didCheckIn = false;
      if (member.memberId && !member.isCheckedIn) {
        didCheckIn = await checkInMember(eventId, member.memberId);
      }
      const lead = normalizeLead({
        id: member.memberId ?? member.userId ?? code,
        name: member.name,
        title: member.title,
        company: member.company,
        email: member.email,
        code,
      });
      return {
        success: true,
        data: {
          // Mark as pending so the reconciliation step in useLeads can push
          // it back to /leads/scan once the leads-list endpoint is reachable
          // and dedupe it with the server's canonical row.
          ...lead,
          // Preserve the badge code so the UI can later retry the
          // /leads/scan POST without making the user re-scan.
          code,
          // Server didn't persist a lead row (it rejected the badge),
          // so flag this lead as locally-only. The Leads tab shows a
          // "Saved on this device" indicator and a Retry-sync action.
          pendingSync: true,
          pointsAwarded: 0, // server didn't award; we don't double-credit
          checkedIn: didCheckIn || member.isCheckedIn,
          isCheckedIn: didCheckIn || member.isCheckedIn,
          memberId: member.memberId ?? undefined,
        },
      };
    }
    // Truly not in the audience for this event — clearer message than the
    // raw backend "No attendee found for this badge code".
    return {
      success: false,
      error: {
        code: 'ATTENDEE_NOT_IN_AUDIENCE',
        message: `Badge "${code}" isn't in this event's audience. Ask the organizer to add the attendee, then try again.`,
      },
    };
  }

  return res as ApiResponse<Lead & ScanResultExtras>;
}

/**
 * Pushes a single locally-saved (pendingSync) lead to the backend now that
 * the leads-list endpoint is reachable. On success, returns the canonical
 * server-side Lead so the caller can swap the synthetic id for the server
 * id and clear `pendingSync`. On any failure (or when the server can still
 * not resolve the badge), returns null so the caller leaves the lead
 * pending and tries again next time.
 */
export async function reconcilePendingLead(local: Lead): Promise<Lead | null> {
  if (!local.pendingSync) return null;
  // Need a badge code to resubmit; if we don't have one we can't reconcile.
  const code = local.code ?? '';
  if (!code) return null;
  const res = await submitScan({
    badgeData: code,
    name: local.name,
    company: local.company,
    title: local.title,
  });
  if (!res.success || !res.data) return null;
  // Re-using submitScan means a fallback that hit the audience-list path
  // again will return another `pendingSync: true` lead — don't treat that
  // as a successful reconciliation, otherwise we'd churn the cache without
  // making progress.
  if (res.data.pendingSync) return null;
  return res.data;
}

export async function updateLeadStatus(leadId: string, status: Lead['status']): Promise<ApiResponse<Lead>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  return request<Lead>(`/api/v1/events/${eventId}/leads/${leadId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

/**
 * Session-scoped short-circuit mirroring the `leadsListEndpointMissing`
 * pattern: once the backend confirms the PUT `/leads/:id` update route
 * isn't deployed (404/405), we stop round-tripping for the rest of the
 * session. The local optimistic edit + AsyncStorage overlay in
 * `useUpdateLead` keeps the user's change regardless, so short-circuiting
 * here just avoids pestering the backend. Reset on event switch via
 * `resetLeadsUpdateEndpointMissing`.
 */
let leadsUpdateEndpointMissing = false;

export function resetLeadsUpdateEndpointMissing(): void {
  leadsUpdateEndpointMissing = false;
}

export interface LeadEdits {
  notes?: string;
  tags?: string[];
  priority?: 'hot' | 'warm' | 'cold';
}

/**
 * PUT /api/v1/events/:eventId/leads/:id
 * Updates notes, tags, and/or priority for an existing lead. `priority`
 * and `status` are mirrors on the v1 leads endpoints, so we send both so
 * the change round-trips regardless of which field the backend reads.
 *
 * Callers persist the edit optimistically and to the AsyncStorage overlay
 * independently, so a NOT_IMPLEMENTED response here does NOT lose the
 * user's change — it just means it won't sync cross-device yet.
 */
export async function updateLead(leadId: string, updates: LeadEdits): Promise<ApiResponse<Lead>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  if (leadsUpdateEndpointMissing) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Lead update endpoint not deployed.' } };
  }
  const body: Record<string, unknown> = {};
  if (updates.notes !== undefined) body.notes = updates.notes;
  if (updates.tags !== undefined) body.tags = updates.tags;
  if (updates.priority !== undefined) {
    body.priority = updates.priority;
    body.status = updates.priority;
  }
  const res = await request<Lead>(`/api/v1/events/${eventId}/leads/${leadId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.success) {
    const msg = res.error?.message ?? '';
    if (/could not be found|not found|404|405|not supported/i.test(msg)) {
      leadsUpdateEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Lead update endpoint not deployed.' } };
    }
  }
  return res;
}

/**
 * POST /api/v1/events/:eventId/leads/draw
 * Picks a random winner from the current event's leads (optional giveawayId scopes the pool).
 * Matches BACKEND_SCAN_ENDPOINTS.md §5.
 */
export async function triggerLuckyDraw(giveawayId?: string): Promise<ApiResponse<{ winner: Lead }>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Leads] triggerLuckyDraw eventId=${eventId} giveawayId=${giveawayId}`);
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const body: Record<string, unknown> = {};
  if (giveawayId) {
    body.giveaway_id = giveawayId;
    body.giveawayId  = giveawayId;
  }
  return request<{ winner: Lead }>(`/api/v1/events/${eventId}/leads/draw`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
