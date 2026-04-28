import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeads, submitScan, updateLeadStatus, triggerLuckyDraw, reconcilePendingLead } from '@/lib/api/leads';
import type { ScanPayload } from '@/lib/api/leads';
import type { ApiResponse, Lead } from '@/lib/api/types';
import { loadCachedLeads, saveCachedLeads } from '@/lib/leadsStorage';

/**
 * Merge a fresh server list with the existing cached leads, deduping by id
 * primarily and by badge `code` (case-insensitive) or `email` as secondary
 * keys. This ensures a server-side lead replaces its local twin (which used
 * a synthetic id from the audience-fallback path) instead of appearing
 * twice. Local-only leads are kept at the front of the list.
 */
function mergeLeads(serverLeads: Lead[], cachedLeads: Lead[]): Lead[] {
  const serverIds = new Set(serverLeads.map(l => l.id));
  const serverCodes = new Set(
    serverLeads.map(l => l.code?.toLowerCase()).filter((c): c is string => !!c),
  );
  const serverEmails = new Set(
    serverLeads.map(l => l.email?.toLowerCase()).filter((c): c is string => !!c),
  );
  const localOnly = cachedLeads.filter(l => {
    if (serverIds.has(l.id)) return false;
    if (l.code && serverCodes.has(l.code.toLowerCase())) return false;
    if (l.email && serverEmails.has(l.email.toLowerCase())) return false;
    return true;
  });
  return [...localOnly, ...serverLeads];
}

export function useLeads() {
  const queryClient = useQueryClient();
  const reconciledIdsRef = useRef<Set<string>>(new Set());

  // Hydrate the React Query cache from AsyncStorage on first mount so any
  // offline-saved (pendingSync) leads survive an app restart. We gate the
  // server fetch on hydration completing — otherwise listLeads() could
  // return + populate the cache before the persisted rows are loaded, and
  // the merge in queryFn would never see the persisted local-only entries.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadCachedLeads().then((cached) => {
      if (cancelled) return;
      if (cached.length > 0) {
        const existing = queryClient.getQueryData<ApiResponse<Lead[]>>(['leads']);
        // Only seed the cache if it's empty — if another code path
        // (e.g. an optimistic submitScan) already populated it during
        // this session, don't overwrite that fresher data.
        if (!existing?.data || existing.data.length === 0) {
          queryClient.setQueryData<ApiResponse<Lead[]>>(['leads'], {
            success: true,
            data: cached,
          });
        }
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [queryClient]);

  // Persist any subsequent change to the leads cache (optimistic inserts,
  // server merges, status updates, reconciliation) back to AsyncStorage.
  // Subscribing to the query cache lets us cover every code path that
  // mutates the entry without having to wire persistence into each call
  // site individually.
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      if (event?.query.queryKey?.[0] !== 'leads') return;
      const data = queryClient.getQueryData<ApiResponse<Lead[]>>(['leads']);
      void saveCachedLeads(data?.data ?? []);
    });
    return unsubscribe;
  }, [queryClient]);

  const query = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const res = await listLeads();
      if (!res.success || !res.data) return res;
      // Merge with whatever's currently cached so optimistic / pendingSync
      // rows aren't blown away on a successful refetch.
      const cached = queryClient.getQueryData<ApiResponse<Lead[]>>(['leads']);
      const cachedLeads = cached?.data ?? [];
      return { success: true, data: mergeLeads(res.data, cachedLeads) };
    },
    select: (res) => res?.data ?? [],
    staleTime: 1000 * 30,
    // Wait for the AsyncStorage hydration to complete before hitting the
    // server, so the queryFn merge sees any persisted local-only leads.
    enabled: hydrated,
    // Don't retry — if the server returns 4xx (e.g. the leads-list route
    // isn't registered yet), retrying just spams the backend. listLeads()
    // already detects the missing-route case and throws so React Query
    // preserves the prior cache (which contains optimistically-inserted
    // leads from useSubmitScan).
    retry: false,
  });

  // Once the list endpoint actually returns data, push any locally-saved
  // (pendingSync) leads that haven't been reconciled yet. On success, swap
  // the synthetic id for the canonical server id and clear `pendingSync`.
  // We track per-id so we don't keep re-pushing a lead the server still
  // can't accept (the entry is left in the cache as pending and retried on
  // the next mount / event switch).
  useEffect(() => {
    if (!query.isSuccess) return;
    const data = query.data ?? [];
    const pending = data.filter(
      l => l.pendingSync && !reconciledIdsRef.current.has(l.id),
    );
    if (pending.length === 0) return;
    let cancelled = false;

    // Mark in-flight up front to prevent re-entry during the awaits below.
    pending.forEach(l => reconciledIdsRef.current.add(l.id));

    void (async () => {
      const reconciled = await Promise.all(
        pending.map(async (local) => {
          try {
            const server = await reconcilePendingLead(local);
            return { local, server };
          } catch {
            return { local, server: null };
          }
        }),
      );
      if (cancelled) return;

      const successes = reconciled.filter(r => r.server) as { local: Lead; server: Lead }[];
      // Failed pushes: un-mark so the next pass retries them.
      reconciled
        .filter(r => !r.server)
        .forEach(r => reconciledIdsRef.current.delete(r.local.id));

      if (successes.length === 0) return;

      queryClient.setQueryData<ApiResponse<Lead[]>>(['leads'], (prev) => {
        const existing = prev?.data ?? [];
        const successByLocalId = new Map(
          successes.map(s => [s.local.id, s.server]),
        );
        // Replace the pending row in-place with the canonical server one,
        // preserving locally-edited notes/status if the server returned
        // empty defaults.
        const next = existing.map(l => {
          const server = successByLocalId.get(l.id);
          if (!server) return l;
          return {
            ...server,
            notes: l.notes || server.notes,
            status: l.status ?? server.status,
            color: l.color ?? server.color,
            pendingSync: false,
          };
        });
        // Drop any duplicates that might have crept in (e.g. the server id
        // was already in the list because a parallel refetch landed first).
        const seen = new Set<string>();
        const deduped: Lead[] = [];
        for (const l of next) {
          if (seen.has(l.id)) continue;
          seen.add(l.id);
          deduped.push(l);
        }
        return { success: true, data: deduped };
      });

      // Refetch to pull any server-side changes (timestamps, etc) after
      // the reconciliation. The custom queryFn merges with the cache so
      // our just-confirmed leads stay put.
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    })();

    return () => { cancelled = true; };
  }, [query.isSuccess, query.data, queryClient]);

  return query;
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
          // Primary dedupe by id.
          let dedup = existing.filter((l) => l.id !== newLead.id);
          // Secondary dedupe: if a local-only (pendingSync) twin shares the
          // same code/email, drop it — the new lead is its server-confirmed
          // (or freshly-resolved) version.
          const code = newLead.code?.toLowerCase();
          const email = newLead.email?.toLowerCase();
          if (code || email) {
            dedup = dedup.filter((l) => {
              if (!l.pendingSync) return true;
              if (code && l.code && l.code.toLowerCase() === code) return false;
              if (email && l.email && l.email.toLowerCase() === email) return false;
              return true;
            });
          }
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
