/**
 * Shared API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps fetch with:
 *  - Absolute base URL support for production/native builds
 *  - Relative /api fallback for same-origin web deployments
 *  - JSON headers + X-Tenant-ID header
 *  - Bearer token from localStorage
 *  - 401 handler that clears token and reloads to show login
 *  - Typed response envelope { success, data, error }
 */

/**
 * Web deployments served through Vite/Express can continue to use relative
 * paths so the local proxy and same-origin production proxy keep working.
 * Standalone builds do not have that proxy, so they MUST inject an absolute
 * API URL through EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_API_URL (or the
 * existing VITE_API_BASE_URL for web builds).
 */

function readEnv(name: string): string {
  try {
    if (typeof process !== 'undefined' && process?.env?.[name]) {
      return String(process.env[name]);
    }
  } catch {}

  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (metaEnv?.[name]) {
      return String(metaEnv[name]);
    }
  } catch {}

  return '';
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function hasHttpOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return /^https?:$/i.test(window.location.protocol);
}

const configuredBaseUrl = normalizeBaseUrl(
  readEnv('EXPO_PUBLIC_API_BASE_URL') ||
  readEnv('EXPO_PUBLIC_API_URL') ||
  readEnv('VITE_API_BASE_URL')
);

export const API_BASE_URL = configuredBaseUrl || (hasHttpOrigin() ? '' : '');
export const TENANT_ID =
  readEnv('EXPO_PUBLIC_TENANT_ID') ||
  readEnv('VITE_TENANT_ID') ||
  '3';

export const TOKEN_KEY = 'auth_token';

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message: string;
  };
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Tenant-ID': TENANT_ID,
    ...extra,
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function handle401(): void {
  clearToken();
  window.location.reload();
}

function buildUrl(path: string): string | null {
  if (API_BASE_URL) return `${API_BASE_URL}${path}`;
  if (hasHttpOrigin()) return path;
  return null;
}

async function parseResponse<T>(res: Response): Promise<ApiEnvelope<T>> {
  if (res.status === 401) {
    handle401();
    return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' } };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      success: false,
      error: { code: 'PARSE_ERROR', message: 'Invalid response from server.' },
    };
  }

  if (body !== null && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.success === 'boolean') {
      return obj as ApiEnvelope<T>;
    }
    if (!res.ok) {
      const message =
        (typeof obj.message === 'string' ? obj.message : null) ??
        (typeof obj.error === 'string' ? obj.error : null) ??
        `Request failed with status ${res.status}`;
      return { success: false, error: { code: String(res.status), message } };
    }
    return { success: true, data: body as T };
  }

  return {
    success: false,
    error: { code: 'UNEXPECTED_RESPONSE', message: 'Unexpected response format from server.' },
  };
}

const MAX_RETRIES = 2;

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 600));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

function configError<T>(): ApiEnvelope<T> {
  return {
    success: false,
    error: {
      code: 'CONFIG_ERROR',
      message: 'API base URL is not configured for this build.',
    },
  };
}

export async function apiGet<T>(path: string, extraHeaders?: Record<string, string>): Promise<ApiEnvelope<T>> {
  const url = buildUrl(path);
  if (!url) return configError<T>();

  try {
    const res = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildHeaders(extraHeaders),
    });
    return parseResponse<T>(res);
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error. Please check your connection.' } };
  }
}

export async function apiPost<T>(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<ApiEnvelope<T>> {
  const url = buildUrl(path);
  if (!url) return configError<T>();

  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: buildHeaders(extraHeaders),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error. Please check your connection.' } };
  }
}

export async function apiPut<T>(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<ApiEnvelope<T>> {
  const url = buildUrl(path);
  if (!url) return configError<T>();

  try {
    const res = await fetchWithRetry(url, {
      method: 'PUT',
      headers: buildHeaders(extraHeaders),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error. Please check your connection.' } };
  }
}

export async function apiPatch<T>(path: string, body: unknown): Promise<ApiEnvelope<T>> {
  const url = buildUrl(path);
  if (!url) return configError<T>();

  try {
    const res = await fetchWithRetry(url, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error. Please check your connection.' } };
  }
}

export async function apiDelete<T>(path: string, extraHeaders?: Record<string, string>): Promise<ApiEnvelope<T>> {
  const url = buildUrl(path);
  if (!url) return configError<T>();

  try {
    const res = await fetchWithRetry(url, {
      method: 'DELETE',
      headers: buildHeaders(extraHeaders),
    });
    return parseResponse<T>(res);
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error. Please check your connection.' } };
  }
}
