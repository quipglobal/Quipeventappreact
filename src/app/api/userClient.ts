/**
 * User Profile & Gamification API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET   /api/v1/me                         → ProfileResponse
 *   POST  /api/v1/me/profile  { fields }     → ProfileResponse
 *   GET   /api/v1/events/:id/my-rank         → PointsResponse
 */

import { apiGet, apiPost, API_BASE_URL, TOKEN_KEY } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocialLinks {
  twitter?: string;
  website?: string;
  github?: string;
  facebook?: string;
  instagram?: string;
  [key: string]: string | undefined;
}

export interface InterestedTopic {
  id: number;
  name: string;
  slug?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  companyId: number | null;
  industry: string;
  industryId: number | null;
  title: string;
  bio: string;
  avatar: string;
  profileImage: string;
  linkedinUrl: string;
  socialLinks: SocialLinks;
  interestedTopics: InterestedTopic[];
  points: number;
  tier: string;
  role: 'attendee' | 'sponsor';
  interests: string[];
  profileComplete: boolean;
}

export interface ProfileResponse {
  success: boolean;
  data?: UserProfile;
  error?: { message: string };
}

export interface PointsResponse {
  success: boolean;
  data?: { points: number; tier: string };
  error?: { message: string };
}

/**
 * Fields accepted by POST /api/v1/me/profile (snake_case for backend).
 *
 * Both `company_id` (from the lookup typeahead) and `company` /
 * `company_name` (free-text the user typed without picking a
 * suggestion) are sent so the backend can either use the chosen id
 * or fall back to its existing register-style "find or create by
 * name" path. Same pattern was already used by `auth.register`.
 *
 * `interests` (string names) is sent for backward compat, plus
 * `interested_topic_ids` (numeric ids) which is the canonical pivot
 * shape the model expects on save.
 */
export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  bio?: string;
  linkedin_url?: string;
  company_id?: number | null;
  company?: string;
  company_name?: string;
  industry_id?: number | null;
  social_links?: SocialLinks;
  avatar_url?: string;
  profile_image?: string;
  interests?: string[];
  interested_topic_ids?: number[];
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

function normalizeProfile(raw: Record<string, unknown>): UserProfile {
  const company = raw.company as Record<string, unknown> | string | null | undefined;
  const industry = raw.industry as Record<string, unknown> | string | null | undefined;

  const companyName =
    typeof company === 'string' ? company :
    company && typeof company === 'object' ? String(company.name ?? '') : '';
  const companyId =
    company && typeof company === 'object' && company.id != null ? Number(company.id) :
    raw.company_id != null ? Number(raw.company_id) : null;

  const industryName =
    typeof industry === 'string' ? industry :
    industry && typeof industry === 'object' ? String(industry.name ?? '') : '';
  const industryId =
    industry && typeof industry === 'object' && industry.id != null ? Number(industry.id) :
    raw.industry_id != null ? Number(raw.industry_id) : null;

  const topicsRaw = raw.interested_topics ?? raw.interestedTopics;
  const interestedTopics: InterestedTopic[] = Array.isArray(topicsRaw)
    ? topicsRaw.map((t: unknown) => {
        if (typeof t === 'string') return { id: 0, name: t };
        const obj = t as Record<string, unknown>;
        return {
          id: Number(obj.id ?? 0),
          name: String(obj.name ?? ''),
          slug: obj.slug ? String(obj.slug) : undefined,
        };
      }).filter(t => t.name)
    : [];

  const socialLinksRaw = raw.social_links ?? raw.socialLinks;
  const socialLinks: SocialLinks = {};
  if (socialLinksRaw && typeof socialLinksRaw === 'object' && !Array.isArray(socialLinksRaw)) {
    for (const [k, v] of Object.entries(socialLinksRaw as Record<string, unknown>)) {
      if (typeof v === 'string' && v) socialLinks[k] = v;
    }
  }

  const firstName = pickString(raw.first_name, raw.firstName);
  const lastName = pickString(raw.last_name, raw.lastName);
  const fullName = pickString(raw.name) || `${firstName} ${lastName}`.trim();

  return {
    id: String(raw.id ?? ''),
    name: fullName,
    firstName,
    lastName,
    email: pickString(raw.email),
    phone: pickString(raw.phone),
    company: companyName,
    companyId,
    industry: industryName,
    industryId,
    title: pickString(raw.title, raw.job_title, raw.position),
    bio: pickString(raw.bio),
    avatar: pickString(raw.avatar_url, raw.avatar, raw.photo),
    profileImage: pickString(raw.profile_image, raw.profileImage),
    linkedinUrl: pickString(raw.linkedin_url, raw.linkedinUrl),
    socialLinks,
    interestedTopics,
    points: Number(raw.points ?? raw.gamification_points ?? 0),
    tier: pickString(raw.tier, raw.membership_tier) || 'Bronze',
    role: raw.role === 'sponsor' ? 'sponsor' : 'attendee',
    interests: interestedTopics.map(t => t.name),
    profileComplete: Boolean(raw.profile_complete ?? raw.profileComplete ?? true),
  };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/me
 * Returns the current user's full profile.
 *
 * One-shot diag log of the raw server shape — paired with the
 * matching log in `updateUserProfileApi`, this lets us see whether
 * (a) GET hydrates the form correctly and (b) whether a subsequent
 * SAVE round-trips the same fields back. Removable once the
 * EditProfile save flow is verified end-to-end.
 */
let getProfileDiagLogged = false;
export async function getUserProfileApi(): Promise<ProfileResponse> {
  const res = await apiGet<unknown>('/api/v1/me');
  if (!getProfileDiagLogged && typeof console !== 'undefined') {
    getProfileDiagLogged = true;
    try {
      console.error(
        '[userClient] GET /api/v1/me DIAG (not an error):',
        JSON.stringify(res, null, 2),
      );
    } catch { /* ignore */ }
  }
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch profile.' } };
  }
  const raw = ((res.data as Record<string, unknown>)?.user
    ?? (res.data as Record<string, unknown>)?.data
    ?? res.data) as Record<string, unknown>;
  return { success: true, data: normalizeProfile(raw) };
}

