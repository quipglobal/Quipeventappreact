/**
 * Lookups API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Reference data used to populate dropdowns / chip pickers in profile editing.
 *
 *   GET /api/v1/industries          → list of { id, name }
 *   GET /api/v1/tags                → list of { id, name, slug } (interest topics)
 *   GET /api/v1/companies?per_page= → paginated list of companies
 */

import { apiGet } from './client';

const HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

export interface Lookup {
  id: number;
  name: string;
  slug?: string;
}

export interface LookupsResponse {
  success: boolean;
  data?: Lookup[];
  error?: { message: string };
}

function unwrapList(envelope: unknown): unknown[] {
  if (Array.isArray(envelope)) return envelope;
  if (envelope && typeof envelope === 'object') {
    const obj = envelope as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as unknown[];
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.data)) return inner.data as unknown[];
    }
  }
  return [];
}

function toLookup(raw: unknown): Lookup | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = Number(obj.id ?? 0);
  const name = String(obj.name ?? '');
  if (!id || !name) return null;
  return { id, name, slug: obj.slug ? String(obj.slug) : undefined };
}

export async function listIndustriesApi(): Promise<LookupsResponse> {
  const res = await apiGet<unknown>('/api/v1/industries', HEADERS);
  if (!res.success) return { success: false, error: res.error ?? { message: 'Failed to load industries.' } };
  const list = unwrapList(res.data).map(toLookup).filter((x): x is Lookup => x !== null);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, data: list };
}

export async function listTagsApi(): Promise<LookupsResponse> {
  const res = await apiGet<unknown>('/api/v1/tags', HEADERS);
  if (!res.success) return { success: false, error: res.error ?? { message: 'Failed to load topics.' } };
  const list = unwrapList(res.data).map(toLookup).filter((x): x is Lookup => x !== null);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, data: list };
}

export async function listCompaniesApi(perPage = 200): Promise<LookupsResponse> {
  const res = await apiGet<unknown>(`/api/v1/companies?per_page=${perPage}`, HEADERS);
  if (!res.success) return { success: false, error: res.error ?? { message: 'Failed to load companies.' } };
  const list = unwrapList(res.data).map(toLookup).filter((x): x is Lookup => x !== null);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, data: list };
}
