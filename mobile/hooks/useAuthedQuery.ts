import { useQuery, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

/**
 * Options accepted by `useAuthedQuery` — identical to React Query's
 * `UseQueryOptions` except `enabled` is restricted to a plain boolean
 * (or omitted). React Query also supports a function-form `enabled`,
 * but allowing it here would silently bypass the auth gate (the
 * wrapper would have no way to AND-merge it without re-implementing
 * the function-form contract). Callers who need conditional gating
 * should compute the boolean in their component and pass it through.
 */
export type UseAuthedQueryOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
> = Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'enabled'> & {
  enabled?: boolean;
};

/**
 * Thin wrapper around `useQuery` that automatically AND-gates `enabled`
 * on having an authenticated session (`token` and `user.id` both
 * present). React Query also pauses `refetchInterval` whenever a query
 * is `enabled: false`, so this single gate covers both the initial
 * fetch and any periodic refetch — no need to gate `refetchInterval`
 * separately.
 *
 * Why this exists: every authenticated polling query previously had to
 * hand-roll `enabled: !!token && !!user?.id` (and remember to also gate
 * `refetchInterval`). Forgetting it meant the screen kept polling
 * after sign-out, 401-ing every tick and burning unauthenticated rate
 * limit. Centralising the gate makes signed-in-only the default and
 * prevents new authenticated queries from regressing.
 */
export function useAuthedQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseAuthedQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
) {
  const { token, user } = useAuth();
  const authed = !!token && !!user?.id;
  const callerEnabled = options.enabled ?? true;
  return useQuery<TQueryFnData, TError, TData, TQueryKey>({
    ...options,
    enabled: callerEnabled && authed,
  });
}
