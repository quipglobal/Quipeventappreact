---
name: Vite HMR on Replit
description: Root cause and fix for the Vite HMR WebSocket loop/page-reload problem in the Replit dev environment
---

## Root cause

The Replit reverse proxy drops idle WebSocket connections after ~4 seconds. The Vite HMR
WebSocket is mostly idle (server→client only, no client keep-alive), so the proxy cuts it.

**This by itself does NOT cause page reloads.** Vite reconnects within ~300 ms and the
client shows `[vite] connecting... connected.` repeatedly — harmless noise in dev tools.

**Page reloads (the real loop) happen when Vite HMR throws a runtime error during a hot
update**, e.g. "useApp export incompatible" from AppContext hot-swapping. On error, Vite's
client falls back to `location.reload()`, which re-runs the splash screen → the user sees
the splash screen replay every few seconds while file edits are in progress.

## Diagnosis checklist

- `[vite] connecting... connected.` every 4–9 s → proxy idle drop, harmless, ignore
- `[vite] server connection lost. Polling for restart...` → actual server restart (expected after workflow restart)
- `[vite] page reload` OR JS error like "export incompatible" → this is the real loop cause

## Fixes applied

1. **`// @refresh reset`** on line 1 of `src/app/context/AppContext.tsx` — forces a module
   boundary reset instead of HMR hot-swap. Prevents the "export incompatible" crash loop
   during edits to AppContext or any large context file.

2. **`handleSplashComplete = React.useCallback(() => setScreen('welcome'), [])` in
   `src/app/App.tsx`** — prevents SplashScreen's `useEffect([onComplete])` from re-running
   when parent re-renders, which was extending splash time or retriggering the animation.

3. **`wsKeepAlive` Vite plugin in `vite.config.ts`** — broadcasts a Vite custom event
   (`{ type: 'custom', event: 'keepalive' }`) every 2 s as a real TEXT data frame so the
   proxy sees bidirectional traffic. Extends typical WS lifetime from 4 s to 5–9 s,
   reducing reconnect noise. Reconnects remain harmless (no page reload).

## What does NOT work

- `hmr: { host: REPLIT_DEV_DOMAIN, clientPort: 443, protocol: 'wss' }` — made things
  worse; causes WS to reconnect on the same ~4 s cadence. Do NOT add this config.
- WS-level `ws.ping()` frames — proxy does not count them as data activity; only extended
  lifetime by ~1–2 s on top of baseline. Use TEXT data frames (custom event) instead.

## Why the loop was confused for a proxy issue

The reconnect noise (`connecting... connected.` every 4 s) existed both BEFORE and AFTER
the crash loop was fixed. The cadence looks similar. Definitive test: if `[vite] page reload`
never appears in the console, the reconnects are harmless and the loop is gone.
