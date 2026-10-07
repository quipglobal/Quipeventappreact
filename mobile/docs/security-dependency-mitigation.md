# Braces depth-guard mitigation

Expo SDK 52 and React Native 0.76 remain unchanged. The npm override maps
`braces` to the exact `@dieub/braces-depth-guard@3.0.3-pn.3` release.
This is a third-party backport, **not an upstream patched braces release**.
The lockfile pins its integrity hash. Reconsider the override when upstream
publishes a fix for GHSA-vfj7-8cjw-p6xm.

## Consumer investigation

- `mobile/metro.config.js` forwards `/api` and `/mobile` with Node HTTP/HTTPS
  streams. It does not use `http-proxy-middleware`.
- Installed SDK 52 Expo CLI and React Native tooling do not import
  `http-proxy-middleware`; the mobile manifest lists it directly.
- Removing that package alone would leave vulnerable braces through
  Metro's file-map watchers, Expo Updates' fast-glob, React Native's Jest and
  code-generation tooling, and patch-package's workspace lookup.
- Keep the existing proxy implementation and package rather than changing
  proxy behavior as part of this mitigation. Override braces across the tree.

## Why this backport

The published tarball was compared with braces 3.0.3. The public entry point
and MIT license are unchanged. Runtime changes are limited to depth/length
validation in parsing and recursive AST walkers, plus cycle detection in
expansion's parent-chain traversal. There are no install hooks or new runtime
dependencies; it retains fill-range. The parser counts combined braces and
parentheses, caps depth at 100, and the walkers also protect caller-supplied
ASTs. Options cannot raise that ceiling.

This deliberately rejects pathological nesting; ordinary alternatives,
numeric ranges, quoted/escaped literals, Metro watcher globs, and Expo Updates
asset globs are checked in `scripts/test-security-deps.cjs`.
Unlike an install-time patch, the npm alias also applies when EAS disables
install scripts. Keep npm as the only mobile lockfile.

## Verification

Run from `mobile`:

```sh
npm audit --json
node --test scripts/test-security-deps.cjs
npx expo export --platform all --output-dir /tmp/mobile-security-export
```

An audit's absence of the upstream advisory is not proof that a fork is safe:
the source comparison and behavioral/exploit regression checks are required.
Other audit findings must be reported separately, not suppressed or “fixed”
by an automatic SDK upgrade.

Verified on 2026-10-07: all eight security compatibility checks passed and
Android, iOS, and web exports succeeded. A local upstream fixture confirmed
the existing proxy preserves request paths/query strings, bodies, authorization
and tenant headers, binary response bytes, upstream status/headers, CORS
preflight, and Metro passthrough. Both mobile preview workflows restarted.

The audit no longer reports braces, micromatch, or http-proxy-middleware.
It still reports 23 unrelated findings (11 moderate, 11 high, one critical),
including shell-quote, node-forge, compression, sprintf-js, and undici.
This is not a clean audit. The browser preview also exposes an unchanged
welcome-screen initialization error: `handleVerifyOtp` is referenced in an
effect dependency array before its declaration. These are separate follow-ups.
