import { request } from '@/lib/apiClient';
import type { ApiResponse, ArticleCategory, Article, ArticleAnalytics } from '@/lib/api/types';

function normalizeCategory(raw: any): ArticleCategory {
  // Backend returns plain strings: ["Finance", "Research", "Technology"]
  if (typeof raw === 'string') {
    return {
      id: raw,
      name: raw,
      slug: raw.toLowerCase().replace(/\s+/g, '-'),
      color: '#7c3aed',
      documentCount: 0,
    };
  }
  return {
    id: String(raw.id ?? raw.slug ?? raw.name ?? ''),
    name: raw.name ?? raw.title ?? '',
    slug: raw.slug ?? String(raw.id ?? ''),
    color: raw.color ?? raw.accent_color ?? '#7c3aed',
    documentCount: Number(raw.document_count ?? raw.documents_count ?? raw.count ?? 0),
  };
}

function estimateReadTime(content: string): number {
  if (!content) return 3;
  const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
}

const BACKEND_BASE = 'https://app.cxocollaborate.com';

/**
 * Resolve a PDF/document file URL from a raw backend object.
 *
 * Resolution order:
 *  1. Canonical PDF-specific fields (pdf_url, file_url, document_url, …)
 *  2. Nested objects: attachment?.url, media?.url, file?.url
 *  3. Generic `url` field — included here because for /reader/documents the
 *     `url` field IS the file URL, not an API endpoint.
 *
 * Relative paths (e.g. /storage/docs/42.pdf) are resolved against BACKEND_BASE.
 * Returns null when no valid http/https URL is found.
 */
/** Resolve a string path/URL to a full https URL, or return null. */
function toUrl(v: unknown): string | null {
  if (!v || typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : null;
  } catch {
    return trimmed.startsWith('/') ? BACKEND_BASE + trimmed : null;
  }
}

/** Extract URL from an object that might be a Spatie media item or similar. */
function urlFromObj(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  return (
    toUrl(o.original_url) ??
    toUrl(o.url) ??
    toUrl(o.full_url) ??
    toUrl(o.path) ??
    toUrl(o.download_url) ??
    null
  );
}

/**
 * Resolve a PDF/document file URL from a raw backend object.
 *
 * Handles:
 * - Direct string fields (file_url, pdf_url, document_url, …)
 * - Fields that are objects { url, original_url, … } (Spatie media items)
 * - media[] array (Spatie Media Library) — prefers PDF mime type, else first item
 * - attachments[] array
 * - Nested objects: attachment, document, pdf, file
 * - Relative paths resolved against BACKEND_BASE
 */
function resolveFileUrl(raw: any): string | null {
  // 1. Direct string fields — try every plausible name
  const directFields = [
    'pdf_url', 'file_url', 'document_url', 'attachment_url',
    'pdf_link', 'download_url', 'media_url', 'resource_url',
    'pdf_path', 'file_path', 'document_path', 'attachment_path',
    'pdf', 'document', 'link', 'file', 'url',
  ];
  for (const f of directFields) {
    const candidate = raw[f];
    if (candidate && typeof candidate === 'string') {
      const u = toUrl(candidate);
      if (u) return u;
    }
    // Field might itself be an object with a url key
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const u = urlFromObj(candidate);
      if (u) return u;
    }
  }

  // 2. Spatie Media Library: raw.media array
  //    Prefer items with mime_type containing 'pdf' or collection_name 'documents'/'pdf'
  if (Array.isArray(raw.media) && raw.media.length > 0) {
    const pdfItem =
      raw.media.find((m: any) =>
        String(m.mime_type ?? '').includes('pdf') ||
        String(m.collection_name ?? '').toLowerCase().includes('pdf') ||
        String(m.collection_name ?? '').toLowerCase().includes('doc') ||
        String(m.file_name ?? '').toLowerCase().endsWith('.pdf'),
      ) ?? raw.media[0];
    const u = urlFromObj(pdfItem);
    if (u) return u;
  }

  // 3. Spatie Media Library: raw.media as single object
  if (raw.media && typeof raw.media === 'object' && !Array.isArray(raw.media)) {
    const u = urlFromObj(raw.media);
    if (u) return u;
  }

  // 4. attachments[] array
  if (Array.isArray(raw.attachments) && raw.attachments.length > 0) {
    const pdfItem =
      raw.attachments.find((a: any) =>
        String(a.mime_type ?? '').includes('pdf') ||
        String(a.name ?? a.file_name ?? '').toLowerCase().endsWith('.pdf'),
      ) ?? raw.attachments[0];
    const u = urlFromObj(pdfItem) ?? toUrl(pdfItem);
    if (u) return u;
  }

  // 5. files[] array
  if (Array.isArray(raw.files) && raw.files.length > 0) {
    const pdfItem =
      raw.files.find((f: any) =>
        String(f.mime_type ?? '').includes('pdf') ||
        String(f.name ?? f.file_name ?? '').toLowerCase().endsWith('.pdf'),
      ) ?? raw.files[0];
    const u = urlFromObj(pdfItem) ?? toUrl(pdfItem);
    if (u) return u;
  }

  // 6. Fallback: scan ALL string fields for anything that looks like a PDF URL
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== 'string') continue;
    if (v.toLowerCase().endsWith('.pdf') || v.includes('/pdf/') || v.includes('/document')) {
      const u = toUrl(v);
      if (u) {
        if (__DEV__) console.log(`[Reader] resolveFileUrl: found PDF-like URL in field "${k}": ${u}`);
        return u;
      }
    }
  }

  if (__DEV__) {
    console.log('[Reader] resolveFileUrl: no URL found. Raw keys:', Object.keys(raw).join(', '));
    const urlLike = Object.entries(raw).filter(
      ([k, v]) =>
        typeof v === 'string' &&
        (String(v).includes('http') || String(v).includes('.pdf') ||
         k.includes('url') || k.includes('file') || k.includes('path')),
    );
    if (urlLike.length) {
      console.log('[Reader] URL-like fields:', JSON.stringify(Object.fromEntries(urlLike)));
    }
  }

  return null;
}

