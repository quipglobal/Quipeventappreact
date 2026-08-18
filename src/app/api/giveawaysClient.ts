import { apiGet, apiPost, apiPut, apiDelete, ApiEnvelope } from './client';
import { SponsorGiveaway } from '@/app/context/AppContext';

const HEADERS = { 'Accept': 'application/json' };

export interface ListGiveawaysResponse {
  success: boolean;
  data?: SponsorGiveaway[];
  error?: { code: string; message: string };
}

export interface SaveGiveawayResponse {
  success: boolean;
  data?: SponsorGiveaway;
  error?: { code: string; message: string };
}

export interface RemoveGiveawayResponse {
  success: boolean;
  error?: { code: string; message: string };
}

let listEndpointMissing = false;
let createEndpointMissing = false;
let updateEndpointMissing = false;
let deleteEndpointMissing = false;
let warnedListMissing = false;

export function resetGiveawaysEndpointMissing(): void {
  listEndpointMissing = false;
  createEndpointMissing = false;
  updateEndpointMissing = false;
  deleteEndpointMissing = false;
}

function pickString(...candidates: unknown[]): string {
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return '';
}

function pickNumber(...candidates: unknown[]): number {
  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  }
  return 0;
}

/**
 * Map a raw winner row from the backend into the local
 * `GiveawayWinner` shape. Tolerates a wide variety of field names
 * (camelCase, snake_case, nested `lead`/`attendee` payloads) so the
 * exact backend response shape doesn't have to be locked in before
 * the route ships. Returns `null` when we can't extract at least an
 * id+name — silently dropping malformed rows is safer than spraying
 * unnamed cards into the UI.
 */
function normalizeWinner(raw: any): { id: string; name: string; company?: string; title?: string; avatar?: string; drawnAt: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const lead = raw.lead ?? raw.attendee ?? raw.user ?? null;
  const id = String(
    raw.id ?? raw.winner_id ?? raw.winnerId ?? raw.lead_id ?? raw.leadId ??
      lead?.id ?? lead?.uuid ?? '',
  );
  const name = pickString(
    raw.name, raw.winner_name, raw.winnerName, raw.full_name, raw.fullName,
    lead?.name, lead?.full_name, lead?.fullName,
  );
  if (!id || !name) return null;
  const drawnSource =
    raw.drawn_at ?? raw.drawnAt ?? raw.created_at ?? raw.createdAt ?? raw.timestamp;
  const drawnAt = drawnSource ? new Date(drawnSource) : new Date();
  return {
    id,
    name,
    company: pickString(raw.company, raw.company_name, raw.companyName, lead?.company, lead?.company_name) || undefined,
    title: pickString(raw.title, raw.job_title, raw.jobTitle, lead?.title, lead?.job_title) || undefined,
    avatar: pickString(raw.avatar, raw.avatar_url, raw.avatarUrl, raw.photo, raw.photo_url, lead?.avatar, lead?.avatar_url) || undefined,
    drawnAt: (isNaN(drawnAt.getTime()) ? new Date() : drawnAt).toISOString(),
  };
}

