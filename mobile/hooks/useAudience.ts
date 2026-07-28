import { useState, useCallback, useEffect, useRef } from 'react';
import { useEvent } from '@/context/EventContext';
import { listAttendees, getLeaderboard, listSpeakers } from '@/lib/api/users';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import type { Attendee } from '@/lib/api/types';

/**
 * Paginated audience hook — fetches 15 checked-in attendees per page.
 * Page 1 is fetched on mount (or event change). Call loadMore() to append
 * the next page. Pull-to-refresh calls refetch() which resets to page 1.
 */
export function useAudience() {
  const { currentEventId } = useEvent();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef(false);

  const fetchPage = useCallback(
    async (p: number, mode: 'initial' | 'refresh' | 'more') => {
      if (!currentEventId) return;
      if (fetchingRef.current && mode === 'more') return;
      fetchingRef.current = true;

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefetching(true);
      if (mode === 'more') setIsLoadingMore(true);
      setIsError(false);

      try {
        const res = await listAttendees({ page: p });
        const data = res.data ?? [];
        if (mode === 'more') {
          setAttendees(prev => [...prev, ...data]);
        } else {
          setAttendees(data);
        }
        setPage(p);
        setHasMore(res.hasMore);
        if (!res.success) {
          setIsError(true);
          setError(new Error(res.error?.message ?? 'Failed to load audience'));
        }
      } catch (e) {
        setIsError(true);
        setError(e instanceof Error ? e : new Error('Unknown error'));
      } finally {
        fetchingRef.current = false;
        setIsLoading(false);
        setIsRefetching(false);
        setIsLoadingMore(false);
      }
    },
    [currentEventId],
  );

  useEffect(() => {
    setAttendees([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, 'initial');
  }, [currentEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => fetchPage(1, 'refresh'), [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isLoading || isRefetching) return;
    fetchPage(page + 1, 'more');
  }, [hasMore, isLoadingMore, isLoading, isRefetching, page, fetchPage]);

  return {
    data: attendees,
    isLoading,
    isRefetching,
    isLoadingMore,
    isError,
    error,
    refetch,
    loadMore,
    hasMore,
  };
}

export function useLeaderboard() {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['leaderboard', currentEventId],
    queryFn: getLeaderboard,
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
  });
}

export function useSpeakers() {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['speakers', currentEventId],
    queryFn: listSpeakers,
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
    staleTime: 5 * 60 * 1000,
  });
}
