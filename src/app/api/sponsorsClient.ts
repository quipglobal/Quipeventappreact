/**
 * Sponsors & Partners API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (real backend):
 *   GET /api/v1/events/:eventId/sponsors                     → SponsorsResponse
 *   GET /api/v1/sponsors/:id                                 → SponsorDetailResponse
 */

import { apiGet } from './client';
import type { Sponsor } from '@/app/types/config';

// ─── Response Types ───────────────────────────────────────────────────────────

export interface SponsorsResponse {
  success: boolean;
  data?: Sponsor[];
  error?: { message: string };
}

export interface SponsorDetailResponse {
  success: boolean;
  data?: Sponsor;
  error?: { message: string };
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

type SponsorTier = 'Platinum' | 'Gold' | 'Silver';

function normalizeTier(raw: string | undefined): SponsorTier {
  if (!raw) return 'Silver';
  const t = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (t === 'Platinum' || t === 'Gold' || t === 'Silver') return t;
  return 'Silver';
}

function normalizeSponsor(raw: Record<string, unknown>): Sponsor {
  const resources: Sponsor['resources'] = [];
  if (Array.isArray(raw.resources)) {
    (raw.resources as Record<string, unknown>[]).forEach(r => {
      resources.push({
        id: String(r.id ?? ''),
        title: (r.title ?? r.name ?? '') as string,
        type: (r.type ?? 'link') as Sponsor['resources'][number]['type'],
        url: (r.url ?? r.link ?? '#') as string,
      });
    });
  }

  const staff: Sponsor['staff'] = [];
  if (Array.isArray(raw.staff)) {
    (raw.staff as Record<string, unknown>[]).forEach(s => {
      staff.push({
        id: String(s.id ?? ''),
        name: (s.name ?? '') as string,
        title: (s.title ?? s.job_title ?? '') as string,
        company: (s.company ?? (raw.name as string) ?? '') as string,
        avatar: (s.avatar ?? s.avatar_url ?? '') as string,
      });
    });
  }

  return {
    id: String(raw.id ?? ''),
    name: (raw.name ?? raw.company_name ?? '') as string,
    tier: normalizeTier(raw.tier as string),
    logo: (raw.logo ?? raw.logo_url ?? raw.avatar ?? raw.image ?? '') as string,
    booth: (raw.booth ?? raw.booth_number ?? raw.location ?? '') as string,
    tagline: (raw.tagline ?? raw.slogan ?? raw.headline ?? '') as string,
    description: (raw.description ?? raw.about ?? '') as string,
    website: (raw.website ?? raw.website_url ?? raw.url ?? '') as string,
    resources,
    staff,
    meetingEnabled: Boolean(raw.meeting_enabled ?? raw.meetingEnabled ?? true),
    appointmentEnabled: Boolean(raw.appointment_enabled ?? raw.appointmentEnabled ?? false),
  };
}

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/:eventId/sponsors
 * Returns sponsors for the event, optionally filtered by tier.
 */
export async function listSponsorsApi(eventId: string, tier?: string): Promise<SponsorsResponse> {
  if (!eventId) {
    return { success: true, data: [] };
  }

  const res = await apiGet<unknown>(`/api/v1/events/${eventId}/sponsors`);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to load sponsors.' } };
  }

  const envelope = res.data as Record<string, unknown>;
  const raw: unknown[] = Array.isArray(envelope)
    ? envelope
    : (Array.isArray(envelope?.data) ? envelope.data as unknown[] : null)
      ?? (Array.isArray(envelope?.sponsors) ? envelope.sponsors as unknown[] : null)
      ?? [];

  let sponsors = raw.map(r => normalizeSponsor(r as Record<string, unknown>));
  if (tier) sponsors = sponsors.filter(s => s.tier === tier);
  return { success: true, data: sponsors };
}

/**
 * GET /api/v1/sponsors/:id
 * Returns a single sponsor's full profile.
 */
export async function getSponsorApi(id: string): Promise<SponsorDetailResponse> {
  const res = await apiGet<unknown>(`/api/v1/sponsors/${id}`);
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Sponsor not found.' } };
  }
  const raw = ((res.data as Record<string, unknown>)?.data ?? res.data) as Record<string, unknown>;
  return { success: true, data: normalizeSponsor(raw) };
}
