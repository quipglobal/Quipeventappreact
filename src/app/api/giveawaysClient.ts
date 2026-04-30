import { apiGet, apiPost, apiPatch, apiDelete, ApiEnvelope } from './client';
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

function normalizeGiveaway(raw: any): SponsorGiveaway {
  const tsSource = raw?.created_at ?? raw?.createdAt ?? raw?.created ?? raw?.timestamp;
  const createdAt = tsSource ? new Date(tsSource) : new Date();
  return {
    id: String(raw?.id ?? raw?.giveaway_id ?? raw?.uuid ?? `giveaway-${Date.now()}`),
    title: pickString(raw?.title, raw?.name, raw?.prize, raw?.label),
    numberOfItems: pickNumber(
      raw?.numberOfItems,
      raw?.number_of_items,
      raw?.total_available,
      raw?.totalAvailable,
      raw?.quantity,
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
  const body = {
    title: payload.title,
    number_of_items: payload.numberOfItems,
    numberOfItems: payload.numberOfItems,
    quantity: payload.numberOfItems,
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
 * PATCH /api/v1/events/:eventId/giveaways/:giveawayId
 *
 * Used by the sponsor "edit giveaway" flow. Mirrors `createGiveaway`
 * in sending both camelCase and snake_case so either backend
 * convention works without a contract change here. Only sends the
 * fields the caller actually wants to change — the backend is
 * expected to leave the rest untouched.
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
    body.number_of_items = payload.numberOfItems;
    body.numberOfItems = payload.numberOfItems;
    body.quantity = payload.numberOfItems;
  }
  if (payload.image !== undefined) {
    body.image = payload.image;
    body.image_url = payload.image;
  }
  const res = await apiPatch<unknown>(`/api/v1/events/${eventId}/giveaways/${giveawayId}`, body);
  if (!res.success || !res.data) {
    if (res.error?.code === '404') {
      updateEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway update endpoint not deployed.' } };
    }
    return { success: false, error: res.error ?? { code: 'UPDATE_FAILED', message: 'Failed to update giveaway.' } };
  }
  const raw = (res.data as any)?.data ?? res.data;
  return { success: true, data: normalizeGiveaway(raw) };
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
