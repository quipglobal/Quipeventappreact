import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFeedPage,
  getVideoFeedsPage,
  getVideoFeed,
  markVideoWatched,
  submitPollVote,
} from '@/lib/api/feed';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { useAuthedInfiniteQuery } from '@/hooks/useAuthedInfiniteQuery';

/**
 * Paginated home-screen video feed.
 *
 * Backed by `GET /api/v1/events/:eventId/event-video-feeds`. Returns
 * the flattened list of `FeedVideo` items across all fetched pages so
 * the consumer can keep using `videos: FeedVideo[]` exactly as before
 * — the infinite-query plumbing (cursors, `fetchNextPage`, `hasMore`)
 * is exposed alongside for screens that want to render an end-of-list
 * loader.
 */
export function useVideoFeeds() {
  const query = useAuthedInfiniteQuery({
    queryKey: ['video-feeds'],
    queryFn: ({ pageParam }) => getVideoFeedsPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.success || !lastPage.data?.hasMore) return undefined;
      return lastPage.data.nextCursor ?? undefined;
    },
    select: (data) => ({
      items: data.pages.flatMap((p) => p.data?.items ?? []),
      hasMore: data.pages[data.pages.length - 1]?.data?.hasMore ?? false,
    }),
  });

  return {
    ...query,
    // Surface a flat array under `data` so existing call-sites that
    // destructured `data: videos = []` keep compiling and behaving.
    data: query.data?.items ?? [],
    hasMore: query.data?.hasMore ?? false,
  };
}

/** Single video-feed detail by id. */
export function useVideoFeed(feedId: string | null | undefined) {
  return useAuthedQuery({
    queryKey: ['video-feed', feedId],
    queryFn: () => getVideoFeed(feedId!),
    select: (res) => res.data,
    enabled: !!feedId,
  });
}

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
