/**
 * Agenda & Sessions API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET  /api/v1/events/:eventId/agenda   → { success: true, data: AgendaItem[] }
 *
 * AgendaItem fields from backend:
 *   id, event_id, start_time (ISO8601), end_time (ISO8601),
 *   title, description, location, sort_order,
 *   speakers: [], moderators: []
 */

import { apiGet, apiPost } from './client';
import type { Session } from '@/app/types/config';

// ─── Globex tenant scoping ────────────────────────────────────────────────────

const AGENDA_TENANT_HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

// ─── Response Types ───────────────────────────────────────────────────────────

export interface SessionsResponse {
  success: boolean;
  data?: Session[];
  error?: { message: string };
}

export interface SessionDetailResponse {
  success: boolean;
  data?: Session;
  error?: { message: string };
}

export interface BookmarkResponse {
  success: boolean;
  data?: { sessionId: string; bookmarked: boolean };
  error?: { message: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function extractDate(iso: string): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeSession(raw: Record<string, unknown>): Session {
  const speakers: Session['speakers'] = [];

  const rawSpeakers = Array.isArray(raw.speakers) ? raw.speakers : [];
  (rawSpeakers as Record<string, unknown>[]).forEach(s => {
    // Pivot rows commonly nest the actual user data under `user`/`member`/`profile`.
    const u = (s.user && typeof s.user === 'object' ? s.user as Record<string, unknown> : null)
      ?? (s.member && typeof s.member === 'object' ? s.member as Record<string, unknown> : null)
      ?? (s.profile && typeof s.profile === 'object' ? s.profile as Record<string, unknown> : null)
      ?? s;

    const firstName = (u.first_name ?? u.firstName ?? '') as string;
    const lastName  = (u.last_name  ?? u.lastName  ?? '') as string;
    const composedName = `${firstName} ${lastName}`.trim();

    const company = u.company;
    const companyStr = typeof company === 'string'
      ? company
      : (company && typeof company === 'object'
          ? String((company as Record<string, unknown>).name ?? '')
          : (u.company_name ?? u.organization ?? s.speaker_company ?? '') as string);

    speakers.push({
      id: String(u.id ?? s.id ?? s.user_id ?? ''),
      name: (u.name ?? u.full_name ?? u.display_name ?? s.speaker_name ?? composedName ?? '') as string,
      title: (u.title ?? u.job_title ?? u.designation ?? s.speaker_title ?? '') as string,
      company: companyStr,
      avatar: (u.avatar ?? u.avatar_url ?? u.photo ?? u.profile_image ?? '') as string,
      role: (s.role ?? s.speaker_role ?? s.participation_role ?? s.session_role ?? s.type ?? u.role ?? '') as string,
    });
  });

  if (speakers.length === 0 && (raw.speaker || raw.speaker_name)) {
    speakers.push({
      id: String(raw.speaker_id ?? raw.id ?? ''),
      name: (raw.speaker ?? raw.speaker_name ?? '') as string,
      title: (raw.speaker_title ?? '') as string,
      company: (raw.speaker_company ?? '') as string,
      avatar: (raw.speaker_avatar ?? '') as string,
      role: (raw.speaker_role ?? '') as string,
    });
  }

  // Some backends send moderators as a separate array. Merge them in with role="Moderator".
  const rawModerators = Array.isArray(raw.moderators) ? raw.moderators :
                        Array.isArray(raw.moderator) ? raw.moderator : [];
  (rawModerators as Record<string, unknown>[]).forEach(m => {
    const sp = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
    const u = (sp.user && typeof sp.user === 'object' ? sp.user as Record<string, unknown> : sp);
    const id = String(u.id ?? sp.id ?? '');
    if (!id) return;
    if (speakers.some(x => x.id === id)) {
      // Already in speakers list — just tag the role
      const existing = speakers.find(x => x.id === id)!;
      existing.role = existing.role || 'Moderator';
      return;
    }
    speakers.push({
      id,
      name: (u.name ?? u.full_name ?? u.display_name ?? '') as string,
      title: (u.title ?? u.job_title ?? u.designation ?? '') as string,
      company: (u.company ?? u.company_name ?? u.organization ?? '') as string,
      avatar: (u.avatar ?? u.avatar_url ?? u.photo ?? '') as string,
      role: 'Moderator',
    });
  });

  // Assigned audience — backend may use any of these field names depending on
  // version. We normalize them all into a single typed array.
  const rawAudience = (
    Array.isArray(raw.assigned_audience) ? raw.assigned_audience :
    Array.isArray(raw.assignedAudience)   ? raw.assignedAudience  :
    Array.isArray(raw.audience)           ? raw.audience          :
    Array.isArray(raw.assigned_users)     ? raw.assigned_users    :
    Array.isArray(raw.attendees)          ? raw.attendees         :
    []
  ) as Record<string, unknown>[];

  const assignedAudience = rawAudience
    .map(a => {
      // Some backends nest the user under `user` or `member`
      const u = (a.user && typeof a.user === 'object' ? a.user as Record<string, unknown> : null)
        ?? (a.member && typeof a.member === 'object' ? a.member as Record<string, unknown> : null)
        ?? a;
      const firstName = (u.first_name ?? u.firstName ?? '') as string;
      const lastName  = (u.last_name  ?? u.lastName  ?? '') as string;
      const composedName = `${firstName} ${lastName}`.trim();
      const company = u.company;
      return {
        id: String(u.id ?? u.user_id ?? a.id ?? a.user_id ?? ''),
        name: (u.name ?? u.full_name ?? u.display_name ?? composedName ?? '') as string,
        avatar: (u.avatar ?? u.avatar_url ?? u.profile_image ?? u.photo ?? '') as string,
        title: (u.title ?? u.job_title ?? u.designation ?? '') as string,
        company: typeof company === 'string'
          ? company
          : (company && typeof company === 'object'
              ? String((company as Record<string, unknown>).name ?? '')
              : (u.company_name ?? u.organization ?? '') as string),
      };
    })
    .filter(m => m.id && m.name);

  const startIso = (raw.start_time ?? raw.startTime ?? '') as string;
  const endIso   = (raw.end_time   ?? raw.endTime   ?? '') as string;

  return {
    id:          String(raw.id ?? ''),
    title:       (raw.title ?? raw.name ?? '') as string,
    startTime:   formatTime(startIso),
    endTime:     formatTime(endIso),
    startIso,
    endIso,
    date:        extractDate(startIso) || (raw.date ?? raw.session_date ?? '') as string,
    room:        (raw.location ?? raw.room ?? raw.venue ?? '') as string,
    track:       (raw.track ?? raw.category ?? raw.stream ?? '') as string,
    type:        (raw.type ?? raw.session_type ?? '') as string,
    tags:        Array.isArray(raw.tags) ? raw.tags as string[] : [],
    speakers,
    assignedAudience,
    description: (raw.description ?? raw.summary ?? '') as string,
    pollId:      raw.poll_id   ? String(raw.poll_id)   : undefined,
    surveyId:    raw.survey_id ? String(raw.survey_id) : undefined,
  };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:eventId/agenda
 * Returns all sessions for the event, sorted by sort_order / start_time.
 */
export async function listSessionsApi(
  eventId: string,
  filters?: { day?: string; track?: string }
): Promise<SessionsResponse> {
  if (!eventId) {
    return { success: true, data: [] };
  }

  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/agenda`, AGENDA_TENANT_HEADERS);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to load agenda.' } };
  }

  const envelope = res.data as Record<string, unknown>;
  const raw: unknown[] = Array.isArray(envelope)
    ? envelope
    : (Array.isArray(envelope?.data)     ? envelope.data     as unknown[] : null)
      ?? (Array.isArray(envelope?.sessions) ? envelope.sessions as unknown[] : null)
      ?? (Array.isArray(envelope?.agenda)   ? envelope.agenda   as unknown[] : null)
      ?? [];

  let sessions = raw.map(r => normalizeSession(r as Record<string, unknown>));

  sessions.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  if (filters?.day)   sessions = sessions.filter(s => s.date === filters.day);
  if (filters?.track && filters.track !== 'all') sessions = sessions.filter(s => s.track === filters.track);

  return { success: true, data: sessions };
}

/**
 * Looks up a single session by ID from the full agenda.
 */
export async function getSessionApi(eventId: string, id: string): Promise<SessionDetailResponse> {
  if (!eventId) return { success: false, error: { message: 'No event selected.' } };

  const allRes = await listSessionsApi(eventId);
  if (!allRes.success) return { success: false, error: allRes.error };
  const session = (allRes.data ?? []).find(s => s.id === id);
  if (!session)  return { success: false, error: { message: 'Session not found.' } };
  return { success: true, data: session };
}

/**
 * Client-side bookmark toggle (server-side bookmark endpoint not yet available).
 */
export async function bookmarkSessionApi(eventId: string, id: string, bookmarked: boolean): Promise<BookmarkResponse> {
  if (!eventId) return { success: true, data: { sessionId: id, bookmarked } };

  const path = `/api/v1/events/${eventId}/sessions/${id}/bookmark`;
  const res = bookmarked
    ? await apiPost<unknown>(path, {}, AGENDA_TENANT_HEADERS)
    : await apiPost<unknown>(`${path}/remove`, {}, AGENDA_TENANT_HEADERS);

  if (!res.success) {
    return { success: true, data: { sessionId: id, bookmarked } };
  }
  return { success: true, data: { sessionId: id, bookmarked } };
}
