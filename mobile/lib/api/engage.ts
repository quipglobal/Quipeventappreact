import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Challenge, Poll, Survey, SurveyDetail, SurveyQuestion, SurveyQuestionType, SurveyQuestionOption, Giveaway, GiveawayWinner } from '@/lib/api/types';

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
  const CLOSED = ['ended', 'closed', 'inactive', 'draft', 'completed', 'expired'];
  const polls: Poll[] = raw.map((p: any) => {
    const rawStatus = String(p.status ?? p.poll_status ?? '').toLowerCase();
    const isLive: boolean =
      p.is_live !== undefined ? Boolean(p.is_live)
      : p.is_active !== undefined ? Boolean(p.is_active)
      : p.active !== undefined ? Boolean(p.active)
      : CLOSED.includes(rawStatus) ? false
      : true;
    const rawUserVote =
      p.user_vote ?? p.voted_option_id ?? p.my_vote ?? p.user_answer ??
      p.user_voted_option ?? p.selected_option_id ?? null;
    const userVotedOptionId = rawUserVote != null ? String(rawUserVote) : undefined;
    return {
      id: String(p.id),
      question: p.question ?? p.title ?? '',
      session: p.session ?? p.session_title ?? '',
      points: Number(p.points ?? p.gamification_points ?? 10),
      totalVotes: Number(p.total_votes ?? p.totalVotes ?? 0),
      isLive,
      options: (p.options ?? p.answers ?? []).map((o: any) => ({
        id: String(o.id),
        text: o.text ?? o.answer ?? o.label ?? '',
        votes: Number(o.votes ?? o.vote_count ?? 0),
      })),
      ...(userVotedOptionId !== undefined ? { userVotedOptionId } : {}),
    };
  });
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

