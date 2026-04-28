import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFeedPage, markVideoWatched, submitPollVote } from '@/lib/api/feed';
import { useAuth } from '@/context/AuthContext';

export function useFeed() {
  // Inline auth gate: `useAuthedQuery` wraps `useQuery` and the wrapper
  // doesn't extend to `useInfiniteQuery` (different generic signature
  // and pagination contract). The gate here mirrors what
  // `useAuthedQuery` does — AND-merge `enabled` with `!!token &&
  // !!user?.id` so the feed stops fetching the moment the user signs
  // out, instead of leaving the React Query worker churning through
  // pages with a stale (or missing) bearer token.
  const { token, user } = useAuth();
  const authed = !!token && !!user?.id;
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => getFeedPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.success || !lastPage.data?.hasMore) return undefined;
      return lastPage.data.nextCursor ?? undefined;
    },
    select: (data) => ({
      items: data.pages.flatMap((p) => p.data?.items ?? []),
      hasMore: data.pages[data.pages.length - 1]?.data?.hasMore ?? false,
    }),
    staleTime: 1000 * 60,
    enabled: authed,
  });
}

export function useMarkVideoWatched() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) => markVideoWatched(videoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useSubmitPollVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      submitPollVote(pollId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
