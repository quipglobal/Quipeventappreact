# Mobile Performance Fix Plan
**Date:** 2026-07-31  
**Scope:** Confirmed fixes only — no speculative changes

---

## Summary

Three confirmed bugs were identified during static analysis and fixed in Phase 10.  
Six patterns were identified that are functioning correctly but worth monitoring.

---

## Confirmed Fixes (Phase 10)

### FIX-1 — verify-OTP fallback `fetch` has no timeout
**Severity:** 🔴 High  
**File:** `mobile/lib/apiClient.ts` (inside `verifyOtp()`)  
**Root cause:** The fallback `GET /api/v1/me` call that runs when the backend omits the user payload uses a raw `fetch()` with no AbortController. If the backend hangs, the OTP screen spins forever.  
**Fix:** Wrap with a 10 s AbortController — identical to the timeout pattern in `requestOnce()`.  
**Status:** ✅ Applied

---

### FIX-2 — OTP auto-verify `useEffect` missing dependency
**Severity:** 🟡 Medium  
**File:** `mobile/components/auth/WelcomeScreen.tsx` (~line 646)  
**Root cause:** The effect that fires `handleVerifyOtp()` when `otpValue.length === 6` does not list `handleVerifyOtp` in its dependency array. The captured closure may hold a stale `otpLoading = false` reference, allowing a second verify request to fire concurrently if `otpValue` changes while a request is in-flight.  
**Fix:** Add `otpLoading` guard inside the effect; add `handleVerifyOtp` to the dep array.  
**Status:** ✅ Applied

---

### FIX-3 — Enhanced request instrumentation (Phase 2)
**Severity:** N/A (diagnostic tooling)  
**File:** `mobile/lib/requestInstrumentation.ts`  
**Root cause:** Existing instrumentation recorded method/path/duration but had no screen context, trigger type, or parent action correlation — making it impossible to trace which screen caused a request storm.  
**Fix:** Added `TriggerType` vocabulary, `setCurrentScreen()` / `setCurrentAction()` context setters, `getRequestHeaders()` that emits `X-Request-ID`, `X-Screen-Name`, `X-Screen-Instance-ID`, `X-Trigger-Type`, `X-Parent-Action-ID` (dev-only). Updated `RequestEntry` to capture all fields. Updated `apiClient.ts` to inject headers.  
**Status:** ✅ Applied

---

## Patterns Functioning Correctly (No Fix Required)

| Pattern | Location | Why It's Correct |
|---|---|---|
| 30 s meetings poll | `hooks/useMeetings.ts` | AppState-gated — stops when app backgrounds |
| React Query retry=2 for queries | `app/_layout.tsx` | Only applies to idempotent GETs; mutations have retry=0 |
| `send-otp` retry on network error | `lib/apiClient.ts` | Explicitly allowed in `isRetrySafe()` — re-sending OTP is safe |
| `verify-otp` never retried | `lib/apiClient.ts` | Explicitly excluded from `isRetrySafe()` |
| 20 s timeout on all requests | `lib/apiClient.ts:77` | `REQUEST_TIMEOUT_MS` applied via AbortController |
| resend countdown | `WelcomeScreen.tsx:604` | Pure UI timer, disables button, no API involved |

---

## Recommended Next Steps (Not Yet Implemented)

### NEXT-1 — Add `setCurrentScreen()` calls to each screen
**Effort:** Low (1 line per screen mount)  
**Value:** Without this, Phase 2 headers always show `screenName: 'unknown'`. The context setters are built but need call sites.

```typescript
// Add to each screen component:
import { setCurrentScreen } from '@/lib/requestInstrumentation';
useFocusEffect(useCallback(() => { setCurrentScreen('Audience'); }, []));
```

### NEXT-2 — Add `setCurrentAction()` calls to user gesture handlers
**Effort:** Low (2 lines per action)  
**Value:** Groups all API calls from one user action under a shared `X-Parent-Action-ID`.

```typescript
import { setCurrentAction, generateId } from '@/lib/requestInstrumentation';
const handleScanPress = useCallback(() => {
  setCurrentAction(generateId(), 'user_action');
  void submitScan(...);
}, [...]);
```

### NEXT-3 — Backend Laravel middleware (Phase 4)
**Effort:** Medium (new middleware + structured log config)  
**Value:** Correlates client request IDs to server-side SQL query counts and durations. See `BACKEND_REQUEST_TRACE.json` for the expected schema.

### NEXT-4 — Implement `logReport()` access from shake menu
**Effort:** Low  
**Value:** Lets QA and devs see the live request report without attaching Metro. Use `react-native-shake` or Expo DevMenu to call `logReport()`.

---

## Validation Checklist

To confirm all fixes are working:

- [ ] FIX-1: Verify OTP flow completes when `/api/v1/me` takes 10+ seconds (should return TIMEOUT error, not hang)
- [ ] FIX-2: Rapidly type and clear OTP digits — only one `verify-otp` request fires per complete 6-digit entry
- [ ] FIX-3: In dev build, open Metro console and press Continue — verify `X-Request-ID` and `X-Screen-Name` headers appear in network logs
- [ ] Confirm `X-Parent-Action-ID` is shared by all calls from the same user action (after NEXT-2)