export async function getSurveyDetail(surveyId: string): Promise<ApiResponse<SurveyDetail>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/mobile-surveys/${surveyId}`);
  if (!res.success) return res as ApiResponse<SurveyDetail>;
  const raw = res.data?.data ?? res.data;

  const TYPE_MAP: Record<string, SurveyQuestionType> = {
    text: 'text', open: 'text', textarea: 'text', open_ended: 'text',
    multiple_choice: 'single_choice', radio: 'single_choice', single: 'single_choice', single_choice: 'single_choice',
    checkbox: 'checkbox', multi_select: 'checkbox', multiple: 'checkbox',
    rating: 'rating', scale: 'rating', stars: 'rating', number: 'rating',
    yes_no: 'yes_no', boolean: 'yes_no', yesno: 'yes_no', yes_or_no: 'yes_no',
  };

  const rawQuestions: any[] = Array.isArray(raw?.questions)
    ? raw.questions
    : Array.isArray(raw?.survey_questions)
    ? raw.survey_questions
    : [];

  const questionList: SurveyQuestion[] = rawQuestions.map((q: any, i: number) => {
    const rawType = String(q.type ?? q.question_type ?? q.input_type ?? 'text').toLowerCase().replace(/[-\s]/g, '_');
    const type: SurveyQuestionType = TYPE_MAP[rawType] ?? 'text';

    const rawOpts: any[] = Array.isArray(q.options) ? q.options
      : Array.isArray(q.choices) ? q.choices
      : Array.isArray(q.answers) ? q.answers
      : [];
    const options: SurveyQuestionOption[] = rawOpts.map((o: any, oi: number) => ({
      id: String(o.id ?? o.value ?? oi),
      text: typeof o === 'string' ? o : (o.text ?? o.label ?? o.value ?? String(o)),
    }));

    return {
      id: String(q.id ?? `q${i}`),
      type,
      text: q.text ?? q.question ?? q.label ?? q.title ?? '',
      required: Boolean(q.required ?? q.is_required ?? false),
      options: options.length > 0 ? options : undefined,
      min: Number(q.min ?? 1),
      max: Number(q.max ?? 5),
    };
  });

  return {
    success: true,
    data: {
      id: String(raw?.id ?? surveyId),
      title: raw?.title ?? raw?.name ?? '',
      desc: raw?.description ?? raw?.desc ?? '',
      questions: questionList.length || Number(raw?.questions_count ?? raw?.questions ?? 0),
      questionList,
      points: Number(raw?.points ?? raw?.gamification_points ?? 50),
    },
  };
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
    const numberOfItems = Number(
      g.number_of_items ?? g.numberOfItems ?? g.quantity ?? g.total ?? g.total_available ?? 0,
    );
    const image = g.image ?? g.image_url ?? g.imageUrl ?? g.photo ?? g.photo_url ?? '';
    const sponsorId = String(g.sponsor_id ?? g.sponsorId ?? g.sponsor?.id ?? g.user_id ?? g.created_by ?? '');
    const createdSrc = g.created_at ?? g.createdAt ?? g.created;
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
      ...(numberOfItems > 0 ? { numberOfItems } : {}),
      ...(image ? { image } : {}),
      ...(sponsorId ? { sponsorId } : {}),
      ...(createdSrc ? { createdAt: new Date(createdSrc).toISOString() } : {}),
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

/**
 * Session-scoped short-circuit flags mirroring the web `giveawaysClient`.
 * Once the backend confirms a giveaway CRUD route isn't deployed
 * (404/405), we stop round-tripping for the rest of the session and
 * surface a typed NOT_IMPLEMENTED so callers can keep the optimistic
 * local row instead of rolling it back. Reset on event switch via
 * `resetGiveawaysEndpointMissing`.
 */
let createEndpointMissing = false;
let updateEndpointMissing = false;
let deleteEndpointMissing = false;

export function resetGiveawaysEndpointMissing(): void {
  createEndpointMissing = false;
  updateEndpointMissing = false;
  deleteEndpointMissing = false;
}

/**
 * The mobile `request()` collapses HTTP status into a generic
 * REQUEST_FAILED code but preserves the server message. A Laravel
 * "route could not be found" (404) or "method is not supported" (405)
 * both mean the endpoint isn't deployed, so we sniff the message to
 * decide whether to degrade to local-only rather than surface a hard
 * error to the sponsor.
 */
function isRouteMissing(error?: { code?: string; message?: string }): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  if (code === '404' || code === '405' || code === 'NOT_IMPLEMENTED') return true;
  const msg = String(error.message ?? '').toLowerCase();
  return (
    msg.includes('could not be found') ||
    msg.includes('not be found') ||
    msg.includes('not supported') ||
    msg.includes('not found') ||
    msg.includes('404') ||
    msg.includes('405')
  );
}

function mapGiveawayRow(raw: any, fallbackTitle = '', fallbackSponsor = ''): Giveaway {
  const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const numberOfItems = Number(
    raw?.number_of_items ?? raw?.numberOfItems ?? raw?.quantity ?? raw?.total ?? 0,
  );
  const image = raw?.image ?? raw?.image_url ?? raw?.imageUrl ?? '';
  const sponsorId = String(raw?.sponsor_id ?? raw?.sponsorId ?? raw?.sponsor?.id ?? raw?.user_id ?? '');
  const createdSrc = raw?.created_at ?? raw?.createdAt ?? raw?.created;
  return {
    id: String(raw?.id ?? raw?.giveaway_id ?? raw?.uuid ?? ''),
    title: raw?.title ?? raw?.name ?? raw?.prize ?? fallbackTitle,
    sponsor: raw?.sponsor ?? raw?.sponsor_name ?? raw?.sponsorName ?? fallbackSponsor,
    entries: Number(raw?.entries ?? raw?.entry_count ?? 0),
    ends: raw?.ends_at ? new Date(raw.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : raw?.ends ?? '',
    color: raw?.color ?? COLORS[0],
    entered: Boolean(raw?.entered ?? raw?.has_entered ?? false),
    ...(numberOfItems > 0 ? { numberOfItems } : {}),
    ...(image ? { image } : {}),
    ...(sponsorId ? { sponsorId } : {}),
    ...(createdSrc ? { createdAt: new Date(createdSrc).toISOString() } : {}),
  };
}

export async function createGiveaway(payload: CreateGiveawayPayload): Promise<ApiResponse<Giveaway>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
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
  const res = await request<any>(`/api/v1/events/${eventId}/giveaways`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.success) {
    if (isRouteMissing(res.error)) {
      createEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway create endpoint not deployed.' } };
    }
    return res as ApiResponse<Giveaway>;
  }
  const raw = res.data?.data ?? res.data;
  return { success: true, data: mapGiveawayRow(raw, payload.title, payload.sponsorName) };
}

export interface UpdateGiveawayPayload {
  title?: string;
  numberOfItems?: number;
  image?: string;
}

/**
 * PUT /api/v1/events/:eventId/giveaways/:giveawayId
 *
 * Mirrors the web `giveawaysClient.updateGiveaway`: the Laravel route is
 * registered with PUT (a PATCH gets a 405), and we send both camelCase
 * and snake_case field variants so either backend convention works.
 * Synthetic ids (`giveaway-<ts>`) never round-tripped through the backend,
 * so we short-circuit to NOT_IMPLEMENTED and let the caller keep the
 * local-only edit.
 */
export async function updateGiveaway(
  giveawayId: string,
  payload: UpdateGiveawayPayload,
): Promise<ApiResponse<Giveaway>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  if (updateEndpointMissing || giveawayId.startsWith('giveaway-')) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway update endpoint not deployed.' } };
  }
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.numberOfItems !== undefined) {
    body.number_of_items = payload.numberOfItems;
    body.numberOfItems = payload.numberOfItems;
    body.quantity = payload.numberOfItems;
  }
  if (payload.image !== undefined) {
    body.image = payload.image;
    body.image_url = payload.image;
  }
  const res = await request<any>(`/api/v1/events/${eventId}/giveaways/${giveawayId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.success) {
    if (isRouteMissing(res.error)) {
      updateEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway update endpoint not deployed.' } };
    }
    return res as ApiResponse<Giveaway>;
  }
  const raw = res.data?.data ?? res.data;
  return { success: true, data: mapGiveawayRow(raw, payload.title ?? '') };
}

export async function removeGiveaway(giveawayId: string): Promise<ApiResponse<true>> {
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  if (deleteEndpointMissing || giveawayId.startsWith('giveaway-')) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway delete endpoint not deployed.' } };
  }
  const res = await request<any>(`/api/v1/events/${eventId}/giveaways/${giveawayId}`, {
    method: 'DELETE',
  });
  if (!res.success) {
    if (isRouteMissing(res.error)) {
      deleteEndpointMissing = true;
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Giveaway delete endpoint not deployed.' } };
    }
    return res as ApiResponse<true>;
  }
  return { success: true, data: true };
}
