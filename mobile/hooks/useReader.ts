import { useMutation } from '@tanstack/react-query';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { getCategories, getDocuments, getDocument, postReadingAnalytics } from '@/lib/api/reader';
import type { ArticleAnalytics } from '@/lib/api/types';

export function useArticleCategories() {
  return useAuthedQuery({
    queryKey: ['article-categories'],
    queryFn: getCategories,
    select: (res) => res.data ?? [],
    staleTime: 10 * 60 * 1000,
  });
}

export function useArticles(categoryId?: string) {
  return useAuthedQuery({
    queryKey: ['articles', categoryId ?? 'all'],
    queryFn: () => getDocuments(categoryId),
    select: (res) => res.data ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useArticle(id: string | null) {
  return useAuthedQuery({
    queryKey: ['article', id],
    queryFn: () => getDocument(id!),
    select: (res) => res.data ?? null,
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    refetchOnFocus: false,
  });
}

export function useSubmitArticleAnalytics() {
  return useMutation({
    mutationFn: ({
      documentId,
      analytics,
    }: {
      documentId: string;
      analytics: ArticleAnalytics;
    }) => postReadingAnalytics(documentId, analytics),
  });
}
