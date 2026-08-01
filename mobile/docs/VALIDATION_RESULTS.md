# Validation Results
**Date:** 2026-07-31  
**Method:** Static analysis + build verification

---

## Phase 10 Fix Validation

### FIX-1 — verify-OTP fallback timeout
**Test:** `verifyOtp()` is called, backend returns token without user payload, fallback `GET /api/v1/me` hangs.  
**Expected:** Request aborts after 10 s, returns `TIMEOUT` error, OTP screen shows error message.  
**Static validation:** AbortController with 10 s timeout added to the fallback fetch. Abort signal and cleanup `clearTimeout` match the pattern in `requestOnce()`. ✅  
**Live test needed:** Simulate hung `/api/v1/me` response in staging. ⬜

### FIX-2 — OTP auto-verify stale closure
**Test:** Type 5 digits, pause, type 6th — only one `verify-otp` request fires. Type 6 digits fast, then quickly clear and re-enter — still only one request per completion.  
**Static validation:** `otpLoading` guard in `useEffect` prevents concurrent calls. `handleVerifyOtp` in deps ensures fresh closure. ✅  
**Live test needed:** QA on device with slow backend (2 s delay on verify-otp). ⬜

### FIX-3 — Enhanced instrumentation
**Test:** Run dev build, navigate to Audience tab.  
**Expected Metro output:**
```
[API] GET /api/v1/events/53/members → 200 (342ms)
```
**Expected request headers (visible in network proxy / Charles / Proxyman):**
```
X-Request-ID: lf3kx2-a1b2c3
X-Screen-Name: unknown   ← 'unknown' until setCurrentScreen() call sites are added
X-Screen-Instance-ID: unknown-lf3kw1
X-Trigger-Type: screen_mount
```
**Static validation:** `getRequestHeaders()` called in `requestOnce()` headers block; guarded by `__DEV__`. ✅  
**Live test needed:** Attach network proxy on dev build and verify headers appear. ⬜

---

## Build Verification
TypeScript build passed clean after all three fixes. No new type errors introduced. ✅

---

## Outstanding Validation (Requires Live Testing)

| Test | How to run | Pass condition |
|---|---|---|
| OTP hung backend | Mock `/api/v1/me` to delay 15 s in staging | Returns TIMEOUT in ≤10 s |
| OTP double-verify | Slow 6-digit entry with 3 s backend delay | Exactly 1 verify-otp request |
| Instrumentation headers | Network proxy (Charles/Proxyman) on dev build | X-Request-ID present on all requests |
| No send-otp duplicates | Tap Continue 5× rapidly | Button disabled after 1st tap; 1 request in trace |
| Meetings poll guard | Background the app, wait 35 s, foreground | No poll fired while backgrounded |
| Leads scan no-retry | Scan badge, kill network before response | 1 POST only; no retry on scan |

---

## Dev Backend Smoke Test — 2026-08-01

**Dev server:** `https://bef44c34-7df5-4c09-93a2-5684b5888527-00-3s6pvdiz19h8o.spock.replit.dev:5000`  
**Method:** Static analysis + live probe + runtime screenshot  
**Scope:** Verify both web and mobile apps point at dev server; confirm all performance fixes; document health payload shape.

---

### Step 1 — Web app API URL config

**Finding:** `vite.config.ts` and `server.js` both read `VITE_API_BASE_URL` (env var) as the proxy target for `/api/*` and `/storage/*`. Falls back to `https://app.cxocollaborate.com` when unset. The web app's own TypeScript (`src/app/api/client.ts`) always uses `API_BASE_URL = ''` (relative URLs) — the proxy handles routing, so no client-side URL needs to change.  
**Action taken:** `VITE_API_BASE_URL` set to dev server URL via Replit environment variables. ✅

---

### Step 2 — Both apps switched to dev URL

| App | Config mechanism | Before | After |
|---|---|---|---|
| Web | `VITE_API_BASE_URL` env var → `vite.config.ts` proxy | `https://app.cxocollaborate.com` | Dev server URL |
| Mobile | `EXPO_PUBLIC_API_BASE_URL` env var → `mobile/lib/apiClient.ts` `BASE_URL` | `https://app.cxocollaborate.com` | Dev server URL |

Production values documented as comments in `mobile/.env` for easy revert.  
**Status:** ✅

---

### Step 3 — Health-check parser audit

**Dev health endpoint response (live probe):**
```json
{
  "status": "degraded",
  "version": "v1",
  "timestamp": "2026-08-01T16:22:56+00:00",
  "components": {
    "redis": {
      "status": "unreachable",
      "error": "Class \"Predis\\Client\" not found"
    }
  }
}
```

**⚠️ CRITICAL FINDING: Redis not available on dev server.**  
The `Predis\Client` PHP class is missing — the `predis/predis` Composer package is not installed on this dev server. Consequences:
- Redis session storage cannot be tested here (PHP will throw on session reads/writes if configured to use Redis).
- Redis cache store is not functional. Server-side caches (`Cache::remember()`) may fall back to file/database driver or fail, depending on `APP_ENV` / `CACHE_FALLBACK` config.
- The primary goal of the Redis migration (eliminating file-lock contention) cannot be validated on this dev server.

