import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Event, Session } from '@/lib/api/types';

function normalizeSession(raw: any): Session {
  return {
    id: String(raw.id),
    title: raw.title ?? raw.name ?? '',
    speaker: raw.speaker ?? raw.speaker_name ?? raw.presenter ?? '',
    speakerTitle: raw.speaker_title ?? raw.speakerTitle ?? raw.presenter_title ?? '',
    speakerCompany: raw.speaker_company ?? raw.speakerCompany ?? raw.presenter_company ?? '',
    track: raw.track ?? raw.category ?? '',
    room: raw.room ?? raw.location ?? raw.venue ?? '',
    day: Number(raw.day ?? raw.day_number ?? 1),
    startTime: raw.start_time ?? raw.startTime ?? '',
    endTime: raw.end_time ?? raw.endTime ?? '',
    accentColor: raw.accent_color ?? raw.accentColor ?? '#7c3aed',
    description: raw.description ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
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
