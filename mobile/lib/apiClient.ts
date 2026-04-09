import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * On native (iOS/Android) use the full backend URL — no CORS restrictions.
 * On web (Expo web in browser) use '' so calls go to the Metro dev-server proxy
 * at /api/*, which forwards them to the backend without CORS issues.
 */
const BASE_URL =
  Platform.OS === 'web'
    ? ''
    : (process.env.EXPO_PUBLIC_API_BASE_URL ?? '');
const TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID ?? '1';

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

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const method = (options.method ?? 'GET').toUpperCase();
  const startMs = __DEV__ ? Date.now() : 0;
  try {
    const token = await getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Tenant-ID': TENANT_ID,
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

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
    const isNetworkError =
      err instanceof TypeError &&
      (err.message.includes('fetch') ||
        err.message.includes('Network') ||
        err.message.includes('network') ||
        err.message.includes('Failed to fetch'));
    return {
      success: false,
      error: {
        code: isNetworkError ? 'NETWORK_ERROR' : 'REQUEST_FAILED',
        message: isNetworkError
          ? 'No internet connection. Please check your network and try again.'
          : 'Something went wrong. Please try again.',
      },
    };
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
  const isSponsor =
    raw.role === 'sponsor' ||
    systemRole === 'SPONSOR' ||
    rolesArray.includes('sponsor') ||
    rolesArray.includes('exhibitor');

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

export async function sendOtp(phone: string): Promise<ApiResponse<{ message: string }>> {
  return request('/api/v1/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier: phone, type: 'login' }),
  });
}

export interface VerifyOtpResult {
  token: string;
  user: AuthUser | null;
  isNewUser: boolean;
}

export async function verifyOtp(phone: string, otp: string): Promise<ApiResponse<VerifyOtpResult>> {
  const res = await request<any>('/api/v1/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ identifier: phone, code: otp, type: 'login' }),
  });

  if (!res.success || !res.data) return res as ApiResponse<VerifyOtpResult>;

  const raw = res.data;
  const token: string = raw.token ?? raw.access_token ?? raw.auth_token ?? '';

  if (!token) {
    return { success: false, error: { code: 'NO_TOKEN', message: 'Authentication failed. Please try again.' } };
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