function normalizeGiveaway(raw: any): SponsorGiveaway {
  const tsSource = raw?.created_at ?? raw?.createdAt ?? raw?.created ?? raw?.timestamp;
  const createdAt = tsSource ? new Date(tsSource) : new Date();

  // ── Winners ──────────────────────────────────────────────────────────────
  // The admin/sponsor endpoint returns a single `winner` object (non-null once
  // drawn) plus a flat `winner_name` string.  Older/custom shapes may use
  // plural arrays (`winners`, `winner_list`, etc.).  We normalise all shapes
  // into the same `winners` array that AppContext expects.
  const rawWinners: unknown =
    raw?.winners ?? raw?.winner_list ?? raw?.winnersList ?? raw?.draws ?? raw?.draw_history;
  let winners: Array<{ id: string; name: string; company?: string; title?: string; avatar?: string; drawnAt: string; userId?: string }> = [];
  if (Array.isArray(rawWinners)) {
    winners = rawWinners.map(normalizeWinner).filter(Boolean) as typeof winners;
  } else if (raw?.winner && typeof raw.winner === 'object' && raw.winner.id) {
    // Single winner object from the admin endpoint (non-null once DRAWN).
    const w = raw.winner;
    winners = [{
      id:      String(w.id),
      userId:  String(w.id),   // winner.id IS the user_id from the backend
      name:    String(w.name ?? raw.winner_name ?? ''),
      company: w.company ? String(w.company) : undefined,
      title:   w.title   ? String(w.title)   : undefined,
      avatar:  w.avatar  ? String(w.avatar)  : undefined,
      drawnAt: String(raw?.drawn_at ?? raw?.drawnAt ?? new Date().toISOString()),
    }];
  } else if (raw?.winner_name && raw?.winner_user_id) {
    // Flat winner fields without a nested object.
    winners = [{
      id:      String(raw.winner_user_id),
      userId:  String(raw.winner_user_id),
      name:    String(raw.winner_name),
      drawnAt: String(raw?.drawn_at ?? raw?.drawnAt ?? new Date().toISOString()),
    }];
  }

  // ── Sponsor / company identity ────────────────────────────────────────────
  // The admin endpoint returns `company_id` + `company_name`; older shapes
  // used `sponsor_id` / `sponsor_name`.  Prefer the new canonical fields.
  const sponsorId = String(
    raw?.company_id ?? raw?.sponsorId ?? raw?.sponsor_id ??
    raw?.sponsor?.id ?? raw?.created_by_user_id ?? raw?.user_id ?? raw?.created_by ?? '',
  );
  const sponsorName = pickString(
    raw?.company_name,
    raw?.sponsorName,
    raw?.sponsor_name,
    raw?.sponsor?.name,
    raw?.sponsor?.company_name,
  );

  return {
    id: String(raw?.id ?? raw?.giveaway_id ?? raw?.uuid ?? `giveaway-${Date.now()}`),
    title: pickString(raw?.title, raw?.name, raw?.prize, raw?.label),
    numberOfItems: pickNumber(
      raw?.numberOfItems,
      raw?.number_of_items,
      raw?.totalCount,
      raw?.total_count,
      raw?.prizeCount,
      raw?.prize_count,
      raw?.itemsCount,
      raw?.items_count,
      raw?.totalItems,
      raw?.total_items,
      raw?.total_available,
      raw?.totalAvailable,
      raw?.quantity,
      raw?.count,
      raw?.total,
      raw?.entries_total,
    ),
    image: pickString(raw?.image, raw?.image_url, raw?.imageUrl, raw?.photo, raw?.photo_url),
    createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
    sponsorName,
    sponsorId,
    addedByName: pickString(
      raw?.addedByName,
      raw?.added_by_name,
      raw?.creator_name,
      raw?.creatorName,
      raw?.added_by,
      raw?.user?.name,
      raw?.creator?.name,
    ) || undefined,
    // Only attach `winners` when we actually have backend rows so we
    // don't override the localStorage overlay merge with an empty
    // array on giveaways the backend hasn't tracked yet.
    ...(winners.length > 0 ? { winners } : {}),
  };
}

/**
 * GET /api/v1/events/:eventId/giveaways
 *
 * Backend may return either a bare array, `{ data: [...] }`, or
 * `{ giveaways: [...] }` (Laravel API resources commonly wrap
 * collections under a named key). We probe each shape.
 *
 * If the backend hasn't deployed the route yet (404), we set a
 * session-scoped flag so subsequent calls short-circuit, and surface
 * a typed error so callers can fall back to local-only state — same
 * pattern as `leadsClient.listLeads`.
 */
