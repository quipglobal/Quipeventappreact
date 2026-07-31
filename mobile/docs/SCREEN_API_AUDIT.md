# Mobile App — Screen-by-Screen API Audit
**Scope:** `mobile/` (Expo React Native)  
**Audit method:** Static analysis of component files, hooks, and API client  
**Date:** 2026-07-31

---

## Methodology

Every screen was inspected for:
- `useEffect` / `useFocusEffect` blocks that trigger network calls
- React Query hooks (`useAuthedQuery`, `useQuery`) and their options
- AppState listeners
- Raw `setInterval` / `setTimeout` that call API methods
- Mutation handlers triggered by user actions
- Request cancellation (AbortController / React Query cleanup)

**Global defaults (from `app/_layout.tsx` QueryClient):**
| Setting | Value |
|---|---|
| `retry` | 2 (queries) / 0 (mutations) |
| `staleTime` | 30 000 ms |
| `refetchOnMount` | true (when stale) |
| `refetchOnReconnect` | `'always'` |
| Focus refetch | `useAuthedQuery` invalidates on each `useFocusEffect` (skips first mount) |

---

## Screen Inventory

### 1. Login / Send OTP
**Route:** `(auth)/welcome`  
**Component:** `components/auth/WelcomeScreen.tsx`  
**Child components:** `EmailStep`, `OtpStep`, `ProfileReviewStep`, `CreateAccountStep`

| Endpoint | Method | Trigger | Expected | Notes |
|---|---|---|---|---|
| `POST /api/v1/auth/send-otp` | POST | Button press (Continue) | 1 | Loading flag prevents re-tap; no auto-retry on timeout |
| `POST /api/v1/auth/verify-otp` | POST | Auto-fires when 6th digit entered OR Verify button | 1 | Auto-verify `useEffect` fires on `otpValue` change — **missing `handleVerifyOtp` in deps** |
| `GET /api/v1/me` | GET | Inside `verifyOtp()` fallback when backend omits user payload | 0–1 | Raw `fetch` with **no AbortController / timeout** (confirmed bug) |
| `POST /api/v1/auth/register` | POST | Create Account button | 1 | No retry |

**Cancellation:** None — no AbortController in `handleEmailContinue` or `handleVerifyOtp`. Navigating away while pending leaves a dangling request; the `finally` block still calls `setEmailLoading(false)` / `setOtpLoading(false)` on an unmounted component (harmless with React 18 but noisy).

**Confirmed bugs:**
- `useEffect` for OTP auto-verify has `[otpValue]` deps but calls `handleVerifyOtp` which is not in the array → stale closure risk.
- Fallback `GET /api/v1/me` has no timeout — can hang indefinitely.

---

### 2. OTP Verification (same screen as Login)
See Login / Send OTP above. Step transitions are in-component state (`sheetView`), not a separate route.

---

### 3. Event List
**Route:** `events`  
**Component:** `app/events.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events?per_page=100` | GET | `useAuthedQuery` mount + focus | staleTime 30 s; retry 2 |
| `POST /api/v1/events/join` | POST | Button press | mutation retry 0 |
| `GET /api/v1/events/:id` | GET | After join selection | |
| `GET /api/v1/events/:id/access` | GET | Access check before entry | |
| `POST /api/v1/events/:id/self-check-in` | POST | Auto on event selection | mutation retry 0 |

**Max concurrent on mount:** 1 (event list query)  
**Focus refetch:** Yes — event list invalidated every return to screen

---

### 4. Event Dashboard
**Route:** `event-dashboard`  
**Component:** `app/event-dashboard.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/leaderboard` | GET | mount | |
| `GET /api/v1/events/:id/mobile-polls` | GET | mount | |
| `GET /api/v1/events/:id/members?...` | GET | mount (audience summary) | |
| `GET /api/v1/events/:id/mobile-agenda` | GET | mount | |
| `GET /api/v1/events/:id/sponsors` | GET | mount | |
| `GET /api/v1/events/:id/giveaways` | GET | mount | |

