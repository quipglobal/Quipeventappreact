/**
 * Engagement API Client (event-scoped)
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend contract:
 *   GET  /api/v1/events/:eventId/surveys
 *   GET  /api/v1/events/:eventId/surveys/:surveyId          (with questions)
 *   POST /api/v1/events/:eventId/surveys/:surveyId/submit   { answers:[{question_id, answer_text}] }
 *
 *   GET  /api/v1/events/:eventId/polls
 *   GET  /api/v1/events/:eventId/polls/:pollId              (with options)
 *   POST /api/v1/events/:eventId/polls/:pollId/vote         { option_id }
 *
 *   GET  /api/v1/events/:eventId/gamification/challenges
 *   POST /api/v1/events/:eventId/gamification/challenges/:challengeId/complete
 */

import { apiGet, apiPost } from './client';

// ─── Surveys ────────────────────────────────────────────────────────────────

export type BackendSurveyQuestionType =
  | 'rating' | 'nps'
  | 'singleChoice' | 'single_choice' | 'single' | 'radio' | 'select'
  | 'multiChoice' | 'multi_choice' | 'multi' | 'checkbox' | 'multiple' | 'multiple_choice'
  | 'text' | 'long_text' | 'open' | 'open_ended' | 'short_answer' | 'textarea' | 'free_text'
  | (string & {});

export interface BackendSurveyQuestion {
  id: number;
  survey_id: number;
  order: number;
  question_text: string;
  question_type: BackendSurveyQuestionType;
  is_required: boolean;
  options: string[] | null;
}

export interface BackendSurveySummary {
  id: number;
  event_id: number;
  title: string;
  description: string | null;
  status: string;
  questions_count?: number;
  /** True when the backend confirms the current user has already submitted
   *  this survey. Used to seed local completion state on list load so a
   *  fresh session / logout-login never shows surveys as incomplete. */
  is_completed?: boolean;
}

export interface BackendSurveyDetail extends BackendSurveySummary {
  questions: BackendSurveyQuestion[];
}

export interface SurveyAnswer {
  question_id: number;
  answer_text: string;
}

export async function listEventSurveysApi(
  eventId: string | number
): Promise<{ success: boolean; data?: BackendSurveySummary[]; error?: { code?: string; message: string } }> {
  // Primary: /surveys  |  Fallback: /mobile-surveys (same path the mobile app uses)
  let res = await apiGet<any>(`/api/v1/events/${eventId}/surveys`);
  if (!res.success) res = await apiGet<any>(`/api/v1/events/${eventId}/mobile-surveys`);
  if (!res.success) return { success: false, error: res.error ?? { message: 'Failed to load surveys.' } };
  // Normalise envelope shapes: bare array OR { data: [...] }.
  const raw: any = res.data;
  const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
  const surveys: BackendSurveySummary[] = list.map((s: any) => ({
    id: s.id,
    event_id: s.event_id,
    title: s.title ?? '',
    description: s.description ?? null,
    status: s.status ?? '',
    questions_count: s.questions_count,
    // Probe every field alias the backend might use for server-side completion.
    is_completed: !!(
      s.is_completed ?? s.completed ?? s.user_completed ??
      s.user_submitted ?? s.has_response ?? s.has_submission ?? false
    ),
  }));
  return { success: true, data: surveys };
}

export async function getEventSurveyApi(
  eventId: string | number,
  surveyId: string | number
): Promise<{ success: boolean; data?: BackendSurveyDetail; error?: { code?: string; message: string } }> {
  const res = await apiGet<BackendSurveyDetail>(`/api/v1/events/${eventId}/surveys/${surveyId}`);
  if (!res.success || !res.data) return { success: false, error: res.error ?? { message: 'Failed to load survey.' } };
  return { success: true, data: res.data };
}

export async function submitEventSurveyApi(
  eventId: string | number,
  surveyId: string | number,
  answers: SurveyAnswer[]
): Promise<{ success: boolean; error?: { code?: string; message: string } }> {
  const res = await apiPost<unknown>(
    `/api/v1/events/${eventId}/surveys/${surveyId}/submit`,
    { answers }
  );
  if (!res.success) return { success: false, error: res.error ?? { code: 'SUBMIT_FAILED', message: 'Failed to submit survey.' } };
  return { success: true };
}

// ─── Polls ──────────────────────────────────────────────────────────────────

export interface BackendPollOption {
  id: number;
  poll_id: number;
  option_text: string;
  order: number;
}

