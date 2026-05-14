/**
 * Reader / Articles API Client
 * ─────────────────────────────────────────────────────────────────────────────
 *   GET  /mobile/reader/categories                       → ArticleCategory[]
 *   GET  /mobile/reader/documents[?category_id=&page=]  → Article[]
 *   GET  /mobile/reader/documents/:id                   → Article
 *   POST /mobile/reader/documents/:id/analytics         → void
 *
 * Data contract:
 *   - NOT_IMPLEMENTED short-circuit on first 404/405 (same pattern as other clients)
 *   - Full normalisation on every response: handles multiple envelope shapes
 *     and field-name variants so the UI is shielded from backend field changes
 */
import { apiGet, apiPost } from './client';

// ── Normalised types ────────────────────────────────────────────────────────

export interface ArticleCategory {
  id: number;
  name: string;
  slug: string;
  color: string;
  documentCount: number;
}

export interface Article {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  authorAvatar: string | null;
  categoryId: number | null;
  categoryName: string;
  categoryColor: string;
  thumbnailUrl: string | null;
  estimatedReadMinutes: number;
  publishedAt: string;
  updatedAt: string;
}

export interface ArticleAnalyticsPayload {
  session_id: string;
  article_id: number;
  click_count: number;
  active_read_seconds: number;
  total_elapsed_seconds: number;
  max_scroll_percent: number;
  started_at: string;
  ended_at: string;
  completed: boolean;
}

// ── Response envelopes ──────────────────────────────────────────────────────

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

export interface ArticleResponse {
  success: boolean;
  data?: Article | null;
  error?: { code?: string; message: string };
}

// ── NOT_IMPLEMENTED guards ──────────────────────────────────────────────────

let categoriesNotImplemented = false;
let articlesNotImplemented = false;

function isNotImplemented(code?: string): boolean {
  return code === '404' || code === '405' || code === 'NOT_FOUND';
}

// ── Normalisation helpers ───────────────────────────────────────────────────

function estimateReadTime(text: string): number {
  if (!text) return 3;
  const wordCount = text.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCategory(raw: any): ArticleCategory {
  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? raw.title ?? ''),
    slug: String(raw.slug ?? raw.id ?? ''),
    color: String(raw.color ?? raw.accent_color ?? '#7c3aed'),
    documentCount: Number(raw.document_count ?? raw.documents_count ?? raw.count ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeArticle(raw: any): Article {
  // Author — may be nested object or plain string
  const authorRaw = raw.author ?? raw.user ?? raw.created_by ?? {};
  const authorName =
    typeof authorRaw === 'string'
      ? authorRaw
      : String(authorRaw?.name ?? authorRaw?.full_name ?? authorRaw?.username ?? raw.author_name ?? '');
  const authorAvatar =
    typeof authorRaw === 'object' && authorRaw !== null
      ? (authorRaw.avatar ?? authorRaw.profile_photo_url ?? authorRaw.photo ?? null)
      : null;

  // Category — may be nested object or root-level fields
  const catRaw = raw.category ?? raw.document_category ?? {};
  const categoryId =
    typeof catRaw === 'object' && catRaw !== null
      ? Number(catRaw.id ?? raw.category_id ?? raw.document_category_id ?? null)
      : Number(raw.category_id ?? raw.document_category_id ?? null);
  const categoryName =
    typeof catRaw === 'string' ? catRaw : String(catRaw?.name ?? raw.category_name ?? '');
  const categoryColor =
    typeof catRaw === 'object' && catRaw !== null ? String(catRaw.color ?? '#7c3aed') : '#7c3aed';

  // Read time — backend may give it directly; fall back to word-count estimate
  const rawReadTime = raw.read_time ?? raw.reading_time ?? raw.estimated_read_time ?? null;
  const estimatedReadMinutes =
    rawReadTime !== null ? Number(rawReadTime) : estimateReadTime(raw.content ?? raw.body ?? '');

  return {
    id: Number(raw.id),
    title: String(raw.title ?? raw.name ?? ''),
    excerpt: String(raw.excerpt ?? raw.description ?? raw.summary ?? raw.short_description ?? ''),
    content: String(raw.content ?? raw.body ?? raw.text ?? raw.html ?? ''),
    authorName,
    authorAvatar: authorAvatar ? String(authorAvatar) : null,
    categoryId: Number.isNaN(categoryId) ? null : categoryId,
    categoryName,
    categoryColor,
    thumbnailUrl:
      raw.thumbnail ?? raw.thumbnail_url ?? raw.cover_image ?? raw.featured_image ?? raw.image ?? null,
    estimatedReadMinutes,
    publishedAt: String(raw.published_at ?? raw.created_at ?? ''),
    updatedAt: String(raw.updated_at ?? raw.published_at ?? raw.created_at ?? ''),
  };
}

/** Pull an array out of whichever envelope shape the backend returns. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractArray(res: any): unknown[] {
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.data)) return res.data.data;
  if (Array.isArray(res.data?.documents)) return res.data.documents;
  if (Array.isArray(res.data?.categories)) return res.data.categories;
  if (Array.isArray(res.data?.items)) return res.data.items;
  return [];
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getArticleCategories(): Promise<ArticleCategoriesResponse> {
  if (categoriesNotImplemented) return { success: true, data: [] };
  const res = await apiGet<unknown>('/mobile/reader/categories');
  if (!res.success) {
    if (isNotImplemented(res.error?.code)) {
      categoriesNotImplemented = true;
      return { success: true, data: [] };
    }
    return { success: false, error: res.error ?? { message: 'Failed to load categories.' } };
  }
  const raw = extractArray(res);
  return { success: true, data: raw.map(normalizeCategory) };
}

export async function getArticles(params?: {
  category_id?: number | null;
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
    if (isNotImplemented(res.error?.code)) {
      articlesNotImplemented = true;
      return { success: true, data: [] };
    }
    return { success: false, error: res.error ?? { message: 'Failed to load articles.' } };
  }
  const raw = extractArray(res);
  return { success: true, data: raw.map(normalizeArticle) };
}

export async function getArticle(id: number): Promise<ArticleResponse> {
  const res = await apiGet<unknown>(`/mobile/reader/documents/${id}`);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to load article.' } };
  }
  // Unwrap single-item envelope: { data: { data: {...} } } or { data: {...} }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envelope = res as any;
  const raw = envelope.data?.data ?? envelope.data;
  if (!raw || typeof raw !== 'object') return { success: true, data: null };
  return { success: true, data: normalizeArticle(raw) };
}

export async function postArticleAnalytics(
  articleId: number,
  payload: ArticleAnalyticsPayload,
): Promise<{ success: boolean }> {
  const res = await apiPost<unknown>(
    `/mobile/reader/documents/${articleId}/analytics`,
    payload,
  );
  return { success: res.success };
}
