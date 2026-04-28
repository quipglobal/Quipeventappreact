import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { listSponsors, getSponsor } from '@/lib/api/sponsors';
import type { Sponsor } from '@/lib/api/types';

export function usePartners(tier?: Sponsor['tier']) {
  return useAuthedQuery({
    queryKey: ['sponsors', tier],
    queryFn: () => listSponsors(tier),
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60 * 10,
  });
}

export function useSponsor(id: string) {
  return useAuthedQuery({
    queryKey: ['sponsor', id],
    queryFn: () => getSponsor(id),
    select: (res) => res.data,
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });
}
