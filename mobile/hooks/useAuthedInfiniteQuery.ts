import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  useInfiniteQuery,
  useQueryClient,
  type UseInfiniteQueryOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

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
  /**
   * Disable refetch-on-focus. Defaults to `true` so paginated screens
   * pull fresh first-page data whenever the user navigates back.
   */
  refetchOnFocus?: boolean;
};

/**
 * Sister wrapper to `useAuthedQuery`, for `useInfiniteQuery`. Same
 * two behaviours:
 * 1. AND-gates `enabled` on an authenticated session.
 * 2. Invalidates on screen focus so navigating back to the screen
 *    refreshes against the backend without requiring sign-out /
 *    sign-in. The first focus after mount is skipped to avoid
 *    double-firing on top of the initial fetch.
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
  const queryClient = useQueryClient();
  const authed = !!token && !!user?.id;
  const callerEnabled = options.enabled ?? true;
  const refetchOnFocus = options.refetchOnFocus ?? true;

  const query = useInfiniteQuery<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >({
    ...options,
    enabled: callerEnabled && authed,
  });

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (!refetchOnFocus || !callerEnabled || !authed) return;
      void queryClient.invalidateQueries({ queryKey: options.queryKey });
    }, [refetchOnFocus, callerEnabled, authed, queryClient, options.queryKey]),
  );

  return query;
}
