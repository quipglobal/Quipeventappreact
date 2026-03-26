/**
 * Engagement API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   POST /api/polls/:id/vote            → { optionId }                    → { success, results }
 *   GET  /api/polls/:id/results                                           → { results }
 *   POST /api/surveys/:id/submit        → { answers }                     → { success }
 *   POST /api/challenges/:id/complete                                     → { success, points }
 *   GET  /api/giveaways                                                   → { giveaways }
 *   POST /api/giveaways/:id/enter                                         → { success, entryStatus }
 *   GET  /api/giveaways/:id/status                                        → { entryStatus }
 *
 * Set VITE_USE_MOCK_API=true in .env to run without a live backend.
 */

import { apiGet, apiPost } from './client';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const delay = (ms = 600) => new Promise<void>(r => setTimeout(r, ms));

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollResults {
  pollId: string;
  totalVotes: number;
  options: PollOption[];
  userVotedOptionId?: string;
}

export interface VotePollResponse {
  success: boolean;
  data?: PollResults;
  error?: { code?: string; message: string };
}

export interface SubmitSurveyResponse {
  success: boolean;
  error?: { code?: string; message: string };
}

export interface CompleteChallengeResponse {
  success: boolean;
  data?: { pointsAwarded: number };
  error?: { code?: string; message: string };
}

export interface GiveawayEntry {
  giveawayId: string;
  entered: boolean;
  entryCount: number;
}

export interface GiveawayEntryResponse {
  success: boolean;
  data?: GiveawayEntry;
  error?: { code?: string; message: string };
}

export interface GiveawayItem {
  id: string;
  sponsorName: string;
  sponsorLogo: string;
  sponsorTier: 'Platinum' | 'Gold' | 'Silver';
  booth: string;
  title: string;
  description: string;
  image: string;
  type: 'raffle' | 'swag' | 'offer' | 'demo';
  requirement: string;
  pointsBonus: number;
  claimCount: number;
  totalAvailable: number | null;
  endsAt: string;
  featured?: boolean;
}

export interface ListGiveawaysResponse {
  success: boolean;
  data?: GiveawayItem[];
  error?: { code?: string; message: string };
}

// ─── In-memory mock state ──────────────────────────────────────────────────

const mockVotes: Record<string, { optionId: string; results: Record<string, number> }> = {};
const mockSurveySubmissions: Set<string> = new Set();
const mockChallengeCompletions: Set<string> = new Set();
const mockGiveawayEntries: Set<string> = new Set();

