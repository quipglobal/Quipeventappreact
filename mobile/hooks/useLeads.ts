import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeads, submitScan, updateLeadStatus, triggerLuckyDraw } from '@/lib/api/leads';
import type { ScanPayload } from '@/lib/api/leads';
import type { Lead } from '@/lib/api/types';

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: listLeads,
    select: (res) => res.data ?? [],
    staleTime: 1000 * 30,
  });
}

export function useSubmitScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScanPayload) => submitScan(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: Lead['status'] }) =>
      updateLeadStatus(leadId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useLuckyDraw() {
  return useMutation({
    mutationFn: (giveawayId?: string) => triggerLuckyDraw(giveawayId),
  });
}
