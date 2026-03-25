import { useQuery } from '@tanstack/react-query';
import { listSponsors, getSponsor } from '@/lib/api/sponsors';
import type { Sponsor } from '@/lib/api/types';

export function usePartners(tier?: Sponsor['tier']) {
  return useQuery({
    queryKey: ['sponsors', tier],
    queryFn: () => listSponsors(tier),
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60 * 10,
  });
}

export function useSponsor(id: string) {
  return useQuery({
    queryKey: ['sponsor', id],
    queryFn: () => getSponsor(id),
    select: (res) => res.data,
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });
}
