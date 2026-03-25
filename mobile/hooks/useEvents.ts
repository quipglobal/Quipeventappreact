import { useQuery, useMutation } from '@tanstack/react-query';
import { listEvents, joinEventByCode } from '@/lib/api/events';
import { getUserPoints } from '@/lib/api/users';

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: listEvents,
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60 * 5,
  });
}

export function useJoinEvent() {
  return useMutation({
    mutationFn: (code: string) => joinEventByCode(code),
  });
}

export function useUserPoints() {
  return useQuery({
    queryKey: ['userPoints'],
    queryFn: getUserPoints,
    select: (res) => res.data,
    staleTime: 1000 * 30,
  });
}
