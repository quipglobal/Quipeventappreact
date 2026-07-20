/**
 * Reader / Articles API Client
 * ─────────────────────────────────────────────────────────────────────────────
 *   GET  /api/v1/mobile/reader/categories                              → ArticleCategory[]
 *   GET  /api/v1/mobile/reader/documents[?category=&page=&search=]    → Article[]
 *   GET  /api/v1/mobile/reader/documents/:id                          → Article
 *   POST /api/v1/mobile/reader/analytics/event                        → void  (impression/click/open)
 *   POST /api/v1/mobile/reader/analytics/read-session                 → void  (merged on server)
 *
 * Routes are tenant-scoped via the auth Bearer token — no X-Tenant-ID header needed.
 * Only PUBLISHED documents are returned; drafts are invisible to this API.
 *
 * pdf_url behaviour (backend-resolved):
 *   The backend always resolves pdf_url before sending — it may be a signed GCS URL
 *   (expires in ~1 hour), a legacy storage URL, or a direct external URL.
 *   Always fetch GET /documents/:id fresh before opening the PDF viewer rather than
 *   using a long-cached pdf_url. Hide the "Read" button when pdf_url is null.
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

export interface ArticlesMeta {
  current_page: number;
  last_page: number;
  total: number;
  has_more: boolean;
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
  meta?: ArticlesMeta;
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
  // Backend may return plain strings (e.g. "Technology") rather than objects.
  if (typeof raw === 'string' || typeof raw === 'number') {
    const name = String(raw);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || name;
    return { id: 0, name, slug, color: '#7c3aed', documentCount: 0 };
  }
  const name = String(raw.name ?? raw.title ?? raw.label ?? raw.category_name ?? '');
  // Derive a unique slug even when the backend omits it — used as React key + selection id.
  const slug = String(
    (raw.slug ?? raw.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) || name
  );
  return {
    id: Number(raw.id ?? 0),
    name,
    slug,
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

  // Extract PDF/document file URL.
  // The backend always pre-resolves pdf_url before sending (signed GCS URL, legacy
  // storage URL, or external URL). Never attempt client-side path resolution.
  // pdf_url is null when no PDF is attached — the UI must handle this gracefully.
  //
  // Primary source: raw.pdf_url (canonical new backend field).
  // Fallbacks kept for backward-compat with older response shapes.
  const pdfUrl: string | null = (() => {
    // 1. Canonical field — new backend always sends this pre-resolved
    if (raw.pdf_url && typeof raw.pdf_url === 'string') return raw.pdf_url;
    // 2. Common legacy field aliases
    for (const f of ['file_url', 'document_url', 'attachment_url', 'pdf_link', 'download_url']) {
      const v = raw[f];
      if (v && typeof v === 'string') return v;
      if (v && typeof v === 'object' && !Array.isArray(v))
        return v.url ?? v.original_url ?? v.path ?? null;
    }
    // 3. Spatie media[] — prefer PDF collection/mime type
    if (Array.isArray(raw.media) && raw.media.length > 0) {
      const item =
        raw.media.find((m: any) =>
          String(m.mime_type ?? '').includes('pdf') ||
          String(m.collection_name ?? '').toLowerCase().includes('pdf') ||
          String(m.file_name ?? '').toLowerCase().endsWith('.pdf'),
        ) ?? raw.media[0];
      return item?.original_url ?? item?.url ?? item?.path ?? null;
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
      raw.cover_image_url ?? raw.thumbnail_url ?? raw.thumbnail ?? raw.cover_image ?? raw.featured_image ?? raw.image ?? null,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMeta(res: any): ArticlesMeta | undefined {
  // Shape A — backend sends { success, data: [...], meta: { current_page, last_page, total, has_more } }
  // This is the primary shape used by the mobile reader API (same as video-feeds).
  const top = res.meta ?? res.pagination;
  if (top != null && typeof top === 'object') {
    const cur = Number(top.current_page ?? 1);
    const last = Number(top.last_page ?? top.total_pages ?? 1);
    const hm = top.has_more !== undefined ? Boolean(top.has_more) : (cur < last);
    return { current_page: cur, last_page: last, total: Number(top.total ?? 0), has_more: hm };
  }
  // Shape B — Laravel paginator nested inside data: { data: { data:[...], current_page, last_page } }
  const d = res.data;
  if (!d || Array.isArray(d)) return undefined;
  if (d.current_page != null) {
    const cur = Number(d.current_page);
    const last = Number(d.last_page ?? 1);
    const hm = d.has_more !== undefined ? Boolean(d.has_more) : (cur < last);
    return { current_page: cur, last_page: last, total: Number(d.total ?? 0), has_more: hm };
  }
  // Shape C — meta nested inside the data envelope
  const m = d.meta ?? d.pagination;
  if (m?.current_page != null) {
    const cur = Number(m.current_page);
    const last = Number(m.last_page ?? m.total_pages ?? 1);
    const hm = m.has_more !== undefined ? Boolean(m.has_more) : (cur < last);
    return { current_page: cur, last_page: last, total: Number(m.total ?? 0), has_more: hm };
  }
  return undefined;
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

export async function getArticles(
  params?: {
    /** Filter by category name string — backend accepts ?category=<name> */
    category?: string | null;
    per_page?: number;
    page?: number;
    search?: string;
  },
  signal?: AbortSignal,
): Promise<ArticlesResponse> {
  if (articlesNotImplemented) return { success: true, data: [] };
  if (signal?.aborted) return { success: true, data: [] };

  const qs = new URLSearchParams();
  if (params?.category?.trim()) qs.set('category', params.category.trim());
  qs.set('per_page', String(params?.per_page ?? 20));
  if (params?.page) qs.set('page', String(params.page));
  if (params?.search?.trim()) qs.set('search', params.search.trim());

  const res = await apiGet<unknown>(`/api/v1/mobile/reader/documents?${qs}`);

  if (signal?.aborted) return { success: true, data: [] };
  if (!res.success) {
    if (isNotImplemented(res.error?.code)) {
      articlesNotImplemented = true;
      return { success: true, data: [] };
    }
    return { success: false, error: res.error ?? { message: 'Failed to load articles.' } };
  }
  const raw = extractArray(res);
  const meta = extractMeta(res);
  return { success: true, data: raw.map(normalizeArticle), meta };
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
