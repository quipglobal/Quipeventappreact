import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Challenge, Poll, Survey, Giveaway } from '@/lib/api/types';

export async function listChallenges(): Promise<ApiResponse<Challenge[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Engage] listChallenges eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };
  const res = await request<any>(`/api/v1/events/${eventId}/challenges`);
  if (!res.success) return { success: true, data: [] };
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  const challenges: Challenge[] = raw.map((c: any) => ({
    id: String(c.id),
    title: c.title ?? c.name ?? '',
    desc: c.description ?? c.desc ?? '',
    emoji: c.emoji ?? c.icon ?? '🎯',
    points: Number(c.points ?? c.gamification_points ?? 0),
    progress: Number(c.progress ?? c.current ?? 0),
    total: Number(c.total ?? c.target ?? 1),
  }));
  return { success: true, data: challenges };
}

export async function completeChallenge(challengeId: string): Promise<ApiResponse<{ points: number }>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/challenges/${challengeId}/complete`, {
    method: 'POST',
  });
  if (!res.success) return res as ApiResponse<{ points: number }>;
  const raw = res.data;
  return { success: true, data: { points: Number(raw?.points ?? raw?.gamification_points ?? 0) } };
}

export async function listPolls(): Promise<ApiResponse<Poll[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Engage] listPolls eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };
  const res = await request<any>(`/api/v1/events/${eventId}/mobile-polls`);
  if (!res.success) return res as ApiResponse<Poll[]>;
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  const polls: Poll[] = raw.map((p: any) => ({
    id: String(p.id),
    question: p.question ?? p.title ?? '',
    session: p.session ?? p.session_title ?? '',
    points: Number(p.points ?? p.gamification_points ?? 10),
    totalVotes: Number(p.total_votes ?? p.totalVotes ?? 0),
    options: (p.options ?? p.answers ?? []).map((o: any) => ({
      id: String(o.id),
      text: o.text ?? o.answer ?? o.label ?? '',
      votes: Number(o.votes ?? o.vote_count ?? 0),
    })),
  }));
  return { success: true, data: polls };
}

export async function votePoll(pollId: string, optionId: string): Promise<ApiResponse<{ points: number; results: Array<{ id: string; votes: number }> }>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  return request(`/api/v1/events/${eventId}/mobile-polls/${pollId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  });
}

export async function listSurveys(): Promise<ApiResponse<Survey[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Engage] listSurveys eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };
  const res = await request<any>(`/api/v1/events/${eventId}/mobile-surveys`);
  if (!res.success) return res as ApiResponse<Survey[]>;
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  const surveys: Survey[] = raw.map((s: any) => ({
    id: String(s.id),
    title: s.title ?? s.name ?? '',
    desc: s.description ?? s.desc ?? '',
    questions: Number(s.questions_count ?? s.questions ?? 0),
    points: Number(s.points ?? s.gamification_points ?? 50),
  }));
  return { success: true, data: surveys };
}

export async function submitSurvey(surveyId: string, answers: Record<string, string>): Promise<ApiResponse<{ points: number }>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  return request<{ points: number }>(`/api/v1/events/${eventId}/mobile-surveys/${surveyId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export async function listGiveaways(): Promise<ApiResponse<Giveaway[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Engage] listGiveaways eventId=${eventId}`);
  if (!eventId) return { success: true, data: [] };
  const res = await request<any>(`/api/v1/events/${eventId}/giveaways`);
  if (!res.success) return { success: true, data: [] };
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const giveaways: Giveaway[] = raw.map((g: any, i: number) => ({
    id: String(g.id),
    title: g.title ?? g.name ?? g.prize ?? '',
    sponsor: g.sponsor ?? g.sponsor_name ?? '',
    entries: Number(g.entries ?? g.entry_count ?? 0),
    ends: g.ends_at ? new Date(g.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : g.ends ?? '',
    color: g.color ?? COLORS[i % COLORS.length],
    entered: Boolean(g.entered ?? g.has_entered ?? false),
  }));
  return { success: true, data: giveaways };
}

export async function enterGiveaway(giveawayId: string): Promise<ApiResponse<{ entries: number }>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/giveaways/${giveawayId}/enter`, {
    method: 'POST',
  });
  if (!res.success) return res as ApiResponse<{ entries: number }>;
  return { success: true, data: { entries: Number(res.data?.entries ?? res.data?.entry_count ?? 1) } };
}
