import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Event, Session } from '@/lib/api/types';

/**
 * Format a raw backend time value to a human-readable "h:mm AM/PM" string.
 *
 * Three cases the backend may send:
 *  1. Bare time "HH:mm:ss" / "HH:mm"            → reformat directly (no tz conversion)
 *  2. ISO without tz offset "2026-05-15T08:30:00" → extract HH:mm from the string.
 *     IMPORTANT: do NOT use new Date() here. On Hermes (React Native) AND on
 *     most strict ECMAScript implementations, no-offset ISO date-time strings are
 *     treated as UTC — so new Date("…T08:30:00") gives 8:30 AM UTC, and
 *     toLocaleTimeString() then shifts it to device-local time, producing the
 *     wrong displayed value (e.g. "2:30 AM" instead of "8:30 AM" for an IST device).
 *  3. ISO WITH explicit UTC offset "…T08:30:00Z" or "…+05:30" → parse with Date
 *     and convert to device local time — the UTC moment is well-defined here.
 */
function formatSessionTime(raw: string): string {
  if (!raw) return '';

  const hasT = raw.includes('T');
  const hasExplicitOffset = raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw);

  // Cases 1 & 2: no explicit timezone → extract HH:mm directly from the string.
  if (!hasExplicitOffset) {
    const timePart = hasT ? raw.split('T')[1] : raw;
    const parts = timePart.split(':');
    if (parts.length >= 2) {
      try {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          const period = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          return `${h12}:${String(m).padStart(2, '0')} ${period}`;
        }
      } catch {}
    }
    return raw; // unrecognised format — pass through
  }

  // Case 3: explicit UTC offset — convert to device local time.
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  } catch {}

  return raw;
}

function normalizeSession(raw: any): Session {
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

  return {
    id: String(raw.id),
    title: raw.title ?? raw.name ?? '',
    speaker: raw.speaker ?? raw.speaker_name ?? raw.presenter ?? '',
    speakerTitle: raw.speaker_title ?? raw.speakerTitle ?? raw.presenter_title ?? '',
    speakerCompany: raw.speaker_company ?? raw.speakerCompany ?? raw.presenter_company ?? '',
    track: raw.track ?? raw.category ?? '',
    room: raw.room ?? raw.location ?? raw.venue ?? '',
    day: Number(raw.day ?? raw.day_number ?? 1),
    startTime: formatSessionTime(raw.start_time ?? raw.startTime ?? ''),
    endTime: formatSessionTime(raw.end_time ?? raw.endTime ?? ''),
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
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.agenda ?? []);
  return { success: true, data: raw.map(normalizeSession) };
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
