/**
 * Auth API Client — Email OTP flow
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   POST /api/v1/auth/send-otp     → { identifier, type }      → { success }
 *   POST /api/v1/auth/verify-otp   → { identifier, code, type } → { token, user, isNewUser }
 *   POST /api/v1/auth/register     → { identifier, name, title, company } → { token, user }
 *   GET  /api/v1/me                                             → { user }
 */

import { apiGet, apiPost, apiPut, saveToken, clearToken, TOKEN_KEY } from './client';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  company?: string;
  role: 'attendee' | 'sponsor';
  avatar?: string;
  points?: number;
  tier?: string;
  interests?: string[];
  profileComplete?: boolean;
  emailVerified?: boolean;
}

export interface SendOtpResponse {
  success: boolean;
  error?: { code?: string; message: string };
}

export interface VerifyOtpResponse {
  success: boolean;
  data?: {
    token: string;
    user: AuthUser | null;
    isNewUser: boolean;
  };
  error?: { code?: string; message: string };
}

export interface RegisterResponse {
  success: boolean;
  data?: {
    token: string;
    user: AuthUser;
  };
  error?: { code?: string; message: string };
}

export interface MeResponse {
  success: boolean;
  data?: AuthUser;
  error?: { code?: string; message: string };
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeUser(raw: Record<string, unknown>): AuthUser {
  return {
    id: String(raw.id ?? ''),
    name: (raw.name as string) ?? `${raw.first_name ?? ''} ${raw.last_name ?? ''}`.trim(),
    email: (raw.email as string) ?? '',
    phone: (raw.phone as string | undefined),
    title: (raw.title ?? raw.job_title ?? raw.position ?? '') as string,
    company: (raw.company ?? raw.organization ?? '') as string,
    role: raw.role === 'sponsor' ? 'sponsor' : 'attendee',
    avatar: (raw.avatar ?? raw.avatar_url ?? raw.photo ?? undefined) as string | undefined,
    points: Number(raw.points ?? raw.gamification_points ?? 0),
    tier: (raw.tier ?? raw.membership_tier ?? 'Bronze') as string,
    interests: Array.isArray(raw.interests) ? raw.interests as string[] : [],
    profileComplete: Boolean(raw.profile_complete ?? raw.profileComplete ?? true),
    emailVerified: Boolean(raw.email_verified ?? raw.emailVerified ?? true),
  };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/send-otp
 * Sends an OTP code to the given email address.
 */
export async function sendOtp(identifier: string): Promise<SendOtpResponse> {
  const res = await apiPost<void>('/api/v1/auth/send-otp', { identifier, type: 'login' });
  if (!res.success && res.error) {
    return { success: false, error: res.error };
  }
  return { success: true };
}

/**
 * POST /api/v1/auth/verify-otp
 * Verifies the OTP and returns a token + user (or isNewUser flag).
 */
export async function verifyOtp(identifier: string, code: string): Promise<VerifyOtpResponse> {
  const res = await apiPost<Record<string, unknown>>(
    '/api/v1/auth/verify-otp',
    { identifier, code, type: 'login' }
  );

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error ?? { code: 'VERIFY_FAILED', message: 'OTP verification failed.' },
    };
  }

  const raw = res.data;
  const token = (raw.token as string) ?? '';
  const isNewUser = Boolean(raw.is_new_user ?? raw.isNewUser ?? !raw.user);
  const userData = (raw.user ?? raw.data) as Record<string, unknown> | null | undefined;

  if (token) {
    saveToken(token);
  }

  return {
    success: true,
    data: {
      token,
      user: userData ? normalizeUser(userData) : null,
      isNewUser,
    },
  };
}

/**
 * POST /api/v1/auth/register
 * Creates a new user account for a verified email address.
 * Falls back to PUT /api/v1/me/profile if the register endpoint is unavailable.
 */
export async function registerUser(params: {
  identifier: string;
  firstName: string;
  lastName: string;
  phone?: string;
  title?: string;
  company?: string;
}): Promise<RegisterResponse> {
  const fullName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();

  const payload = {
    identifier: params.identifier,
    name: fullName,
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    phone: params.phone?.trim() ?? '',
    title: params.title?.trim() ?? '',
    company: params.company?.trim() ?? '',
  };

  const res = await apiPost<Record<string, unknown>>('/api/v1/auth/register', payload);

  if (res.success && res.data) {
    const raw = res.data;
    const token = (raw.token as string) ?? '';
    if (token) saveToken(token);
    const userData = (raw.user ?? raw.data ?? raw) as Record<string, unknown>;
    return { success: true, data: { token, user: normalizeUser(userData) } };
  }

  const profileRes = await apiPut<Record<string, unknown>>('/api/v1/me/profile', {
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    phone: params.phone?.trim() ?? '',
    title: params.title?.trim() ?? '',
    company: params.company?.trim() ?? '',
  });

  if (!profileRes.success || !profileRes.data) {
    return {
      success: false,
      error: profileRes.error ?? { code: 'REGISTER_FAILED', message: 'Registration failed. Please try again.' },
    };
  }

  const profileRaw = (profileRes.data as Record<string, unknown>);
  const profileData = (profileRaw.data ?? profileRaw) as Record<string, unknown>;
  const meRes = await apiGet<Record<string, unknown>>('/api/v1/me');
  const meRaw = meRes.success && meRes.data
    ? ((meRes.data as Record<string, unknown>).user ?? meRes.data) as Record<string, unknown>
    : profileData;

  return { success: true, data: { token: '', user: normalizeUser(meRaw) } };
}

/**
 * GET /api/v1/me
 * Restores the current user session from the stored token.
 */
export async function getMeApi(): Promise<MeResponse> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return { success: false, error: { code: 'NO_TOKEN', message: 'No auth token found.' } };
  }

  const res = await apiGet<Record<string, unknown>>('/api/v1/me');

  if (!res.success || !res.data) {
    clearToken();
    return {
      success: false,
      error: res.error ?? { code: 'ME_FAILED', message: 'Could not restore session.' },
    };
  }

  const raw = (res.data.user ?? res.data.data ?? res.data) as Record<string, unknown>;
  return { success: true, data: normalizeUser(raw) };
}

// ─── OAuth stubs ──────────────────────────────────────────────────────────────

export async function initiateGoogleOAuth(): Promise<void> {
  throw new Error('OAUTH_NOT_CONFIGURED');
}

export async function initiateLinkedInOAuth(): Promise<void> {
  throw new Error('OAUTH_NOT_CONFIGURED');
}
