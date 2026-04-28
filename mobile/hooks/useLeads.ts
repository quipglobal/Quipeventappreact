import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeads, submitScan, updateLeadStatus, triggerLuckyDraw, reconcilePendingLead } from '@/lib/api/leads';
import type { ScanPayload } from '@/lib/api/leads';
import type { ApiResponse, Lead } from '@/lib/api/types';
import { loadCachedLeads, saveCachedLeads } from '@/lib/leadsStorage';
import { leadsQueryKey } from '@/lib/leadsCacheKey';
import { useAuth } from '@/context/AuthContext';

export { leadsQueryKey };

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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryKey = leadsQueryKey(userId);

  // Hydrate the React Query cache from AsyncStorage as soon as we know
  // which user is signed in. Storage is namespaced by user id and the
  // query cache key is scoped by user id, so a different user on the
  // same device can never read the prior user's leads (in-memory or
  // persisted). Note: persisted-slot clearing on logout is handled
  // centrally in AuthContext.logout(), which is guaranteed to run
  // regardless of which screen is mounted at sign-out time.
  const [hydratedForUserId, setHydratedForUserId] = useState<string | null>(null);
  useEffect(() => {
    if (hydratedForUserId === userId) return;
    let cancelled = false;

    if (!userId) {
      setHydratedForUserId(null);
      return;
    }

    void loadCachedLeads(userId).then((cached) => {
      if (cancelled) return;
      // Merge persisted rows into the user-scoped cache slot. We *can't*
      // simply overwrite: a `useSubmitScan` optimistic insert (or any
      // other write) may have landed at `['leads', userId]` before
      // AsyncStorage resolved, and replacing the slot wholesale would
      // silently drop that just-created lead — the exact regression
      // task #19 is supposed to prevent. mergeLeads keeps any
      // session-only rows in place while bringing the persisted set in.
      queryClient.setQueryData<ApiResponse<Lead[]>>(leadsQueryKey(userId), (prev) => {
        const existing = prev?.data ?? [];
        // mergeLeads treats arg1 as the "anchor" (kept at the back) and
        // arg2 as the source of "local-only" rows kept at the front.
        // Passing `cached` first + `existing` second yields
        // `[...just-created-session-leads, ...persisted]`, which matches
        // the rest of the app's ordering (newest scan on top).
        return { success: true, data: mergeLeads(cached, existing) };
      });
      setHydratedForUserId(userId);
    });

    return () => { cancelled = true; };
  }, [userId, hydratedForUserId, queryClient]);

  // Persist any subsequent change to the leads cache (optimistic
  // inserts, server merges, status updates, reconciliation) back to
  // AsyncStorage under the current user's namespaced key. Subscribing
  // to the query cache lets us cover every code path that mutates the
  // entry without having to wire persistence into each call site
  // individually. Skips writes until hydration has completed for the
  // current user so the empty pre-hydration cache can't overwrite a
  // freshly-loaded array.
  useEffect(() => {
    if (!userId || hydratedForUserId !== userId) return;
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      const key = event?.query.queryKey;
      if (!Array.isArray(key) || key[0] !== 'leads' || key[1] !== userId) return;
      const data = queryClient.getQueryData<ApiResponse<Lead[]>>(leadsQueryKey(userId));
      void saveCachedLeads(userId, data?.data ?? []);
    });
    return unsubscribe;
  }, [userId, hydratedForUserId, queryClient]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await listLeads();
      if (!res.success || !res.data) return res;
      // Merge with whatever's currently cached so optimistic / pendingSync
      // rows aren't blown away on a successful refetch.
      const cached = queryClient.getQueryData<ApiResponse<Lead[]>>(queryKey);
      const cachedLeads = cached?.data ?? [];
      return { success: true, data: mergeLeads(res.data, cachedLeads) };
    },
    select: (res) => res?.data ?? [],
    staleTime: 1000 * 30,
    // Wait for the AsyncStorage hydration to complete (and for a user
    // to be signed in) before hitting the server, so the queryFn merge
    // sees any persisted local-only leads.
    enabled: !!userId && hydratedForUserId === userId,
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
    if (!query.isSuccess || !userId) return;
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

      queryClient.setQueryData<ApiResponse<Lead[]>>(leadsQueryKey(userId), (prev) => {
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
      queryClient.invalidateQueries({ queryKey: leadsQueryKey(userId) });
    })();

    return () => { cancelled = true; };
  }, [query.isSuccess, query.data, queryClient, userId]);

  return query;
}

export function useSubmitScan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useMutation({
    mutationFn: (payload: ScanPayload) => submitScan(payload),
    onSuccess: (res) => {
      if (!userId) return;
      const queryKey = leadsQueryKey(userId);
      // Optimistically prepend the new lead so it shows up instantly in
      // the Leads tab, even before the refetch lands. De-dupe by id so we
      // don't double-list when the refetch returns the same row.
      if (res.success && res.data) {
        const newLead = res.data;
        queryClient.setQueryData<ApiResponse<Lead[]>>(queryKey, (prev) => {
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
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: Lead['status'] }) =>
      updateLeadStatus(leadId, status),
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: leadsQueryKey(userId) });
    },
  });
}

export function useLuckyDraw() {
  return useMutation({
    mutationFn: (giveawayId?: string) => triggerLuckyDraw(giveawayId),
  });
}
