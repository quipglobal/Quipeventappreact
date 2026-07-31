# Web App — API Request Audit Report

**Scope:** `/src/` (React + Vite web app)  
**Date:** 2026-07-31  
**Methodology:** Static analysis of all fetch callsites, context orchestration, polling hooks, and preloader logic.

---

## Architecture Snapshot

| Layer | Technology |
|---|---|
| Data fetching | Raw `useEffect` + `useState` — **no React Query** |
| Shared cache | `pageCache.ts` — in-memory, 15-min TTL, keyed by `(namespace, eventId)` |
| Polling primitive | `useAuthedInterval.ts` — auth-gated, optional `pauseWhenHidden` |
| Central state | `AppContext.tsx` (2 003 lines) — owns leads, giveaways, meetings, conversations, leaderboard |
| Prefetch | `usePreloader.ts` — fires 7+ parallel GETs on event join, repeats every 15 min |
| HTTP client | `client.ts` — plain `fetch` wrapper, `MAX_RETRIES = 2` at 600 ms back-off |

---

## Findings

### CRITICAL — F-01: Blind retry on non-idempotent HTTP methods
**File:** `src/app/api/client.ts`  
**Severity:** 🔴 Critical

The `apiFetch` wrapper retries **all** HTTP methods up to 2 times on any error (network timeout, 5xx). POST and PATCH mutate server state, so a transient failure on a mutation can fire the request **3 times** before the caller sees an error.

**Affected mutating endpoints (confirmed callsites):**
- `POST /events/:id/leads/scan` — creates a lead; a retry creates a duplicate
- `POST /events/:id/meeting-requests` — creates a connection request; retry creates a duplicate
- `POST /events/:id/giveaways` — creates a giveaway; retry creates a duplicate
- `PATCH /events/:id/giveaways/:gid` — updates a giveaway
- `PUT /me/profile` — saves user profile on points sync
- `POST /events/:id/meeting-requests/:rid/accept`

**Root cause:** No method-based guard in the retry loop.

```typescript
// client.ts (current) — retries all methods
while (attempt <= MAX_RETRIES) {
  try { return await fetch(...); }
  catch { attempt++; }
}
```

**Fix:** Only retry safe/idempotent methods:
```typescript
const RETRYABLE = ['GET', 'HEAD', 'OPTIONS'];
const shouldRetry = RETRYABLE.includes(options?.method?.toUpperCase() ?? 'GET');
while (attempt <= (shouldRetry ? MAX_RETRIES : 0)) { ... }
```

---

### HIGH — F-02: HomePage fires duplicate requests already handled by preloader
**File:** `src/app/components/HomePage.tsx` (lines 88–142)  
**Severity:** 🟠 High

`HomePage` fires `listSessionsApi` and `getEventSpeakersApi` unconditionally on every mount — even though `usePreloader` already fetched and cached both on event join. Two sub-problems compound each other:

**Sub-problem A — Sessions:** The component checks `getCached('sessions', eventId)` and skips the network call if the cache hits. However, the cache check and network dispatch happen in the same synchronous tick, so if the preloader is still in-flight (e.g. the user navigated to home immediately after joining), the cache check returns `null` and a duplicate network call fires.

**Sub-problem B — Speakers cache key mismatch (always misses):** The preloader stores speakers under key `'speakers'` (via `setCached('speakers', eid, r.data)`). `HomePage` checks `getCached('speakers:home', eventId)` first, then falls back to `getCached('speakers', eventId)`. On initial page load the `'speakers:home'` key is always empty, so the component reads `'speakers'` correctly — but then it still unconditionally fires `getEventSpeakersApi(targetEventId, 24)` after the check (the cache check is only used to decide whether to clear the state, not to skip the network call). The `'speakers:home'` key is only populated by the HomePage's own fetch, creating a parallel, redundant speaker dataset.

**Net effect:** Every `HomePage` mount fires 1 network call that the preloader already covered (speakers, always). Sessions may also duplicate during the preloader's warm-up window.

**Fix:** Respect the preloader cache before initiating any network request:
```typescript
// Before firing listSessionsApi:
const cached = getCached<Session[]>('sessions', eventId);
if (cached) { setSessions(cached); return; }
// Only then: listSessionsApi(...)

// Before firing getEventSpeakersApi:
const cachedSpeakers = getCached<EventMember[]>('speakers', eventId)
                     ?? getCached<EventMember[]>('speakers:home', eventId);
if (cachedSpeakers) { setAudienceSpeakers(cachedSpeakers); return; }
// Only then: getEventSpeakersApi(...)
```

