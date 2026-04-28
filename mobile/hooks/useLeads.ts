import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeads, submitScan, updateLeadStatus, triggerLuckyDraw } from '@/lib/api/leads';
import type { ScanPayload } from '@/lib/api/leads';
import type { ApiResponse, Lead } from '@/lib/api/types';

export function useLeads() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['leads'],
    // Wrap listLeads so we can preserve any locally-saved leads that
    // are still flagged `pendingSync` — the server list won't include
    // them yet, so naively replacing the cache would erase the offline
    // indicator before the user retries the upload.
    queryFn: async () => {
      const prev = queryClient.getQueryData<ApiResponse<Lead[]>>(['leads']);
      const prevPending = (prev?.data ?? []).filter((l) => l.pendingSync === true);
      const res = await listLeads();
      if (!res.success || !res.data) return res;
      const serverIds = new Set(res.data.map((l) => l.id));
      // Also dedupe by badge code when present: if the server has already
      // reconciled the same attendee under a different id (e.g. a retry
      // succeeded on another device), drop the local pending row instead
      // of letting both linger.
      const serverCodes = new Set(
        res.data.map((l) => l.code).filter((c): c is string => Boolean(c)),
      );
      const preservedPending = prevPending.filter(
        (l) => !serverIds.has(l.id) && !(l.code && serverCodes.has(l.code)),
      );
      return { success: true, data: [...preservedPending, ...res.data] };
    },
    select: (res) => res?.data ?? [],
    staleTime: 1000 * 30,
    // Don't retry — if the server returns 4xx (e.g. the leads-list route
    // isn't registered yet), retrying just spams the backend. listLeads()
    // already detects the missing-route case and throws so React Query
    // preserves the prior cache (which contains optimistically-inserted
    // leads from useSubmitScan).
    retry: false,
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
