import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Event, Session } from '@/lib/api/types';

/**
 * Derive a short timezone abbreviation (e.g. "CST") from an IANA timezone
 * identifier (e.g. "America/Chicago") using Intl.DateTimeFormat.
 * Falls back to an empty string if the identifier is unrecognised or Intl
 * is unavailable (shouldn't happen on Hermes 0.76+ with ICU, but guarded).
 */
function tzAbbrFromIANA(ianaName: string): string {
  if (!ianaName) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaName,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

/**
 * Format a raw backend time value to a human-readable "h:mm AM/PM [TZ]" string
 * using venue wall-clock time — never device-local time.
 *
 * Three cases the backend may send:
 *  1. Bare time "HH:mm:ss" / "HH:mm"             → reformat directly.
 *  2. ISO without tz offset "2026-05-15T08:30:00" → extract HH:mm from the string.
 *     IMPORTANT: do NOT call new Date() — Hermes treats no-offset ISO strings as
 *     UTC, so toLocaleTimeString() would shift to device-local time.
 *  3. ISO WITH explicit offset "…T09:00:00-05:00" → extract the HH:mm that sit
 *     between 'T' and the offset. Those digits ARE the venue wall-clock time.
 *     Do NOT convert via new Date() / toLocaleTimeString().
 *
 * @param tzAbbr optional short abbreviation appended to the result ("CST", …)
 */
function formatSessionTime(raw: string, tzAbbr?: string): string {
  if (!raw) return '';

  const hasT = raw.includes('T');
  const hasExplicitOffset = raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw);

  let h: number, m: number;

  if (!hasExplicitOffset) {
    // Cases 1 & 2: naive string — extract HH:mm directly.
    const timePart = hasT ? raw.split('T')[1] : raw;
    const parts = timePart.split(':');
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  } else if (hasT) {
    // Case 3: offset-aware ISO — strip offset/Z to reveal venue wall-clock HH:mm.
    // e.g. "2026-07-15T09:00:00-05:00" → timePart="09:00:00-05:00" → clean="09:00:00"
    const timePart = raw.split('T')[1];
    const cleanTime = timePart.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    const parts = cleanTime.split(':');
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  } else {
    // "Z" only, no 'T' — unusual, pass through unchanged.
    return raw;
  }

  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return raw;

  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const base = `${h12}:${String(m).padStart(2, '0')} ${period}`;
  return tzAbbr ? `${base} ${tzAbbr}` : base;
}

function normalizeSession(raw: any, eventTimezone?: string): Session {
  const rawAud =
    (Array.isArray(raw.assigned_audience) && raw.assigned_audience) ||
    (Array.isArray(raw.assignedAudience) && raw.assignedAudience) ||
    (Array.isArray(raw.audience) && raw.audience) ||
    (Array.isArray(raw.assigned_users) && raw.assigned_users) ||
    (Array.isArray(raw.attendees) && raw.attendees) ||
    [];
  const assignedAudience = (rawAud as any[])
    .map((a) => {
      const u = (a && typeof a.user === 'object' && a.user) ||
                (a && typeof a.member === 'object' && a.member) ||
                a;
      const company = u.company;
      return {
        id: String(u.id ?? u.user_id ?? a.id ?? a.user_id ?? ''),
        name: u.name ?? u.full_name ?? u.display_name ?? '',
        title: u.title ?? u.job_title ?? '',
        company:
          typeof company === 'string'
            ? company
            : company && typeof company === 'object'
              ? String(company.name ?? '')
              : (u.company_name ?? ''),
        avatar: u.avatar ?? u.avatar_url ?? u.profile_image ?? u.photo ?? '',
      };
    })
    .filter((m) => m.id && m.name);

  // Resolve timezone: per-item field takes precedence over the response-level default.
  const tzIana: string = raw.event_timezone ?? eventTimezone ?? '';
  const tzAbbr: string = tzIana ? tzAbbrFromIANA(tzIana) : '';

  const rawStart = raw.start_time ?? raw.startTime ?? '';
  const rawEnd   = raw.end_time   ?? raw.endTime   ?? '';

  return {
    id: String(raw.id),
    title: raw.title ?? raw.name ?? '',
    speaker: raw.speaker ?? raw.speaker_name ?? raw.presenter ?? '',
    speakerTitle: raw.speaker_title ?? raw.speakerTitle ?? raw.presenter_title ?? '',
    speakerCompany: raw.speaker_company ?? raw.speakerCompany ?? raw.presenter_company ?? '',
    track: raw.track ?? raw.category ?? '',
    room: raw.room ?? raw.location ?? raw.venue ?? '',
    day: Number(raw.day ?? raw.day_number ?? 1),
    startTime: formatSessionTime(rawStart, tzAbbr || undefined),
    endTime:   formatSessionTime(rawEnd,   tzAbbr || undefined),
    startIso:  rawStart || undefined,
    endIso:    rawEnd   || undefined,
    tzAbbr:    tzAbbr   || undefined,
    accentColor: raw.accent_color ?? raw.accentColor ?? '#7c3aed',
    description: raw.description ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    assignedAudience,
  };
}

