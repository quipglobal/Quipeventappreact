import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLeads, submitScan, updateLeadStatus, updateLead, triggerLuckyDraw, reconcilePendingLead } from '@/lib/api/leads';
import type { ScanPayload, LeadEdits } from '@/lib/api/leads';
import type { ApiResponse, Lead } from '@/lib/api/types';
import { loadCachedLeads, saveCachedLeads } from '@/lib/leadsStorage';
import { loadLeadEdits, saveLeadEdit, lookupLeadEdit, type LeadEditsMap } from '@/lib/leadEditsStorage';
import { leadsQueryKey } from '@/lib/leadsCacheKey';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';

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

/**
 * Overlay the user's locally-saved lead edits (notes / tags / priority)
 * on top of a leads list. Mirrors the web `mergeServerLeadsWithLocalEdits`
 * intent: because the backend doesn't reliably persist these three fields
 * on its v1 leads endpoints, a plain server refetch would wipe an edit the
 * user just made. Applying the overlay after every merge keeps those edits
 * visible until (and unless) the backend echoes a real value. Each field
 * that's present in the overlay entry wins; absent fields fall through to
 * the lead's existing value. `status` and `priority` are kept in sync.
 */
function applyLeadEditsOverlay(leads: Lead[], overlay: LeadEditsMap): Lead[] {
  if (!leads.length) return leads;
  return leads.map((l) => {
    const entry = lookupLeadEdit(overlay, l.id, l.code);
    if (!entry) return l;
    const priority = entry.priority ?? l.priority ?? l.status;
    return {
      ...l,
      notes: entry.notes !== undefined ? entry.notes : l.notes,
      tags: entry.tags !== undefined ? entry.tags : l.tags,
      status: priority ?? l.status,
      priority: priority ?? l.priority,
    };
  });
}

export function useLeads() {
  const queryClient = useQueryClient();
  const reconciledIdsRef = useRef<Set<string>>(new Set());
  const { user } = useAuth();
  const { currentEventId } = useEvent();
  const userId = user?.id ?? null;
  const eventId = currentEventId;
  const queryKey = leadsQueryKey(userId, eventId);

  // Hydrate the React Query cache from AsyncStorage as soon as we
  // know the `(user, event)` pair we're operating on. Storage is
  // namespaced by both, and the query cache key is also scoped by
  // both, so:
  //   - a different user on the same device cannot read the prior
  //     user's leads (in-memory or persisted);
  //   - a sponsor at Event B cannot see the leads they scanned at
  //     Event A — switching events is a clean swap to that pair's
  //     own (possibly empty) cached slot.
  // Note: persisted slots are intentionally kept across logout (see
  // `AuthContext.logout`) so the same user signing back in to the
  // same event sees their scanned leads immediately.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const hydratedKey = userId && eventId ? `${userId}::${eventId}` : null;
  useEffect(() => {
    if (hydratedFor === hydratedKey) return;
    let cancelled = false;

    if (!userId || !eventId) {
      // No active (user, event) pair — clear the hydration latch so
      // the next pair we see triggers a fresh hydration.
      setHydratedFor(null);
      return;
    }

    void loadCachedLeads(userId, eventId).then((cached) => {
      if (cancelled) return;
      // Merge persisted rows into the (user, event)-scoped cache slot.
      // We *can't* simply overwrite: a `useSubmitScan` optimistic
      // insert (or any other write) may have landed at
      // `['leads', userId, eventId]` before AsyncStorage resolved, and
      // replacing the slot wholesale would silently drop that
      // just-created lead — the exact regression task #19 was supposed
      // to prevent. mergeLeads keeps any session-only rows in place
      // while bringing the persisted set in.
      queryClient.setQueryData<ApiResponse<Lead[]>>(leadsQueryKey(userId, eventId), (prev) => {
        const existing = prev?.data ?? [];
        // mergeLeads treats arg1 as the "anchor" (kept at the back) and
        // arg2 as the source of "local-only" rows kept at the front.
        // Passing `cached` first + `existing` second yields
        // `[...just-created-session-leads, ...persisted]`, which matches
        // the rest of the app's ordering (newest scan on top).
        return { success: true, data: mergeLeads(cached, existing) };
      });
      setHydratedFor(hydratedKey);
    });

    return () => { cancelled = true; };
  }, [userId, eventId, hydratedKey, hydratedFor, queryClient]);

  // Persist any subsequent change to the leads cache (optimistic
  // inserts, server merges, status updates, reconciliation) back to
  // AsyncStorage under the current `(user, event)` namespaced key.
  // Subscribing to the query cache lets us cover every code path that
  // mutates the entry without having to wire persistence into each
  // call site individually. Skips writes until hydration has completed
  // for the current pair so the empty pre-hydration cache can't
  // overwrite a freshly-loaded array.
  useEffect(() => {
    if (!userId || !eventId || hydratedFor !== hydratedKey) return;
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      const key = event?.query.queryKey;
      if (
        !Array.isArray(key) ||
        key[0] !== 'leads' ||
        key[1] !== userId ||
        key[2] !== eventId
      ) return;
      const data = queryClient.getQueryData<ApiResponse<Lead[]>>(leadsQueryKey(userId, eventId));
      void saveCachedLeads(userId, eventId, data?.data ?? []);
    });
    return unsubscribe;
  }, [userId, eventId, hydratedKey, hydratedFor, queryClient]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await listLeads();
      if (!res.success || !res.data) return res;
      // Merge with whatever's currently cached so optimistic / pendingSync
      // rows aren't blown away on a successful refetch.
      const cached = queryClient.getQueryData<ApiResponse<Lead[]>>(queryKey);
      const cachedLeads = cached?.data ?? [];
      const merged = mergeLeads(res.data, cachedLeads);
      // Re-apply the user's locally-saved edits (notes/tags/priority) on
      // top of the server rows so a refetch doesn't wipe an edit the
      // backend hasn't persisted yet.
      const overlay = await loadLeadEdits(userId);
      return { success: true, data: applyLeadEditsOverlay(merged, overlay) };
    },
    select: (res) => res?.data ?? [],
    staleTime: 1000 * 30,
    // Justified inline gate (instead of `useAuthedQuery`): we need to
    // wait for the AsyncStorage hydration to complete in addition to
    // requiring a signed-in user **and** an active event, so the
    // queryFn merge sees any persisted local-only leads. `!!userId &&
    // !!eventId` is strictly stronger than `useAuthedQuery`'s
    // `!!token && !!user?.id` check (`userId` only exists when
    // `user.id` does), so this also satisfies the signed-in-only
    // invariant the wrapper enforces — sign-out makes `userId` falsy
    // and the query stops, same as if it had been migrated to
    // `useAuthedQuery`.
    enabled: !!userId && !!eventId && hydratedFor === hydratedKey,
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
    if (!query.isSuccess || !userId || !eventId) return;
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

      queryClient.setQueryData<ApiResponse<Lead[]>>(leadsQueryKey(userId, eventId), (prev) => {
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
      queryClient.invalidateQueries({ queryKey: leadsQueryKey(userId, eventId) });
    })();

    return () => { cancelled = true; };
  }, [query.isSuccess, query.data, queryClient, userId, eventId]);

  return query;
}

