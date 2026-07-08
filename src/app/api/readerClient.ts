/**
 * Reader / Articles API Client
 * ─────────────────────────────────────────────────────────────────────────────
 *   GET  /api/v1/mobile/reader/categories                       → ArticleCategory[]
 *   GET  /api/v1/mobile/reader/documents[?category_id=&page=]  → Article[]
 *   GET  /api/v1/mobile/reader/documents/:id                   → Article
 *   POST /api/v1/mobile/reader/analytics/event                 → void  (impression/click/open)
 *   POST /api/v1/mobile/reader/analytics/read-session          → void  (merged on server)
 *
 * NOT_IMPLEMENTED short-circuit on first 404/405 (same pattern as other clients).
 * Full normalisation on every response — handles multiple envelope shapes and
 * field-name variants so the UI is shielded from backend field changes.
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
  /** URL to the attached PDF/document file, if any */
  pdfUrl: string | null;
}

/** Payload for POST /api/v1/mobile/reader/analytics/read-session */
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

/** Payload for POST /api/v1/mobile/reader/analytics/event */
export interface ArticleAnalyticsEventPayload {
  event_type: 'impression' | 'click' | 'open';
  article_id: number;
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
  const authorRaw = raw.author ?? raw.user ?? raw.created_by ?? {};
  const authorName =
    typeof authorRaw === 'string'
      ? authorRaw
      : String(authorRaw?.name ?? authorRaw?.full_name ?? authorRaw?.username ?? raw.author_name ?? '');
  const authorAvatar =
    typeof authorRaw === 'object' && authorRaw !== null
      ? (authorRaw.avatar ?? authorRaw.profile_photo_url ?? authorRaw.photo ?? null)
      : null;

  const catRaw = raw.category ?? raw.document_category ?? {};
  const categoryId =
    typeof catRaw === 'object' && catRaw !== null
      ? Number(catRaw.id ?? raw.category_id ?? raw.document_category_id ?? null)
      : Number(raw.category_id ?? raw.document_category_id ?? null);
  const categoryName =
    typeof catRaw === 'string' ? catRaw : String(catRaw?.name ?? raw.category_name ?? '');
  const categoryColor =
    typeof catRaw === 'object' && catRaw !== null ? String(catRaw.color ?? '#7c3aed') : '#7c3aed';

  const rawReadTime = raw.read_time ?? raw.reading_time ?? raw.estimated_read_time ?? null;
  const estimatedReadMinutes =
    rawReadTime !== null ? Number(rawReadTime) : estimateReadTime(raw.content ?? raw.body ?? '');

  // Extract PDF/document file URL — mirrors mobile resolveFileUrl logic
  const pdfUrl: string | null = (() => {
    // 1. Direct string fields
    const direct = [
      'pdf_url', 'file_url', 'document_url', 'attachment_url',
      'pdf_link', 'download_url', 'media_url', 'resource_url',
      'pdf_path', 'file_path', 'document_path',
    ];
    for (const f of direct) {
      const v = raw[f];
      if (v && typeof v === 'string') return v;
      if (v && typeof v === 'object' && !Array.isArray(v))
        return v.url ?? v.original_url ?? v.path ?? null;
    }
    // 2. Spatie media[] array — prefer PDF mime type
    if (Array.isArray(raw.media) && raw.media.length > 0) {
      const item =
        raw.media.find((m: any) =>
          String(m.mime_type ?? '').includes('pdf') ||
          String(m.collection_name ?? '').toLowerCase().includes('pdf') ||
          String(m.collection_name ?? '').toLowerCase().includes('doc') ||
          String(m.file_name ?? '').toLowerCase().endsWith('.pdf'),
        ) ?? raw.media[0];
      return item?.original_url ?? item?.url ?? item?.path ?? null;
    }
    // 3. Spatie media as single object
    if (raw.media && typeof raw.media === 'object' && !Array.isArray(raw.media))
      return raw.media.url ?? raw.media.original_url ?? raw.media.path ?? null;
    // 4. attachments[] / files[] arrays
    for (const arr of [raw.attachments, raw.files]) {
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const item =
        arr.find((a: any) =>
          String(a.mime_type ?? '').includes('pdf') ||
          String(a.name ?? a.file_name ?? '').toLowerCase().endsWith('.pdf'),
        ) ?? arr[0];
      return item?.url ?? item?.original_url ?? item?.path ?? (typeof item === 'string' ? item : null);
    }
    // 5. Nested object fields
    for (const f of ['file', 'attachment', 'document', 'pdf']) {
      const v = raw[f];
      if (!v) continue;
      if (typeof v === 'string') return v;
      if (typeof v === 'object' && !Array.isArray(v))
        return v.url ?? v.original_url ?? v.path ?? null;
    }
    // 6. Scan all string fields for PDF-like URLs
    for (const [, v] of Object.entries(raw)) {
      if (typeof v !== 'string') continue;
      if (v.toLowerCase().endsWith('.pdf') || v.includes('/pdf/') || v.includes('/document'))
        return v;
    }
    return null;
  })();

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
    pdfUrl: pdfUrl ? String(pdfUrl) : null,
  };
}

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
  const res = await apiGet<unknown>('/api/v1/mobile/reader/categories');
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

  const res = await apiGet<unknown>(`/api/v1/mobile/reader/documents?${qs}`);
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
  const res = await apiGet<unknown>(`/api/v1/mobile/reader/documents/${id}`);
  if (!res.success) {
    return { success: false, error: res.error ?? { message: 'Failed to load article.' } };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envelope = res as any;
  const raw = envelope.data?.data ?? envelope.data;
  if (!raw || typeof raw !== 'object') return { success: true, data: null };
  return { success: true, data: normalizeArticle(raw) };
}

/**
 * POST /api/v1/mobile/reader/analytics/event
 * Fire-and-forget. Tracks impression / click / open lifecycle events.
 * Failures are silently discarded — never surfaced to the user.
 */
export async function postAnalyticsEvent(
  payload: ArticleAnalyticsEventPayload,
): Promise<void> {
  apiPost<unknown>('/api/v1/mobile/reader/analytics/event', payload).catch(() => undefined);
}

/**
 * POST /api/v1/mobile/reader/analytics/read-session
 * Safe to call multiple times per session — the server merges by session_id.
 * Fired on reader close AND on significant scroll milestones.
 * Failures are silently discarded.
 */
export async function postArticleAnalytics(
  payload: ArticleAnalyticsPayload,
): Promise<void> {
  apiPost<unknown>('/api/v1/mobile/reader/analytics/read-session', payload).catch(() => undefined);
}