---

### HIGH — F-03: `usePreloader` — unlimited poll-detail fan-out
**File:** `src/app/hooks/usePreloader.ts` (lines 72–82)  
**Severity:** 🟠 High

On event join (and every 15 min), the preloader fetches the polls list, then fires **one GET per actionable (LIVE or CLOSED) poll** with no cap:

```typescript
const actionable = r.data.filter(p => p.status === 'LIVE' || p.status === 'CLOSED');
await Promise.allSettled(
  actionable.map(p => getEventPollApi(eid, p.id).then(...))
);
```

An event with 20 live polls triggers 20 parallel GET requests at join time. Compare with surveys, which cap at `SURVEY_DETAIL_PREFETCH_LIMIT = 3`. There is no equivalent cap for polls.

**15-minute refresh amplification:** Every 15 min the fan-out fires again for all still-actionable polls. Over a 2-hour event session a user in the background tab will receive **16 fan-out waves**.

**Fix:** Apply the same cap used for surveys:
```typescript
const POLL_DETAIL_PREFETCH_LIMIT = 5;
const actionable = r.data
  .filter(p => p.status === 'LIVE' || p.status === 'CLOSED')
  .slice(0, POLL_DETAIL_PREFETCH_LIMIT);
```

Remaining poll details are already fetched on-demand when the user taps a poll row (each page component checks the cache first, so a hit is instant).

---

### MEDIUM — F-04: Points-sync `setInterval` not visibility-gated
**File:** `src/app/context/AppContext.tsx` (lines 805–826)  
**Severity:** 🟡 Medium

The points sync timer fires `GET /events/:id/my-rank` every **2 minutes** via a raw `setInterval`:

```typescript
const interval = setInterval(syncPoints, 2 * 60 * 1000);
```

Unlike `MeetingsPage`'s `useAuthedInterval(..., { pauseWhenHidden: true })`, this timer has **no visibility guard**. A user with the app open in a background tab generates one extra HTTP round-trip every 2 minutes indefinitely — and receives no UI benefit because the background tab can't display the updated points.

**Fix:** Mirror the pattern already used by the meetings poller:
```typescript
const syncIfVisible = () => {
  if (typeof document !== 'undefined' && document.hidden) return;
  void syncPoints();
};
const interval = setInterval(syncIfVisible, 2 * 60 * 1000);
```

Or extract to `useAuthedInterval` with `pauseWhenHidden: true`.

---

### MEDIUM — F-05: `LeadsPage` can fire `GET /leads` three times on mount
**File:** `src/app/components/LeadsPage.tsx` (lines 435–494)  
**Severity:** 🟡 Medium

On mount, `LeadsPage` executes a three-step sequence that can issue three `GET /events/:id/leads` calls in quick succession when pending-sync leads exist:

1. `listLeads(eventId)` — initial hydration (line 444)
2. `reconcilePendingLeadsNow()` — calls `listLeadsApi` internally as a backend probe before pushing scans
3. `listLeads(eventId)` — refresh call after reconciliation succeeds (line 470)

The AppContext background reconciler also fires its own probe `listLeads` every 60 s, meaning opening `LeadsPage` can momentarily create a burst of 3 sequential GETs on the same endpoint.

**Fix:** Share the probe result between the initial hydration and the reconciler. The simplest approach: pass the already-fetched list result into `reconcilePendingLeadsNow` so it can skip its own probe:
```typescript
// After step 1 succeeds, pass result to reconciler:
const synced = await reconcilePendingLeadsNow({ probeResult: initial });
// Reconciler: if probeResult provided, skip its own listLeads call
```

---

### MEDIUM — F-06: Conversations hydration — serial N+1 message fetches
**File:** `src/app/context/AppContext.tsx` (lines 674–756)  
**Severity:** 🟡 Medium

On event join, the conversation hydration logic fetches the conversation index, then fetches messages for each conversation **serially in a for-loop**:

```typescript
for (const summary of convRes.data) {
  const msgRes = await listMessagesApi(eventId, summary.id); // sequential
  ...
}
```

