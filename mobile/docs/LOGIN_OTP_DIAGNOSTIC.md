# Login / OTP Screen — Deep Diagnostic Report
**File:** `mobile/components/auth/WelcomeScreen.tsx`  
**Date:** 2026-07-31

---

## Component Structure

The welcome screen is a single component that manages login state through an in-component `sheetView` string:

```
'email'           → Enter email, press Continue → POST /auth/send-otp
'otp'             → Enter 6-digit code → POST /auth/verify-otp (auto or button)
'profile-review'  → Confirm existing account → login() + redirect
'create-account'  → Register new account → POST /auth/register
'no-account'      → Email has no account (interstitial)
```

---

## API Call Analysis

### POST /api/v1/auth/send-otp

**Trigger:** `handleEmailContinue()` — only called by the Continue button `onPress`.  
**Guard:** `emailLoading` state is set to `true` synchronously before the request fires; the button has `disabled={loading}` which prevents re-press while pending.  
**Retry policy:** `apiClient.request()` will retry exactly once after 1 200 ms if the first attempt dies at the network layer (`NETWORK_ERROR`). All other errors (429, 5xx) are returned immediately without retry. `send-otp` is explicitly listed in `isRetrySafe()` because re-sending a code is safe (new code supersedes old).  
**Automatic triggers:** None. No `useEffect`, no focus listener, no AppState listener calls this endpoint.  
**Cancellation:** No AbortController at the screen level. If the user navigates away mid-request, the request continues in the background; the `finally` block calls `setEmailLoading(false)` on a potentially unmounted component (harmless with React 18's no-op state-update-after-unmount behavior).

**Button-press protection verdict:** ✅ Protected against rapid re-press via `disabled={loading}`.  
**Duplicate-in-flight verdict:** ✅ One active request at a time.

---

### POST /api/v1/auth/verify-otp

**Triggers (two paths):**
1. **Auto-verify:** `useEffect` fires `handleVerifyOtp()` when `otpValue.length === 6` and `sheetView === 'otp'`.
2. **Manual:** Verify button `onPress` calls `handleVerifyOtp()` directly.

**Confirmed bug — stale closure / missing dep:**
```typescript
// Current (WelcomeScreen.tsx ~646)
useEffect(() => {
  if (otpValue.length === 6 && sheetView === 'otp') handleVerifyOtp();
}, [otpValue]);
//  ↑ handleVerifyOtp is NOT in the dependency array
```
`handleVerifyOtp` is a `useCallback` that captures `otpLoading`. Because it is not in the `useEffect` deps, the effect closure may hold a stale reference to the version that has `otpLoading = false`, and call it again even if a verify is already in-flight. In practice, OTP inputs typically lock after 6 digits so `otpValue` does not change again — but if a user clears and re-enters (or if the OTP input allows edit), a second concurrent verify request can fire.

**Fix applied (Phase 10):** Added `otpLoading` guard inside the effect and `handleVerifyOtp` to deps.

**Retry policy:** `verify-otp` is explicitly excluded from `isRetrySafe()` — **never retried automatically**. Correct.

**Cancellation:** No AbortController. Stale response arrives after navigation away but is ignored because the component is unmounted.

---

### GET /api/v1/me (fallback inside verifyOtp)

**Location:** `apiClient.ts` ~652  
**Trigger:** Called inside `verifyOtp()` when the backend returns a token but omits the user payload. This is a silent fallback to hydrate the user object.

**Confirmed bug — no timeout:**
```typescript
// Current (apiClient.ts ~652)
const meRes = await fetch(`${BASE_URL}/api/v1/me`, {
  headers: { ... }
  // ← No AbortController, no timeout
});
```
If the backend hangs on this request, the entire OTP verification flow hangs indefinitely. The user sees the loading spinner forever. This is a confirmed root cause of "OTP screen becoming stuck".

**Fix applied (Phase 10):** Added 10 s AbortController timeout matching the pattern used elsewhere in `requestOnce`.

---

### POST /api/v1/auth/register

**Trigger:** Create Account button only.  
**Guard:** `createLoading` state gates the button.  
**Retry:** None (POST).  
**Risk:** Low.

---

## Resend Countdown

The resend countdown is a pure UI timer (`setInterval` counting down from 30 s). It does **not** call any API endpoint. The Resend button is `disabled={resendCountdown > 0}`, which prevents repeated OTP sends during the cooldown window.

This is correct behavior — the client-side cooldown is a UX guard. The backend should also enforce a per-email cooldown (static analysis cannot verify backend behavior).

---

## Login Test Matrix (Static Analysis)

| Test | send-otp calls | verify-otp calls | Loops | Risk |
|---|---|---|---|---|
| 1. Normal button press | 1 | 1 | None | ✅ |
| 2. Five rapid button presses | 1 (button disabled after first) | — | None | ✅ |
| 3. Response delayed 2 s | 1 | — | None | ✅ Loading shown |
| 4. Response delayed 5 s | 1 | — | None | ✅ |
| 5. Response delayed 15 s | 1 → timeout at 20 s | — | None | ✅ TIMEOUT error returned |
| 6. Network disconnect | 1 attempt, 1 retry after 1.2 s | — | None | ✅ diagnoseNetwork() called |
| 7. Network reconnect during | 1 → NETWORK_ERROR (not reconnect-aware) | — | None | ⚠ No reconnect retry hook |
| 8. HTTP 429 | 1 → RATE_LIMITED | — | None | ✅ Not retried |
| 9. HTTP 500 | 1 → REQUEST_FAILED | — | None | ✅ Not retried |
| 10. HTTP 503 | 1 → REQUEST_FAILED | — | None | ✅ Not retried |
| 11. Navigate away mid-request | 1 (continues) | — | None | ⚠ No cancellation; finally fires on unmounted component |
| 12. Background then foreground | 1 (continues; no focus-refetch on auth screen) | — | None | ✅ |

---

## Confirmed Root Causes

| # | Issue | Severity | File | Fixed |
|---|---|---|---|---|
| 1 | `GET /api/v1/me` fallback inside `verifyOtp()` has no timeout | 🔴 High | `lib/apiClient.ts:652` | ✅ Phase 10 |
| 2 | Auto-verify `useEffect` missing `handleVerifyOtp` in deps array | 🟡 Medium | `WelcomeScreen.tsx:646` | ✅ Phase 10 |
| 3 | No screen-level AbortController — request continues after unmount | 🟡 Low | `WelcomeScreen.tsx` | ⬜ Out of scope (harmless with React 18) |

---

## Expected Post-Fix Behavior

- One active `send-otp` request per button press
- No duplicate `verify-otp` while loading
- OTP screen cannot hang indefinitely — `/api/v1/me` fallback times out in 10 s
- Auto-verify fires exactly once per completed 6-digit entry
