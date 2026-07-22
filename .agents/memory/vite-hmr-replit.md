---
name: Vite HMR Replit Configuration
description: How to configure Vite HMR WebSocket so it stays stable in the Replit proxy environment and does not drop every 4 seconds.
---

## Rule

Add the following to `vite.config.ts` `server` block when running on Replit:

```ts
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;

server: {
  hmr: REPLIT_DEV_DOMAIN
    ? { host: REPLIT_DEV_DOMAIN, clientPort: 443, protocol: 'wss' }
    : {},
}
```

**Why:** Replit proxies the dev server through an HTTPS proxy at the `REPLIT_DEV_DOMAIN` host on port 443. Without this config, Vite's HMR WebSocket defaults to the internal port (5000) or uses an ambiguous host, causing the Replit proxy to drop the connection every ~4 seconds. This appeared as rapid `[vite] connecting... connected.` cycles in the browser console and caused the app to full-reload repeatedly in the Replit preview iframe.

**How to apply:** Any Vite-based web app run on Replit. When `REPLIT_DEV_DOMAIN` is not set (local dev outside Replit), the `hmr: {}` fallback means Vite uses its defaults — safe and unchanged. The `protocol: 'wss'` is required because port 443 on the Replit proxy only accepts WSS (not plain WS).

## Secondary fix: memoize SplashScreen `onComplete`

The `SplashScreen` component uses `useEffect([onComplete])`. If `onComplete` is an inline arrow function it gets a new reference on every parent render, which cancels and restarts the 2.4 s timer on each re-render — causing the splash screen to hang or appear to loop during auth initialization.

Fix: always wrap it in `useCallback`:

```tsx
const handleSplashComplete = React.useCallback(() => setScreen('welcome'), []);
// ...
<SplashScreen onComplete={handleSplashComplete} />
```