**Max concurrent on mount:** 6 parallel queries  
**Focus refetch:** Yes for all (useAuthedQuery default)

---

### 5. Feed (CXO Feed + Video Feed)
**Route:** `(tabs)/feed`  
**Component:** `app/(tabs)/feed.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/feed?page=N` | GET | mount + focus + pagination | |
| `GET /api/v1/mobile/video-feeds?...` | GET | mount + focus | |
| `POST /api/v1/mobile/video-feeds/:id/watch` | POST | User watches video | mutation retry 0 |
| `POST /api/v1/events/:id/mobile-polls/:id/vote` | POST | Poll vote | mutation retry 0 |

---

### 6. Audience / Attendee Directory
**Route:** `(tabs)/audience`  
**Component:** `app/(tabs)/audience.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/members` | GET | mount + focus | |
| `GET /api/v1/events/:id/leaderboard` | GET | mount + focus | |
| `GET /api/v1/events/:id/speakers` | GET | mount + focus (where supported) | |

---

### 7. Attendee Profile
**Route:** `lead-detail`  
**Component:** `app/lead-detail.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/attendees/:userId` | GET | mount | |
| `PATCH /api/v1/events/:id/leads/:leadId` | PATCH | Edit save | mutation retry 0 |

---

### 8. Sponsor Directory
**Route:** `(tabs)/partners`  
**Component:** `app/(tabs)/partners.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/sponsors` | GET | mount + focus | |

---

### 9. Sponsor Details
**Route:** Embedded in partners tab  
**Component:** Sponsor detail sheet

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/sponsors/:id` | GET | tap on sponsor | |

---

### 10. Engage (Polls, Surveys, Challenges, Giveaways)
**Route:** `(tabs)/engage`  
**Component:** `app/(tabs)/engage.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/challenges` | GET | mount + focus | |
| `GET /api/v1/events/:id/mobile-polls` | GET | mount + focus | |
| `GET /api/v1/events/:id/surveys` | GET | mount + focus | |
| `GET /api/v1/events/:id/surveys/:id` | GET | mount + focus (detail) | |
| `GET /api/v1/events/:id/giveaways` | GET | mount + focus | |
| `POST /api/v1/events/:id/challenges/:id/complete` | POST | User action | mutation retry 0 |
| `POST /api/v1/events/:id/mobile-polls/:id/vote` | POST | User action | mutation retry 0 |
| `POST /api/v1/events/:id/surveys/:id/submit` | POST | User action | mutation retry 0 |
| `POST /api/v1/events/:id/giveaways/:id/enter` | POST | User action | mutation retry 0 |
| `POST/PATCH/DELETE /api/v1/events/:id/giveaways/:id` | varies | Sponsor actions | mutation retry 0 |

**Max concurrent on mount:** 5 parallel queries

---

### 11. Networking / Connections
**Route:** `meetings`  
**Component:** `app/meetings.tsx`, `hooks/useMeetings.ts`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/meeting-requests` | GET | mount + **30 s poll** (AppState-gated) | Only polls when AppState = 'active' |
| `POST /api/v1/events/:id/meeting-requests` | POST | Send connection request | mutation retry 0 |
| `PATCH /api/v1/events/:id/meeting-requests/:id/accept` | PATCH | Accept | mutation retry 0 |
| `PATCH /api/v1/events/:id/meeting-requests/:id/reject` | PATCH | Reject | mutation retry 0 |

**Polling guard:** AppState subscription tears down `refetchInterval` when app backgrounds. **Correct pattern.**

---

### 12. Messages
**Route:** `messages`  
**Component:** `app/messages.tsx`, `context/MessagesContext.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/conversations` | GET | context mount | |
| `GET /api/v1/events/:id/conversations/:id/messages` | GET | open conversation | |
| `POST /api/v1/events/:id/conversations/:id/messages` | POST | send message | mutation retry 0 |

