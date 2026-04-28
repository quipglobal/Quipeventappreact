import { useEffect, useRef } from 'react';

export interface UseAuthedIntervalOptions {
  /**
   * Fire `callback` immediately after the gate opens (initial mount or
   * sign-in), before the first scheduled tick. Defaults to `true`. Set to
   * `false` if the caller fires its own initial fetch (e.g. a separate
   * loading-spinner request that differs from the silent refresh).
   */
  runOnMount?: boolean;
  /**
   * Pause the timer while `document.hidden` is true (the tab is in the
   * background) and run an immediate `callback()` + restart on
   * `visibilitychange` back to visible. Defaults to `false` so existing
   * call-sites preserve their previous behaviour.
   */
  pauseWhenHidden?: boolean;
}

/**
 * Run `callback` every `intervalMs` milliseconds — but **only while the
 * user is signed in** (`userId` truthy). Tears the interval down on
 * sign-out and rebuilds it cleanly on the next sign-in.
 *
 * Why this exists: every periodic authenticated request previously had to
 * hand-roll the same `if (!user?.id) return; ... clearInterval(...)`
 * dance, and forgetting it meant the page kept polling after logout —
 * 401-ing every tick and burning unauthenticated rate limit. Centralising
 * the gate makes signed-in-only the default and prevents new pollers from
 * regressing.
 *
 * The `userId` is taken as a parameter (rather than read from `useApp()`
 * internally) so the same hook can be used inside `AppContext` itself
 * — calling `useApp()` from within the provider would loop.
 *
 * `callback` is captured in a ref so callers don't have to memoise it;
 * the interval is only torn down + rebuilt when `userId`, `intervalMs`,
 * or the option flags change.
 *
 * Pass `intervalMs = null` to disable the timer without changing the
 * caller's `userId` (useful for conditional polling).
 */
export function useAuthedInterval(
  userId: string | null | undefined,
  callback: () => void | Promise<void>,
  intervalMs: number | null,
  options: UseAuthedIntervalOptions = {},
): void {
  const { runOnMount = true, pauseWhenHidden = false } = options;

  // Stable ref so we don't tear down + restart the interval every render
  // when callers pass an inline arrow function for `callback`.
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!userId || intervalMs == null) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fire = () => {
      if (cancelled) return;
      void callbackRef.current();
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(fire, intervalMs);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (pauseWhenHidden && typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.hidden) {
          stop();
        } else {
          // Fresh tick on return to foreground so the user sees up-to-date
          // data without waiting for the next interval.
          fire();
          start();
        }
      };
      if (!document.hidden) {
        if (runOnMount) fire();
        start();
      }
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => {
        cancelled = true;
        stop();
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }

    if (runOnMount) fire();
    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId, intervalMs, runOnMount, pauseWhenHidden]);
}
