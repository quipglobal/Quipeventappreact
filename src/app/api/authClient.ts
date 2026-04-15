/**
 * Auth API Client — Email OTP flow
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   POST /api/v1/auth/send-otp     → { identifier, type: "email_verify" }
 *                                  → { success }
 *
 *   POST /api/v1/auth/verify-otp   → { identifier, code, type: "email_verify" }
 *     Existing account:            → { verified, account_exists: true, token, token_type, user }
 *     New email:                   → { verified, account_exists: false }
 *
 *   POST /api/v1/auth/register     → { email, first_name, last_name, phone?, title?, company? }
 *                                  → { token, user }
 *     409 ALREADY_ATTENDEE:        → { success: false, error: { code, message } }
 *
 *   GET  /api/v1/me                → { user }
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
    accountExists: boolean;
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
  const res = await apiPost<void>('/api/v1/auth/send-otp', {
    identifier,
    type: 'email_verify',
  });
  if (!res.success && res.error) {
    return { success: false, error: res.error };
  }
  return { success: true };
}

/**
 * POST /api/v1/auth/verify-otp
 * Verifies the OTP.
 * - If account_exists: true  → returns token + user (existing account)
 * - If account_exists: false → no token, proceed to registration
 */
export async function verifyOtp(identifier: string, code: string): Promise<VerifyOtpResponse> {
  const res = await apiPost<Record<string, unknown>>(
    '/api/v1/auth/verify-otp',
    { identifier, code, type: 'email_verify' }
  );

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error ?? { code: 'VERIFY_FAILED', message: 'OTP verification failed.' },
    };
  }

  const raw = res.data;

  // Backend returns account_exists: bool to differentiate new vs existing
  const accountExists = Boolean(raw.account_exists ?? raw.accountExists ?? !!raw.token);
  const token = (raw.token as string) ?? '';
  const userData = (raw.user ?? raw.data) as Record<string, unknown> | null | undefined;

  if (token) {
    saveToken(token);
  }

  return {
    success: true,
    data: {
      token,
      user: userData ? normalizeUser(userData) : null,
      accountExists,
    },
  };
}

/**
 * POST /api/v1/auth/register
 * Creates a new user account for a verified-by-OTP email address.
 * Password is not required — backend auto-generates one for OTP-based signups.
 * Returns HTTP 409 with ALREADY_ATTENDEE code if email is already an attendee.
 */
export async function registerUser(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  title?: string;
  company?: string;
}): Promise<RegisterResponse> {
  const res = await apiPost<Record<string, unknown>>('/api/v1/auth/register', {
    email: params.email,
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    phone: params.phone?.trim() ?? '',
    title: params.title?.trim() ?? '',
    company: params.company?.trim() ?? '',
  });

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error ?? { code: 'REGISTER_FAILED', message: 'Registration failed. Please try again.' },
    };
  }

  const raw = res.data;
  const token = (raw.token as string) ?? '';
  if (token) saveToken(token);

  const userData = (raw.user ?? raw.data ?? raw) as Record<string, unknown>;
  return { success: true, data: { token, user: normalizeUser(userData) } };
}

/**
 * PUT /api/v1/me/profile
 * Updates profile fields for an already-authenticated user.
 */
export async function updateProfile(params: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  title?: string;
  company?: string;
}): Promise<MeResponse> {
  const res = await apiPut<Record<string, unknown>>('/api/v1/me/profile', {
    first_name: params.firstName?.trim(),
    last_name: params.lastName?.trim(),
    phone: params.phone?.trim(),
    title: params.title?.trim(),
    company: params.company?.trim(),
  });

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error ?? { code: 'UPDATE_FAILED', message: 'Profile update failed.' },
    };
  }

  const meRes = await apiGet<Record<string, unknown>>('/api/v1/me');
  if (meRes.success && meRes.data) {
    const raw = (meRes.data as Record<string, unknown>);
    const user = (raw.user ?? raw.data ?? raw) as Record<string, unknown>;
    return { success: true, data: normalizeUser(user) };
  }

  const profileRaw = (res.data as Record<string, unknown>);
  const profileData = (profileRaw.data ?? profileRaw) as Record<string, unknown>;
  return { success: true, data: normalizeUser(profileData) };
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