With N active conversations this fires N sequential GET requests. Each request waits for the previous one to complete (no parallelism), so hydration latency is O(N × RTT).

**Mitigating factor:** The backend conversations route currently returns 404 (NOT_IMPLEMENTED), so this code path is a no-op in production today. The issue will surface when the backend deploys the route.

**Fix (for when the route goes live):** Parallelize with `Promise.all`:
```typescript
const results = await Promise.all(
  convRes.data.map(summary => listMessagesApi(eventId, summary.id))
);
```

---

### LOW — F-07: Stale comment in `usePreloader.ts`
**File:** `src/app/hooks/usePreloader.ts` (line 6)  
**Severity:** 🔵 Low / Cosmetic

The file-level JSDoc says:
> "silently refreshes every 3 minutes in the background"

The actual constant is `REFRESH_MS = 15 * 60 * 1000` (15 minutes). The comment was not updated when the interval was lengthened.

**Fix:** Update the comment to reflect the actual 15-minute interval.

---

### LOW — F-08: `AudiencePage` member detail fires 2 requests for own profile
**File:** `src/app/components/AudiencePage.tsx` (lines 106–162)  
**Severity:** 🔵 Low / By Design

When a user views their own profile card in the Audience directory, the component fires two parallel requests:
- `getMemberDetailApi(eventId, member.userId)` — event-scoped member detail
- `getMeProfileApi()` — own richer profile (`/me/profile`)

This is intentional (the `/me` endpoint carries fields like `industry`, `interested_topics`, `social_links` that the member-detail endpoint doesn't expose). The dual call is correct but worth noting as a known deliberate cost.

**No action required** unless the backend adds a merged endpoint.

---

## Summary Table

| ID | Location | Severity | Issue | Fix effort |
|---|---|---|---|---|
| F-01 | `client.ts` | 🔴 Critical | Blind retry on POST/PATCH — can triple mutations | Small |
| F-02 | `HomePage.tsx` | 🟠 High | Speakers always re-fetched (cache key mismatch) + sessions duplicate | Small |
| F-03 | `usePreloader.ts` | 🟠 High | Poll detail fan-out uncapped — N requests per 15 min cycle | Trivial |
| F-04 | `AppContext.tsx` | 🟡 Medium | Points sync setInterval not visibility-gated | Small |
| F-05 | `LeadsPage.tsx` | 🟡 Medium | Up to 3× GET /leads on mount when pending leads exist | Medium |
| F-06 | `AppContext.tsx` | 🟡 Medium | Serial N+1 message fetches (blocked by NOT_IMPLEMENTED today) | Small |
| F-07 | `usePreloader.ts` | 🔵 Low | Stale "3 minutes" comment (actual: 15 min) | Trivial |
| F-08 | `AudiencePage.tsx` | 🔵 Low | Dual-fetch for own profile — intentional, no fix needed | — |

---

## Patterns Working Well

- **`useAuthedInterval` + `pauseWhenHidden: true`** — `MeetingsPage` 30 s poll is correctly visibility-gated and auth-gated. This is the right pattern; it should be adopted for points sync (F-04).
- **`EngagePage` cache-first** — reads preloader cache before firing any network request, with per-key miss detection. Correctly avoids all redundant calls when the preloader has run.
- **`GiveawaysPage`** — pure context consumer, zero direct API calls.
- **`AppContext` lead reconciler** — exponential back-off, visibility skip, per-lead in-flight guard. Well-designed.
- **`NOT_IMPLEMENTED` short-circuit** — session-scoped flags on first 404/405 prevent N+1 error storms for undeployed backend routes.
- **`pageCache.ts`** — lightweight 15-min TTL cache prevents gratuitous re-fetches across page mounts.

---

## Recommended Fix Priority

1. **F-01 (client.ts retry)** — highest impact, 5-line fix, prevents duplicate mutations
2. **F-03 (poll fan-out cap)** — one-line slice, prevents request storm on event join
3. **F-02 (HomePage speakers cache)** — eliminates the one guaranteed duplicate on every home page mount
4. **F-04 (points sync visibility)** — prevents background tab burn, 3-line fix
5. **F-05 (LeadsPage triple-fetch)** — medium effort, requires reconciler API change
6. **F-06 (serial conversations)** — prepare now, no production impact until backend ships the route
