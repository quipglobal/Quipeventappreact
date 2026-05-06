import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

export type UseAuthedQueryOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
> = Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'enabled'> & {
  enabled?: boolean;
  /**
   * Disable the automatic refetch-on-focus behaviour. The default is
   * `true` because the product expectation is "navigating to a screen
   * shows the latest backend state without forcing a sign-out". Pass
   * `false` for queries whose data should not refresh on every screen
   * visit (rare — typically only for write-followed-by-navigate flows
   * the caller wants to control by hand).
   */
  refetchOnFocus?: boolean;
};

/**
 * Thin wrapper around `useQuery` that:
 *
 * 1. AND-gates `enabled` on having an authenticated session (`token`
 *    and `user.id` both present), so the query stops the moment the
 *    user signs out instead of 401-ing on every tick.
 * 2. Refetches whenever the consuming screen gains focus, so the user
 *    sees fresh backend data on every navigation without needing to
 *    sign out and back in. The first focus after mount is skipped so
 *    we don't double-fire on top of `useQuery`'s initial fetch.
 *
 * `useFocusEffect` is sourced from `expo-router` (which re-exports the
 * `@react-navigation/native` hook). It correctly handles tabs that
 * stay mounted between focus changes — exactly the case where
 * `refetchOnMount` alone wasn't enough.
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
  const queryClient = useQueryClient();
  const authed = !!token && !!user?.id;
  const callerEnabled = options.enabled ?? true;
  const refetchOnFocus = options.refetchOnFocus ?? true;

  const query = useQuery<TQueryFnData, TError, TData, TQueryKey>({
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
      // Invalidate (rather than calling refetch directly) so any
      // sibling subscriber on the same key is also marked stale and
      // benefits from the refresh — keeps cross-screen state in sync.
      void queryClient.invalidateQueries({ queryKey: options.queryKey });
    }, [refetchOnFocus, callerEnabled, authed, queryClient, options.queryKey]),
  );

  return query;
}
