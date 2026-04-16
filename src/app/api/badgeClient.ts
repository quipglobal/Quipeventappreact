import { apiGet } from './client';

const HEADERS: Record<string, string> = { 'X-Tenant-ID': '3' };

export interface BadgeData {
  success: boolean;
  badge_code: string;
  qr_image?: string;
  qr_image_url?: string;
}

export async function getMyBadgeApi(): Promise<{ success: boolean; data?: BadgeData; error?: string }> {
  const res = await apiGet<never>('/api/v1/me/badge', HEADERS);
  const raw = res as unknown as BadgeData;
  if (raw?.success) {
    return { success: true, data: raw };
  }
  const errMsg = (res as Record<string, unknown>).error;
  const message = errMsg && typeof errMsg === 'object' && 'message' in errMsg
    ? String((errMsg as { message: unknown }).message)
    : 'Failed to load badge';
  return { success: false, error: message };
}
