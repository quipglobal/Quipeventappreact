/**
 * Auth API Client — Phone OTP flow
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   POST /api/auth/send-otp     → { phone }                 → { success }
 *   POST /api/auth/verify-otp   → { phone, otp }            → { token, user, isNewUser }
 *   POST /api/auth/register     → { phone, name, email, title, company } → { token, user }
 *   GET  /api/auth/me                                        → { user }
 *
 * Set VITE_USE_MOCK_API=true in .env to run without a live backend.
 */

import { apiGet, apiPost, saveToken, clearToken, TOKEN_KEY } from './client';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

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

// ─── Mock Database ────────────────────────────────────────────────────────────

interface MockRecord {
  user: AuthUser;
  token: string;
}

const MOCK_USERS: Record<string, MockRecord> = {
  '5550000001': {
    token: 'mock-token-jessica-abc123',
    user: {
      id: 'user-5550000001',
      name: 'Jessica Williams',
      email: 'jessica@stripe.com',
      phone: '5550000001',
      title: 'Product Designer',
      company: 'Stripe',
      role: 'attendee',
      avatar: 'https://ui-avatars.com/api/?name=Jessica+Williams&background=6366f1&color=fff',
      points: 0,
      tier: 'Bronze',
      interests: [],
      profileComplete: true,
      emailVerified: true,
    },
  },
  '5550000002': {
    token: 'mock-token-michael-def456',
    user: {
      id: 'user-5550000002',
      name: 'Michael Chen',
      email: 'michael@startupx.com',
      phone: '5550000002',
      title: 'CTO',
      company: 'StartupX',
      role: 'attendee',
      avatar: 'https://ui-avatars.com/api/?name=Michael+Chen&background=8b5cf6&color=fff',
      points: 0,
      tier: 'Bronze',
      interests: [],
      profileComplete: true,
      emailVerified: true,
    },
  },
  '8156699646': {
    token: 'mock-token-alex-ghi789',
    user: {
      id: 'user-8156699646',
      name: 'Alex Thompson',
      email: 'alex@demo.com',
      phone: '8156699646',
      title: 'Director of Sales',
      company: 'NovaTech',
      role: 'attendee',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Thompson&background=0ea5e9&color=fff',
      points: 0,
      tier: 'Bronze',
      interests: [],
      profileComplete: true,
      emailVerified: true,
    },
  },
  '5550009999': {
    token: 'mock-token-sarah-jkl012',
    user: {
      id: 'user-5550009999',
      name: 'Sarah Sponsor',
      email: 'sponsor@acmecorp.com',
      phone: '5550009999',
      title: 'VP Partnerships',
      company: 'AcmeCorp',
      role: 'sponsor',
      avatar: 'https://ui-avatars.com/api/?name=Sarah+Sponsor&background=ec4899&color=fff',
      points: 0,
      tier: 'Bronze',
      interests: [],
      profileComplete: true,
      emailVerified: true,
    },
  },
};

const MOCK_OTP = '123456';

const delay = (ms = 800) => new Promise<void>(r => setTimeout(r, ms));

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/send-otp
 * Triggers an SMS OTP to the given phone number.
 */
export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  if (USE_MOCK) {
    await delay(900);
    console.log(`[Mock] OTP sent to +1${phone} — use ${MOCK_OTP}`);
    return { success: true };
  }

  const res = await apiPost<void>('/api/auth/send-otp', { phone });
  if (!res.success && res.error) {
    return { success: false, error: res.error };
  }
  return { success: true };
}

/**
 * POST /api/auth/verify-otp
 * Verifies the OTP and returns a token + user (or isNewUser flag).
 */
export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  if (USE_MOCK) {
    await delay(800);

    if (otp !== MOCK_OTP) {
      return { success: false, error: { code: 'INVALID_OTP', message: 'Incorrect code. Please try again.' } };
    }

    const record = MOCK_USERS[phone];
    if (record) {
      saveToken(record.token);
      return { success: true, data: { token: record.token, user: record.user, isNewUser: false } };
    }

    return { success: true, data: { token: '', user: null, isNewUser: true } };
  }

  const res = await apiPost<{ token: string; user: AuthUser; isNewUser: boolean }>(
    '/api/auth/verify-otp',
    { phone, otp }
  );

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error ?? { code: 'VERIFY_FAILED', message: 'OTP verification failed.' },
    };
  }

  saveToken(res.data.token);
  return { success: true, data: res.data };
}

/**
 * POST /api/auth/register
 * Creates a new user account for a verified phone number.
 */
export async function registerUser(params: {
  phone: string;
  name: string;
  email: string;
  title?: string;
  company?: string;
}): Promise<RegisterResponse> {
  if (USE_MOCK) {
    await delay(900);

    const token = `mock-token-${params.phone}-${Date.now()}`;
    const user: AuthUser = {
      id: `user-${params.phone}-new`,
      name: params.name.trim(),
      email: params.email.trim(),
      phone: params.phone,
      title: params.title?.trim() ?? '',
      company: params.company?.trim() ?? '',
      role: 'attendee',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(params.name.trim())}&background=7c3aed&color=fff`,
      points: 0,
      tier: 'Bronze',
      interests: [],
      profileComplete: true,
      emailVerified: true,
    };

    MOCK_USERS[params.phone] = { token, user };
    saveToken(token);
    return { success: true, data: { token, user } };
  }

  const res = await apiPost<{ token: string; user: AuthUser }>('/api/auth/register', params);

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error ?? { code: 'REGISTER_FAILED', message: 'Registration failed.' },
    };
  }

  saveToken(res.data.token);
  return { success: true, data: res.data };
}

/**
 * GET /api/auth/me
 * Restores the current user session from the stored token.
 * Returns null if no token is stored or token is invalid/expired.
 */
export async function getMeApi(): Promise<MeResponse> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return { success: false, error: { code: 'NO_TOKEN', message: 'No auth token found.' } };
  }

  if (USE_MOCK) {
    await delay(600);
    const record = Object.values(MOCK_USERS).find(r => r.token === token);
    if (record) {
      return { success: true, data: record.user };
    }
    clearToken();
    return { success: false, error: { code: 'INVALID_TOKEN', message: 'Session expired.' } };
  }

  const res = await apiGet<AuthUser>('/api/auth/me');

  if (!res.success || !res.data) {
    clearToken();
    return {
      success: false,
      error: res.error ?? { code: 'ME_FAILED', message: 'Could not restore session.' },
    };
  }

  return { success: true, data: res.data };
}

// ─── OAuth stubs ──────────────────────────────────────────────────────────────

export async function initiateGoogleOAuth(): Promise<void> {
  throw new Error('OAUTH_NOT_CONFIGURED');
}

export async function initiateLinkedInOAuth(): Promise<void> {
  throw new Error('OAUTH_NOT_CONFIGURED');
}
