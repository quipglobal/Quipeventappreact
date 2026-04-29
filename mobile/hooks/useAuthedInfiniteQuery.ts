import {
  useInfiniteQuery,
  type UseInfiniteQueryOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

/**
 * Options accepted by `useAuthedInfiniteQuery` — identical to React
 * Query's `UseInfiniteQueryOptions` except `enabled` is restricted to a
 * plain boolean (or omitted). React Query also supports a function-form
 * `enabled`, but allowing it here would silently bypass the auth gate
 * (the wrapper would have no way to AND-merge it without
 * re-implementing the function-form contract). Callers who need
 * conditional gating should compute the boolean in their component and
 * pass it through.
 */
export type UseAuthedInfiniteQueryOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
  TPageParam,
> = Omit<
  UseInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>,
  'enabled'
> & {
  enabled?: boolean;
};

/**
 * Sister wrapper to `useAuthedQuery`, but for `useInfiniteQuery` —
 * paginated / infinite-scrolling lists. Same contract: AND-gates
 * `enabled` on having an authenticated session (`token` and `user.id`
 * both present) so the query stops fetching the moment the user signs
 * out, instead of leaving the React Query worker churning through
 * pages with a stale (or missing) bearer token.
 *
 * `useAuthedQuery` only covers `useQuery` — `useInfiniteQuery` has a
 * different generic signature and pagination contract (extra
 * `TPageParam`, `getNextPageParam`, `initialPageParam`), so it needs
 * its own wrapper rather than trying to overload the existing one.
 *
 * Why this exists: every authenticated infinite-scrolling list would
 * otherwise have to hand-roll `enabled: !!token && !!user?.id` inline.
 * Forgetting it means the list keeps fetching after sign-out, 401-ing
 * every refetch and burning unauthenticated rate limit. Centralising
 * the gate makes signed-in-only the default and prevents new
 * authenticated infinite queries from regressing.
 */
export function useAuthedInfiniteQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  options: UseAuthedInfiniteQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >,
) {
  const { token, user } = useAuth();
  const authed = !!token && !!user?.id;
  const callerEnabled = options.enabled ?? true;
  return useInfiniteQuery<TQueryFnData, TError, TData, TQueryKey, TPageParam>({
    ...options,
    enabled: callerEnabled && authed,
  });
}
