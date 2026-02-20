/**
 * Auth API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Replace BASE_URL and remove the mock layer once a real backend is wired.
 * All public methods map 1-to-1 to the documented API contract.
 *
 * API CONTRACT:
 *   POST /auth/login             → LoginRequest  → LoginResponse
 *   POST /auth/resend-verification → { email }   → { success: true }
 *   GET  /auth/me                               → MeResponse
 */

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.eventhub.app/v1';

// ─── Request / Response Types ───────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: 'attendee' | 'sponsor';
  company?: string;
  title?: string;
  avatar?: string;
  points?: number;
  tier?: string;
  interests?: string[];
  profileComplete?: boolean;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: AuthUser;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ResendVerificationResponse {
  success: boolean;
  error?: { message: string };
}

export interface MeResponse {
  success: boolean;
  data?: AuthUser;
  error?: { message: string };
}

// ─── Mock Data (remove when backend is live) ─────────────────────────────────

/**
 * SEED CREDENTIALS (mock only):
 *   attendee@demo.com  / demo123  → attendee, email verified
 *   sponsor@demo.com   / demo123  → sponsor,  email verified
 *   unverified@demo.com / demo123 → attendee, email NOT verified  ← triggers gating UI
 *
 * Any other well-formed email + password (min 6 chars) returns a generic
 * verified attendee so designers / testers can explore freely.
 */
const MOCK_DB: Record<
  string,
  { password: string; user: AuthUser; token: string }
> = {
  'attendee@demo.com': {
    password: 'demo123',
    token: 'mock-token-attendee-abc123',
    user: {
      id: 'user-001',
      email: 'attendee@demo.com',
      name: 'Alex Johnson',
      emailVerified: true,
      role: 'attendee',
      company: 'Innovation Inc.',
      title: 'Product Manager',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Johnson&background=6366f1&color=fff',
      points: 0,
      tier: 'Bronze',
      interests: ['AI', 'Cloud', 'Sustainability'],
      profileComplete: true,
    },
  },
  'sponsor@demo.com': {
    password: 'demo123',
    token: 'mock-token-sponsor-xyz789',
    user: {
      id: 'user-002',
      email: 'sponsor@demo.com',
      name: 'Sarah Martinez',
      emailVerified: true,
      role: 'sponsor',
      company: 'TechCorp Solutions',
      title: 'Partnership Director',
      avatar: 'https://ui-avatars.com/api/?name=Sarah+Martinez&background=8b5cf6&color=fff',
      points: 0,
      tier: 'Bronze',
      interests: ['Partnerships', 'Enterprise', 'Cloud'],
      profileComplete: true,
    },
  },
  'unverified@demo.com': {
    password: 'demo123',
    token: '', // no token until verified
    user: {
      id: 'user-003',
      email: 'unverified@demo.com',
      name: 'Unverified User',
      emailVerified: false,
      role: 'attendee',
      points: 0,
      tier: 'Bronze',
      interests: [],
      profileComplete: false,
    },
  },
};

/** Simulate network latency */
const delay = (ms = 900) => new Promise<void>((res) => setTimeout(res, ms));

// ─── API Methods ─────────────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Returns a token + user object on success, or an error with code on failure.
 */
export async function loginApi(req: LoginRequest): Promise<LoginResponse> {
  await delay();

  /* ── Real implementation (uncomment when backend is ready) ──────────────
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return response.json() as Promise<LoginResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  // ── Mock layer ──────────────────────────────────────────────────────────
  const normalised = req.email.toLowerCase().trim();
  const record = MOCK_DB[normalised];

  // Unverified email check (before password validation, matching real backend)
  if (record && !record.user.emailVerified) {
    return {
      success: false,
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email not verified',
      },
      data: { token: '', user: record.user },
    };
  }

  if (record) {
    if (record.password !== req.password) {
      return {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect password' },
      };
    }
    return { success: true, data: { token: record.token, user: record.user } };
  }

  // Fallback: any well-formed email + password ≥ 6 chars = demo attendee
  if (req.password.length >= 6) {
    const firstName = normalised.split('@')[0];
    const displayName =
      firstName.charAt(0).toUpperCase() + firstName.slice(1);
    return {
      success: true,
      data: {
        token: `mock-token-${Date.now()}`,
        user: {
          id: `user-${Date.now()}`,
          email: normalised,
          name: displayName,
          emailVerified: true,
          role: 'attendee',
          company: 'Demo Corp',
          title: 'Event Attendee',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`,
          points: 0,
          tier: 'Bronze',
          interests: ['Technology', 'Networking'],
          profileComplete: false,
        },
      },
    };
  }

  return {
    success: false,
    error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
  };
}

/**
 * POST /auth/resend-verification
 * Triggers a verification email re-send for the given address.
 */
export async function resendVerificationApi(
  email: string
): Promise<ResendVerificationResponse> {
  await delay(700);

  /* ── Real implementation ────────────────────────────────────────────────
  const response = await fetch(`${BASE_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return response.json();
  ─────────────────────────────────────────────────────────────────────── */

  // Mock: always succeeds
  console.log(`[Mock] Verification email re-sent to: ${email}`);
  return { success: true };
}

/**
 * GET /auth/me
 * Checks the current verification status of the user.
 * Pass the stored token in the Authorization header when wiring real backend.
 */
export async function getMeApi(email: string): Promise<MeResponse> {
  await delay(800);

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
  ─────────────────────────────────────────────────────────────────────── */

  // Mock: flip the unverified user to verified after 1 resend (simulate email click)
  const normalised = email.toLowerCase().trim();
  const record = MOCK_DB[normalised];
  if (record) {
    // Simulate that after calling resend the user has now verified
    record.user.emailVerified = true;
    record.token = `mock-token-verified-${Date.now()}`;
    return { success: true, data: record.user };
  }
  return { success: false, error: { message: 'User not found' } };
}

/**
 * ─── OAuth stubs ─────────────────────────────────────────────────────────────
 * TODO: Wire these to your OAuth provider (Google / LinkedIn) when ready.
 * Expected flow:
 *   1. Redirect user to provider authorization URL
 *   2. Provider redirects back to /auth/callback?code=...
 *   3. Exchange code for token via POST /auth/oauth/callback
 *   4. Store token → navigate to main app
 */
export async function initiateGoogleOAuth(): Promise<void> {
  // TODO: Replace with real Google OAuth redirect
  // window.location.href = `${BASE_URL}/auth/google`;
  throw new Error('OAUTH_NOT_CONFIGURED');
}

export async function initiateLinkedInOAuth(): Promise<void> {
  // TODO: Replace with real LinkedIn OAuth redirect
  // window.location.href = `${BASE_URL}/auth/linkedin`;
  throw new Error('OAUTH_NOT_CONFIGURED');
}
