import { useQuery } from '@tanstack/react-query';
import { listAttendees, getLeaderboard } from '@/lib/api/users';

export function useAudience(filters?: { tier?: string; search?: string }) {
  return useQuery({
    queryKey: ['attendees', filters],
    queryFn: () => listAttendees(filters),
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60 * 3,
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60 * 2,
  });
}
