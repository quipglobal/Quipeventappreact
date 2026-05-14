import { request } from '@/lib/apiClient';
import type { ApiResponse, ArticleCategory, Article, ArticleAnalytics } from '@/lib/api/types';

function normalizeCategory(raw: any): ArticleCategory {
  return {
    id: String(raw.id ?? raw.slug ?? ''),
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

/**
 * Resolve a PDF/document file URL from a raw backend object.
 * Checks every field that backend implementations commonly use.
 * Excludes generic `url` since it often points to the API endpoint, not the file.
 * Returns null when no valid absolute https/http URL is found.
 */
function resolveFileUrl(raw: any): string | null {
  const candidate =
    raw.file_url ??
    raw.pdf_url ??
    raw.document_url ??
    raw.attachment_url ??
    raw.pdf_link ??
    raw.download_url ??
    raw.media_url ??
    raw.resource_url ??
    raw.link ??
    raw.file ??
    null;

  if (!candidate || typeof candidate !== 'string') return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return candidate;
  } catch {
    if (candidate.startsWith('/')) return null;
    return null;
  }
}

function normalizeArticle(raw: any): Article {
  if (__DEV__) {
    const keys = Object.keys(raw ?? {});
    console.log('[Reader] raw document keys:', keys.join(', '));
    const fileFields = [
      'file_url', 'pdf_url', 'document_url', 'attachment_url',
      'pdf_link', 'download_url', 'media_url', 'resource_url',
      'link', 'file', 'url',
    ];
    const found: Record<string, any> = {};
    fileFields.forEach((f) => { if (raw?.[f] != null) found[f] = raw[f]; });
    console.log('[Reader] file-like fields present:', JSON.stringify(found));
    console.log('[Reader] content length:', (raw?.content ?? raw?.body ?? '').length);
  }

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

  return {
    id: String(raw.id),
    title: raw.title ?? raw.name ?? '',
    excerpt: raw.excerpt ?? raw.description ?? raw.summary ?? raw.short_description ?? '',
    content: raw.content ?? raw.body ?? raw.text ?? raw.html ?? '',
    fileUrl,
    authorName,
    authorAvatar,
    categoryId: String(
      (typeof category === 'object' ? category?.id : null) ?? raw.category_id ?? raw.document_category_id ?? '',
    ),
    categoryName,
    categoryColor,
    thumbnailUrl:
      raw.thumbnail ?? raw.thumbnail_url ?? raw.cover_image ?? raw.featured_image ?? raw.image ?? null,
    estimatedReadMinutes,
    publishedAt: raw.published_at ?? raw.created_at ?? '',
    updatedAt: raw.updated_at ?? raw.published_at ?? raw.created_at ?? '',
  };
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
  const qs = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : '';
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
  if (__DEV__) console.log(`[Reader] getDocument(${id}) raw top-level:`, JSON.stringify(raw).slice(0, 400));
  return { success: true, data: normalizeArticle(raw) };
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
