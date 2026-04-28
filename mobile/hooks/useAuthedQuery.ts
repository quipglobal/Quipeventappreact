import { useQuery, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

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
 *
 * The caller's own `enabled` (if provided) is AND-merged with the
 * auth gate. Function-form `enabled` is not supported here — pass a
 * boolean if you need conditional gating (compute it in the component).
 */
export function useAuthedQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
) {
  const { token, user } = useAuth();
  const authed = !!token && !!user?.id;
  const callerEnabled = options.enabled ?? true;
  const enabled = typeof callerEnabled === 'boolean' ? callerEnabled && authed : authed;
  return useQuery({
    ...options,
    enabled,
  });
}
