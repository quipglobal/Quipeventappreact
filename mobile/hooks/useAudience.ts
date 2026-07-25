import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { useEvent } from '@/context/EventContext';
import { listAttendees, getLeaderboard, listSpeakers } from '@/lib/api/users';

export function useAudience(filters?: { tier?: string; search?: string }) {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['attendees', currentEventId, filters],
    queryFn: () => listAttendees(filters),
    select: (res) => {
      // Surface backend errors (e.g. 403 "not a member") so isError becomes
      // true and the audience screen can show a meaningful message + Retry.
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to load audience');
      }
      return res.data ?? [];
    },
    enabled: !!currentEventId,
    // 60-second stale window: the attendee list changes infrequently and the
    // old staleTime:0 / gcTime:0 combo guaranteed a full network round-trip
    // on every tab switch. Under high user load (100+ concurrent sessions)
    // that caused a burst of simultaneous GET /attendees calls with zero
    // coalescing. Now repeated visits within 60 s are served from cache and
    // a background refetch runs silently after the window lapses — the list
    // stays fresh without amplifying backend pressure. gcTime uses the React
    // Query default (5 min), keeping the cache warm across brief navigations.
    staleTime: 60_000,
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
