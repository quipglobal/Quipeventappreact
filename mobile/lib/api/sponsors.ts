import { request } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Sponsor } from '@/lib/api/types';

function normalizeSponsor(s: any): Sponsor {
  return {
    id: String(s.id),
    name: s.name ?? '',
    tier: s.tier ?? 'Bronze',
    tagline: s.tagline ?? s.slogan ?? '',
    category: s.category ?? s.industry ?? '',
    boothNumber: s.booth_number ?? s.boothNumber ?? s.booth ?? '',
    tierColor: s.tier_color ?? s.tierColor ?? '#cd7f32',
    accentColor: s.accent_color ?? s.accentColor ?? '#7c3aed',
    giveaway: s.giveaway ?? undefined,
    website: s.website ?? s.url ?? '',
    description: s.description ?? '',
  };
}

export async function listSponsors(tier?: Sponsor['tier']): Promise<ApiResponse<Sponsor[]>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Sponsors] listSponsors eventId=${eventId} tier=${tier}`);
  if (!eventId) return { success: true, data: [] };
  const params = tier ? `?tier=${tier}` : '';
  const res = await request<any>(`/api/v1/events/${eventId}/sponsors${params}`);
  if (!res.success) return res as ApiResponse<Sponsor[]>;
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.sponsors ?? []);
  return { success: true, data: raw.map(normalizeSponsor) };
}

export async function getSponsor(id: string): Promise<ApiResponse<Sponsor>> {
  const eventId = getEventId();
  if (__DEV__) console.log(`[Sponsors] getSponsor(${id}) eventId=${eventId}`);
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/sponsors/${id}`);
  if (!res.success) return res as ApiResponse<Sponsor>;
  return { success: true, data: normalizeSponsor(res.data?.data ?? res.data) };
}
