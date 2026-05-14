/**
 * Reader / Articles API Client
 * ─────────────────────────────────────────────────────────────────────────────
 *   GET /mobile/reader/categories   → ArticleCategory[]
 *   GET /mobile/reader/documents    → Article[]  (paginated)
 *
 * Uses NOT_IMPLEMENTED short-circuit on 404/405 (same pattern as other clients).
 */
import { apiGet } from './client';

export interface ArticleCategory {
  id: number;
  name: string;
  slug: string;
}

export interface Article {
  id: number;
  title: string;
  excerpt?: string;
  content?: string;
  cover_image_url?: string;
  author?: string;
  estimated_read_time?: number;
  published_at?: string;
  created_at: string;
  category?: ArticleCategory;
}

export interface ArticlesResponse {
  success: boolean;
  data?: Article[];
  error?: { code?: string; message: string };
}

export interface ArticleCategoriesResponse {
  success: boolean;
  data?: ArticleCategory[];
  error?: { code?: string; message: string };
}

let categoriesNotImplemented = false;
let articlesNotImplemented = false;

export async function getArticleCategories(): Promise<ArticleCategoriesResponse> {
  if (categoriesNotImplemented) return { success: true, data: [] };
  const res = await apiGet<unknown>('/mobile/reader/categories');
  if (!res.success) {
    if (res.error?.code === '404' || res.error?.code === '405') {
      categoriesNotImplemented = true;
      return { success: true, data: [] };
    }
    return { success: false, error: res.error ?? { message: 'Failed to load categories.' } };
  }
  const raw = res as Record<string, unknown>;
  const data = Array.isArray(raw.data) ? (raw.data as ArticleCategory[]) : [];
  return { success: true, data };
}

export async function getArticles(params?: {
  category_id?: number;
  per_page?: number;
  page?: number;
}): Promise<ArticlesResponse> {
  if (articlesNotImplemented) return { success: true, data: [] };
  const qs = new URLSearchParams();
  if (params?.category_id) qs.set('category_id', String(params.category_id));
  qs.set('per_page', String(params?.per_page ?? 20));
  if (params?.page) qs.set('page', String(params.page));

  const res = await apiGet<unknown>(`/mobile/reader/documents?${qs}`);
  if (!res.success) {
    if (res.error?.code === '404' || res.error?.code === '405') {
      articlesNotImplemented = true;
      return { success: true, data: [] };
    }
    return { success: false, error: res.error ?? { message: 'Failed to load articles.' } };
  }
  const raw = res as Record<string, unknown>;
  const data = Array.isArray(raw.data) ? (raw.data as Article[]) : [];
  return { success: true, data };
}
