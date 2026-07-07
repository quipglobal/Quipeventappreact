import { request, ApiResponse } from '../apiClient';

export interface GlobalVideoFeed {
  id: string;
  title: string;
  thumbnail: string;
  duration?: string;
  category: string;
  url: string;
  published_at: string;
}

export interface GlobalArticle {
  id: string;
  title: string;
  thumbnail: string;
  excerpt: string;
  read_time: string;
  category: string;
  published_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

const GLOBAL_HEADERS = {
  'X-Tenant-ID': '3',
};

/**
 * Fetch global video feeds (Podcast)
 */
export async function fetchGlobalVideoFeeds(params: {
  category?: string;
  search?: string;
  page?: number;
  per_page?: number;
} = {}): Promise<ApiResponse<PaginatedResponse<GlobalVideoFeed>>> {
  const query = new URLSearchParams();
  if (params.category) query.append('category', params.category);
  if (params.search) query.append('search', params.search);
  if (params.page) query.append('page', params.page.toString());
  if (params.per_page) query.append('per_page', params.per_page.toString());

  return request(`/api/v1/mobile/video-feeds?${query.toString()}`, {
    headers: GLOBAL_HEADERS,
  });
}

/**
 * Fetch global video categories
 */
export async function fetchVideoCategories(): Promise<ApiResponse<Category[]>> {
  return request('/api/v1/mobile/video-feeds/categories', {
    headers: GLOBAL_HEADERS,
  });
}

/**
 * Fetch global articles
 */
export async function fetchGlobalArticles(params: {
  category?: string;
  search?: string;
  page?: number;
  per_page?: number;
} = {}): Promise<ApiResponse<PaginatedResponse<GlobalArticle>>> {
  const query = new URLSearchParams();
  if (params.category) query.append('category', params.category);
  if (params.search) query.append('search', params.search);
  if (params.page) query.append('page', params.page.toString());
  if (params.per_page) query.append('per_page', params.per_page.toString());

  return request(`/api/v1/mobile/reader/documents?${query.toString()}`, {
    headers: GLOBAL_HEADERS,
  });
}

/**
 * Fetch global article categories
 */
export async function fetchArticleCategories(): Promise<ApiResponse<Category[]>> {
  return request('/api/v1/mobile/reader/categories', {
    headers: GLOBAL_HEADERS,
  });
}
