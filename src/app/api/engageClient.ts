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
  const res = await apiGet<BackendSurveySummary[]>(`/api/v1/events/${eventId}/surveys`);
  if (!res.success) return { success: false, error: res.error ?? { message: 'Failed to load surveys.' } };
  return { success: true, data: res.data ?? [] };
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
  const res = await apiGet<BackendPollSummary[]>(`/api/v1/events/${eventId}/polls`);
  if (!res.success) return { success: false, error: res.error ?? { message: 'Failed to load polls.' } };
  return { success: true, data: res.data ?? [] };
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

export interface BackendChallenge {
  id: number;
  title: string;
  description: string | null;
  points: number;
  is_active: boolean;
  max_completions: number | null;
  completions_count: number;
  starts_at: string | null;
  ends_at: string | null;
}

export interface ChallengeCompleteResult {
  awarded: boolean;
  points_earned: number;
  summary?: {
    total_points: number;
    rank: number;
    breakdown?: Record<string, { points: number; count: number }>;
  };
}

export async function listEventChallengesApi(
  eventId: string | number
): Promise<{ success: boolean; data?: BackendChallenge[]; error?: { code?: string; message: string } }> {
  const res = await apiGet<BackendChallenge[]>(`/api/v1/events/${eventId}/gamification/challenges`);
  if (!res.success) return { success: false, error: res.error ?? { message: 'Failed to load challenges.' } };
  return { success: true, data: res.data ?? [] };
}

export async function completeEventChallengeApi(
  eventId: string | number,
  challengeId: string | number
): Promise<{ success: boolean; data?: ChallengeCompleteResult; error?: { code?: string; message: string } }> {
  const res = await apiPost<ChallengeCompleteResult>(
    `/api/v1/events/${eventId}/gamification/challenges/${challengeId}/complete`,
    {}
  );
  if (!res.success || !res.data) return { success: false, error: res.error ?? { code: 'COMPLETE_FAILED', message: 'Failed to complete challenge.' } };
  return { success: true, data: res.data };
}

// Giveaways live in `giveawaysClient.ts` and are sourced exclusively
// from the backend (event-scoped). Attendees can no longer self-claim
// — entry happens server-side when a sponsor rep scans their badge —
// so the in-memory mock list / enter / status helpers that used to
// live here have been removed.
