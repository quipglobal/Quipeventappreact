/**
 * Events API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET  /api/v1/events?per_page=100                          → ListEventsResponse
 *   GET  /api/v1/events/:id                                   → EventDetailResponse
 *   POST /api/v1/events/join  { code }                       → JoinEventResponse
 */

import { apiGet, apiPost, apiPut } from './client';
import { resolveEventMembership, type EventIdentity } from '../../../mobile/lib/eventMembership';
import { normalizeEventJoinResponse } from '../../../mobile/lib/eventJoinResult';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventStatus = 'live' | 'upcoming' | 'past';
export type EventCategory = 'ciomeet' | 'cisomeet' | 'cfomeet' | 'ctomeet' | 'grcmeet';

export interface OrganizerEvent {
  id: string;
  title: string;
  organizer: string;
  cover: string;
  status: EventStatus;
  category: EventCategory;
  dates: string;
  dateRange: { start: string; end: string };
  location: string;
  isVirtual: boolean;
  attendees: number;
  capacity: number;
  description: string;
  tags: string[];
  speakers: number;
  sessions: number;
  isFeatured?: boolean;
  isRegistered?: boolean;
  price?: string;
  code?: string;
}

export interface ListEventsResponse {
  success: boolean;
  data?: OrganizerEvent[];
  error?: { message: string };
}

export interface EventDetailResponse {
  success: boolean;
  data?: OrganizerEvent;
  error?: { message: string };
}

export interface JoinEventResponse {
  success: boolean;
  data?: { eventId: string; message: string; membershipId?: number };
  error?: { code: string; message: string };
}

export interface EventAccessData {
  is_member: boolean;
  membership_id: string | null;
  role: string | null;
  status: string | null;
  joined_at: string | null;
  event: {
    id: number;
    name: string;
    slug: string;
    status: string;
    requires_code: boolean;
  };
}

export interface EventAccessResponse {
  success: boolean;
  data?: EventAccessData;
  error?: { code: string; message: string };
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeStatus(raw: string | undefined): EventStatus {
  if (raw === 'live' || raw === 'active' || raw === 'ongoing') return 'live';
  if (raw === 'past' || raw === 'completed' || raw === 'ended') return 'past';
  return 'upcoming';
}

/**
 * Return a local-time YYYY-MM-DD key for a Date, used for calendar-day
 * comparisons that are immune to UTC-midnight parsing artefacts.
 */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Override the API-provided status with a client-side calendar-day check so
 * that events the backend hasn't transitioned yet show the correct badge:
 *  - end calendar day < today        → "past"   (completed but still tagged "upcoming")
 *  - start ≤ today ≤ end (days)      → "live"   (ongoing but not yet marked live)
 *
 * We intentionally compare YYYY-MM-DD date prefixes rather than parsed
 * Date objects to avoid JavaScript's UTC-midnight parsing behaviour: a bare
 * "2026-08-02" is parsed as 2026-08-02T00:00:00Z which is yesterday in any
 * timezone west of UTC, incorrectly flagging today's events as past.
 *
 * Falls back to `apiStatus` when dates are absent.
 */
function deriveDateStatus(
  start: string,
  end: string,
  apiStatus: EventStatus,
): EventStatus {
  const todayKey = toDateKey(new Date());
  // Extract the YYYY-MM-DD prefix; handles both "2026-08-02" and full ISO strings.
  const startKey = start ? start.slice(0, 10) : null;
  const endKey   = end   ? end.slice(0, 10)   : null;
  // Past: end calendar day is strictly before today
  if (endKey && endKey < todayKey) return 'past';
  // Live: started today or earlier, and either no end date or end is today or later
  if (startKey && startKey <= todayKey && (!endKey || endKey >= todayKey)) return 'live';
  return apiStatus;
}

function normalizeCategory(raw: string | undefined): EventCategory {
  // Collapse separators so "cio-meet", "cio_meet", "CIO Meet" all match.
  const s = (raw ?? '').toLowerCase().replace(/[\s_\-]/g, '');
  const map: Record<string, EventCategory> = {
    ciomeet:  'ciomeet',  cio:  'ciomeet',
    cisomeet: 'cisomeet', ciso: 'cisomeet',
    cfomeet:  'cfomeet',  cfo:  'cfomeet',
    ctomeet:  'ctomeet',  cto:  'ctomeet',
    grcmeet:  'grcmeet',  grc:  'grcmeet',
  };
  return map[s] ?? 'ciomeet';
}

function formatDateRange(start: string, end: string): string {
  if (!start) return '';
  try {
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (!e || s.toDateString() === e.toDateString()) {
      return s.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
    }
    return `${s.toLocaleDateString('en-US', opts)}–${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  } catch {
    return start;
  }
}

function normalizeEvent(raw: Record<string, unknown>): OrganizerEvent {
  const startDate = (raw.start_date ?? raw.startDate ?? raw.start ?? '') as string;
  const endDate = (raw.end_date ?? raw.endDate ?? raw.end ?? '') as string;
  return {
    id: String(raw.id ?? ''),
    title: (raw.name ?? raw.title ?? '') as string,
    organizer: (raw.organizer ?? raw.organizer_name ?? raw.organization ?? 'CXO Inc') as string,
    cover: (raw.banner_url ?? raw.bannerUrl ?? raw.image ?? raw.photo ?? raw.cover ?? '') as string,
    status: deriveDateStatus(startDate, endDate, normalizeStatus(raw.status as string)),
    category: normalizeCategory(raw.category as string),
    dates: formatDateRange(startDate, endDate),
    dateRange: { start: startDate, end: endDate },
    location: (raw.location ?? raw.venue ?? raw.city ?? '') as string,
    isVirtual: Boolean(raw.is_virtual ?? raw.isVirtual ?? raw.virtual),
    attendees: Number(raw.attendees_count ?? raw.attendees ?? raw.registered_count ?? 0),
    capacity: Number(raw.capacity ?? raw.max_attendees ?? 0),
    description: (raw.description ?? '') as string,
    tags: Array.isArray(raw.tags) ? raw.tags as string[] : [],
    speakers: Number(raw.speakers_count ?? raw.speakers ?? 0),
    sessions: Number(raw.sessions_count ?? raw.sessions ?? 0),
    isFeatured: Boolean(raw.is_featured ?? raw.isFeatured),
    isRegistered: Boolean(raw.is_registered ?? raw.isRegistered),
    price: (raw.price ?? raw.ticket_price ?? undefined) as string | undefined,
    code: (raw.code ?? raw.event_code ?? raw.slug ?? undefined) as string | undefined,
  };
}

// ─── Globex tenant scoping ────────────────────────────────────────────────────

const EVENTS_TENANT_HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events
 * Returns a list of all events for the Globex tenant (tenant 3).
 */
export async function listEventsApi(status?: EventStatus): Promise<ListEventsResponse> {
  const res = await apiGet<unknown>('/api/v1/events?per_page=100', EVENTS_TENANT_HEADERS);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch events.' } };
  }
  const raw: unknown[] = Array.isArray(res.data)
    ? res.data
    : ((res.data as Record<string, unknown>)?.data as unknown[]) ??
      ((res.data as Record<string, unknown>)?.events as unknown[]) ??
      [];
  let events = raw.map(e => normalizeEvent(e as Record<string, unknown>));
  if (status) events = events.filter(e => e.status === status);
  return { success: true, data: events };
}

/**
 * GET /api/v1/events/:id
 * Returns a single event's full details (Globex tenant).
 */
export async function getEventApi(id: string): Promise<EventDetailResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${id}`, EVENTS_TENANT_HEADERS);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Event not found.' } };
  }
  const raw = ((res.data as Record<string, unknown>)?.data ?? res.data) as Record<string, unknown>;
  return { success: true, data: normalizeEvent(raw) };
}

