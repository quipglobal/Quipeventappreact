import { useEffect, type DependencyList } from 'react';
import { useAuth } from '@/context/AuthContext';

/**
 * Run an effect that requires an authenticated session, automatically
 * gated on `token` + `user.id` both being present. Identical to
 * `useEffect` except the effect (and its cleanup) are skipped while
 * there is no signed-in user, and React re-runs the effect cleanly
 * when the session appears or disappears.
 *
 * Use this for periodic / long-running effects whose body is too
 * custom for an `enabled`-gated React Query (e.g. setTimeout chains
 * with exponential backoff, AppState listeners, in-flight guards).
 * For an authenticated `useQuery` call, prefer `useAuthedQuery`
 * instead.
 *
 * The setup callback receives the resolved `userId` so it can use it
 * in closures without re-checking, and may return a cleanup function
 * which is called on tear-down (sign-out, deps change, unmount).
 *
 * `deps` follows the same contract as `useEffect`'s dep array — pass
 * any additional values the effect closes over so React knows when
 * to re-run. The internal auth gate (`hasSession`) is appended
 * automatically.
 */
export function useAuthedEffect(
  effect: (userId: string) => void | (() => void),
  deps: DependencyList = [],
): void {
  const { token, user } = useAuth();
  const userId = user?.id ?? null;
  const hasSession = !!token && !!userId;
  useEffect(() => {
    if (!hasSession || !userId) return;
    return effect(userId);
    // The caller controls the dep list; `hasSession` + `userId` are the
    // only things we add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession, userId, ...deps]);
}
