import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { listLeads, reconcilePendingLead, resetLeadsListEndpointMissing } from '@/lib/api/leads';
import type { ApiResponse, Lead } from '@/lib/api/types';
import { useEvent } from '@/context/EventContext';
import { useAuthedEffect } from '@/hooks/useAuthedEffect';

/**
 * Background reconciliation for locally-saved (`pendingSync: true`) leads.
 *
 * The on-mount reconciliation in `useLeads()` only fires while the My Leads
 * tab is mounted, so a sponsor who stays in the scanner all day can build
 * up a queue of pending leads that never get pushed. This hook runs once
 * at the root layout and:
 *
 *   • Wakes up every 60s while the app is `active` (paused while
 *     backgrounded; returning to the foreground triggers an immediate
 *     attempt via the AppState listener).
 *   • Probes GET /events/:id/leads first — only attempts the per-lead
 *     POST /leads/scan when the list endpoint is reachable, mirroring
 *     `useLeads`'s gating so we don't spam a backend that can't accept
 *     scans yet.
 *   • Backs off exponentially on consecutive failures (60s → 120s → … →
 *     capped at 10 minutes) so a downed backend isn't hammered. Resets
 *     to the base interval the moment any reconciliation succeeds.
 *   • On success, swaps the synthetic id for the canonical server lead
 *     in the React Query cache and invalidates `['leads']` so the next
 *     observer fetch picks up server-side fields. The per-row
 *     "Saved on this device" indicator the Engage tab renders flips to
 *     synced automatically — non-intrusive by construction (no toast
 *     fired here; reconciled leads simply lose their pendingSync flag).
 */
export function useReconcilePendingLeadsBackground() {
  const queryClient = useQueryClient();
  const { currentEventId } = useEvent();
  // Keep refs so the closure captured by setTimeout always sees the
  // latest queryClient even though it never actually changes in
  // practice (defensive against future refactors).
  const queryClientRef = useRef(queryClient);
  useEffect(() => { queryClientRef.current = queryClient; }, [queryClient]);

  // Gate the loop on an authenticated session *and* a selected event.
  // The auth half is handled by the shared `useAuthedEffect` hook (same
  // primitive every other authenticated background hook uses) — it
  // skips the body and tears down the timer + AppState listener on
  // sign-out, then re-arms cleanly on the next sign-in. The event half
  // is checked inline below because it's specific to this loop. Without
  // these gates the timer chain would keep ticking after sign-out and
  // fire `GET /events/:id/leads` every minute, every one of which 401s.
  useAuthedEffect(() => {
    if (!currentEventId) return;

    const BASE_DELAY_MS = 60 * 1000;
    const MAX_DELAY_MS = 10 * 60 * 1000;
    const INITIAL_DELAY_MS = 5 * 1000;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;
    let inFlight = false;

    const computeDelay = () => {
      const exp = Math.min(consecutiveFailures, 4);
      return Math.min(BASE_DELAY_MS * Math.pow(2, exp), MAX_DELAY_MS);
    };

    const schedule = (ms?: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void tick(); }, ms ?? computeDelay());
    };

    const tick = async () => {
      if (cancelled) return;
      // Skip work while the app is backgrounded; the AppState listener
      // below will wake us as soon as the user returns.
      if (AppState.currentState !== 'active') {
        schedule(BASE_DELAY_MS);
        return;
      }

      const qc = queryClientRef.current;
      const cached = qc.getQueryData<ApiResponse<Lead[]>>(['leads']);
      const cachedLeads = cached?.data ?? [];
      const pending = cachedLeads.filter((l) => l.pendingSync && !!l.code);
      if (pending.length === 0) {
        // No pending leads — reset backoff so the next time something
        // appears we start at the base interval.
        consecutiveFailures = 0;
        schedule(BASE_DELAY_MS);
        return;
      }

      if (inFlight) {
        schedule();
        return;
      }
      inFlight = true;

      try {
        // Clear the session-scoped "list endpoint missing" short-circuit
        // before each attempt — otherwise a single 404 earlier in the
        // session would permanently prevent the background loop from
        // rediscovering the route after a backend rollout. We re-arm the
        // short-circuit naturally if the upcoming request 404s again.
        resetLeadsListEndpointMissing();

        // Probe the list endpoint first — same gate `useLeads` uses.
        let probeOk = false;
        try {
          const res = await listLeads();
          if (cancelled) return;
          probeOk = !!(res.success && res.data);
        } catch {
          // listLeads throws when the backend hasn't shipped the route;
          // treat as a soft failure and back off.
          probeOk = false;
        }
        if (!probeOk) {
          consecutiveFailures++;
          return;
        }

        const reconciled = await Promise.all(
          pending.map(async (local) => {
            try {
              const server = await reconcilePendingLead(local);
              return { local, server };
            } catch {
              return { local, server: null as Lead | null };
            }
          }),
        );
        if (cancelled) return;

        const successes = reconciled.filter(
          (r): r is { local: Lead; server: Lead } => !!r.server,
        );

        if (successes.length === 0) {
          consecutiveFailures++;
          return;
        }

        consecutiveFailures = 0;
        qc.setQueryData<ApiResponse<Lead[]>>(['leads'], (prev) => {
          const existing = prev?.data ?? [];
          const map = new Map(successes.map((s) => [s.local.id, s.server]));
          // Replace each pending row in place with the canonical server
          // one, preserving locally-edited notes / status / color over
          // the (likely empty) server echo.
          const next = existing.map((l) => {
            const server = map.get(l.id);
            if (!server) return l;
            return {
              ...server,
              notes: l.notes || server.notes,
              status: l.status ?? server.status,
              color: l.color ?? server.color,
              pendingSync: false,
            };
          });
          // Drop any duplicates that might have crept in (e.g. the
          // server id was already in the list because a parallel
          // refetch landed first).
          const seen = new Set<string>();
          const deduped: Lead[] = [];
          for (const l of next) {
            if (seen.has(l.id)) continue;
            seen.add(l.id);
            deduped.push(l);
          }
          return { success: true, data: deduped };
        });
        // Refetch so any server-side fields (timestamps, etc) come down.
        qc.invalidateQueries({ queryKey: ['leads'] });
      } catch {
        consecutiveFailures++;
      } finally {
        inFlight = false;
        if (!cancelled) schedule();
      }
    };

    schedule(INITIAL_DELAY_MS);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      // Returned to foreground — give the backend a fresh chance and
      // attempt soon.
      consecutiveFailures = 0;
      schedule(2000);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
    // `useAuthedEffect` already keys on the auth gate (token + user.id);
    // we add `currentEventId` (not just a boolean `hasEvent`) so the
    // timer rebuilds when the user switches between two truthy event
    // ids — without this, an event swap would leave the loop running
    // against the previous event's `['leads']` cache.
  }, [currentEventId]);
}
