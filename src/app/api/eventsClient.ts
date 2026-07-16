/**
 * Events API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET  /api/v1/events?per_page=100                          → ListEventsResponse
 *   GET  /api/v1/events/:id                                   → EventDetailResponse
 *   POST /api/v1/events/join  { code }                       → JoinEventResponse
 */

import { apiGet, apiPost, apiPut } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventStatus = 'live' | 'upcoming' | 'past';
export type EventCategory = 'conference' | 'workshop' | 'webinar' | 'meetup' | 'hackathon' | 'summit';

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

function normalizeCategory(raw: string | undefined): EventCategory {
  const map: Record<string, EventCategory> = {
    conference: 'conference', workshop: 'workshop', webinar: 'webinar',
    meetup: 'meetup', hackathon: 'hackathon', summit: 'summit',
  };
  return map[raw?.toLowerCase() ?? ''] ?? 'conference';
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
    status: normalizeStatus(raw.status as string),
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
 * POST /api/v1/events/join-by-code
 * Join an event by access code (Globex tenant).
 * Backend auto-creates a checkin record (auto_checked_in) so the attendee
 * appears in the audience list immediately — no separate check-in step needed.
 */
export async function joinEventByCodeApi(code: string): Promise<JoinEventResponse> {
  const normalizedCode = code.trim().toUpperCase();
  const res = await apiPost<unknown>(
    '/api/v1/events/join',
    { code: normalizedCode },
    EVENTS_TENANT_HEADERS,
  );
  if (res.success && res.data) {
    const raw = res.data as Record<string, unknown>;
    const eventId = String(raw.event_id ?? raw.eventId ?? raw.id ?? '');
    // membership_id may be returned as a number or a string from the backend
    const _rawMembId = raw.membership_id ?? raw.member_id;
    const membershipId: number | undefined =
      typeof _rawMembId === 'number' ? _rawMembId :
      typeof _rawMembId === 'string' && _rawMembId ? (Number(_rawMembId) || undefined) :
      undefined;
    return { success: true, data: { eventId, message: String(raw.message ?? 'Successfully joined event!'), membershipId } };
  }
  return { success: false, error: { code: 'INVALID_CODE', message: 'Event not found. Please check your code.' } };
}

/**
 * GET /api/v1/events/{eventId}/access
 * Check whether the current user is a member of the given event.
 * Always returns 200 — never blocks.
 */
export async function checkEventAccess(eventId: string): Promise<EventAccessResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/access`, EVENTS_TENANT_HEADERS);
  if (!res.success) {
    return { success: false, error: res.error as { code: string; message: string } ?? { code: 'ERROR', message: 'Access check failed.' } };
  }
  const raw = res.data as Record<string, unknown>;
  const data = (raw?.data ?? raw) as EventAccessData;
  return { success: true, data };
}

/**
 * POST /api/v1/events/join-by-code
 * Join event using an attendee invite code.
 * Body: { code: "ABC12" }
 * 201 → newly joined (auto_checked_in: true); 200 → already a member (idempotent); 404 → invalid code
 * Backend auto-creates a checkin record — no separate check-in step needed.
 */
export async function joinEventWithCode(eventCode: string): Promise<JoinEventResponse> {
  const res = await apiPost<unknown>(
    '/api/v1/events/join',
    { code: eventCode.trim().toUpperCase() },
    EVENTS_TENANT_HEADERS,
  );
  if (res.success && res.data) {
    const raw = res.data as Record<string, unknown>;
    const eventId = String(raw.event_id ?? raw.eventId ?? raw.id ?? '');
    // membership_id may be returned as a number or a string from the backend
    const _rawMembId = raw.membership_id ?? raw.member_id;
    const membershipId: number | undefined =
      typeof _rawMembId === 'number' ? _rawMembId :
      typeof _rawMembId === 'string' && _rawMembId ? (Number(_rawMembId) || undefined) :
      undefined;
    return { success: true, data: { eventId, message: raw.message as string ?? 'Successfully joined event!', membershipId } };
  }
  const msg = (res.error?.message) ?? 'Invalid event key. Please try again.';
  return { success: false, error: { code: res.error?.code ?? 'INVALID_CODE', message: msg } };
}
