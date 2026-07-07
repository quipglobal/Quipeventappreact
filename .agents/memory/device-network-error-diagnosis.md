---
name: Device network error diagnosis
description: How the mobile API client distinguishes offline vs backend-unreachable, and what was verified healthy server-side.
---

**Rule:** When a device-only "network" failure is reported for the mobile app, do NOT assume the classifier is wrong or the server is down — verify each leg separately. Server-side legs already verified healthy (Jul 2026): DNS resolves on Cloudflare/Google resolvers (A 34.111.179.208, no AAAA), TLS chain valid + cross-signed to ISRG Root X1, cert valid, HTTP 200 to okhttp UA. Remaining failure modes are device-local: TLS trust, carrier DNS, or network filtering.

**Root cause found (Jul 2026):** "Chrome loads the site but app fetch fails, google probe ok" = system trust store missing the backend's brand-new Let's Encrypt chain (Root YE / X2 cross-sign issued 2026-05-13; browsers ship their own root stores). Fix: Android network security config with the ISRG roots + chain certs embedded in res/raw as extra trust anchors (system anchors kept), referenced via android:networkSecurityConfig in the manifest. RN's whatwg-fetch polyfill reduces ALL native failures (incl. SSLHandshakeException) to generic "TypeError: Network request failed" — never expect the JS error message to name the TLS layer.

**Why:** Curl from the workspace cannot reproduce device-path failures; guessing wastes build cycles (each Play-uploadable AAB needs a new versionCode).

**How to apply:** The API client's `request()` wrapper retries once (GET/HEAD + send-otp only — never verify-otp/register), then probes `clients3.google.com/generate_204` and the backend origin in parallel (native only; web would hit CORS) and reports which leg failed. With `EXPO_PUBLIC_AUTH_DEBUG=true` baked in, the raw error (`name: message`) and probe results are appended to the user-visible message — a single user screenshot then identifies root cause (e.g. SSLHandshakeException vs UnknownHostException). Timeout detection must use `controller.signal.aborted`, not message-sniffing "abort" (genuine errors like "Software caused connection abort" contain that word).
