/**
 * Auth API Client — Email OTP flow
 * ─────────────────────────────────────────────────────────────────────────────
 * Confirmed API behavior (tested 2025-04-15):
 *
 *   POST /api/v1/auth/send-otp  { identifier, type }
 *     type:"login"        existing user  → { message:"OTP sent successfully.", expires_in:600 }
 *     type:"login"        unknown user   → { message:"If this account exists…" } (no expires_in)
 *     type:"email_verify" any user       → { message:"OTP sent successfully.", expires_in:600 }
 *   → Use expires_in presence to detect whether the OTP was really sent.
 *
 *   POST /api/v1/auth/verify-otp  { identifier, code, type }
 *     Existing account → { verified:true, account_exists:true, token, user }
 *     New email        → { verified:true, account_exists:false }
 *
 *   POST /api/v1/auth/register  { email, first_name, last_name, phone?, title?, company? }
 *     Success          → { token, user }
 *     409 ALREADY_ATTENDEE → { success:false, error:{ code, message } }
 *
 *   GET  /api/v1/me             → { user }
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
  badgeCode?: string;
}

export interface SendOtpResponse {
  success: boolean;
  /** true = OTP was actually emailed (user exists for 'login' type, always for 'email_verify') */
  otpSent: boolean;
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
  data?: { token: string; user: AuthUser };
  error?: { code?: string; message: string };
}

export interface MeResponse {
  success: boolean;
  data?: AuthUser;
  error?: { code?: string; message: string };
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeUser(raw: Record<string, unknown>): AuthUser {
  const roleStr = String(raw.role ?? '').toLowerCase();
  const rolesArray: string[] = Array.isArray(raw.roles)
    ? (raw.roles as unknown[]).map((r) => String(r).toLowerCase())
    : [];
  const isSponsor =
    roleStr === 'sponsor' || roleStr === 'sponsor_rep' ||
    roleStr === 'exhibitor' || roleStr === 'exhibitor_rep' ||
    rolesArray.includes('sponsor') || rolesArray.includes('sponsor_rep') ||
    rolesArray.includes('exhibitor') || rolesArray.includes('exhibitor_rep');
  return {
    id: String(raw.id ?? ''),
    name: (raw.name as string) ?? `${raw.first_name ?? ''} ${raw.last_name ?? ''}`.trim(),
    email: (raw.email as string) ?? '',
    phone: (raw.phone as string | undefined),
    title: (raw.title ?? raw.job_title ?? raw.position ?? '') as string,
    company: (raw.company ?? raw.organization ?? '') as string,
    role: isSponsor ? 'sponsor' : 'attendee',
    avatar: (raw.avatar ?? raw.avatar_url ?? raw.photo ?? undefined) as string | undefined,
    points: Number(raw.points ?? raw.gamification_points ?? 0),
    tier: (raw.tier ?? raw.membership_tier ?? 'Bronze') as string,
    interests: Array.isArray(raw.interests) ? raw.interests as string[] : [],
    profileComplete: Boolean(raw.profile_complete ?? raw.profileComplete ?? true),
    emailVerified: Boolean(raw.email_verified ?? raw.emailVerified ?? true),
    badgeCode: (raw.badge_code ?? raw.badgeCode ?? undefined) as string | undefined,
  };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/send-otp
 *
 * type:'login'        — for existing-user login. If the user doesn't have an
 *                       account the backend still returns 200 but omits
 *                       expires_in. We use that absence to detect "no account".
 * type:'email_verify' — for signup email verification. OTP always sent.
 *
 * Returns otpSent:true only when the code was actually emailed.
 */
export async function sendOtp(
  identifier: string,
  type: 'login' | 'email_verify' = 'login'
): Promise<SendOtpResponse> {
  const res = await apiPost<Record<string, unknown>>(
    '/api/v1/auth/send-otp',
    { identifier, type }
  );

  if (!res.success && res.error) {
    return { success: false, otpSent: false, error: res.error };
  }

  const data = (res.data as Record<string, unknown>) ?? {};
  // For type:'login', the backend sends OTP only if the account exists.
  // It signals this via expires_in being present in the response.
  // For type:'email_verify' the OTP is always sent.
  const otpSent = type === 'email_verify' || ('expires_in' in data);

  return { success: true, otpSent };
}

/**
 * POST /api/v1/auth/verify-otp
 * type should match what was used for send-otp.
 */
export async function verifyOtp(
  identifier: string,
  code: string,
  type: 'login' | 'email_verify' = 'login'
): Promise<VerifyOtpResponse> {
  const res = await apiPost<Record<string, unknown>>(
    '/api/v1/auth/verify-otp',
    { identifier, code, type }
  );

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error ?? { code: 'VERIFY_FAILED', message: 'OTP verification failed.' },
    };
  }

  const raw = res.data;
  const accountExists = Boolean(raw.account_exists ?? raw.accountExists ?? !!raw.token);
  const token = (raw.token as string) ?? '';
  const userData = (raw.user ?? raw.data) as Record<string, unknown> | null | undefined;

  if (token) saveToken(token);

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
 * Creates a new account. No password — backend auto-generates one.
 * Returns HTTP 409 ALREADY_ATTENDEE if email is an existing attendee.
 */
export async function registerUser(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  title?: string;
  company?: string;
  tenantId?: number;
}): Promise<RegisterResponse> {
  const res = await apiPost<Record<string, unknown>>('/api/v1/auth/register', {
    email: params.email,
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    phone: params.phone?.trim() ?? '',
    title: params.title?.trim() ?? '',
    company: params.company?.trim() ?? '',
    tenant_id: 3,
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
    const raw = meRes.data as Record<string, unknown>;
    const user = (raw.user ?? raw.data ?? raw) as Record<string, unknown>;
    return { success: true, data: normalizeUser(user) };
  }

  const profileRaw = res.data as Record<string, unknown>;
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