export interface BackendPollSummary {
  id: number;
  event_id: number;
  title: string;
  status: string;                    // 'LIVE' | 'CLOSED' | ...
  results_visibility: string;        // 'AFTER_VOTE' | 'ALWAYS' | 'AFTER_CLOSE'
  starts_at: string | null;
  ends_at: string | null;
  options_count?: number;
  /** The option id the current user already voted for, if any.
   *  Normalised from multiple backend field aliases (user_vote, voted_option_id,
   *  my_vote, …) so a fresh session re-shows the user's prior selection. */
  user_voted_option_id?: number | null;
}

export interface BackendPollDetail extends BackendPollSummary {
  options: BackendPollOption[];
}

export interface PollResultRow {
  id: number;
  option_text: string;
  votes: number;
  percentage: number;
}

export interface PollVoteResult {
  voted_option_id: number;
  total_votes: number;
  results: PollResultRow[];
}

export async function listEventPollsApi(
  eventId: string | number
): Promise<{ success: boolean; data?: BackendPollSummary[]; error?: { code?: string; message: string } }> {
  // Primary: /polls  |  Fallback: /mobile-polls (same path the mobile app uses)
  let res = await apiGet<any>(`/api/v1/events/${eventId}/polls`);
  if (!res.success) res = await apiGet<any>(`/api/v1/events/${eventId}/mobile-polls`);
  if (!res.success) return { success: false, error: res.error ?? { message: 'Failed to load polls.' } };
  // Normalise both envelope shapes: bare array OR { data: [...] }.
  const raw: any = res.data;
  const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
  const polls: BackendPollSummary[] = list.map((p: any) => {
    // Probe every alias the backend might use for the user's prior vote.
    const rawVote =
      p.user_voted_option_id ?? p.user_vote ?? p.voted_option_id ??
      p.my_vote ?? p.user_answer ?? p.user_voted_option ?? p.selected_option_id ?? null;
    return {
      id: p.id,
      event_id: p.event_id,
      title: p.title ?? '',
      status: p.status ?? '',
      results_visibility: p.results_visibility ?? '',
      starts_at: p.starts_at ?? null,
      ends_at: p.ends_at ?? null,
      options_count: p.options_count,
      user_voted_option_id: rawVote != null ? Number(rawVote) : null,
    };
  });
  return { success: true, data: polls };
}

export async function getEventPollApi(
  eventId: string | number,
  pollId: string | number
): Promise<{ success: boolean; data?: BackendPollDetail; error?: { code?: string; message: string } }> {
  const res = await apiGet<BackendPollDetail>(`/api/v1/events/${eventId}/polls/${pollId}`);
  if (!res.success || !res.data) return { success: false, error: res.error ?? { message: 'Failed to load poll.' } };
  return { success: true, data: res.data };
}

export async function submitEventPollVoteApi(
  eventId: string | number,
  pollId: string | number,
  optionId: number
): Promise<{ success: boolean; data?: PollVoteResult; error?: { code?: string; message: string } }> {
  const res = await apiPost<PollVoteResult>(
    `/api/v1/events/${eventId}/polls/${pollId}/vote`,
    { option_id: optionId }
  );
  if (!res.success || !res.data) return { success: false, error: res.error ?? { code: 'VOTE_FAILED', message: 'Failed to submit vote.' } };
  return { success: true, data: res.data };
}

// ─── Challenges ─────────────────────────────────────────────────────────────
//
// Backend contract (Challenges API Reference, updated):
//   GET  /api/v1/events/:eventId/gamification/challenges
//        → { success: true, data: BackendChallenge[] }
//        Response is Cache-Control: private, no-store — always fetch fresh.
//        Automatically seeds 5 default challenges and backfills eligibility.
//
//   POST /api/v1/events/:eventId/gamification/challenges/:id/claim
//        → 200 { success:true, data:{ awarded, points_earned, summary } }
//        → 409 { success:false, error:{ code:'ALREADY_CLAIMED', … } }
//        → 422 { success:false, error:{ code:'NOT_ELIGIBLE', … } }

/**
 * Known criteria_type values seeded automatically by the backend.
 * The mobile/web UI uses these to show appropriate descriptions and icons.
 */
export type ChallengeCriteriaType =
  | 'SURVEY_AND_POLL'   // Vote in ≥1 poll AND submit ≥1 survey
  | 'PARTNER_MEETING'   // Complete a meeting with a sponsor rep
  | 'SPONSOR_FEEDBACK'  // Submit ≥1 sponsor review
  | 'EXTERNAL_ACTION'   // Admin manually marks user eligible
  | 'VISIT_ALL_SPONSORS'// Get scanned by a rep from every partner company
  | (string & {});      // Forward-compat with future types

