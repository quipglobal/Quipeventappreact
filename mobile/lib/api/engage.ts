import { request, USE_MOCK } from '@/lib/apiClient';
import type { ApiResponse, Challenge, Poll, Survey, Giveaway } from '@/lib/api/types';

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_CHALLENGES: Challenge[] = [
  { id: 'c1', title: 'First Connection', desc: 'Connect with 3 other attendees', emoji: '🤝', points: 50, progress: 1, total: 3 },
  { id: 'c2', title: 'Session Explorer', desc: 'Attend 5 sessions', emoji: '🎯', points: 100, progress: 3, total: 5 },
  { id: 'c3', title: 'Poll Enthusiast', desc: 'Vote in 3 live polls', emoji: '📊', points: 30, progress: 1, total: 3 },
  { id: 'c4', title: 'Sponsor Scout', desc: 'Visit 4 sponsor booths', emoji: '🏆', points: 80, progress: 0, total: 4 },
  { id: 'c5', title: 'Social Butterfly', desc: 'Visit sponsor booths and collect all giveaways', emoji: '🦋', points: 150, progress: 0, total: 1 },
];

const MOCK_POLLS: Poll[] = [
  { id: 'p1', question: 'Which AI use case excites you most in 2026?', session: 'Keynote', points: 10, totalVotes: 219, options: [{ id: 'o1', text: 'Generative AI', votes: 87 }, { id: 'o2', text: 'AI Agents', votes: 61 }, { id: 'o3', text: 'Computer Vision', votes: 29 }, { id: 'o4', text: 'Predictive Analytics', votes: 42 }] },
  { id: 'p2', question: 'How satisfied are you with the event so far?', session: 'General', points: 10, totalVotes: 230, options: [{ id: 'o1', text: 'Very satisfied', votes: 134 }, { id: 'o2', text: 'Satisfied', votes: 67 }, { id: 'o3', text: 'Neutral', votes: 21 }, { id: 'o4', text: 'Not satisfied', votes: 8 }] },
];

const MOCK_SURVEYS: Survey[] = [
  { id: 'sv1', title: 'Morning Workshop Feedback', desc: 'Rate the workshop sessions you attended this morning.', questions: 5, points: 50 },
  { id: 'sv2', title: 'Speaker Evaluation', desc: 'Rate the keynote speakers and their presentations.', questions: 8, points: 75 },
];

const MOCK_GIVEAWAYS: Giveaway[] = [
  { id: 'g1', title: 'MacBook Pro 16"', sponsor: 'TechCorp Solutions', entries: 142, ends: '3:00 PM', color: '#7c3aed', entered: false },
  { id: 'g2', title: '$500 AWS Credits', sponsor: 'CloudNine Systems', entries: 89, ends: '5:00 PM', color: '#06b6d4', entered: false },
  { id: 'g3', title: 'AI Tool License (1 year)', sponsor: 'QuantumLeap AI', entries: 54, ends: '4:00 PM', color: '#10b981', entered: false },
];

export async function listChallenges(): Promise<ApiResponse<Challenge[]>> {
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_CHALLENGES };
  }
  return request<Challenge[]>('/api/v1/challenges');
}

export async function completeChallenge(challengeId: string): Promise<ApiResponse<{ points: number }>> {
  if (USE_MOCK) {
    await delay(500);
    return { success: true, data: { points: 100 } };
  }
  return request<{ points: number }>('/api/v1/challenges/complete', {
    method: 'POST',
    body: JSON.stringify({ challengeId }),
  });
}

export async function listPolls(): Promise<ApiResponse<Poll[]>> {
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_POLLS };
  }
  return request<Poll[]>('/api/v1/polls');
}

export async function votePoll(pollId: string, optionId: string): Promise<ApiResponse<{ points: number; results: Array<{ id: string; votes: number }> }>> {
  if (USE_MOCK) {
    await delay(400);
    return { success: true, data: { points: 10, results: [] } };
  }
  return request('/api/v1/polls/vote', {
    method: 'POST',
    body: JSON.stringify({ pollId, optionId }),
  });
}

export async function listSurveys(): Promise<ApiResponse<Survey[]>> {
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_SURVEYS };
  }
  return request<Survey[]>('/api/v1/surveys');
}

export async function submitSurvey(surveyId: string, answers: Record<string, string>): Promise<ApiResponse<{ points: number }>> {
  if (USE_MOCK) {
    await delay(800);
    return { success: true, data: { points: 50 } };
  }
  return request<{ points: number }>('/api/v1/surveys/submit', {
    method: 'POST',
    body: JSON.stringify({ surveyId, answers }),
  });
}

export async function listGiveaways(): Promise<ApiResponse<Giveaway[]>> {
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_GIVEAWAYS };
  }
  return request<Giveaway[]>('/api/v1/giveaways');
}

export async function enterGiveaway(giveawayId: string): Promise<ApiResponse<{ entries: number }>> {
  if (USE_MOCK) {
    await delay(500);
    return { success: true, data: { entries: 1 } };
  }
  return request<{ entries: number }>('/api/v1/giveaways/enter', {
    method: 'POST',
    body: JSON.stringify({ giveawayId }),
  });
}
