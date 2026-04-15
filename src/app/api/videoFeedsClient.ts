/**
 * Video Feeds API Client
 * ─────────────────────────────────────────────────────────────────────────────
 *   GET /api/v1/mobile/video-feeds/categories  → string[]
 *   GET /api/v1/mobile/video-feeds             → VideoFeed[]  (paginated)
 */
import { apiGet } from './client';

export interface VideoFeed {
  id: number;
  title: string;
  description: string;
  url: string;
  embed_url: string;
  platform: 'youtube' | string;
  thumbnail_url: string;
  event_categories: string[];
  created_at: string;
  updated_at: string;
}

export interface VideoFeedsMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

export interface VideoFeedsResponse {
  success: boolean;
  data?: VideoFeed[];
  meta?: VideoFeedsMeta;
  error?: { code?: string; message: string };
}

export interface CategoriesResponse {
  success: boolean;
  data?: string[];
  error?: { code?: string; message: string };
}

export async function getVideoFeedCategories(): Promise<CategoriesResponse> {
  const res = await apiGet<string[]>('/api/v1/mobile/video-feeds/categories');
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? { message: 'Failed to load categories.' } };
  }
  return { success: true, data: res.data };
}

interface RawFeedsEnvelope {
  success: boolean;
  data?: VideoFeed[];
  meta?: VideoFeedsMeta;
}

export async function getVideoFeeds(params?: {
  category?: string;
  page?: number;
  per_page?: number;
}): Promise<VideoFeedsResponse> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.page) qs.set('page', String(params.page));
  qs.set('per_page', String(params?.per_page ?? 20));

  const res = await apiGet<unknown>(`/api/v1/mobile/video-feeds?${qs}`);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to load video feeds.' } };
  }

  const envelope = res as unknown as RawFeedsEnvelope;
  const data = Array.isArray(envelope.data) ? envelope.data : [];
  const meta = envelope.meta;

  return { success: true, data, meta };
}
