import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { listSessions, getSession, bookmarkSession } from '@/lib/api/events';

export function useAgenda(filters?: { day?: number; track?: string }) {
  return useAuthedQuery({
    queryKey: ['sessions', filters],
    queryFn: () => listSessions(filters),
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60 * 5,
  });
}

export function useSession(id: string) {
  return useAuthedQuery({
    queryKey: ['session', id],
    queryFn: () => getSession(id),
    select: (res) => res.data,
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
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