function deriveStatus(raw: any): 'upcoming' | 'live' | 'past' {
  const s: string = raw.status ?? '';
  if (s === 'live') return 'live';
  if (s === 'past') return 'past';
  if (s === 'upcoming') return 'upcoming';
  const now = new Date();
  const end = raw.end_date ? new Date(raw.end_date) : null;
  const start = raw.start_date ? new Date(raw.start_date) : null;
  if (end && end < now) return 'past';
  if (start && start <= now && end && end >= now) return 'live';
  return 'upcoming';
}

function normalizeEvent(raw: any): Event {
  return {
    id: String(raw.id),
    name: raw.name ?? raw.title ?? '',
    code: raw.code ?? raw.event_code ?? raw.slug ?? '',
    startDate: raw.start_date ?? raw.startDate ?? raw.start ?? '',
    endDate: raw.end_date ?? raw.endDate ?? raw.end ?? '',
    location: raw.location ?? raw.venue ?? raw.city ?? '',
    description: raw.description ?? '',
    bannerUrl: raw.banner_url ?? raw.bannerUrl ?? raw.image ?? raw.photo ?? undefined,
    category: raw.category ?? undefined,
    status: deriveStatus(raw),
  };
}

export async function listEvents(): Promise<ApiResponse<Event[]>> {
  if (__DEV__) console.log('[Events] listEvents — live');
  const res = await request<any>('/api/v1/events?per_page=100');
  if (!res.success) return res as ApiResponse<Event[]>;
  const raw: any[] = Array.isArray(res.data)
    ? res.data
    : (res.data?.data ?? res.data?.events ?? []);
  return { success: true, data: raw.map(normalizeEvent) };
}

export async function listEventsByTenant(tenantId: string): Promise<ApiResponse<Event[]>> {
  if (__DEV__) console.log(`[Events] listEventsByTenant(${tenantId}) — live`);
  const res = await request<any>('/api/v1/events?per_page=100', {
    headers: { 'X-Tenant-ID': tenantId },
  });
  if (!res.success) return res as ApiResponse<Event[]>;
  const raw: any[] = Array.isArray(res.data)
    ? res.data
    : (res.data?.data ?? res.data?.events ?? []);
  const publishedOnly = raw.filter((e) => (e.status ?? '') !== 'draft');
  return { success: true, data: publishedOnly.map(normalizeEvent) };
}

export async function findEventByCode(code: string, tenantId: string): Promise<ApiResponse<Event>> {
  if (__DEV__) console.log(`[Events] findEventByCode(${code}, tenant=${tenantId})`);
  const listRes = await listEventsByTenant(tenantId);
  if (!listRes.success) return { success: false, error: listRes.error };
  const upper = code.trim().toUpperCase();
  const match = (listRes.data ?? []).find(
    (e) => (e.code ?? '').toUpperCase() === upper || String(e.id) === code,
  );
  if (!match) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: `No event found for code "${code}".` },
    };
  }
  return { success: true, data: match };
}

export async function getEvent(id: string): Promise<ApiResponse<Event>> {
  if (__DEV__) console.log(`[Events] getEvent(${id}) — live`);
  const res = await request<any>(`/api/v1/events/${id}`);
  if (!res.success) return res as ApiResponse<Event>;
  const raw = res.data?.data ?? res.data;
  return { success: true, data: normalizeEvent(raw) };
}

export async function joinEventByCode(code: string): Promise<ApiResponse<Event>> {
  if (__DEV__) console.log(`[Events] joinEventByCode(${code}) — live`);
  const listRes = await listEvents();
  if (!listRes.success) return { success: false, error: listRes.error };
  const events = listRes.data ?? [];
  const upper = code.trim().toUpperCase();
  const match = events.find(
    (e) => (e.code ?? '').toUpperCase() === upper || e.id === code
  );
  if (!match) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: `No event found for code "${code}". Please check the code and try again.` },
    };
  }
  return { success: true, data: match };
}

/**
 * Join an event by attendee invite code using the backend's join-by-code
 * endpoint. The server auto-creates a checkin record so the attendee appears
 * in the audience list immediately — no separate check-in step is needed.
 *
 * Response shape (from backend):
 *   { message, auto_checked_in, role, badge_code, event?: {...}, event_id? }
 *
 * Returns the resolved Event on success, or an error if the code is invalid.
 */