export function useSubmitScan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentEventId } = useEvent();
  const userId = user?.id ?? null;
  const eventId = currentEventId;
  return useMutation({
    mutationFn: (payload: ScanPayload) => submitScan(payload),
    onSuccess: (res) => {
      if (!userId || !eventId) return;
      const queryKey = leadsQueryKey(userId, eventId);
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
  const { currentEventId } = useEvent();
  const userId = user?.id ?? null;
  const eventId = currentEventId;
  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: Lead['status'] }) =>
      updateLeadStatus(leadId, status),
    onSuccess: () => {
      if (!userId || !eventId) return;
      queryClient.invalidateQueries({ queryKey: leadsQueryKey(userId, eventId) });
    },
  });
}

/**
 * Edit a lead's notes / tags / priority. Applies the change three ways so
 * it's durable regardless of backend support:
 *   1. Optimistically patches the React Query cache so the UI updates
 *      instantly (and the cache-subscription in `useLeads` mirrors it to
 *      the per-(user,event) AsyncStorage leads cache).
 *   2. Writes the three editable fields to the per-user lead-edits overlay
 *      (`leadEditsStorage`) so the edit survives a server refetch — which
 *      would otherwise prefer the server row — and logout → login.
 *   3. Fires the PUT `/leads/:id` request for forward-compat / cross-device
 *      sync. A failure (incl. NOT_IMPLEMENTED) is tolerated: the optimistic
 *      + overlay state is deliberately NOT rolled back, since the backend
 *      hasn't shipped reliable notes/tags/priority persistence yet.
 */
export function useUpdateLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentEventId } = useEvent();
  const userId = user?.id ?? null;
  const eventId = currentEventId;
  return useMutation({
    mutationFn: ({ leadId, updates }: { leadId: string; updates: LeadEdits; code?: string | null }) =>
      updateLead(leadId, updates),
    onMutate: async ({ leadId, updates, code }) => {
      if (!userId || !eventId) return;
      const key = leadsQueryKey(userId, eventId);
      // Snapshot the badge code before mutating so the overlay is mirrored
      // under both id and code — handles the id drift between scan-time and
      // a later list fetch.
      const existing = queryClient.getQueryData<ApiResponse<Lead[]>>(key)?.data ?? [];
      const found = existing.find((l) => l.id === leadId);
      const leadCode = code ?? found?.code ?? null;
      // 1. Optimistic cache patch.
      queryClient.setQueryData<ApiResponse<Lead[]>>(key, (prev) => {
        const rows = prev?.data ?? [];
        return {
          success: true,
          data: rows.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  notes: updates.notes !== undefined ? updates.notes : l.notes,
                  tags: updates.tags !== undefined ? updates.tags : l.tags,
                  status: updates.priority ?? l.status,
                  priority: updates.priority ?? l.priority,
                }
              : l,
          ),
        };
      });
      // 2. Persist to the AsyncStorage overlay so the edit survives refetch
      //    / logout → login.
      await saveLeadEdit(userId, leadId, updates, leadCode);
    },
  });
}

export function useLuckyDraw() {
  return useMutation({
    mutationFn: (giveawayId?: string) => triggerLuckyDraw(giveawayId),
  });
}
