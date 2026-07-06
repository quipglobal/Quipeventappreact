import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * On native (iOS/Android) use the full backend URL — no CORS restrictions.
 * On web (Expo web in browser) use '' so calls go to the Metro dev-server proxy
 * at /api/*, which forwards them to the backend without CORS issues.
 *
 * IMPORTANT: EXPO_PUBLIC_API_BASE_URL must be present in the EAS build's
 * builderEnvironment.env so Metro bakes it in. The fallback to the production
 * URL here acts as a safety net so a missing env var can never silently produce
 * empty-host fetch() calls on device (which manifest as "No internet" errors).
 */
const PRODUCTION_API_URL = 'https://app.cxocollaborate.com';
const BASE_URL =
  Platform.OS === 'web'
    ? ''
    : (process.env.EXPO_PUBLIC_API_BASE_URL || PRODUCTION_API_URL);
const TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID ?? '3';

function parseBool(v: string | undefined, fallback = false): boolean {
  if (v == null || v === '') return fallback;
  return String(v).toLowerCase() === 'true';
}

export const USE_MOCK = parseBool(process.env.EXPO_PUBLIC_USE_MOCK_API, false);
export const USE_MOCK_AUTH = parseBool(process.env.EXPO_PUBLIC_USE_MOCK_AUTH, false);

if (__DEV__) {
  console.log(
    `[API] BASE_URL="${BASE_URL}" TENANT_ID="${TENANT_ID}" USE_MOCK=${USE_MOCK} USE_MOCK_AUTH=${USE_MOCK_AUTH}`,
  );
}

let _unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  _unauthorizedHandler = handler;
}

export function clearUnauthorizedHandler(): void {
  _unauthorizedHandler = null;
}

const TOKEN_KEY = 'cxo_auth_token';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/**
 * How long we wait for the backend before giving up and telling the user
 * something actionable. `app.cxocollaborate.com` has been observed to hang
 * for 10s+ on individual requests (TLS handshake fine, response never
 * arrives) — without an explicit timeout the underlying `fetch()` promise
 * just sits there indefinitely on native, and RN eventually surfaces it to
 * our catch block as a generic "Network request failed" TypeError, which
 * we were previously always relabeling as "No internet connection" even
 * though the device had a perfectly good connection and the real problem
 * was a slow/unresponsive server.
 */
