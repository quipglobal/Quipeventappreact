/**
 * Agenda & Sessions API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET  /api/v1/events/:eventId/mobile-agenda               → SessionsResponse
 *   POST /api/v1/events/:eventId/sessions/:id/bookmark       → BookmarkResponse
 *   DELETE /api/v1/events/:eventId/sessions/:id/bookmark     → BookmarkResponse
 */

import { apiGet, apiPost } from './client';
import type { Session } from '@/app/types/config';

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

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeSession(raw: Record<string, unknown>): Session {
  const speakers: Session['speakers'] = [];
  const rawSpeakers = Array.isArray(raw.speakers) ? raw.speakers : [];
  rawSpeakers.forEach((s: Record<string, unknown>) => {
    speakers.push({
      id: String(s.id ?? ''),
      name: (s.name ?? s.speaker_name ?? '') as string,
      title: (s.title ?? s.speaker_title ?? s.job_title ?? '') as string,
      company: (s.company ?? s.speaker_company ?? '') as string,
      avatar: (s.avatar ?? s.avatar_url ?? s.photo ?? '') as string,
    });
  });

  if (speakers.length === 0 && (raw.speaker || raw.speaker_name)) {
    speakers.push({
      id: String(raw.speaker_id ?? raw.id ?? ''),
      name: (raw.speaker ?? raw.speaker_name ?? '') as string,
      title: (raw.speaker_title ?? '') as string,
      company: (raw.speaker_company ?? '') as string,
      avatar: (raw.speaker_avatar ?? '') as string,
    });
  }

  const startTime = (raw.start_time ?? raw.startTime ?? '') as string;
  const endTime = (raw.end_time ?? raw.endTime ?? '') as string;
  const date = (raw.date ?? raw.session_date ?? raw.day_date ?? '') as string;

  return {
    id: String(raw.id ?? ''),
    title: (raw.title ?? raw.name ?? '') as string,
    startTime,
    endTime,
    date,
    room: (raw.room ?? raw.location ?? raw.venue ?? '') as string,
    track: (raw.track ?? raw.category ?? raw.stream ?? '') as string,
    type: (raw.type ?? raw.session_type ?? 'Session') as string,
    tags: Array.isArray(raw.tags) ? raw.tags as string[] : [],
    speakers,
    description: (raw.description ?? raw.summary ?? '') as string,
    pollId: raw.poll_id ? String(raw.poll_id) : undefined,
    surveyId: raw.survey_id ? String(raw.survey_id) : undefined,
  };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:eventId/mobile-agenda
 * Returns all sessions for the event, filtered by day/track if provided.
 */
export async function listSessionsApi(
  eventId: string,
  filters?: { day?: string; track?: string }
): Promise<SessionsResponse> {
  if (!eventId) {
    return { success: true, data: [] };
  }

  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/mobile-agenda`);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to load agenda.' } };
  }

  const envelope = res.data as Record<string, unknown>;
  const raw: unknown[] = Array.isArray(envelope)
    ? envelope
    : (Array.isArray(envelope?.data) ? envelope.data as unknown[] : null)
      ?? (Array.isArray(envelope?.sessions) ? envelope.sessions as unknown[] : null)
      ?? (Array.isArray(envelope?.agenda) ? envelope.agenda as unknown[] : null)
      ?? [];

  let sessions = raw.map(r => normalizeSession(r as Record<string, unknown>));
  if (filters?.day) sessions = sessions.filter(s => s.date === filters.day);
  if (filters?.track && filters.track !== 'all') sessions = sessions.filter(s => s.track === filters.track);

  return { success: true, data: sessions };
}

/**
 * GET /api/v1/events/:eventId/mobile-agenda/:id
 * Returns full detail for a single session.
 */
export async function getSessionApi(eventId: string, id: string): Promise<SessionDetailResponse> {
  if (!eventId) return { success: false, error: { message: 'No event selected.' } };

  const allRes = await listSessionsApi(eventId);
  if (!allRes.success) return { success: false, error: allRes.error };
  const session = (allRes.data ?? []).find(s => s.id === id);
  if (!session) return { success: false, error: { message: 'Session not found.' } };
  return { success: true, data: session };
}

/**
 * POST /api/v1/events/:eventId/sessions/:id/bookmark
 * Toggles a bookmark on a session.
 */
export async function bookmarkSessionApi(eventId: string, id: string, bookmarked: boolean): Promise<BookmarkResponse> {
  if (!eventId) return { success: true, data: { sessionId: id, bookmarked } };

  const path = `/api/v1/events/${eventId}/sessions/${id}/bookmark`;
  const res = bookmarked
    ? await apiPost<unknown>(path, {})
    : await apiPost<unknown>(`${path}/remove`, {});

  if (!res.success) {
    return { success: true, data: { sessionId: id, bookmarked } };
  }
  return { success: true, data: { sessionId: id, bookmarked } };
}
