import { request } from '@/lib/apiClient';
import type { ApiResponse } from '@/lib/api/types';

export interface LookupItem {
  id: number;
  name: string;
  slug?: string;
}

function unwrapList(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;
  return [];
}

function toLookupItem(raw: any): LookupItem | null {
  const id = Number(raw?.id ?? 0);
  const name = String(raw?.name ?? '');
  if (!id || !name) return null;
  return { id, name, slug: raw.slug ? String(raw.slug) : undefined };
}

export async function listIndustriesApi(): Promise<ApiResponse<LookupItem[]>> {
  const res = await request<any>('/api/v1/industries');
  if (!res.success) {
    return { success: false, error: res.error ?? { code: 'FETCH_FAILED', message: 'Failed to load industries' } };
  }
  const list = unwrapList(res.data).map(toLookupItem).filter((x): x is LookupItem => x !== null);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, data: list };
}

export async function listTagsApi(): Promise<ApiResponse<LookupItem[]>> {
  const res = await request<any>('/api/v1/tags');
  if (!res.success) {
    return { success: false, error: res.error ?? { code: 'FETCH_FAILED', message: 'Failed to load topics' } };
  }
  const list = unwrapList(res.data).map(toLookupItem).filter((x): x is LookupItem => x !== null);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, data: list };
}

export interface FullProfile {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  bio: string;
  company: string;
  companyId: number | null;
  industry: string;
  industryId: number | null;
  avatar: string;
  linkedinUrl: string;
  socialLinks: Record<string, string>;
  interestedTopics: LookupItem[];
  interests: string[];
  points: number;
  tier: string;
  role: 'attendee' | 'sponsor';
  profileComplete: boolean;
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) if (typeof v === 'string' && v) return v;
  return '';
}

export function normalizeFullProfile(raw: any): FullProfile {
  const company = raw.company;
  const companyName =
    typeof company === 'string'
      ? company
      : company && typeof company === 'object'
      ? String(company.name ?? '')
      : String(raw.company_name ?? '');
  const companyId =
    company && typeof company === 'object' && company.id != null
      ? Number(company.id)
      : raw.company_id != null
      ? Number(raw.company_id)
      : null;

  const industry = raw.industry;
  const industryName =
    typeof industry === 'string'
      ? industry
      : industry && typeof industry === 'object'
      ? String(industry.name ?? '')
      : '';
  const industryId =
    industry && typeof industry === 'object' && industry.id != null
      ? Number(industry.id)
      : raw.industry_id != null
      ? Number(raw.industry_id)
      : null;

  const topicsRaw = raw.interested_topics ?? raw.interestedTopics ?? raw.interests_tags ?? [];
  const interestedTopics: LookupItem[] = Array.isArray(topicsRaw)
    ? topicsRaw
        .map((t: any) => {
          if (typeof t === 'string') return { id: 0, name: t };
          return { id: Number(t.id ?? 0), name: String(t.name ?? ''), slug: t.slug };
        })
        .filter((t: LookupItem) => t.name)
    : [];

  const socialLinksRaw = raw.social_links ?? raw.socialLinks ?? {};
  const socialLinks: Record<string, string> = {};
  if (socialLinksRaw && typeof socialLinksRaw === 'object') {
    for (const [k, v] of Object.entries(socialLinksRaw)) {
      if (typeof v === 'string' && v) socialLinks[k] = v;
    }
  }

  const firstName = pickString(raw.first_name, raw.firstName);
  const lastName = pickString(raw.last_name, raw.lastName);
  const name = pickString(raw.name) || `${firstName} ${lastName}`.trim();

  const roleStr = String(raw.role ?? '').toLowerCase();
  const rolesArray: string[] = Array.isArray(raw.roles)
    ? raw.roles.map((r: any) => (typeof r === 'string' ? r : r?.name ?? '').toLowerCase())
    : [];
  const isSponsor =
    roleStr === 'sponsor' ||
    roleStr === 'sponsor_rep' ||
    roleStr === 'exhibitor' ||
    rolesArray.includes('sponsor') ||
    rolesArray.includes('sponsor_rep');

  return {
    id: String(raw.id ?? ''),
    firstName,
    lastName,
    name,
    email: pickString(raw.email),
    phone: pickString(raw.phone, raw.phone_number),
    title: pickString(raw.title, raw.job_title, raw.position),
    bio: pickString(raw.bio, raw.about),
    company: companyName,
    companyId,
    industry: industryName,
    industryId,
    avatar: pickString(raw.avatar_url, raw.avatar, raw.profile_image, raw.photo),
    linkedinUrl: pickString(raw.linkedin_url, raw.linkedinUrl),
    socialLinks,
    interestedTopics,
    interests: interestedTopics.map(t => t.name),
    points: Number(raw.points ?? raw.gamification_points ?? 0),
    tier: pickString(raw.tier, raw.membership_tier) || 'Bronze',
    role: isSponsor ? 'sponsor' : 'attendee',
    profileComplete: Boolean(raw.profile_complete ?? raw.profileComplete ?? true),
  };
}

export async function getMyProfileApi(): Promise<ApiResponse<FullProfile>> {
  const res = await request<any>('/api/v1/me');
  if (!res.success) {
    return { success: false, error: res.error ?? { code: 'FETCH_FAILED', message: 'Failed to load profile' } };
  }
  const raw =
    (res.data as any)?.user ??
    (res.data as any)?.data ??
    res.data;
  return { success: true, data: normalizeFullProfile(raw) };
}
