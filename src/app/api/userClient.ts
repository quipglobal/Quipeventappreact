/**
 * User Profile & Gamification API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Functions for: get profile, update profile fields, fetch points/tier.
 *
 * API CONTRACT (planned):
 *   GET   /user/profile                        → ProfileResponse
 *   PATCH /user/profile   { fields }           → ProfileResponse
 *   GET   /user/points                         → PointsResponse
 */

import { BASE_URL } from './authClient';

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

const delay = (ms = 600) => new Promise<void>(res => setTimeout(res, ms));

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /user/profile
 * Returns the current user's full profile from the backend.
 */
export async function getUserProfileApi(): Promise<ProfileResponse> {
  await delay();

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/user/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<ProfileResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  return { success: false, error: { message: 'No session token — using in-memory state' } };
}

/**
 * PATCH /user/profile
 * Updates editable profile fields. Returns the updated profile on success.
 */
export async function updateUserProfileApi(fields: ProfileUpdateFields): Promise<ProfileResponse> {
  await delay(700);

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/user/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(fields),
  });
  return res.json() as Promise<ProfileResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  return { success: true };
}

/**
 * GET /user/points
 * Returns the latest points balance and tier from the backend.
 * Call this after any point-earning action to keep the UI in sync.
 */
export async function getUserPointsApi(): Promise<PointsResponse> {
  await delay(400);

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/user/points`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<PointsResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  return { success: false, error: { message: 'No session token — using in-memory state' } };
}
