/**
 * React Query cache key for the leads list belonging to the given
 * user. Lives in its own module so both `AuthContext` (logout-time
 * cache eviction) and `useLeads` (read/write/subscribe) can import it
 * without creating a circular dependency.
 *
 * Scoping the key by user id is the central in-memory isolation
 * boundary on mobile: even if a stale entry for User A is still in the
 * shared QueryClient at logout/login time, User B's hook reads/writes
 * a different key (`['leads', B]`) and can never observe A's data.
 */
export function leadsQueryKey(userId: string | null | undefined): readonly [string, string | null] {
  return ['leads', userId ?? null] as const;
}
