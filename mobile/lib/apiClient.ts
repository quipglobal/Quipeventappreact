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
  error?: { code: string; message: string; detail?: string };
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

/**
 * TEMPORARY DIAGNOSTIC LOGGING — remove once the login issue is pinpointed.
 * Logs raw request/response detail for the two auth endpoints (send-otp,
 * verify-otp) so backend can see: exact URL, wall-clock timing, raw HTTP
 * status, and the raw response body text BEFORE any JSON parsing — plus the
 * raw error if fetch itself throws. Tokens/codes are redacted before logging.
 *
 * Active in dev (Expo Go / web preview) automatically; for a production
 * diagnostic build, opt in explicitly with EXPO_PUBLIC_AUTH_DEBUG=true.
 * Scope is strictly limited to the two OTP endpoints.
 */
const AUTH_DEBUG =
  __DEV__ || parseBool(process.env.EXPO_PUBLIC_AUTH_DEBUG, false);

const AUTH_DEBUG_PATHS = ['/api/v1/auth/send-otp', '/api/v1/auth/verify-otp'];

function isAuthDebugPath(path: string): boolean {
  return AUTH_DEBUG && AUTH_DEBUG_PATHS.includes(path);
}

function redactSensitive(text: string): string {
  return text
    .replace(/("(?:token|access_token|auth_token|refresh_token)"\s*:\s*")[^"]+(")/gi, '$1[REDACTED]$2')
    .replace(/("(?:code|otp)"\s*:\s*")\d{4,8}(")/gi, '$1[REDACTED]$2');
}

async function requestOnce<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const method = (options.method ?? 'GET').toUpperCase();
  const startMs = Date.now();
  const url = `${BASE_URL}${path}`;
  const authDebug = isAuthDebugPath(path);
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

    if (authDebug) {
      // On native, BASE_URL is the real backend origin and `url` is absolute.
      // On web, BASE_URL is "" and the request goes through the metro dev
      // proxy — show the effective production target so logs are unambiguous.
      const effectiveUrl = BASE_URL
        ? url
        : `${PRODUCTION_API_URL}${path} (via metro dev proxy, web only)`;
      console.log(
        `[AUTH-DEBUG] → ${method} url="${url}" effectiveTarget="${effectiveUrl}" (BASE_URL="${BASE_URL || '(empty: web/metro proxy)'}" path="${path}") platform=${Platform.OS} tenant=${TENANT_ID} at=${new Date(startMs).toISOString()}`,
      );
    }

    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });

    if (authDebug) {
      console.log(
        `[AUTH-DEBUG] ← ${method} ${path} rawStatus=${res.status} ${res.statusText ?? ''} elapsed=${Date.now() - startMs}ms at=${new Date().toISOString()}`,
      );
    }

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
    if (authDebug) {
      let rawText = '';
      try {
        rawText = await res.text();
        console.log(
          `[AUTH-DEBUG] ${method} ${path} rawBody (${rawText.length} bytes): ${redactSensitive(rawText).slice(0, 2000)}`,
        );
        json = JSON.parse(rawText);
      } catch (parseErr) {
        console.log(
          `[AUTH-DEBUG] ${method} ${path} body read/JSON.parse FAILED: ${parseErr instanceof Error ? `${parseErr.name}: ${parseErr.message}` : String(parseErr)} rawBody="${redactSensitive(rawText).slice(0, 500)}"`,
        );
        return {
          success: false,
          error: { code: 'PARSE_ERROR', message: 'Unexpected server response. Please try again.' },
        };
      }
    } else {
      try {
        json = await res.json();
      } catch {
        return {
          success: false,
          error: { code: 'PARSE_ERROR', message: 'Unexpected server response. Please try again.' },
        };
      }
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
    if (authDebug) {
      console.log(
        `[AUTH-DEBUG] ${method} ${path} fetch THREW (no HTTP response) after ${Date.now() - startMs}ms at=${new Date().toISOString()}: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
      );
    }
    if (__DEV__) {
      console.warn(`[API] ${method} ${path} threw after ${Date.now() - startMs}ms:`, err);
    }

    // Raw error identity, captured engine-agnostically.
    //
    // IMPORTANT: never reference `DOMException` here. Hermes (the native
    // JS engine) does not define it as a global, so `err instanceof
    // DOMException` itself throws a ReferenceError on device — which
    // escaped this catch block entirely and surfaced as the generic
    // "Something went wrong" in the UI for EVERY network-level failure on
    // Android/iOS. Checking `.name` is engine- and realm-agnostic.
    const errName = String((err as { name?: unknown } | null | undefined)?.name ?? '');
    const rawMsg = err instanceof Error ? err.message : String(err);
    const detail = `${errName || 'Error'}: ${rawMsg}`.slice(0, 300);
    const msg = rawMsg.toLowerCase();

    // Our own AbortController fires after REQUEST_TIMEOUT_MS — this means
    // the request reached the network stack fine but the server never
    // responded in time. This is NOT the same as "no internet": the device
    // is connected, the backend is just slow/hung. Detect OUR timeout
    // precisely via controller.signal.aborted rather than message sniffing,
    // because genuine network errors like "Software caused connection
    // abort" also contain the word "abort" and must NOT be swallowed here.
    const isTimeout =
      controller.signal.aborted ||
      errName === 'AbortError' ||
      msg === 'aborted';
    if (isTimeout) {
      return {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'The server is taking longer than usual to respond. Please try again in a moment.',
          detail,
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

    // Android/iOS surface *most* fetch failures (no connectivity, DNS
    // failure, connection refused, TLS errors, etc.) as TypeErrors with
    // varied messages — but native layers (OkHttp/NSURLSession) can also
    // surface them as plain Errors, so match on any Error, not just
    // TypeError. Timeouts are handled above, so what's left genuinely
    // points at a connectivity/DNS/TLS problem, not a slow server.
    const isNetworkError =
      deviceOffline ||
      (err instanceof Error &&
        (msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('failed to fetch') ||
          msg.includes('unable to resolve host') ||
          msg.includes('connection refused') ||
          msg.includes('econnrefused') ||
          msg.includes('timed out') ||
          msg.includes('timeout') ||
          msg.includes('abort') ||
          msg.includes('reset') ||
          msg.includes('socket') ||
          msg.includes('ssl') ||
          msg.includes('handshake') ||
          msg.includes('certificate') ||
          msg.includes('trust anchor') ||
          msg.includes('only absolute urls') ||
          msg.includes('net::')));
    return {
      success: false,
      error: {
        code: isNetworkError ? 'NETWORK_ERROR' : 'REQUEST_FAILED',
        message: isNetworkError
          ? 'No internet connection. Please check your network and try again.'
          : 'Something went wrong. Please try again.',
        detail,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Probe a URL and report whether ANY HTTP response came back. A 404 still
 * counts as reachable — we only care whether the network path (DNS → TCP →
 * TLS → HTTP) works, not what the server says.
 */
async function probeUrl(url: string, timeoutMs = 6000): Promise<boolean> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    await fetch(url, { method: 'GET', headers: { Accept: '*/*' }, signal: c.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

interface NetworkDiagnosis {
  internetOk: boolean;
  serverOk: boolean;
}

/**
 * When a request fails at the network level on a real device, work out
 * WHICH leg is broken so the user gets an accurate message instead of a
 * blanket (and often wrong) "No internet connection":
 *   • internet probe — a highly-available Google 204 endpoint
 *   • server probe   — our own backend origin
 * Native only: on web these cross-origin probes would fail on CORS even
 * with a healthy network, which would poison the diagnosis.
 */
async function diagnoseNetwork(): Promise<NetworkDiagnosis | null> {
  if (Platform.OS === 'web') return null;
  const [internetOk, serverOk] = await Promise.all([
    probeUrl('https://clients3.google.com/generate_204').then(
      (ok) => ok || probeUrl('https://www.gstatic.com/generate_204'),
    ),
    probeUrl(`${BASE_URL || PRODUCTION_API_URL}/api/v1/health`),
  ]);
  return { internetOk, serverOk };
}

const NETWORK_RETRY_DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Public request entry point. Wraps `requestOnce` with:
 *  1. ONE automatic retry after a short delay when the first attempt dies
 *     at the network level (transient radio/DNS blips on mobile networks
 *     routinely succeed on immediate retry).
 *  2. A connectivity diagnosis when the retry also fails, so the final
 *     error message states which leg is actually broken — device offline
 *     vs. backend unreachable — instead of always blaming the user's WiFi.
 *  3. When AUTH_DEBUG is baked into the build, the raw underlying error
 *     (e.g. "TypeError: SSLHandshakeException: …") is appended to the
 *     message so a single user screenshot identifies the root cause.
 */
/**
 * Retry is limited to requests where a duplicate submission is harmless:
 * all GET/HEAD, plus send-otp (re-sending a code is benign — the newest
 * code simply supersedes the old one). verify-otp and register are NEVER
 * retried automatically: in the rare "server processed it but the response
 * got lost" case, a blind retry would consume the code twice or create a
 * duplicate account attempt.
 */
function isRetrySafe(path: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD') return true;
  return path === '/api/v1/auth/send-otp';
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const method = (options.method ?? 'GET').toUpperCase();
  let res = await requestOnce<T>(path, options);
  if (res.success || res.error?.code !== 'NETWORK_ERROR') return res;

  if (isRetrySafe(path, method)) {
    await sleep(NETWORK_RETRY_DELAY_MS);
    res = await requestOnce<T>(path, options);
    if (res.success || res.error?.code !== 'NETWORK_ERROR') return res;
  }

  const diag = await diagnoseNetwork();
  const detail = res.error?.detail;
  if (AUTH_DEBUG) {
    console.log(
      `[AUTH-DEBUG] ${path} network diagnosis: internetOk=${diag?.internetOk} serverOk=${diag?.serverOk} rawError="${detail ?? ''}"`,
    );
  }

  let message: string;
  if (diag && diag.internetOk && !diag.serverOk) {
    message =
      'Your internet is working, but the event server cannot be reached from your device right now. Please try again in a few minutes.';
  } else if (diag && diag.internetOk && diag.serverOk) {
    message =
      'A temporary network issue interrupted the connection. Please try again.';
  } else {
    message = 'No internet connection. Please check your network and try again.';
  }
  if (AUTH_DEBUG && detail) {
    message += `\n[diag: ${detail}${diag ? ` | internet=${diag.internetOk ? 'ok' : 'fail'} server=${diag.serverOk ? 'ok' : 'fail'}` : ''}]`;
  }

  return {
    success: false,
    error: { code: 'NETWORK_ERROR', message, detail },
  };
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