export async function listGiveaways(eventId: string | number): Promise<ListGiveawaysResponse> {
  if (listEndpointMissing) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaways list endpoint not deployed.' } };
  }
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/giveaways`, HEADERS);
  if (!res.success || !res.data) {
    if (res.error?.code === '404') {
      listEndpointMissing = true;
      if (!warnedListMissing && typeof console !== 'undefined') {
        warnedListMissing = true;
        console.warn(
          '[giveawaysClient] GET /events/:id/giveaways returned 404. Falling back to local-only ' +
            'sponsor giveaways. Backend needs to register the route to enable cross-device sync.',
        );
      }
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaways list endpoint not deployed.' } };
    }
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch giveaways.' } };
  }
  const data = res.data as any;
  let raw: any[] | null = null;
  if (Array.isArray(data)) raw = data;
  else if (Array.isArray(data?.data)) raw = data.data;
  else if (Array.isArray(data?.giveaways)) raw = data.giveaways;
  if (raw === null) {
    if (typeof console !== 'undefined') {
      console.warn('[giveawaysClient] unrecognized list response shape:', data);
    }
    return { success: false, error: { code: 'LIST_FAILED', message: 'Unexpected giveaways response.' } };
  }
  return { success: true, data: raw.map(normalizeGiveaway) };
}

export interface CreateGiveawayPayload {
  title: string;
  numberOfItems: number;
  image: string;
  sponsorName: string;
  sponsorId: string;
  /**
   * The integer company id of the sponsoring company — what the backend stores
   * as `company_id`. Required for sponsor reps (admins may omit it).
   */
  companyId?: number | null;
  /** Display name of the rep who added this giveaway. */
  addedByName?: string;
}

/**
 * POST /api/v1/events/:eventId/giveaways
 *
 * Sends both camelCase and snake_case versions of each field so the
 * backend can accept whichever convention it uses without a contract
 * change here. The image is sent as a data-URL string; the backend
 * is free to persist it as-is or transcode to its own asset store.
 */
export async function createGiveaway(
  eventId: string | number,
  payload: CreateGiveawayPayload,
): Promise<SaveGiveawayResponse> {
  if (createEndpointMissing) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway create endpoint not deployed.' } };
  }
  // company_id is the canonical field the backend requires for sponsor reps.
  // We also send the legacy sponsor_id / sponsorId aliases for older backend
  // versions that haven't migrated to the company-based model yet.
  const itemCount = payload.numberOfItems;
  const companyIdVal = payload.companyId != null ? Number(payload.companyId) : undefined;
  const body: Record<string, unknown> = {
    title: payload.title,
    // Company / sponsor identity — canonical field first.
    ...(companyIdVal != null ? { company_id: companyIdVal } : {}),
    sponsor_name: payload.sponsorName,
    sponsorName: payload.sponsorName,
    sponsor_id: payload.sponsorId,
    sponsorId: payload.sponsorId,
    added_by_name: payload.addedByName ?? '',
    addedByName: payload.addedByName ?? '',
    creator_name: payload.addedByName ?? '',
    creatorName: payload.addedByName ?? '',
    // Item count — every known field-name variant.
    number_of_items: itemCount,
    total_count:     itemCount,
    prize_count:     itemCount,
    items_count:     itemCount,
    total_items:     itemCount,
    numberOfItems:   itemCount,
    totalCount:      itemCount,
    prizeCount:      itemCount,
    itemsCount:      itemCount,
    totalItems:      itemCount,
    quantity:        itemCount,
    count:           itemCount,
    image: payload.image,
    image_url: payload.image,
  };
  const res = await apiPost<unknown>(`/api/v1/events/${eventId}/giveaways`, body, HEADERS);
  if (!res.success || !res.data) {
    // 404 = route not registered; 405 = route exists but POST verb not mapped.
    // Both mean the endpoint isn't ready — fall back to local-only rather than
    // rolling back the optimistic row (mirrors how `updateGiveaway` handles 405).
    if (res.error?.code === '404' || res.error?.code === '405') {
      createEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway create endpoint not deployed.' } };
    }
    // Backend accepted the request (2xx) but returned no `data` body — the row
    // was likely created server-side; we just can't do the id swap. Surface as
    // NOT_IMPLEMENTED so the caller keeps the optimistic row with the temp id.
    if (res.success && !res.data) {
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway create endpoint returned no data body.' } };
    }
    return { success: false, error: res.error ?? { code: 'CREATE_FAILED', message: 'Failed to save giveaway.' } };
  }
  // Some Laravel resources return the row at the top level, others wrap
  // it under `{ data: {...} }`. Normalize either shape.
  const raw = (res.data as any)?.data ?? res.data;
  return { success: true, data: normalizeGiveaway(raw) };
}

export interface UpdateGiveawayPayload {
  title?: string;
  numberOfItems?: number;
  image?: string;
}

/**
 * PUT /api/v1/events/:eventId/giveaways/:giveawayId
 *
 * Used by the sponsor "edit giveaway" flow. The Laravel backend
 * registers this route with PUT (not PATCH) — sending PATCH gets
 * back a 405 "The PATCH method is not supported for route ...
 * Supported methods: GET, HEAD, PUT, DELETE." Mirrors
 * `createGiveaway` in sending both camelCase and snake_case so
 * either backend convention works without a contract change here.
 * Because we send a full PUT, we still only include the fields the
 * caller actually wants to change — anything omitted is implicitly
 * left untouched on the server (Laravel's `validated()` ignores
 * absent keys when they're marked `sometimes`).
 *
 * On 405 we also tag the endpoint as missing so a single legacy
 * deployment that only supports a different verb degrades to local-
 * only updates instead of erroring on every save.
 */
export async function updateGiveaway(
  eventId: string | number,
  giveawayId: string,
  payload: UpdateGiveawayPayload,
): Promise<SaveGiveawayResponse> {
  if (updateEndpointMissing) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway update endpoint not deployed.' } };
  }
  // Treat synthetic ids (rows that never round-tripped through the
  // backend) as "no canonical row to update". The caller will fall
  // back to a local-only state mutation.
  if (giveawayId.startsWith('giveaway-')) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway is local-only — backend create did not complete.' } };
  }
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) {
    body.title = payload.title;
  }
  if (payload.numberOfItems !== undefined) {
    const n = payload.numberOfItems;
    body.number_of_items = n;
    body.numberOfItems   = n;
    body.quantity        = n;
    body.count           = n;
    body.total_count     = n;
    body.totalCount      = n;
    body.prize_count     = n;
    body.prizeCount      = n;
    body.items_count     = n;
    body.itemsCount      = n;
    body.total_items     = n;
    body.totalItems      = n;
  }
  if (payload.image !== undefined) {
    body.image = payload.image;
    body.image_url = payload.image;
  }
  const res = await apiPut<unknown>(`/api/v1/events/${eventId}/giveaways/${giveawayId}`, body);
  if (!res.success || !res.data) {
    if (res.error?.code === '404' || res.error?.code === '405') {
      updateEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway update endpoint not deployed.' } };
    }
    return { success: false, error: res.error ?? { code: 'UPDATE_FAILED', message: 'Failed to update giveaway.' } };
  }
  const raw = (res.data as any)?.data ?? res.data;
  return { success: true, data: normalizeGiveaway(raw) };
}

// ─── Winners ────────────────────────────────────────────────────────────────

export interface SaveWinnerPayload {
  /**
   * The backend user account id (integer as string) of the chosen winner —
   * sent as `winner_user_id` to the backend. This is the only field the
   * /winners endpoint accepts; the server resolves name/company from its own
   * user table.
   *
   * When the server picked the winner via /draw this is `DrawWinner.id`
   * (both are the same user_id). When the client picked locally from the leads
   * pool this should be `Lead.userId` (the user account id, NOT the scan_id).
   */
  userId: string;
  /** Display name — used only for local overlay; not sent to the server. */
  name: string;
  company?: string;
  title?: string;
  avatar?: string;
  /** ISO 8601 timestamp of when the draw resolved — local only. */
  drawnAt: string;
}

export interface SaveWinnerResponse {
  success: boolean;
  error?: { code: string; message: string };
}

/**
 * POST /api/v1/events/:eventId/giveaways/:giveawayId/winners
 *
 * Records a winner on the backend. Contract (from backend agent):
 *   • Only accepts `{ winner_user_id: integer }`.
 *   • winner_user_id must already have an entry in the giveaway
 *     (created automatically via scan when auto_enter_on_scan is true,
 *     or via manual entry). Returns 422 NO_ENTRY if not.
 *   • Idempotent: if the giveaway is already DRAWN, returns 200 with
 *     was_already_drawn: true and the existing winner rather than an error.
 *
 * Failures are non-fatal — the localStorage overlay is the source of
 * truth for this device and the UX never blocks on this call.
 *
 * Synthetic giveaway ids (created locally, never round-tripped through
 * the backend) skip the call — there's no canonical row to attach to yet.
 */
export async function saveGiveawayWinner(
  eventId: string | number,
  giveawayId: string,
  winner: SaveWinnerPayload,
): Promise<SaveWinnerResponse> {
  if (giveawayId.startsWith('giveaway-')) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway is local-only — backend create did not complete.' } };
  }
  const winnerUserId = parseInt(winner.userId, 10);
  if (!winnerUserId || isNaN(winnerUserId)) {
    // No valid integer user id — can't satisfy the backend contract.
    // The localStorage overlay still has the win; just skip the API call.
    return { success: false, error: { code: 'NO_USER_ID', message: 'Winner has no backend user id — cannot POST to /winners.' } };
  }
  const body = { winner_user_id: winnerUserId };
  const res = await apiPost<unknown>(
    `/api/v1/events/${eventId}/giveaways/${giveawayId}/winners`,
    body,
    HEADERS,
  );
  if (!res.success) {
    const code = String(res.error?.code ?? '');
    if (code === '404' || code === '405' || code === 'NotFoundHttpException' || code === 'MethodNotAllowedHttpException') {
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Save-winner endpoint not deployed.' } };
    }
    if (code === '422' || code === 'NO_ENTRY') {
      // Winner has no entry in the giveaway — log and degrade gracefully.
      if (typeof console !== 'undefined') {
        console.warn('[saveGiveawayWinner] winner_user_id', winnerUserId, 'has no entry in giveaway', giveawayId, '— 422 NO_ENTRY');
      }
      return { success: false, error: { code: 'NO_ENTRY', message: 'Winner has no entry in this giveaway.' } };
    }
    return { success: false, error: res.error ?? { code: 'SAVE_WINNER_FAILED', message: 'Failed to save winner.' } };
  }
  return { success: true };
}

// ─── Attendee giveaway list ───────────────────────────────────────────────────

export interface AttendeeGiveaway {
  id: string;
  title: string;
  description?: string;
  prize?: string;
  numberOfItems: number;
  image?: string;
  status: 'OPEN' | 'CLOSED' | 'DRAWN' | string;
  companyId?: number | null;
  companyName?: string;
  entryCount: number;
  hasEntered: boolean;
  isWinner: boolean;
  isDrawn: boolean;
  winner?: { id: number; name: string; email?: string; company?: string } | null;
  startsAt?: string | null;
  endsAt?: string | null;
  drawnAt?: string | null;
}

export interface ListAttendeeGiveawaysResponse {
  success: boolean;
  data?: AttendeeGiveaway[];
  error?: { code: string; message: string };
}

/**
 * GET /api/v1/events/:eventId/mobile-giveaways
 *
 * Attendee-facing giveaway list. Returns OPEN, CLOSED, and DRAWN giveaways
 * with attendee-specific flags (has_entered, is_winner, is_drawn, winner).
 * DRAFT giveaways are never returned. Behind event.member middleware — any
 * authenticated event member can call it.
 */
export async function listAttendeeGiveaways(eventId: string | number): Promise<ListAttendeeGiveawaysResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/mobile-giveaways`, HEADERS);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch giveaways.' } };
  }
  const data = res.data as any;
  let raw: any[] | null = null;
  if (Array.isArray(data)) raw = data;
  else if (Array.isArray(data?.data)) raw = data.data;
  if (!raw) {
    return { success: false, error: { code: 'LIST_FAILED', message: 'Unexpected giveaways response.' } };
  }
  const normalized: AttendeeGiveaway[] = raw.map((r: any) => ({
    id:           String(r.id ?? ''),
    title:        String(r.title ?? ''),
    description:  r.description ? String(r.description) : undefined,
    prize:        r.prize       ? String(r.prize)       : undefined,
    numberOfItems: Number(r.number_of_items ?? r.numberOfItems ?? 0),
    image:        r.image_url   ? String(r.image_url)   : undefined,
    status:       String(r.status ?? 'OPEN'),
    companyId:    r.company_id  != null ? Number(r.company_id) : null,
    companyName:  r.company_name ? String(r.company_name) : undefined,
    entryCount:   Number(r.entry_count ?? 0),
    hasEntered:   Boolean(r.has_entered),
    isWinner:     Boolean(r.is_winner),
    isDrawn:      Boolean(r.is_drawn ?? r.status === 'DRAWN'),
    winner:       r.winner ?? null,
    startsAt:     r.starts_at   ?? null,
    endsAt:       r.ends_at     ?? null,
    drawnAt:      r.drawn_at    ?? null,
  }));
  return { success: true, data: normalized };
}

/**
 * DELETE /api/v1/events/:eventId/giveaways/:giveawayId
 */
export async function removeGiveaway(
  eventId: string | number,
  giveawayId: string,
): Promise<RemoveGiveawayResponse> {
  if (deleteEndpointMissing) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway delete endpoint not deployed.' } };
  }
  const res = await apiDelete<unknown>(`/api/v1/events/${eventId}/giveaways/${giveawayId}`, HEADERS);
  if (!res.success) {
    if (res.error?.code === '404') {
      deleteEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway delete endpoint not deployed.' } };
    }
    return { success: false, error: res.error ?? { code: 'DELETE_FAILED', message: 'Failed to remove giveaway.' } };
  }
  return { success: true };
}