/**
 * POST /api/v1/me/profile
 * Updates editable profile fields. Returns the updated profile on success.
 *
 * One-shot console log of the request payload and the raw server
 * response is emitted to help debug "save didn't stick" reports.
 * Once the bug is fixed for good this can be removed; until then
 * it's the cheapest way to capture the actual server shape from a
 * real authenticated session.
 */
let updateProfileDiagLogged = false;
export async function updateUserProfileApi(payload: ProfileUpdatePayload): Promise<ProfileResponse> {
  const res = await apiPost<unknown>('/api/v1/me/profile', payload);
  if (!updateProfileDiagLogged && typeof console !== 'undefined') {
    updateProfileDiagLogged = true;
    try {
      console.error(
        '[userClient] POST /api/v1/me/profile DIAG (not an error):',
        JSON.stringify({ payload, response: res }, null, 2),
      );
    } catch { /* ignore */ }
  }
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Failed to update profile.' } };
  }
  const raw = ((res.data as Record<string, unknown>)?.data ?? res.data) as Record<string, unknown>;
  return { success: true, data: normalizeProfile(raw) };
}

export interface AvatarUploadResponse {
  success: boolean;
  /** Absolute or root-relative URL the backend stored the image at. */
  data?: { avatarUrl: string };
  error?: { message: string };
}

/**
 * POST /api/v1/me/profile/avatar  (multipart, field: avatar)
 * Uploads an image file and returns the URL to use as `avatar_url`
 * in subsequent profile updates.
 */
export async function uploadAvatarApi(file: File): Promise<AvatarUploadResponse> {
  const form = new FormData();
  form.append('avatar', file);

  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Tenant-ID': '3',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/me/profile/avatar`, {
      method: 'POST',
      headers,
      body: form,
    });
  } catch {
    return { success: false, error: { message: 'Network error while uploading. Please try again.' } };
  }

  let body: Record<string, unknown> = {};
  try { body = await res.json() as Record<string, unknown>; } catch { /* ignore */ }

  if (!res.ok) {
    const errors = body.errors as Record<string, string[]> | undefined;
    const firstFieldError = errors ? Object.values(errors).flat()[0] : undefined;
    return {
      success: false,
      error: { message: firstFieldError ?? (body.message as string) ?? 'Upload failed.' },
    };
  }

  const data = (body.data ?? body) as Record<string, unknown>;
  const avatarUrl = String(data.avatar_url ?? data.avatarUrl ?? '');
  if (!avatarUrl) {
    return { success: false, error: { message: 'Upload succeeded but no URL was returned.' } };
  }
  return { success: true, data: { avatarUrl } };
}

/**
 * GET /api/v1/events/:eventId/my-rank
 * Returns the latest points balance and tier.
 */
export async function getUserPointsApi(eventId?: string): Promise<PointsResponse> {
  if (!eventId) {
    return { success: false, error: { message: 'No event selected.' } };
  }

  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/my-rank`);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Failed to fetch points.' } };
  }
  const raw = res.data as Record<string, unknown>;
  return {
    success: true,
    data: {
      points: Number(raw.points ?? raw.total_points ?? raw.gamification_points ?? 0),
      tier: (raw.tier ?? raw.membership_tier ?? 'Bronze') as string,
    },
  };
}
