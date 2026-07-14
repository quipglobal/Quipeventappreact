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
  // Backend may return winners under any of these keys depending on
  // how the API resource is shaped. We map them once here so the
  // AppContext merge can rely on `g.winners` being a real array.
  const rawWinners: unknown =
    raw?.winners ?? raw?.winner_list ?? raw?.winnersList ?? raw?.draws ?? raw?.draw_history;
  const winners = Array.isArray(rawWinners)
    ? (rawWinners.map(normalizeWinner).filter(Boolean) as Array<{ id: string; name: string; company?: string; title?: string; avatar?: string; drawnAt: string }>)
    : [];
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
    sponsorName: pickString(
      raw?.sponsorName,
      raw?.sponsor_name,
      raw?.sponsor?.name,
      raw?.sponsor?.company_name,
    ),
    sponsorId: String(
      raw?.sponsorId ?? raw?.sponsor_id ?? raw?.sponsor?.id ?? raw?.user_id ?? raw?.created_by ?? '',
    ),
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
  // Send every known field-name variant for the item count so the
  // backend can accept whichever column name its migration defined
  // (number_of_items, quantity, total_count, count, etc.).
  const itemCount = payload.numberOfItems;
  const body = {
    title: payload.title,
    // snake_case variants
    number_of_items: itemCount,
    total_count:     itemCount,
    prize_count:     itemCount,
    items_count:     itemCount,
    total_items:     itemCount,
    // camelCase variants
    numberOfItems:   itemCount,
    totalCount:      itemCount,
    prizeCount:      itemCount,
    itemsCount:      itemCount,
    totalItems:      itemCount,
    // bare "quantity" / "count" fallback
    quantity:        itemCount,
    count:           itemCount,
    image: payload.image,
    image_url: payload.image,
    sponsor_name: payload.sponsorName,
    sponsorName: payload.sponsorName,
    sponsor_id: payload.sponsorId,
    sponsorId: payload.sponsorId,
  };
  const res = await apiPost<unknown>(`/api/v1/events/${eventId}/giveaways`, body, HEADERS);
  if (!res.success || !res.data) {
    if (res.error?.code === '404') {
      createEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway create endpoint not deployed.' } };
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
  /** Lead/attendee id of the chosen winner. */
  id: string;
  name: string;
  company?: string;
  title?: string;
  avatar?: string;
  /** ISO 8601 timestamp of when the draw resolved. */
  drawnAt: string;
}

export interface SaveWinnerResponse {
  success: boolean;
  error?: { code: string; message: string };
}

/**
 * POST /api/v1/events/:eventId/giveaways/:giveawayId/winners
 *
 * Notifies the backend that a winner has been picked for this giveaway
 * (typically by `SponsorDrawPage` after a Lucky Draw resolves — either
 * server-arbitrated or, while `/leads/draw` is missing, the client-side
 * fallback). The backend is expected to:
 *   • persist the winner row (so back-office reports include it);
 *   • surface it on subsequent `GET /events/:id/giveaways` responses
 *     under each giveaway's `winners` array — the frontend already
 *     unions that field with its local overlay so admin- and rep-side
 *     picks converge on every device.
 *
 * This endpoint isn't documented in `BACKEND_SCAN_ENDPOINTS.md` yet;
 * it's a forward-looking call. If the backend hasn't shipped it (404
 * or 405), we set a session-scoped flag and surface NOT_IMPLEMENTED so
 * the caller can degrade silently — winners still live in the per-event
 * localStorage overlay, the on-screen UX is unaffected.
 *
 * Synthetic giveaway ids (created locally, never round-tripped through
 * the backend) skip the call entirely, the same way `updateGiveaway`
 * does — there's no canonical row to attach a winner to yet.
 */
export async function saveGiveawayWinner(
  eventId: string | number,
  giveawayId: string,
  winner: SaveWinnerPayload,
): Promise<SaveWinnerResponse> {
  // No session-scoped blocking flag here: lucky draws are infrequent (one per
  // draw, not a polling loop), so the cost of always hitting the network is
  // negligible. A session-flag would silently drop a second giveaway's winner
  // POST if the first one 404'd — which is exactly the "winner not posted to
  // backend" bug. Each draw independently retries so a newly-deployed endpoint
  // is picked up immediately without requiring a page reload.
  if (giveawayId.startsWith('giveaway-')) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway is local-only — backend create did not complete.' } };
  }
  // Send both camelCase and snake_case so either backend convention
  // works without a contract change here. Mirrors `createGiveaway` /
  // `updateGiveaway`.
  const body: Record<string, unknown> = {
    id: winner.id,
    winner_id: winner.id,
    winnerId: winner.id,
    lead_id: winner.id,
    leadId: winner.id,
    name: winner.name,
    company: winner.company ?? '',
    title: winner.title ?? '',
    avatar: winner.avatar ?? '',
    avatar_url: winner.avatar ?? '',
    drawn_at: winner.drawnAt,
    drawnAt: winner.drawnAt,
  };
  const res = await apiPost<unknown>(
    `/api/v1/events/${eventId}/giveaways/${giveawayId}/winners`,
    body,
    HEADERS,
  );
  if (!res.success) {
    const code = String(res.error?.code ?? '');
    if (code === '404' || code === '405') {
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Save-winner endpoint not deployed.' } };
    }
    return { success: false, error: res.error ?? { code: 'SAVE_WINNER_FAILED', message: 'Failed to save winner.' } };
  }
  return { success: true };
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
