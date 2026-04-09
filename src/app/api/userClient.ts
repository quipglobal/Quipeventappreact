/**
 * User Profile & Gamification API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET   /api/v1/me                         → ProfileResponse
 *   PATCH /api/v1/profile  { fields }        → ProfileResponse
 *   GET   /api/v1/events/:id/my-rank         → PointsResponse
 */

import { apiGet, apiPatch } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  avatar: string;
  points: number;
  tier: string;
  role: 'attendee' | 'sponsor';
  interests: string[];
  profileComplete: boolean;
}

export interface ProfileResponse {
  success: boolean;
  data?: UserProfile;
  error?: { message: string };
}

export interface PointsResponse {
  success: boolean;
  data?: { points: number; tier: string };
  error?: { message: string };
}

export type ProfileUpdateFields = Partial<Pick<UserProfile, 'name' | 'company' | 'title' | 'avatar' | 'interests'>>;

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeProfile(raw: Record<string, unknown>): UserProfile {
  return {
    id: String(raw.id ?? ''),
    name: (raw.name ?? `${raw.first_name ?? ''} ${raw.last_name ?? ''}`.trim()) as string,
    email: (raw.email ?? '') as string,
    company: (raw.company ?? raw.organization ?? '') as string,
    title: (raw.title ?? raw.job_title ?? raw.position ?? '') as string,
    avatar: (raw.avatar ?? raw.avatar_url ?? raw.photo ?? '') as string,
    points: Number(raw.points ?? raw.gamification_points ?? 0),
    tier: (raw.tier ?? raw.membership_tier ?? 'Bronze') as string,
    role: raw.role === 'sponsor' ? 'sponsor' : 'attendee',
    interests: Array.isArray(raw.interests) ? raw.interests as string[] : [],
    profileComplete: Boolean(raw.profile_complete ?? raw.profileComplete ?? true),
  };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/me
 * Returns the current user's full profile.
 */
export async function getUserProfileApi(): Promise<ProfileResponse> {
  const res = await apiGet<unknown>('/api/v1/me');
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch profile.' } };
  }
  const raw = ((res.data as Record<string, unknown>)?.user
    ?? (res.data as Record<string, unknown>)?.data
    ?? res.data) as Record<string, unknown>;
  return { success: true, data: normalizeProfile(raw) };
}

/**
 * PATCH /api/v1/profile
 * Updates editable profile fields. Returns the updated profile on success.
 */
export async function updateUserProfileApi(fields: ProfileUpdateFields): Promise<ProfileResponse> {
  const res = await apiPatch<unknown>('/api/v1/profile', fields);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Failed to update profile.' } };
  }
  const raw = ((res.data as Record<string, unknown>)?.data ?? res.data) as Record<string, unknown>;
  return { success: true, data: normalizeProfile(raw) };
}

/**
 * GET /api/v1/events/:eventId/my-rank
 * Returns the latest points balance and tier.
 */
export async function getUserPointsApi(eventId?: string): Promise<PointsResponse> {
  if (!eventId) {
    return { success: false, error: { message: 'No event selected.' } };
  }

  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/my-rank`);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch points.' } };
  }
  const raw = res.data as Record<string, unknown>;
  return {
    success: true,
    data: {
      points: Number(raw.points ?? raw.total_points ?? raw.gamification_points ?? 0),
      tier: (raw.tier ?? raw.membership_tier ?? 'Bronze') as string,
    },
  };
}
