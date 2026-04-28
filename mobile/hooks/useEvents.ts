import { useMutation } from '@tanstack/react-query';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { listEventsByTenant, findEventByCode } from '@/lib/api/events';
import { getUserPoints } from '@/lib/api/users';

const TENANT_ID = '3';

export function useEvents() {
  return useAuthedQuery({
    queryKey: ['events', TENANT_ID],
    queryFn: async () => {
      const res = await listEventsByTenant(TENANT_ID);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to load events.');
      }
      return res.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useJoinEvent() {
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await findEventByCode(code, TENANT_ID);
      if (!res.success) {
        throw new Error(res.error?.message ?? `No event found for code "${code}".`);
      }
      return res.data!;
    },
  });
}

export function useUserPoints() {
  return useAuthedQuery({
    queryKey: ['userPoints'],
    queryFn: getUserPoints,
    select: (res) => res.data,
    staleTime: 1000 * 30,
  });
}
