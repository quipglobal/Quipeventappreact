import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { useEvent } from '@/context/EventContext';
import { listAttendees, getLeaderboard, listSpeakers } from '@/lib/api/users';

export function useAudience(filters?: { tier?: string; search?: string }) {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['attendees', currentEventId, filters],
    queryFn: () => listAttendees(filters),
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
    // Backend returns Cache-Control: no-store — always fetch fresh.
    // staleTime:0 means data is immediately stale so React Query will always
    // go to the network on mount / focus. gcTime:0 evicts the cache entry as
    // soon as there are no active subscribers, preventing stale data from
    // being served to a newly-mounted audience screen.
    staleTime: 0,
    gcTime: 0,
  });
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
