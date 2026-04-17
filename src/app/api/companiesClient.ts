/**
 * Companies / Partners API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/v1/events/:id/companies   → companies attending this event
 * GET /api/v1/companies/:id          → full company profile with sponsor reps
 */

import { apiGet } from './client';

const HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyRep {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
}

export interface Company {
  id: number;
  companyId: number;
  name: string;
  logoUrl: string | null;
  website: string | null;
  domain: string | null;
  description: string | null;
  employeeCount: string | null;
  revenueRange: string | null;
  headquarters: string | null;
  foundedYear: number | null;
  companyType: string | null;
  industries: string[];
  marketSegments: string[];
  keywords: string[];
  repCount: number;
  reps?: CompanyRep[];
}

export interface CompaniesResponse {
  success: boolean;
  data?: Company[];
  error?: { message: string };
}

export interface CompanyDetailResponse {
  success: boolean;
  data?: Company;
  error?: { message: string };
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function extractNameArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) =>
    item && typeof item === 'object' && 'name' in (item as object)
      ? String((item as Record<string, unknown>).name)
      : String(item)
  ).filter(Boolean);
}

function normalizeEventCompany(raw: Record<string, unknown>): Company {
  return {
    id: raw.id as number,
    companyId: (raw.company_id ?? raw.id) as number,
    name: (raw.name ?? '') as string,
    logoUrl: (raw.logo_url ?? raw.logoUrl ?? null) as string | null,
    website: (raw.website ?? null) as string | null,
    domain: (raw.domain ?? null) as string | null,
    description: null,
    employeeCount: null,
    revenueRange: null,
    headquarters: (raw.headquarters ?? null) as string | null,
    foundedYear: null,
    companyType: (raw.company_type ?? raw.companyType ?? null) as string | null,
    industries: extractNameArray(raw.industries),
    marketSegments: extractNameArray(raw.marketSegments ?? raw.market_segments),
    keywords: extractNameArray(raw.keywords),
    repCount: 0,
  };
}

function normalizeCompanyDetail(raw: Record<string, unknown>): Company {
  const reps: CompanyRep[] = [];
  if (Array.isArray(raw.sponsorReps)) {
    for (const r of raw.sponsorReps as Record<string, unknown>[]) {
      const eventRoles: string[] = [];
      if (Array.isArray(r.events)) {
        for (const ev of r.events as Record<string, unknown>[]) {
          if (Array.isArray(ev.roles)) eventRoles.push(...(ev.roles as string[]));
        }
      }
      reps.push({
        id: r.id as number,
        fullName: (r.fullName ?? `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()) as string,
        firstName: (r.firstName ?? '') as string,
        lastName: (r.lastName ?? '') as string,
        title: (r.title ?? '') as string,
        email: (r.email ?? '') as string,
        phone: (r.phone ?? null) as string | null,
        avatarUrl: (r.avatarUrl ?? null) as string | null,
        roles: eventRoles,
      });
    }
  }

  return {
    id: raw.id as number,
    companyId: raw.id as number,
    name: (raw.name ?? '') as string,
    logoUrl: (raw.logoUrl ?? raw.logo_url ?? null) as string | null,
    website: (raw.website ?? null) as string | null,
    domain: (raw.domain ?? null) as string | null,
    description: (raw.description ?? null) as string | null,
    employeeCount: (raw.employeeCount ?? raw.employee_count ?? null) as string | null,
    revenueRange: (raw.revenueRange ?? null) as string | null,
    headquarters: (raw.headquarters ?? null) as string | null,
    foundedYear: (raw.foundedYear ?? null) as number | null,
    companyType: (raw.companyType ?? raw.company_type ?? null) as string | null,
    industries: extractNameArray(raw.industries),
    marketSegments: extractNameArray(raw.marketSegments ?? raw.market_segments),
    keywords: extractNameArray(raw.keywords),
    repCount: reps.length,
    reps,
  };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:id/companies
 * Returns companies that are part of this specific event.
 */
export async function getEventCompaniesApi(eventId: string | number): Promise<CompaniesResponse> {
  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/companies?per_page=100`, HEADERS);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch companies.' } };
  }
  const envelope = (res.data as Record<string, unknown>)?.data ?? res.data;
  const rawList: unknown[] = Array.isArray(envelope)
    ? envelope
    : Array.isArray((envelope as Record<string, unknown>)?.data)
      ? ((envelope as Record<string, unknown>).data as unknown[])
      : [];

  return {
    success: true,
    data: rawList.map(r => normalizeEventCompany(r as Record<string, unknown>)),
  };
}

/**
 * GET /api/v1/companies/:id
 * Returns full company profile including sponsor reps.
 */
export async function getCompanyDetailApi(companyId: number): Promise<CompanyDetailResponse> {
  const res = await apiGet<unknown>(`/api/v1/companies/${companyId}`, HEADERS);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Company not found.' } };
  }
  const raw = ((res.data as Record<string, unknown>)?.data ?? res.data) as Record<string, unknown>;
  return { success: true, data: normalizeCompanyDetail(raw) };
}
