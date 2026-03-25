import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.cxoinc.com/v1';
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false';

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

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    if (res.status === 401) {
      await clearToken();
      _unauthorizedHandler?.();
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } };
    }
    return res.json() as Promise<ApiResponse<T>>;
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network request failed' } };
  }
}

const delay = (ms = 900) => new Promise<void>((r) => setTimeout(r, ms));

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
}

const MOCK_USERS: Record<string, { user: AuthUser; token: string }> = {
  '5550000001': {
    token: 'mock-token-jessica-001',
    user: {
      id: 'user-5550000001', phone: '+1 (555) 000-0001', name: 'Jessica Williams', email: 'jessica@stripe.com',
      title: 'Product Designer', company: 'Stripe', role: 'attendee',
      avatar: 'https://ui-avatars.com/api/?name=Jessica+Williams&background=6366f1&color=fff',
      points: 120, tier: 'Silver', interests: ['Design', 'Product'], profileComplete: true,
    },
  },
  '5550000002': {
    token: 'mock-token-michael-002',
    user: {
      id: 'user-5550000002', phone: '+1 (555) 000-0002', name: 'Michael Chen', email: 'michael@startupx.com',
      title: 'CTO', company: 'StartupX', role: 'attendee',
      avatar: 'https://ui-avatars.com/api/?name=Michael+Chen&background=8b5cf6&color=fff',
      points: 350, tier: 'Gold', interests: ['Engineering', 'AI'], profileComplete: true,
    },
  },
  '8156699646': {
    token: 'mock-token-alex-003',
    user: {
      id: 'user-8156699646', phone: '+1 (815) 669-9646', name: 'Alex Thompson', email: 'alex@demo.com',
      title: 'Director of Sales', company: 'NovaTech', role: 'attendee',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Thompson&background=0ea5e9&color=fff',
      points: 45, tier: 'Bronze', interests: ['Sales', 'Networking'], profileComplete: true,
    },
  },
  '5550009999': {
    token: 'mock-token-sponsor-9999',
    user: {
      id: 'user-5550009999', phone: '+1 (555) 000-9999', name: 'Sarah Sponsor', email: 'sponsor@acmecorp.com',
      title: 'VP Partnerships', company: 'AcmeCorp', role: 'sponsor',
      avatar: 'https://ui-avatars.com/api/?name=Sarah+Sponsor&background=ec4899&color=fff',
      points: 0, tier: 'Bronze', interests: ['Partnerships', 'Enterprise'], profileComplete: true,
    },
  },
};

const DEMO_OTP = '123456';
const MOCK_SESSIONS_KEY = 'cxo_mock_sessions';

async function getMockSessions(): Promise<Record<string, AuthUser>> {
  try {
    const raw = await AsyncStorage.getItem(MOCK_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveMockSession(token: string, user: AuthUser): Promise<void> {
  const sessions = await getMockSessions();
  sessions[token] = user;
  await AsyncStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(sessions));
}

export async function sendOtp(phone: string): Promise<ApiResponse<{ message: string }>> {
  if (USE_MOCK) {
    await delay(900);
    return { success: true, data: { message: 'OTP sent' } };
  }
  return request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) });
}

export interface VerifyOtpResult {
  token: string;
  user: AuthUser | null;
  isNewUser: boolean;
}

export async function verifyOtp(phone: string, otp: string): Promise<ApiResponse<VerifyOtpResult>> {
  if (USE_MOCK) {
    await delay(800);
    if (otp !== DEMO_OTP) {
      return { success: false, error: { code: 'INVALID_OTP', message: 'Incorrect code. Please try again.' } };
    }
    const digits = phone.replace(/\D/g, '');
    const found = MOCK_USERS[digits];
    if (found) {
      return { success: true, data: { token: found.token, user: found.user, isNewUser: false } };
    }
    return { success: true, data: { token: '', user: null, isNewUser: true } };
  }
  return request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) });
}

export interface RegisterInput {
  phone: string;
  name: string;
  email: string;
  title: string;
  company: string;
}

export async function register(input: RegisterInput): Promise<ApiResponse<{ token: string; user: AuthUser }>> {
  if (USE_MOCK) {
    await delay(900);
    const digits = input.phone.replace(/\D/g, '');
    const user: AuthUser = {
      id: `user-${digits}-new`,
      name: input.name.trim(),
      email: input.email.trim(),
      title: input.title.trim(),
      company: input.company.trim(),
      role: 'attendee',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(input.name.trim())}&background=7c3aed&color=fff`,
      points: 0,
      tier: 'Bronze',
      interests: [],
      profileComplete: true,
    };
    const token = `mock-token-${digits}-new`;
    await saveMockSession(token, user);
    return { success: true, data: { token, user } };
  }
  return request('/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export async function getMe(): Promise<ApiResponse<AuthUser>> {
  if (USE_MOCK) {
    await delay(500);
    const token = await getToken();
    if (!token) return { success: false, error: { code: 'NO_TOKEN', message: 'Not authenticated' } };
    const found = Object.values(MOCK_USERS).find((u) => u.token === token);
    if (found) return { success: true, data: found.user };
    const sessions = await getMockSessions();
    if (sessions[token]) return { success: true, data: sessions[token] };
    return { success: false, error: { code: 'INVALID_TOKEN', message: 'Token expired' } };
  }
  return request<AuthUser>('/auth/me');
}
