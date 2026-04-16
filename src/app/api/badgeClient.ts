import { apiGet } from './client';

const HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

export interface BadgeData {
  qr_content: string;
  badge_code: string;
  name: string;
  title?: string;
  company?: string;
  avatar?: string;
  event_name?: string;
}

export async function getMyBadgeApi(): Promise<{ success: boolean; data?: BadgeData; error?: string }> {
  const res = await apiGet<BadgeData>('/api/v1/me/badge', HEADERS);
  if (res.success && res.data) return { success: true, data: res.data };
  return { success: false, error: res.error?.message ?? 'Failed to load badge' };
}