const REQUEST_TIMEOUT_MS = 20000;

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const method = (options.method ?? 'GET').toUpperCase();
  const startMs = __DEV__ ? Date.now() : 0;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const token = await getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Tenant-ID': TENANT_ID,
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });

    if (__DEV__) {
      console.log(`[API] ${method} ${path} → ${res.status} (${Date.now() - startMs}ms)`);
    }

    if (res.status === 401) {
      await clearToken();
      _unauthorizedHandler?.();
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' },
      };
    }

    if (res.status === 429) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a moment and try again.' },
      };
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      return {
        success: false,
        error: { code: 'PARSE_ERROR', message: 'Unexpected server response. Please try again.' },
      };
    }

    if (json.success === true) return json as ApiResponse<T>;

    if (json.status === 'success' || (res.ok && json.success !== false)) {
      return { success: true, data: (json.data ?? json) as T };
    }

    const errorMessage =
      json.error?.message ??
      json.message ??
      (Array.isArray(json.errors) ? json.errors[0] : undefined) ??
      (json.errors && typeof json.errors === 'object'
        ? Object.values(json.errors).flat().join(' ')
        : undefined) ??
      'Request failed. Please try again.';

    const errorCode = json.error?.code ?? json.code ?? 'REQUEST_FAILED';
    return { success: false, error: { code: errorCode, message: errorMessage } };
  } catch (err) {
    if (__DEV__) {
      console.warn(`[API] ${method} ${path} threw after ${Date.now() - startMs}ms:`, err);
    }

    // Our own AbortController fires after REQUEST_TIMEOUT_MS — this means
    // the request reached the network stack fine but the server never
    // responded in time. This is NOT the same as "no internet": the device
    // is connected, the backend is just slow/hung. Telling the user to
    // "check their network" here sends them chasing the wrong problem.
    const isTimeout =
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError');
    if (isTimeout) {
      return {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'The server is taking longer than usual to respond. Please try again in a moment.',
        },
      };
    }

    // Genuine connectivity loss is directly observable on web via
    // navigator.onLine; on native we fall back to message sniffing below
    // since RN doesn't expose an equivalent synchronous signal here.
    const deviceOffline =
      typeof navigator !== 'undefined' &&
      typeof navigator.onLine === 'boolean' &&
      navigator.onLine === false;

    // Android/iOS surface *all* fetch failures (no connectivity, DNS
    // failure, connection refused, TLS errors, etc.) as TypeErrors with
    // varied messages. We still cast a wide net here, but timeouts are now
    // handled above via AbortError, so what's left genuinely points at a
    // connectivity/DNS/TLS problem rather than a slow server.
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    const isNetworkError =
      deviceOffline ||
      (err instanceof TypeError &&
        (msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('failed to fetch') ||
          msg.includes('unable to resolve host') ||
          msg.includes('connection refused') ||
          msg.includes('econnrefused') ||
          msg.includes('socket') ||
          msg.includes('ssl') ||
          msg.includes('certificate') ||
          msg.includes('only absolute urls') ||
          msg.includes('net::')));
    return {
      success: false,
      error: {
        code: isNetworkError ? 'NETWORK_ERROR' : 'REQUEST_FAILED',
        message: isNetworkError
          ? 'No internet connection. Please check your network and try again.'
          : 'Something went wrong. Please try again.',
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface AuthUser {
  id: string;
  phone?: string;
  name: string;
  email: string;
  company: string;
  title: string;
  avatar: string;
  role: 'attendee' | 'sponsor';
  points: number;
  tier: string;
  interests: string[];
  profileComplete: boolean;
  badgeCode?: string;
}

function normalizeAuthUser(raw: any): AuthUser {
  const firstName = raw.first_name ?? (raw.name?.split(' ')[0] ?? '');
  const lastName = raw.last_name ?? (raw.name?.split(' ').slice(1).join(' ') ?? '');
  const name = raw.name ?? (firstName || lastName ? `${firstName} ${lastName}`.trim() : '');

  const systemRole: string = (raw.system_role ?? '').toUpperCase();
  const rolesArray: string[] = Array.isArray(raw.roles)
    ? raw.roles.map((r: any) => (typeof r === 'string' ? r : r?.name ?? '').toLowerCase())
    : [];

  // Debug: log raw role fields so we can see exactly what the backend sends.
  console.log('[normalizeAuthUser] raw.role=', raw.role, 'system_role=', raw.system_role, 'roles=', raw.roles);

  const roleStr = String(raw.role ?? '').toLowerCase();
  const isSponsor =
    roleStr === 'sponsor' ||
    roleStr === 'sponsor_rep' ||
    roleStr === 'exhibitor' ||
    roleStr === 'exhibitor_rep' ||
    systemRole === 'SPONSOR' ||
    systemRole === 'SPONSOR_REP' ||
    rolesArray.includes('sponsor') ||
    rolesArray.includes('sponsor_rep') ||
    rolesArray.includes('exhibitor') ||
    rolesArray.includes('exhibitor_rep');

  return {
    id: String(raw.id ?? ''),
    phone: raw.phone ?? raw.phone_number ?? undefined,
    name,
    email: raw.email ?? '',
    company: raw.company ?? raw.organization ?? raw.company_name ?? '',
    title: raw.title ?? raw.job_title ?? raw.position ?? '',
    avatar:
      raw.avatar ??
      raw.avatar_url ??
      raw.profile_photo_url ??
      raw.photo_url ??
      raw.profile_image ??
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=7c3aed&color=fff`,
    role: isSponsor ? 'sponsor' : 'attendee',
    points: Number(raw.points ?? raw.gamification_points ?? raw.total_points ?? 0),
    tier: raw.tier ?? raw.membership_tier ?? raw.level ?? 'Bronze',
    interests: Array.isArray(raw.interests) ? raw.interests : [],
    profileComplete:
      raw.profileComplete ??
      raw.profile_complete ??
      raw.is_profile_complete ??
      raw.setup_complete ??
      false,
    badgeCode: raw.badge_code ?? raw.badgeCode ?? undefined,
  };
}

/**
 * Step 1 of OTP login.
 * POST /api/v1/auth/send-otp  →  { identifier, type: "login" }
 * `identifier` is either an E.164 phone number (+1XXXXXXXXXX) or an email address.
 */
export async function sendOtp(identifier: string): Promise<ApiResponse<{ otpSent: boolean }>> {
  const res = await request<any>('/api/v1/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier, type: 'login' }),
  });
  if (!res.success) return res as ApiResponse<{ otpSent: boolean }>;

  // For type:'login', the backend only actually emails a code when the
  // account exists. It signals this by including `expires_in` in the
  // response. When the account is unknown it still returns 200 with a
  // generic "If this account exists…" message and NO `expires_in`.
  // Without this check the app sends the user to a dead-end OTP screen
  // for an email that never received a code.
  const data = (res.data ?? {}) as Record<string, unknown>;
  const otpSent = 'expires_in' in data && data.expires_in != null;
  return { success: true, data: { otpSent } };
}

export interface VerifyOtpResult {
  token: string;
  user: AuthUser | null;
  isNewUser: boolean;
}

/**
 * Step 2 of OTP login.
 * POST /api/v1/auth/verify-otp  →  { identifier, code, type: "login" }
 *
 * Success cases:
 *   • Existing account  → { token, user, isNewUser: false }
 *   • Brand-new email   → backend returns { verified: true } with no token
 *                         → { token: '', user: null, isNewUser: true }
 *                         → caller should show registration form
 *   • account_exists: true in response always comes with a token (treated as existing).
 */
export async function verifyOtp(identifier: string, otp: string): Promise<ApiResponse<VerifyOtpResult>> {
  const res = await request<any>('/api/v1/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier, code: otp, type: 'login' }),
  });

  if (!res.success || !res.data) return res as ApiResponse<VerifyOtpResult>;

  const raw = res.data;
  const token: string = raw.token ?? raw.access_token ?? raw.auth_token ?? '';

  if (!token) {
    // Backend confirmed email/phone is valid but no account exists yet.
    // Signals: verified:true | account_exists:false | email_verified:true
    const isVerifiedNewUser =
      raw.verified === true ||
      raw.email_verified === true ||
      raw.account_exists === false ||
      raw.is_new_user === true ||
      raw.isNewUser === true;

    if (isVerifiedNewUser) {
      return { success: true, data: { token: '', user: null, isNewUser: true } };
    }

    return {
      success: false,
      error: { code: 'NO_TOKEN', message: 'Authentication failed. Please try again.' },
    };
  }

  const rawUser = raw.user ?? (raw.data && typeof raw.data === 'object' && raw.data.id ? raw.data : null) ?? null;

  if (rawUser) {
    const user = normalizeAuthUser(rawUser);
    if (user.id) {
      const isNewUser = raw.isNewUser ?? raw.is_new_user ?? raw.is_new ?? false;
      return { success: true, data: { token, user, isNewUser } };
    }
  }

  try {
    const meRes = await fetch(`${BASE_URL}/api/v1/me`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': TENANT_ID,
      },
    });
    if (meRes.ok) {
      const meJson = await meRes.json();
      const envelope = meJson.data ?? meJson.user ?? meJson;
      const user = normalizeAuthUser(envelope);
      if (user.id) {
        return { success: true, data: { token, user, isNewUser: false } };
      }
    }
  } catch {
    // fallthrough to new-user
  }

  return { success: true, data: { token: '', user: null, isNewUser: true } };
}

export interface RegisterInput {
  phone: string;
  name: string;
  email: string;
  title: string;
  company: string;
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  const first_name = parts[0] ?? '';
  const last_name = parts.slice(1).join(' ') || first_name;
  return { first_name, last_name };
}

export async function register(
  input: RegisterInput
): Promise<ApiResponse<{ token: string; user: AuthUser }>> {
  const { first_name, last_name } = splitName(input.name);
  const randomPassword = `OTP-${Math.random().toString(36).slice(2, 10).toUpperCase()}-${Date.now()}`;

  const res = await request<any>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      first_name,
      last_name,
      phone: input.phone,
      email: input.email,
      title: input.title,
      company: input.company,
      password: randomPassword,
      password_confirmation: randomPassword,
    }),
  });

  if (!res.success || !res.data) return res as ApiResponse<{ token: string; user: AuthUser }>;

  const raw = res.data;
  const token: string = raw.token ?? raw.access_token ?? raw.auth_token ?? '';
  const rawUser = raw.user ?? raw.data ?? raw;

  return {
    success: true,
    data: { token, user: normalizeAuthUser(rawUser) },
  };
}

/** Dev-only: authenticate with email + password directly (bypasses OTP flow). */
export async function loginWithPassword(
  email: string,
  password: string,
): Promise<ApiResponse<{ token: string; user: AuthUser }>> {
  const res = await request<any>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.success || !res.data) return res as ApiResponse<{ token: string; user: AuthUser }>;
  const raw = res.data;
  const token: string = raw.token ?? raw.access_token ?? raw.auth_token ?? '';
  const rawUser = raw.user ?? raw.data ?? raw;
  return { success: true, data: { token, user: normalizeAuthUser(rawUser) } };
}

/**
 * Fetch the current user's event-scoped role from the event members list.
 * The backend stores roles per-event (e.g. SPONSOR_REP, ATTENDEE) in the
 * event_members pivot — the global /me endpoint always returns "attendee".
 * Returns 'sponsor' if the member has SPONSOR_REP / EXHIBITOR_REP role.
 *
 * Strategy order:
 *  1. badge_code search  — single-record lookup, fast & precise
 *  2. checked_in_only=false — full roster, catches all registered members
 *  3. default endpoint     — fallback for backends that ignore the param
 */
export async function getMyEventRole(
  eventId: string | number,
  userId: string | number,
  badgeCode?: string,
): Promise<'sponsor' | 'attendee'> {
  const SPONSOR_KEYWORDS = ['sponsor', 'sponsor_rep', 'exhibitor', 'exhibitor_rep'];

  function extractItems(data: any): any[] {
    if (Array.isArray(data)) return data;
    // Pagination envelope: { current_page, data: [...] }
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.members)) return data.members;
    return [];
  }

  function isSponsorRecord(m: any): boolean {
    const roles: string[] = Array.isArray(m.roles)
      ? m.roles.map((r: any) => (typeof r === 'string' ? r : r?.name ?? '').toLowerCase())
      : [];
    return SPONSOR_KEYWORDS.some((k) => roles.includes(k));
  }

  function findByUserId(items: any[]): any | undefined {
    return items.find((m: any) => String(m.id) === String(userId));
  }

  console.log(`[getMyEventRole] START eventId=${eventId} userId=${userId} badgeCode=${badgeCode ?? 'none'}`);

  try {
    // ── Strategy 1: badge_code lookup (single-record, most precise) ──────────
    if (badgeCode) {
      const r1 = await request<any>(
        `/api/v1/events/${eventId}/members?badge_code=${encodeURIComponent(badgeCode)}`,
      );
      console.log(`[getMyEventRole] badge_code lookup success=${r1.success} data=`, JSON.stringify(r1.data)?.slice(0, 200));
      if (r1.success && r1.data) {
        const items = extractItems(r1.data);
        // Badge code search returns only the matching member(s)
        const me = items.find((m: any) =>
          String(m.badge_code ?? '').toUpperCase() === badgeCode.toUpperCase() ||
          String(m.id) === String(userId),
        );
        if (me) {
          const role = isSponsorRecord(me) ? 'sponsor' : 'attendee';
          console.log(`[getMyEventRole] badge_code hit → roles=${JSON.stringify(me.roles)} → ${role}`);
          return role;
        }
      }
    }

    // ── Strategy 2: full roster, bypass checked-in filter ────────────────────
    const r2 = await request<any>(
      `/api/v1/events/${eventId}/members?per_page=500&checked_in_only=false`,
    );
    console.log(`[getMyEventRole] full-roster success=${r2.success} items=${extractItems(r2.data).length}`);
    if (r2.success && r2.data) {
      const items = extractItems(r2.data);
      const me = findByUserId(items);
      if (me) {
        const role = isSponsorRecord(me) ? 'sponsor' : 'attendee';
        console.log(`[getMyEventRole] full-roster hit userId=${userId} roles=${JSON.stringify(me.roles)} → ${role}`);
        return role;
      }
      console.log(`[getMyEventRole] full-roster: userId=${userId} NOT found among ${items.length} members`);
    }

    // ── Strategy 3: default endpoint (checked-in only) ───────────────────────
    const r3 = await request<any>(`/api/v1/events/${eventId}/members?per_page=500`);
    console.log(`[getMyEventRole] checked-in-only success=${r3.success} items=${extractItems(r3.data).length}`);
    if (r3.success && r3.data) {
      const items = extractItems(r3.data);
      const me = findByUserId(items);
      if (me) {
        const role = isSponsorRecord(me) ? 'sponsor' : 'attendee';
        console.log(`[getMyEventRole] checked-in hit userId=${userId} roles=${JSON.stringify(me.roles)} → ${role}`);
        return role;
      }
    }

    console.log(`[getMyEventRole] all strategies exhausted → attendee`);
    return 'attendee';
  } catch (err) {
    console.log(`[getMyEventRole] EXCEPTION:`, err);
    return 'attendee';
  }
}

export async function getMe(): Promise<ApiResponse<AuthUser>> {
  const res = await request<any>('/api/v1/me');
  if (!res.success || !res.data) return res as ApiResponse<AuthUser>;

  const envelope = res.data;
  const rawUser = envelope.user ?? envelope.data ?? envelope;
  const user = normalizeAuthUser(rawUser);

  if (!user.id) {
    return {
      success: false,
      error: { code: 'PARSE_ERROR', message: 'Unexpected user profile format from server.' },
    };
  }

  return { success: true, data: user };
}
