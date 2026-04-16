/**
 * Shared API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps fetch with:
 *  - Base URL injection (always '' — proxy handles routing)
 *  - JSON headers + X-Tenant-ID header
 *  - Bearer token from localStorage
 *  - 401 handler that clears token and reloads to show login
 *  - Typed response envelope { success, data, error }
 */

/**
 * Always use relative paths — the Vite dev-server proxy (in dev) and
 * server.js proxy (in production) both forward /api/* to the backend.
 * Using VITE_API_BASE_URL directly causes cross-origin fetch failures
 * because the backend doesn't send Access-Control-Allow-Origin.
 */
export const API_BASE_URL = '';

const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? '1';

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

export async function apiGet<T>(path: string, extraHeaders?: Record<string, string>): Promise<ApiEnvelope<T>> {
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: buildHeaders(extraHeaders),
    });
    return parseResponse<T>(res);
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error. Please check your connection.' } };
  }
}

export async function apiPost<T>(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<ApiEnvelope<T>> {
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
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
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
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
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error. Please check your connection.' } };
  }
}