const mockGiveawayList: GiveawayItem[] = [
  {
    id: 'g1', sponsorName: 'TechCorp Solutions',
    sponsorLogo: 'https://ui-avatars.com/api/?name=TechCorp&background=6366f1&color=fff&size=128',
    sponsorTier: 'Platinum', booth: 'A-12', title: 'Win a MacBook Pro M4',
    description: 'Visit our booth for a product demo and enter the raffle for a brand new MacBook Pro with M4 chip.',
    image: 'https://images.unsplash.com/photo-1764650909534-ebe7b1206466?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnaWZ0JTIwYm94JTIwZ2l2ZWF3YXklMjBwcml6ZSUyMHJhZmZsZXxlbnwxfHx8fDE3NzE4MzkxNTJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    type: 'raffle', requirement: 'Complete a booth demo', pointsBonus: 50,
    claimCount: 342, totalAvailable: null, endsAt: 'Jan 18, 5:00 PM', featured: true,
  },
  {
    id: 'g2', sponsorName: 'InnovateLab',
    sponsorLogo: 'https://ui-avatars.com/api/?name=InnovateLab&background=8b5cf6&color=fff&size=128',
    sponsorTier: 'Gold', booth: 'B-05', title: 'Free Cloud Credits — $500',
    description: 'Get $500 in free cloud credits when you sign up for a trial at our booth. Limited to first 200 attendees.',
    image: 'https://images.unsplash.com/photo-1746937618165-c8dc7f11dd77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNoJTIwY29uZmVyZW5jZSUyMGV4cG8lMjBib290aCUyMGRpc3BsYXl8ZW58MXx8fHwxNzcxODM5MTUyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    type: 'offer', requirement: 'Sign up for trial', pointsBonus: 30,
    claimCount: 147, totalAvailable: 200, endsAt: 'Jan 18, 5:00 PM', featured: true,
  },
  {
    id: 'g3', sponsorName: 'DataFlow Systems',
    sponsorLogo: 'https://ui-avatars.com/api/?name=DataFlow&background=ec4899&color=fff&size=128',
    sponsorTier: 'Gold', booth: 'A-08', title: 'Exclusive T-Shirt & Sticker Pack',
    description: 'Grab a limited-edition DataFlow t-shirt and developer sticker pack at our booth.',
    image: '', type: 'swag', requirement: 'Check in at booth', pointsBonus: 20,
    claimCount: 89, totalAvailable: 150, endsAt: 'While supplies last',
  },
  {
    id: 'g4', sponsorName: 'SecureNet Inc',
    sponsorLogo: 'https://ui-avatars.com/api/?name=SecureNet&background=10b981&color=fff&size=128',
    sponsorTier: 'Silver', booth: 'C-15', title: 'Free Security Audit Report',
    description: 'Get a complimentary security audit report for your infrastructure. Book a 15-minute consultation at our booth.',
    image: '', type: 'demo', requirement: 'Book a consultation', pointsBonus: 40,
    claimCount: 34, totalAvailable: 50, endsAt: 'Jan 17, 6:00 PM',
  },
  {
    id: 'g5', sponsorName: 'CloudStream',
    sponsorLogo: 'https://ui-avatars.com/api/?name=CloudStream&background=f59e0b&color=fff&size=128',
    sponsorTier: 'Silver', booth: 'B-22', title: '3 Months Premium Free',
    description: 'Scan the QR code at our booth to claim 3 months of CloudStream Premium absolutely free.',
    image: '', type: 'offer', requirement: 'Scan QR at booth', pointsBonus: 25,
    claimCount: 210, totalAvailable: null, endsAt: 'Jan 18, 5:00 PM',
  },
];

// ─── Polls ─────────────────────────────────────────────────────────────────

/**
 * POST /api/polls/:id/vote
 * Submits the attendee's vote for a poll option.
 */
export async function submitPollVote(
  pollId: string,
  optionId: string,
  currentOptions: PollOption[]
): Promise<VotePollResponse> {
  if (USE_MOCK) {
    await delay(500);

    if (mockVotes[pollId]) {
      return { success: false, error: { code: 'ALREADY_VOTED', message: 'You have already voted in this poll.' } };
    }

    const updatedOptions = currentOptions.map(o => ({
      ...o,
      votes: o.id === optionId ? o.votes + 1 : o.votes,
    }));
    const totalVotes = updatedOptions.reduce((sum, o) => sum + o.votes, 0);

    mockVotes[pollId] = { optionId, results: Object.fromEntries(updatedOptions.map(o => [o.id, o.votes])) };

    return {
      success: true,
      data: {
        pollId,
        totalVotes,
        options: updatedOptions,
        userVotedOptionId: optionId,
      },
    };
  }

  const res = await apiPost<PollResults>(`/api/polls/${pollId}/vote`, { optionId });
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'VOTE_FAILED', message: 'Failed to submit vote.' } };
  }
  return { success: true, data: res.data };
}

/**
 * GET /api/polls/:id/results
 * Fetches current poll results.
 */
export async function fetchPollResults(pollId: string): Promise<{ success: boolean; data?: PollResults; error?: { message: string } }> {
  if (USE_MOCK) {
    await delay(400);
    const vote = mockVotes[pollId];
    if (!vote) {
      return { success: false, error: { message: 'No results yet.' } };
    }
    return {
      success: true,
      data: {
        pollId,
        totalVotes: Object.values(vote.results).reduce((s, v) => s + v, 0),
        options: Object.entries(vote.results).map(([id, votes]) => ({ id, text: '', votes })),
        userVotedOptionId: vote.optionId,
      },
    };
  }

  const res = await apiGet<PollResults>(`/api/polls/${pollId}/results`);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch poll results.' } };
  }
  return { success: true, data: res.data };
}

// ─── Surveys ───────────────────────────────────────────────────────────────