/**
 * POST /api/v1/events/join
 * Join an event by access code (Globex tenant).
 * Backend auto-creates a checkin record (auto_checked_in) so the attendee
 * appears in the audience list immediately — no separate check-in step needed.
 */
export async function joinEventByCodeApi(code: string, selectedEventId?: string): Promise<JoinEventResponse> {
  const normalizedCode = code.trim().toUpperCase();
  const res = await apiPost<unknown>(
    '/api/v1/events/join',
    // Send both field names so it works regardless of which one the backend expects.
    {
      event_code: normalizedCode,
      code: normalizedCode,
      ...(selectedEventId ? { event_id: selectedEventId } : {}),
    },
    EVENTS_TENANT_HEADERS,
  );
  if (res.success) {
    const { eventId, message, membershipId } = normalizeEventJoinResponse(res);
    return { success: true, data: { eventId, message, membershipId } };
  }
  return { success: false, error: { code: res.error?.code ?? 'INVALID_CODE', message: res.error?.message ?? 'Event not found. Please check your code.' } };
}

/**
 * GET /api/v1/events/{eventId}/access
 * Check whether the current user is a member of the given event.
 * Always returns 200 — never blocks.
 */
export async function checkEventAccess(eventId: string, identity?: EventIdentity): Promise<EventAccessResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/access`, EVENTS_TENANT_HEADERS);
  const resolved = await resolveEventMembership(res, identity, page => apiGet<unknown>(
    `/api/v1/events/${eventId}/members?per_page=100&page=${page}&checked_in_only=false`,
    EVENTS_TENANT_HEADERS,
  ), page => apiGet<unknown>(
    `/api/v1/events/${eventId}/attendees?per_page=100&page=${page}&checked_in_only=false`,
    EVENTS_TENANT_HEADERS,
  ));
  if (!resolved.success) return { success: false, error: resolved.error };
  const raw = res.data as Record<string, unknown>;
  const data = { ...((raw?.data ?? raw) as EventAccessData), ...resolved.data };
  return { success: true, data };
}

/**
 * POST /api/v1/events/join
 * Join event using an attendee invite code.
 * Body: { code: "ABC12" }
 * 201 → newly joined (auto_checked_in: true); 200 → already a member (idempotent); 404 → invalid code
 * Backend auto-creates a checkin record — no separate check-in step needed.
 */
export async function joinEventWithCode(eventCode: string, selectedEventId?: string): Promise<JoinEventResponse> {
  return joinEventByCodeApi(eventCode, selectedEventId);
}