export interface BackendChallenge {
  id: number;
  title: string;
  description: string | null;
  points: number;
  /** Discriminates the completion criteria. Use this to show the right icon/description. */
  criteria_type: ChallengeCriteriaType;
  is_active: boolean;
  is_default: boolean;
  max_completions: number | null;
  completions_count: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  /**
   * Server-evaluated user state for this challenge.
   *   'not_started' — criteria not yet met; Claim button must be locked.
   *   'eligible'    — criteria met; Claim button should be active.
   *   'claimed'     — points already awarded; show as complete.
   */
  user_status: 'not_started' | 'eligible' | 'claimed';
  /**
   * Convenience mirror of user_status === 'eligible'.
   * True only when the user may tap Claim right now.
   */
  can_claim: boolean;
}

export interface ChallengeClaimResult {
  awarded: boolean;
  points_earned: number;
  summary?: {
    total_points: number;
    rank: number;
    breakdown?: Record<string, { points: number; count: number }>;
  };
}

/**
 * GET /api/v1/events/:eventId/gamification/challenges
 *
 * Always fetches fresh — do NOT use a client-side cache for this endpoint.
 * The server sets Cache-Control: private, no-store and recomputes eligibility
 * on every request based on the user's latest actions.
 */
export async function listEventChallengesApi(
  eventId: string | number
): Promise<{ success: boolean; data?: BackendChallenge[]; error?: { code?: string; message: string } }> {
  // Primary: /gamification/challenges  |  Fallback: /challenges (mobile-app path)
  // The backend has been observed to return non-JSON (HTML error page) for
  // authenticated requests to /gamification/challenges; the shorter path is
  // the one the mobile app uses and is typically more stable.
  let res = await apiGet<
    { success: boolean; data: BackendChallenge[] } | BackendChallenge[]
  >(`/api/v1/events/${eventId}/gamification/challenges`);

  if (!res.success) {
    res = await apiGet<
      { success: boolean; data: BackendChallenge[] } | BackendChallenge[]
    >(`/api/v1/events/${eventId}/challenges`);
  }

  if (!res.success) return { success: false, error: res.error ?? { message: 'Failed to load challenges.' } };

  // Normalise both envelope shapes: { success, data: [...] } and bare array.
  const raw = res.data as ({ success: boolean; data: BackendChallenge[] } | BackendChallenge[]);
  const challenges: BackendChallenge[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
  return { success: true, data: challenges };
}

/**
 * POST /api/v1/events/:eventId/gamification/challenges/:challengeId/claim
 *
 * Only call when can_claim is true. The backend awards points atomically.
 * 409 = already claimed (treat as success — mark done, refresh list).
 * 422 = not yet eligible (criteria not met — refresh list to re-sync state).
 */
export async function claimEventChallengeApi(
  eventId: string | number,
  challengeId: string | number
): Promise<{ success: boolean; data?: ChallengeClaimResult; error?: { code?: string; message: string } }> {
  const res = await apiPost<
    { success: boolean; data: ChallengeClaimResult } | ChallengeClaimResult
  >(
    `/api/v1/events/${eventId}/gamification/challenges/${challengeId}/claim`,
    {}
  );

  if (!res.success) return { success: false, error: res.error ?? { code: 'CLAIM_FAILED', message: 'Failed to claim challenge.' } };

  // Normalise both envelope shapes.
  const raw = res.data as ({ success: boolean; data: ChallengeClaimResult } | ChallengeClaimResult);
  const data: ChallengeClaimResult =
    raw && 'data' in raw && typeof (raw as { data?: unknown }).data === 'object' && (raw as { data?: unknown }).data !== null
      ? (raw as { success: boolean; data: ChallengeClaimResult }).data
      : (raw as ChallengeClaimResult);
  return { success: true, data };
}

/**
 * @deprecated Use claimEventChallengeApi — the endpoint changed from /complete to /claim.
 * Kept as an alias so any un-migrated callers don't break silently.
 */
export const completeEventChallengeApi = claimEventChallengeApi;

// Giveaways live in `giveawaysClient.ts` and are sourced exclusively
// from the backend (event-scoped). Attendees can no longer self-claim
// — entry happens server-side when a sponsor rep scans their badge —
// so the in-memory mock list / enter / status helpers that used to
// live here have been removed.