/**
 * POST /api/surveys/:id/submit
 * Records all survey answers on the backend.
 */
export async function submitSurveyResponse(
  surveyId: string,
  answers: Record<string, unknown>
): Promise<SubmitSurveyResponse> {
  if (USE_MOCK) {
    await delay(700);

    if (mockSurveySubmissions.has(surveyId)) {
      return { success: false, error: { code: 'ALREADY_SUBMITTED', message: 'Survey already submitted.' } };
    }

    mockSurveySubmissions.add(surveyId);
    console.log(`[Mock] Survey ${surveyId} submitted:`, answers);
    return { success: true };
  }

  const res = await apiPost<void>(`/api/surveys/${surveyId}/submit`, { answers });
  if (!res.success) {
    return { success: false, error: res.error ?? { code: 'SUBMIT_FAILED', message: 'Failed to submit survey.' } };
  }
  return { success: true };
}

// ─── Challenges ────────────────────────────────────────────────────────────

/**
 * POST /api/challenges/:id/complete
 * Records challenge completion on the backend and returns points awarded.
 */
export async function completeChallenge(
  challengeId: string
): Promise<CompleteChallengeResponse> {
  if (USE_MOCK) {
    await delay(600);

    if (mockChallengeCompletions.has(challengeId)) {
      return { success: false, error: { code: 'ALREADY_COMPLETED', message: 'Challenge already completed.' } };
    }

    mockChallengeCompletions.add(challengeId);
    console.log(`[Mock] Challenge ${challengeId} completed`);
    return { success: true, data: { pointsAwarded: 100 } };
  }

  const res = await apiPost<{ pointsAwarded: number }>(`/api/challenges/${challengeId}/complete`, {});
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'COMPLETE_FAILED', message: 'Failed to record challenge completion.' } };
  }
  return { success: true, data: res.data };
}

// ─── Giveaways ─────────────────────────────────────────────────────────────

/**
 * POST /api/giveaways/:id/enter
 * Enters the attendee into a giveaway.
 */
export async function enterGiveaway(giveawayId: string): Promise<GiveawayEntryResponse> {
  if (USE_MOCK) {
    await delay(500);

    if (mockGiveawayEntries.has(giveawayId)) {
      return { success: false, error: { code: 'ALREADY_ENTERED', message: 'You have already entered this giveaway.' } };
    }

    mockGiveawayEntries.add(giveawayId);
    console.log(`[Mock] Entered giveaway ${giveawayId}`);
    return {
      success: true,
      data: { giveawayId, entered: true, entryCount: 1 },
    };
  }

  const res = await apiPost<GiveawayEntry>(`/api/giveaways/${giveawayId}/enter`, {});
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'ENTER_FAILED', message: 'Failed to enter giveaway.' } };
  }
  return { success: true, data: res.data };
}

/**
 * GET /api/giveaways
 * Fetches the list of all available giveaways for the current event.
 */
export async function listGiveaways(): Promise<ListGiveawaysResponse> {
  if (USE_MOCK) {
    await delay(500);
    return { success: true, data: [...mockGiveawayList] };
  }

  const res = await apiGet<{ giveaways: GiveawayItem[] } | GiveawayItem[]>('/api/giveaways');
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch giveaways.' } };
  }
  const data = res.data;
  const giveaways = Array.isArray(data) ? data : (data as { giveaways: GiveawayItem[] }).giveaways ?? [];
  return { success: true, data: giveaways };
}

/**
 * GET /api/giveaways/:id/status
 * Fetches the current attendee's entry status for a giveaway.
 */
export async function fetchGiveawayStatus(giveawayId: string): Promise<GiveawayEntryResponse> {
  if (USE_MOCK) {
    await delay(400);
    const entered = mockGiveawayEntries.has(giveawayId);
    return {
      success: true,
      data: { giveawayId, entered, entryCount: entered ? 1 : 0 },
    };
  }

  const res = await apiGet<GiveawayEntry>(`/api/giveaways/${giveawayId}/status`);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { code: 'STATUS_FAILED', message: 'Failed to fetch giveaway status.' } };
  }
  return { success: true, data: res.data };
}
