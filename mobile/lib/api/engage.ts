import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Challenge, Poll, Survey, Giveaway, GiveawayWinner } from '@/lib/api/types';

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
  // Probe the same response shapes the web client supports (bare
  // array, { data: [...] }, or { giveaways: [...] }) so a Laravel
  // resource collection wrapped under a named key still parses.
  let raw: any[] = [];
  if (Array.isArray(res.data)) raw = res.data;
  else if (Array.isArray(res.data?.data)) raw = res.data.data;
  else if (Array.isArray(res.data?.giveaways)) raw = res.data.giveaways;
  const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const giveaways: Giveaway[] = raw.map((g: any, i: number) => {
    // Normalize winners from the same response — this is the single source
    // of truth for who won which giveaway (avoids separate fetches and keeps
    // web + mobile in sync through the same backend endpoint).
    const rawWinners: any[] = Array.isArray(g.winners)
      ? g.winners
      : Array.isArray(g.winner_list)
      ? g.winner_list
      : Array.isArray(g.draws)
      ? g.draws
      : [];
    const winners: GiveawayWinner[] = rawWinners
      .map((w: any): GiveawayWinner | null => {
        if (!w || typeof w !== 'object') return null;
        const lead = w.lead ?? w.attendee ?? w.user ?? null;
        const id = String(w.id ?? w.winner_id ?? w.winnerId ?? lead?.id ?? '');
        const name =
          w.name ?? w.winner_name ?? w.full_name ?? lead?.name ?? lead?.full_name ?? '';
        if (!id || !name) return null;
        const drawnSrc = w.drawn_at ?? w.drawnAt ?? w.created_at ?? w.createdAt;
        const drawnAt = drawnSrc ? new Date(drawnSrc) : new Date();
        return {
          id,
          name,
          company: w.company ?? w.company_name ?? lead?.company ?? lead?.company_name ?? undefined,
          title: w.title ?? w.job_title ?? lead?.title ?? undefined,
          avatar: w.avatar ?? w.avatar_url ?? lead?.avatar ?? undefined,
          drawnAt: (isNaN(drawnAt.getTime()) ? new Date() : drawnAt).toISOString(),
        };
      })
      .filter((w): w is GiveawayWinner => w !== null);
    return {
      id: String(g.id ?? g.giveaway_id ?? g.uuid ?? `g-${i}`),
      title: g.title ?? g.name ?? g.prize ?? g.label ?? '',
      sponsor:
        g.sponsor ??
        g.sponsor_name ??
        g.sponsorName ??
        g.sponsor?.name ??
        g.sponsor?.company_name ??
        '',
      entries: Number(g.entries ?? g.entry_count ?? 0),
      ends: g.ends_at ? new Date(g.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : g.ends ?? '',
      color: g.color ?? COLORS[i % COLORS.length],
      entered: Boolean(g.entered ?? g.has_entered ?? false),
      ...(winners.length > 0 ? { winners } : {}),
    };
  });
  return { success: true, data: giveaways };
}

export interface SaveWinnerPayload {
  id: string;
  name: string;
  company?: string;
  title?: string;
  avatar?: string;
  drawnAt: string;
}

/**
 * POST /api/v1/events/:eventId/giveaways/:giveawayId/winners
 *
 * Records the winner of a lucky draw against the specific giveaway so the
 * backend persists it and returns it in subsequent GET giveaways responses —
 * ensuring web, mobile, and any back-office view all show the same winner.
 * Sends both camelCase and snake_case variants for backend compatibility.
 */
export async function saveGiveawayWinner(
  giveawayId: string,
  winner: SaveWinnerPayload,
): Promise<ApiResponse<true>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  if (!giveawayId) return { success: false, error: { code: 'NO_GIVEAWAY', message: 'No giveaway selected' } };
  if (__DEV__) console.log(`[Engage] saveGiveawayWinner giveawayId=${giveawayId} winner=${winner.name}`);
  const body = {
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
  const res = await request<any>(`/api/v1/events/${eventId}/giveaways/${giveawayId}/winners`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.success) return res as ApiResponse<true>;
  return { success: true, data: true };
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

export interface CreateGiveawayPayload {
  title: string;
  numberOfItems: number;
  image: string;
  sponsorName: string;
  sponsorId: string;
}

export async function createGiveaway(payload: CreateGiveawayPayload): Promise<ApiResponse<Giveaway>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
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
  const res = await request<any>(`/api/v1/events/${eventId}/giveaways`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.success) return res as ApiResponse<Giveaway>;
  const raw = res.data?.data ?? res.data;
  const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const giveaway: Giveaway = {
    id: String(raw?.id ?? ''),
    title: raw?.title ?? raw?.name ?? raw?.prize ?? payload.title,
    sponsor: raw?.sponsor ?? raw?.sponsor_name ?? payload.sponsorName,
    entries: Number(raw?.entries ?? raw?.entry_count ?? 0),
    ends: raw?.ends_at ? new Date(raw.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : raw?.ends ?? '',
    color: raw?.color ?? COLORS[0],
    entered: Boolean(raw?.entered ?? raw?.has_entered ?? false),
  };
  return { success: true, data: giveaway };
}

export async function removeGiveaway(giveawayId: string): Promise<ApiResponse<true>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/giveaways/${giveawayId}`, {
    method: 'DELETE',
  });
  if (!res.success) return res as ApiResponse<true>;
  return { success: true, data: true };
}