**Recommendation:** Ensure `composer require predis/predis` is run on the dev server, or test against a server where the Redis extension is installed.

**Parser safety:**
- **Mobile** (`probeXhr` / `probeUrl` in `apiClient.ts`): checks only whether any HTTP response arrived (`ok: boolean`, raw `http NNN` status string). Response body is never parsed. Extra fields in the health payload have zero impact. ✅
- **Web** (`src/`): No code calls or parses `/api/v1/health`. ✅

---

### Step 4 — Web smoke-test: auth & sessions

**Status:** ⬜ Blocked by Redis finding above.  
Web sessions use PHP's session store — if the Laravel app is configured to use Redis sessions and `Predis\Client` is missing, every browser login will produce a PHP fatal error (`500`) rather than a valid session cookie. This must be resolved on the dev server before web auth can be smoke-tested.

**What static analysis confirms:** The web app's session cookie is set and read entirely server-side; the client sends it automatically. No client-side changes are required for Redis session compatibility.

---

### Step 5 — Web smoke-test: performance fixes (static analysis)

All five web fixes confirmed present in code:

| Fix | Location | Verified |
|---|---|---|
| **F-01** POST retry guard | `src/app/api/client.ts` `RETRYABLE_METHODS = new Set(['GET','HEAD','OPTIONS'])` — `allowedRetries = 0` for POST/PUT/PATCH/DELETE | ✅ |
| **F-02** HomePage cache-before-fetch | `src/app/components/HomePage.tsx` both `useEffect` blocks: `getCached()` check returns early on cache hit before any network call | ✅ |
| **F-03** Poll prefetch cap | `src/app/hooks/usePreloader.ts` `POLL_DETAIL_PREFETCH_LIMIT = 5` applied via `.slice(0, POLL_DETAIL_PREFETCH_LIMIT)` before `Promise.allSettled` fan-out | ✅ |
| **F-04** Points-sync visibility gate | `src/app/context/AppContext.tsx` line 828: `if (typeof document !== 'undefined' && document.hidden) return;` inside `syncIfVisible()`, called by `setInterval` | ✅ |
| **F-05** LeadsPage mount GETs reduced | `src/app/components/LeadsPage.tsx` passes `probeResult: initial` to `reconcilePendingLeadsNow()`, reusing the already-fetched leads list | ✅ |

**Live verification needed:** Open browser DevTools Network tab, navigate to each affected page, and count requests.

---

### Step 6 — Mobile smoke-test: auth (static analysis)

| Fix | Location | Verified |
|---|---|---|
| OTP verify no duplicate | `mobile/components/auth/WelcomeScreen.tsx`: `!otpLoading` guard + `handleVerifyOtp` in `useEffect` deps — concurrent verify calls blocked | ✅ |
| verify-otp no retry | `mobile/lib/apiClient.ts` `isRetrySafe()`: `verify-otp` explicitly excluded, only GET/HEAD and `send-otp` are retry-safe | ✅ |
| Fallback `/me` timeout | `mobile/lib/apiClient.ts` `verifyOtp()`: AbortController with 10 s timeout wraps fallback `GET /api/v1/me` | ✅ |

**Live verification needed:** QA on device with Expo Go pointed at dev server (after Redis is resolved).

---

### Step 7 — Mobile smoke-test: data & leads (static analysis)

| Check | Location | Verified |
|---|---|---|
| Badge scan single POST | `mobile/lib/apiClient.ts` `isRetrySafe()`: POST to scan endpoint (`/api/v1/events/.../leads/scan`) not retry-safe | ✅ |
| Pending-lead reconcile no dupe GETs | `src/app/context/AppContext.tsx` `reconcilePendingLeadsNow()` accepts `probeResult` param; `LeadsPage` passes `initial` | ✅ |
| Request instrumentation headers | `mobile/lib/apiClient.ts` `requestOnce()`: `getRequestHeaders()` merged into headers (dev-only via `__DEV__` guard) | ✅ |

**Live verification needed:** Same as step 6 — requires working dev backend.

---

### Summary

| Item | Result |
|---|---|
| Web proxy switches to dev server | ✅ Done — `VITE_API_BASE_URL` env var set |
| Mobile switches to dev server | ✅ Done — `EXPO_PUBLIC_API_BASE_URL` env var set |
| Dev server reachable | ✅ HTTP 200 in 0.78 s |
| Health payload shape is client-safe | ✅ Neither client parses the health body |
| Redis available on dev server | ❌ `Predis\Client` not found — install `predis/predis` |
| Web session/auth smoke test | ⬜ Blocked until Redis resolved on dev server |
| All 5 web performance fixes in code | ✅ Static analysis confirmed |
| All mobile fixes in code | ✅ Static analysis confirmed |
| Web app loads against dev backend | ✅ Splash screen renders, Vite proxy active |

**Next action required:** Run `composer require predis/predis` on the dev server (or point at a server where Redis is operational) before proceeding with interactive session and auth smoke tests.
