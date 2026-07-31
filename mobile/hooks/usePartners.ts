import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { useEvent } from '@/context/EventContext';
import { listSponsors, getSponsor } from '@/lib/api/sponsors';
import type { Sponsor } from '@/lib/api/types';

export function usePartners(tier?: Sponsor['tier']) {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['sponsors', currentEventId, tier],
    queryFn: () => listSponsors(tier),
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
    // Sponsor list changes infrequently. 2-minute cache prevents the
    // dashboard + feed double-fetch storm on every tab-focus event.
    staleTime: 2 * 60_000,
  });
}

export function useSponsor(id: string) {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['sponsor', currentEventId, id],
    queryFn: () => getSponsor(id),
    select: (res) => res.data,
    enabled: !!id && !!currentEventId,
    staleTime: 2 * 60_000,
  });
}
