import { request, USE_MOCK } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Sponsor } from '@/lib/api/types';

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_SPONSORS: Sponsor[] = [
  { id: 's1', name: 'TechCorp Solutions', tier: 'Platinum', tagline: 'Building the future of enterprise AI', category: 'AI & Cloud', boothNumber: 'A1', tierColor: '#e5e4e2', accentColor: '#7c3aed', giveaway: 'MacBook Pro 16"', website: 'techcorp.example.com', description: 'TechCorp is the global leader in AI-powered enterprise solutions, helping Fortune 500 companies modernize their operations and unlock new value.' },
  { id: 's2', name: 'CloudNine Systems', tier: 'Gold', tagline: 'Scalable cloud infrastructure for teams of any size', category: 'Cloud Infrastructure', boothNumber: 'B3', tierColor: '#ffd700', accentColor: '#06b6d4', giveaway: '$500 AWS Credits', website: 'cloudnine.example.com', description: 'CloudNine provides cloud-native infrastructure tools used by 8,000+ engineering teams worldwide.' },
  { id: 's3', name: 'QuantumLeap AI', tier: 'Gold', tagline: 'ML-powered solutions for enterprise workflows', category: 'AI/ML', boothNumber: 'B5', tierColor: '#ffd700', accentColor: '#10b981', giveaway: 'AI Tool License (1 year)', website: 'quantumleap.example.com', description: 'QuantumLeap builds production-ready ML infrastructure for data-driven enterprises.' },
  { id: 's4', name: 'SecureNet Pro', tier: 'Silver', tagline: 'Zero-trust security for the modern enterprise', category: 'Cybersecurity', boothNumber: 'C2', tierColor: '#c0c0c0', accentColor: '#ef4444', website: 'securenet.example.com', description: 'SecureNet provides next-generation cybersecurity solutions with a zero-trust architecture.' },
  { id: 's5', name: 'DataFlow Analytics', tier: 'Silver', tagline: 'Real-time analytics at enterprise scale', category: 'Data & Analytics', boothNumber: 'C4', tierColor: '#c0c0c0', accentColor: '#f59e0b', website: 'dataflow.example.com', description: 'DataFlow makes real-time data pipelines and analytics accessible for any team size.' },
  { id: 's6', name: 'GreenTech Global', tier: 'Bronze', tagline: 'Sustainable technology for a better future', category: 'Sustainability', boothNumber: 'D1', tierColor: '#cd7f32', accentColor: '#10b981', website: 'greentech.example.com', description: 'GreenTech helps enterprises measure, reduce, and offset their technology carbon footprint.' },
];

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
  if (USE_MOCK) {
    await delay();
    const sponsors = tier ? MOCK_SPONSORS.filter((s) => s.tier === tier) : MOCK_SPONSORS;
    return { success: true, data: sponsors };
  }
  const eventId = getEventId();
  if (!eventId) return { success: true, data: [] };
  const params = tier ? `?tier=${tier}` : '';
  const res = await request<any>(`/api/v1/events/${eventId}/sponsors${params}`);
  if (!res.success) return res as ApiResponse<Sponsor[]>;
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.sponsors ?? []);
  return { success: true, data: raw.map(normalizeSponsor) };
}

export async function getSponsor(id: string): Promise<ApiResponse<Sponsor>> {
  if (USE_MOCK) {
    await delay(400);
    const sponsor = MOCK_SPONSORS.find((s) => s.id === id);
    if (!sponsor) return { success: false, error: { code: 'NOT_FOUND', message: 'Sponsor not found' } };
    return { success: true, data: sponsor };
  }
  const eventId = getEventId();
  if (!eventId) return { success: false, error: { code: 'NO_EVENT', message: 'No active event' } };
  const res = await request<any>(`/api/v1/events/${eventId}/sponsors/${id}`);
  if (!res.success) return res as ApiResponse<Sponsor>;
  return { success: true, data: normalizeSponsor(res.data) };
}