---

### 13. Poll List & Submission
**Route:** `(tabs)/engage` → poll tab  
See Engage screen above.

---

### 14. Survey List & Submission
**Route:** `(tabs)/engage` → survey tab  
See Engage screen above.

---

### 15. Leaderboard
**Route:** `leaderboard`  
**Component:** `app/leaderboard.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/leaderboard` | GET | mount + focus | staleTime 30 s |

---

### 16. QR / Badge Scanner
**Route:** `qr-badge`  
**Component:** `app/qr-badge.tsx`

No API calls on mount. Badge data is from local context.

---

### 17. Sponsor Lead Scanner
**Route:** `(tabs)/scan`  
**Component:** `app/(tabs)/scan.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `POST /api/v1/events/:id/leads/scan` | POST | Successful QR scan | 800 ms debounce guard prevents re-scan; **apiClient does NOT retry POST** |
| `POST /api/v1/events/:id/leads/draw` | POST | Lucky draw action | mutation |
| `GET /api/v1/events/:id/my-leads` | GET | After successful scan (invalidate) | |

---

### 18. My Leads
**Route:** `(tabs)/leads`  
**Component:** `app/(tabs)/leads.tsx`, `hooks/useLeads.ts`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events/:id/my-leads` | GET | mount + focus | staleTime 30 s |
| `PATCH /api/v1/events/:id/leads/:leadId` | PATCH | Edit lead | mutation retry 0 |

---

### 19. Profile
**Route:** `profile`  
**Component:** `app/profile.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/me` | GET | mount (via auth context) | |
| `PATCH /api/v1/profile` | PATCH | Save edit | mutation retry 0 |
| `POST /api/v1/profile/points/sync` | POST | On profile load | mutation retry 0 |

---

### 20. Article Reader
**Route:** `article-reader`  
**Component:** `app/article-reader.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/mobile/reader/documents/:id` | GET | mount | |
| `POST /api/v1/mobile/reader/analytics` | POST | `setInterval` reading-duration tracker | Interval cleaned up on unmount |
| `POST /api/v1/mobile/reader/analytics/event` | POST | `useFocusEffect` on leave | |

**Note:** The `setInterval` sends analytics (not data-fetch polling) — correct pattern, cleaned up on unmount.

---

### 21. Switch Event
**Route:** `switch-event`  
**Component:** `app/switch-event.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `GET /api/v1/events` | GET | mount + focus | |
| `GET /api/v1/events/:id/access` | GET | Event selection | |

---

### 22. Join Event
**Route:** `join`  
**Component:** `app/join.tsx`

| Endpoint | Method | Trigger | Notes |
|---|---|---|---|
| `POST /api/v1/events/join` | POST | mount effect + user action | |

---

### 23. Logout
No screen — handled in context. Clears token from AsyncStorage and redirects.

---

## Consolidated Risk Summary

| Screen | Unique APIs | Max Concurrent | Has Polling | Focus Refetch | Main Risk |
|---|---|---|---|---|---|
| Login/OTP | 4 | 1 | No | No | verify-OTP fallback has no timeout; auto-verify stale closure |
| Event List | 5 | 1 | No | Yes | Rapid event switching fires multiple access checks |
| Event Dashboard | 6 | 6 | No | Yes | 6 parallel GETs on every dashboard visit |
| Feed | 4 | 2 | No | Yes | Pagination + focus both fire feed GETs |
| Audience | 3 | 3 | No | Yes | 3 parallel GETs on focus; members list can be large |
| Engage | 10 | 5 | No | Yes | 5 parallel GETs; survey-detail per visible survey |
| Networking | 4 | 1 | **Yes (30 s)** | Yes | Polling correctly AppState-gated |
| My Leads | 2 | 1 | No | Yes | Low risk |
| Article Reader | 3 | 1 | Analytics only | Yes | Analytics interval correctly cleaned up |
| Profile | 3 | 1 | No | Yes | Low risk |
