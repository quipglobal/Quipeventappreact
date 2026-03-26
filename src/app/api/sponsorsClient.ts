/**
 * Sponsors & Partners API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Typed functions for: list sponsors by tier, get sponsor detail.
 *
 * API CONTRACT (planned):
 *   GET /sponsors           ?tier=Platinum|Gold|Silver  → SponsorsResponse
 *   GET /sponsors/:id                                   → SponsorDetailResponse
 */

import { BASE_URL } from './authClient';
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

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SPONSORS: Sponsor[] = [
  {
    id: '1',
    name: 'TechCorp Solutions',
    tier: 'Platinum',
    logo: 'https://ui-avatars.com/api/?name=TechCorp&background=6366f1&color=fff&size=128',
    booth: 'A-12',
    tagline: 'Empowering the Future with AI',
    description: 'TechCorp Solutions is a leading provider of enterprise AI and machine learning platforms, serving Fortune 500 companies worldwide.',
    website: 'techcorp.com',
    resources: [
      { id: 'r1', title: 'AI Platform Overview', type: 'pdf', url: '#' },
      { id: 'r2', title: 'Product Demo Video', type: 'video', url: '#' },
      { id: 'r3', title: 'Case Studies', type: 'pdf', url: '#' },
    ],
    staff: [
      {
        id: 'st1',
        name: 'John Smith',
        title: 'Solutions Architect',
        company: 'TechCorp',
        avatar: 'https://ui-avatars.com/api/?name=John+Smith&background=6366f1&color=fff',
      },
    ],
    meetingEnabled: true,
    appointmentEnabled: true,
  },
  {
    id: '2',
    name: 'InnovateLab',
    tier: 'Gold',
    logo: 'https://ui-avatars.com/api/?name=InnovateLab&background=8b5cf6&color=fff&size=128',
    booth: 'B-05',
    tagline: 'Cloud Infrastructure Simplified',
    description: 'InnovateLab provides cutting-edge cloud infrastructure and DevOps tools for modern development teams.',
    website: 'innovatelab.io',
    resources: [
      { id: 'r4', title: 'Platform Guide', type: 'pdf', url: '#' },
      { id: 'r5', title: 'Getting Started', type: 'link', url: '#' },
    ],
    staff: [],
    meetingEnabled: true,
    appointmentEnabled: false,
  },
  {
    id: '3',
    name: 'DataFlow Systems',
    tier: 'Gold',
    logo: 'https://ui-avatars.com/api/?name=DataFlow&background=ec4899&color=fff&size=128',
    booth: 'A-08',
    tagline: 'Big Data, Beautiful Insights',
    description: 'DataFlow Systems offers a comprehensive big data analytics and visualization platform trusted by data scientists globally.',
    website: 'dataflow.com',
    resources: [],
    staff: [],
    meetingEnabled: true,
    appointmentEnabled: true,
  },
  {
    id: '4',
    name: 'SecureNet Inc',
    tier: 'Silver',
    logo: 'https://ui-avatars.com/api/?name=SecureNet&background=10b981&color=fff&size=128',
    booth: 'C-15',
    tagline: 'Your Security, Our Priority',
    description: 'SecureNet provides enterprise cybersecurity and compliance solutions for the modern workplace.',
    website: 'securenet.com',
    resources: [],
    staff: [],
    meetingEnabled: true,
    appointmentEnabled: false,
  },
  {
    id: '5',
    name: 'CloudStream',
    tier: 'Silver',
    logo: 'https://ui-avatars.com/api/?name=CloudStream&background=f59e0b&color=fff&size=128',
    booth: 'B-22',
    tagline: 'Stream Without Limits',
    description: 'CloudStream delivers high-performance video streaming and content delivery network services.',
    website: 'cloudstream.io',
    resources: [],
    staff: [],
    meetingEnabled: false,
    appointmentEnabled: false,
  },
];

const delay = (ms = 700) => new Promise<void>(res => setTimeout(res, ms));

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /sponsors
 * Returns sponsors grouped or filtered by tier.
 */
export async function listSponsorsApi(tier?: string): Promise<SponsorsResponse> {
  await delay();

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const params = tier ? `?tier=${encodeURIComponent(tier)}` : '';
  const res = await fetch(`${BASE_URL}/sponsors${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<SponsorsResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  const data = tier ? MOCK_SPONSORS.filter(s => s.tier === tier) : MOCK_SPONSORS;
  return { success: true, data };
}

/**
 * GET /sponsors/:id
 * Returns a single sponsor's full profile including staff, resources, and booth info.
 */
export async function getSponsorApi(id: string): Promise<SponsorDetailResponse> {
  await delay(500);

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/sponsors/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<SponsorDetailResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  const sponsor = MOCK_SPONSORS.find(s => s.id === id);
  if (!sponsor) return { success: false, error: { message: 'Sponsor not found' } };
  return { success: true, data: sponsor };
}