function normalizeArticle(raw: any): Article {
  const author = raw.author ?? raw.user ?? raw.created_by ?? {};
  const category = raw.category ?? raw.document_category ?? {};

  const readTime =
    raw.read_time ?? raw.reading_time ?? raw.estimated_read_time ?? null;
  const estimatedReadMinutes = readTime
    ? Number(readTime)
    : estimateReadTime(raw.content ?? raw.body ?? '');

  const authorName =
    typeof author === 'string'
      ? author
      : (author?.name ?? author?.full_name ?? author?.username ?? raw.author_name ?? '');
  const authorAvatar =
    typeof author === 'object'
      ? (author?.avatar ?? author?.profile_photo_url ?? author?.photo ?? null)
      : null;

  const categoryName =
    typeof category === 'string'
      ? category
      : (category?.name ?? raw.category_name ?? '');
  const categoryColor =
    typeof category === 'object' ? (category?.color ?? '#7c3aed') : '#7c3aed';

  const fileUrl = resolveFileUrl(raw);

  if (__DEV__) {
    console.log(`[Reader] article "${raw.title}" → fileUrl: ${fileUrl ?? 'null'}`);
  }

  const normalized: Article = {
    id: String(raw.id),
    title: raw.title ?? raw.name ?? '',
    excerpt: raw.excerpt ?? raw.description ?? raw.summary ?? raw.short_description ?? '',
    content: raw.content ?? raw.body ?? raw.text ?? raw.html ?? '',
    fileUrl,
    authorName,
    authorAvatar,
    categoryId: String(
      (typeof category === 'string' ? category : null) ??
      (typeof category === 'object' ? category?.id : null) ??
      raw.category_id ?? raw.document_category_id ?? '',
    ),
    categoryName,
    categoryColor,
    thumbnailUrl:
      raw.thumbnail ?? raw.thumbnail_url ?? raw.cover_image_url ?? raw.cover_image ?? raw.featured_image ?? raw.image ?? null,
    estimatedReadMinutes,
    publishedAt: raw.published_at ?? raw.created_at ?? '',
    updatedAt: raw.updated_at ?? raw.published_at ?? raw.created_at ?? '',
  };

  return normalized;
}

export async function getCategories(): Promise<ApiResponse<ArticleCategory[]>> {
  const res = await request<any>('/api/v1/mobile/reader/categories');
  if (!res.success) {
    if (__DEV__) console.log('[Reader] getCategories failed:', res.error);
    return { success: true, data: [] };
  }
  const raw: any[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.data)
    ? res.data.data
    : Array.isArray(res.data?.categories)
    ? res.data.categories
    : [];
  return { success: true, data: raw.map(normalizeCategory) };
}

export async function getDocuments(categoryId?: string): Promise<ApiResponse<Article[]>> {
  // Backend filter param is ?category= (the category name string, e.g. "Finance")
  const qs = categoryId ? `?category=${encodeURIComponent(categoryId)}` : '';
  const res = await request<any>(`/api/v1/mobile/reader/documents${qs}`);
  if (!res.success) {
    if (__DEV__) console.log('[Reader] getDocuments failed:', res.error);
    return { success: true, data: [] };
  }
  const raw: any[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.data)
    ? res.data.data
    : Array.isArray(res.data?.documents)
    ? res.data.documents
    : [];
  if (__DEV__) console.log(`[Reader] getDocuments → ${raw.length} items`);
  return { success: true, data: raw.map(normalizeArticle) };
}

export async function getDocument(id: string): Promise<ApiResponse<Article | null>> {
  const res = await request<any>(`/api/v1/mobile/reader/documents/${id}`);
  if (!res.success) {
    if (__DEV__) console.log(`[Reader] getDocument(${id}) failed:`, res.error);
    return { success: true, data: null };
  }
  const raw = res.data?.data ?? res.data;
  if (!raw || typeof raw !== 'object') return { success: true, data: null };

  if (__DEV__) {
    console.log('[Reader] RAW article response:', JSON.stringify(raw, null, 2));
  }

  const normalized = normalizeArticle(raw);

  return { success: true, data: normalized };
}

/**
 * POST /api/v1/mobile/reader/analytics/read-session
 * Safe to re-send — server merges by session_id (idempotent upsert).
 * Fired on screen blur, app background, and on significant scroll milestones.
 */
export async function postReadingAnalytics(
  _documentId: string,
  analytics: ArticleAnalytics,
): Promise<ApiResponse<void>> {
  const res = await request<any>(
    '/api/v1/mobile/reader/analytics/read-session',
    {
      method: 'POST',
      body: JSON.stringify(analytics),
    },
  );
  if (!res.success && __DEV__) {
    console.log('[Reader] postReadingAnalytics failed:', res.error);
  }
  return { success: res.success };
}

/**
 * POST /api/v1/mobile/reader/analytics/event
 * Fire-and-forget lifecycle events: impression | click | open.
 * Fired by the article list (impression) and article reader (click, open).
 */
export async function postAnalyticsEvent(
  eventType: 'impression' | 'click' | 'open',
  articleId: string,
): Promise<void> {
  request<any>('/api/v1/mobile/reader/analytics/event', {
    method: 'POST',
    body: JSON.stringify({ event_type: eventType, article_id: articleId }),
  }).catch(() => undefined);
}
