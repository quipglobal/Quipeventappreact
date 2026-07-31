import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { useEvent } from '@/context/EventContext';
import { listSessions, getSession, bookmarkSession } from '@/lib/api/events';

export function useAgenda(filters?: { day?: number; track?: string }) {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['sessions', currentEventId, filters],
    queryFn: () => listSessions(filters),
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
    // Sessions are stable — they change only when the organiser edits the
    // agenda. A 2-minute cache window eliminates the most common storm:
    // simultaneously mounted screens (feed + dashboard) each calling
    // invalidateQueries on every tab focus even though the data is fresh.
    staleTime: 2 * 60_000,
  });
}

export function useSession(id: string) {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['session', currentEventId, id],
    queryFn: () => getSession(id),
    select: (res) => res.data,
    enabled: !!id && !!currentEventId,
    staleTime: 5 * 60_000,
  });
}

export function useBookmarkSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, bookmarked }: { sessionId: string; bookmarked: boolean }) =>
      bookmarkSession(sessionId, bookmarked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}
