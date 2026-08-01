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
  /**
   * One-time random delay (ms) before the first tick and interval start.
   *
   * Pass a pre-computed stable random value — e.g. via `useRef`:
   *   `const jitter = useRef(Math.floor(Math.random() * 30_000)).current`
   * — so the value doesn't change across renders (which would re-run the
   * effect and reset the timer).
   *
   * Why this matters: 300 sessions mounting at the same instant all start
   * their 30-second polling timers together, producing a synchronized load
   * spike every 30 s. A per-session random offset in [0, intervalMs) spreads
   * those ticks uniformly across the full interval window.
   *
   * Defaults to `0` (no delay) so existing call-sites are unaffected.
   */
  initialDelayMs?: number;
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
  const { runOnMount = true, pauseWhenHidden = false, initialDelayMs = 0 } = options;

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
    let startDelayTimer: ReturnType<typeof setTimeout> | null = null;
    // Set inside setup() when pauseWhenHidden=true so the cleanup below can
    // remove it even when setup() ran asynchronously via startDelayTimer.
    let removeVisibilityListener: (() => void) | null = null;

    const fire = () => {
      if (cancelled) return;
      void callbackRef.current();
    };

    const startInterval = () => {
      if (timer) return;
      timer = setInterval(fire, intervalMs);
    };

    const stopInterval = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };

    /** Core setup — runs immediately or after `initialDelayMs`. */
    const setup = () => {
      if (cancelled) return;

      if (pauseWhenHidden && typeof document !== 'undefined') {
        const onVisibilityChange = () => {
          if (document.hidden) {
            stopInterval();
          } else {
            // Fresh tick on return to foreground so the user sees up-to-date
            // data without waiting for the next interval.
            fire();
            startInterval();
          }
        };
        removeVisibilityListener = () =>
          document.removeEventListener('visibilitychange', onVisibilityChange);

        if (!document.hidden) {
          if (runOnMount) fire();
          startInterval();
        }
        document.addEventListener('visibilitychange', onVisibilityChange);
        return;
      }

      if (runOnMount) fire();
      startInterval();
    };

    if (initialDelayMs > 0) {
      startDelayTimer = setTimeout(setup, initialDelayMs);
    } else {
      setup();
    }

    return () => {
      cancelled = true;
      if (startDelayTimer) clearTimeout(startDelayTimer);
      stopInterval();
      if (removeVisibilityListener) removeVisibilityListener();
    };
  }, [userId, intervalMs, runOnMount, pauseWhenHidden, initialDelayMs]);
}
