/**
 * React Query cache key for the leads list belonging to the given
 * `(user, event)` pair. Lives in its own module so multiple consumers
 * (`AuthContext`, `useLeads`, the background reconciler, the engage
 * tab's manual sync action) can import it without creating a circular
 * dependency.
 *
 * Scoping the key by **both** user id and event id is the central
 * in-memory isolation boundary on mobile:
 *
 *   1. User isolation: even if a stale entry for User A is still in
 *      the shared QueryClient at logout/login time, User B's hook
 *      reads/writes a different key (`['leads', B, ...]`) and can
 *      never observe A's data.
 *   2. Event isolation: a sponsor working two events on the same
 *      device cannot see Event X's leads on the Event Y tab — each
 *      `(user, event)` pair has its own independent cache slot, so
 *      switching events is an instantaneous swap to that pair's
 *      cached leads (and a fresh fetch for the new event), not a
 *      mass-overwrite of the shared slot.
 *
 * The key always has length 3 (with `null`s for missing values) so
 * `getQueryData` / `setQueryData` callers can rely on a stable
 * tuple shape.
 */
export function leadsQueryKey(
  userId: string | null | undefined,
  eventId: string | null | undefined,
): readonly [string, string | null, string | null] {
  return ['leads', userId ?? null, eventId ?? null] as const;
}
