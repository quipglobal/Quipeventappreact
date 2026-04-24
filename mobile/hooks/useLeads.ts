import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeads, submitScan, updateLeadStatus, triggerLuckyDraw } from '@/lib/api/leads';
import type { ScanPayload } from '@/lib/api/leads';
import type { ApiResponse, Lead } from '@/lib/api/types';

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
    onSuccess: (res) => {
      // Optimistically prepend the new lead so it shows up instantly in
      // the Leads tab, even before the refetch lands. De-dupe by id so we
      // don't double-list when the refetch returns the same row.
      if (res.success && res.data) {
        const newLead = res.data;
        queryClient.setQueryData<ApiResponse<Lead[]>>(['leads'], (prev) => {
          const existing = prev?.data ?? [];
          const dedup = existing.filter((l) => l.id !== newLead.id);
          return { success: true, data: [newLead, ...dedup] };
        });
      }
      // Always refetch to reconcile with the server (status, real id,
      // server-assigned timestamp, etc).
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
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