export async function joinByCode(
  code: string,
): Promise<ApiResponse<Event & { autoCheckedIn: boolean; membershipId?: number }>> {
  const upper = code.trim().toUpperCase();
  if (__DEV__) console.log(`[Events] joinByCode(${upper}) — POST join-by-code`);

  const res = await request<any>('/api/v1/events/join', {
    method: 'POST',
    body: JSON.stringify({ event_code: upper }),
  });

  if (!res.success) {
    // 409 = user is already a member — treat as success and resolve event from code.
    const is409 =
      res.error?.code === '409' ||
      res.error?.code === 'CONFLICT' ||
      res.error?.message?.toLowerCase().includes('already');
    if (!is409) {
      return res as ApiResponse<Event & { autoCheckedIn: boolean; membershipId?: number }>;
    }
    if (__DEV__) console.log(`[Events] joinByCode 409/already-member for code=${upper} — resolving event`);
  }

  const raw = res.data ?? {};
  const autoCheckedIn: boolean = Boolean(raw.auto_checked_in);
  // Extract membership_id — backend may return it as a number or a string.
  const _rawMembId = raw.membership_id ?? raw.member_id;
  const membershipId: number | undefined =
    typeof _rawMembId === 'number' ? _rawMembId :
    typeof _rawMembId === 'string' && _rawMembId ? (Number(_rawMembId) || undefined) :
    undefined;
  if (__DEV__) console.log(`[Events] joinByCode auto_checked_in=${autoCheckedIn} membershipId=${membershipId}`);

  // Resolve Event — try inline event object first, then event_id fetch, then code lookup.
  const inlineEvent = raw.event ?? raw.data?.event ?? null;
  if (inlineEvent) {
    return { success: true, data: { ...normalizeEvent(inlineEvent), autoCheckedIn, membershipId } };
  }

  const eventId = raw.event_id ?? raw.data?.event_id ?? null;
  if (eventId) {
    const evRes = await getEvent(String(eventId));
    if (evRes.success && evRes.data) {
      return { success: true, data: { ...evRes.data, autoCheckedIn, membershipId } };
    }
  }

  // Last resort: find the event by code from the catalogue.
  const listRes = await listEvents();
  if (listRes.success) {
    const match = (listRes.data ?? []).find(
      (e) => (e.code ?? '').toUpperCase() === upper || String(e.id) === upper,
    );
    if (match) return { success: true, data: { ...match, autoCheckedIn, membershipId } };
  }

  return {
    success: false,
    error: {
      code: 'EVENT_NOT_FOUND',
      message: `Joined but could not load event details for code "${upper}". Please refresh.`,
    },
  };
}

/**
 * GET /api/v1/events/{eventId}/access
 * Returns whether the current user is a member of the event.
 * Always returns 200 — never blocks.
 * Cache the result locally once is_member is true.
 */
export async function checkEventAccess(
  eventId: string,
): Promise<ApiResponse<{ is_member: boolean; role: string | null; event: any }>> {
  const res = await request<any>(`/api/v1/events/${eventId}/access`);
  if (!res.success) return res;
  const raw = res.data ?? {};
  const data = raw?.data ?? raw;
  return {
    success: true,
    data: {
      is_member: Boolean(data?.is_member),
      role: data?.role ?? null,
      event: data?.event ?? null,
    },
  };
}

/**
 * POST /api/v1/events/{eventId}/self-check-in
 * Marks the current user as physically checked in.
 * Idempotent — safe to call even if already checked in.
 * No membership ID required — backend resolves from bearer token.
 */
export async function selfCheckIn(
  eventId: string,
): Promise<ApiResponse<{ checked_in: boolean }>> {
  return request<{ checked_in: boolean }>(`/api/v1/events/${eventId}/self-check-in`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function listSessions(filters?: { day?: number; track?: string }): Promise<ApiResponse<Session[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Events] listSessions eventId=${eventId} filters=`, filters);
  if (!eventId) return { success: true, data: [] };
  const params = new URLSearchParams();
  if (filters?.day) params.set('day', String(filters.day));
  if (filters?.track) params.set('track', filters.track);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await request<any>(`/api/v1/events/${eventId}/mobile-agenda${query}`);
  if (!res.success) return res as ApiResponse<Session[]>;
  // Extract the top-level event_timezone from the response envelope so it can
  // be threaded into each session even if the per-item field is absent.
  const eventTz: string = Array.isArray(res.data)
    ? ''
    : (res.data?.event_timezone ?? res.data?.data?.event_timezone ?? '');
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.agenda ?? []);
  return { success: true, data: raw.map((item) => normalizeSession(item, eventTz)) };
}

export async function getSession(id: string): Promise<ApiResponse<Session>> {
  if (__DEV__) console.log(`[Events] getSession(${id}) — live`);
  const res = await request<any>(`/api/v1/sessions/${id}`);
  if (!res.success) return res as ApiResponse<Session>;
  const raw = res.data?.data ?? res.data;
  return { success: true, data: normalizeSession(raw) };
}

export async function bookmarkSession(sessionId: string, bookmarked: boolean): Promise<ApiResponse<{ bookmarked: boolean }>> {
  return request<{ bookmarked: boolean }>('/api/v1/sessions/bookmark', {
    method: 'POST',
    body: JSON.stringify({ sessionId, bookmarked }),
  });
}
