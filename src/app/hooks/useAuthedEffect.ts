import { useEffect, type DependencyList } from 'react';

/**
 * Run an effect that requires an authenticated user, automatically gated
 * on `userId`. Identical to `useEffect` except the effect (and its
 * cleanup) are skipped while there is no signed-in user, and React
 * re-runs the effect cleanly when the user signs in or out.
 *
 * Use this for periodic / long-running effects whose body is too custom
 * for `useAuthedInterval` (e.g. setTimeout chains with exponential
 * backoff, AppState/visibility listeners, in-flight guards). For a plain
 * `setInterval(callback, ms)`, prefer `useAuthedInterval` instead.
 *
 * The setup callback receives the resolved `userId` so it can use it in
 * closures without re-checking, and may return a cleanup function which
 * is called on tear-down (sign-out, deps change, unmount).
 *
 * `userId` is a parameter (rather than pulled from `useApp()` internally)
 * so this hook is usable both inside components and inside `AppContext`
 * itself — calling `useApp()` from within the provider would loop.
 *
 * `deps` follows the same contract as `useEffect`'s dep array: pass any
 * additional values the effect closes over so React knows when to
 * re-run. `userId` is appended automatically.
 */
export function useAuthedEffect(
  userId: string | null | undefined,
  effect: (userId: string) => void | (() => void),
  deps: DependencyList = [],
): void {
  useEffect(() => {
    if (!userId) return;
    return effect(userId);
    // The caller controls the dep list; `userId` is the only thing we add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ...deps]);
}
