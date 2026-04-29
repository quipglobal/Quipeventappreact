import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getFeedPage, markVideoWatched, submitPollVote } from '@/lib/api/feed';
import { useAuthedInfiniteQuery } from '@/hooks/useAuthedInfiniteQuery';

export function useFeed() {
  return useAuthedInfiniteQuery({
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
