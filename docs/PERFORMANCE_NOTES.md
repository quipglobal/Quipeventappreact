# Performance Notes — Redis & Concurrent-Load Guide

> **Audience**: backend developers configuring Redis caching and future frontend contributors
> adding new API integrations.

---

## 1. Redis endpoint classification

Redis is a key-value store. It does **not** support ad-hoc JOINs, multi-column
filtering, or full-text search. Every cache entry must be keyed to exactly one
stable identity — event-scoped lists, user-scoped profiles, or a specific
filtered query. Misusing global keys for filtered results will serve one user's
view to another.

### ✅ Safe for a shared (event-scoped) Redis key

These endpoints return the same payload for all members of an event. Cache with
a single key like `event:{eventId}:{resource}`.

| Endpoint | Suggested TTL | Notes |
|---|---|---|
| `GET /events/:id/agenda` | 5 min | Rarely changes mid-event |
| `GET /events/:id/speakers` (role filter only) | 5 min | Same page=1&per_page=200 for all |
| `GET /events/:id/companies` (sponsors) | 5 min | Static for event duration |
| `GET /events/:id/challenges` | 5 min | Challenges don't change intra-event |
| `GET /events/:id/surveys` (list) | 2 min | Titles can be edited by organizer |
| `GET /events/:id/polls` (list) | 60 s | Status changes (LIVE → CLOSED) |
| `GET /events/:id/leaderboard?period=overall` | 60 s | Points change frequently |

### ⚠️ Requires a user-scoped key

These endpoints return user-specific data. Cache under
`user:{userId}:event:{eventId}:{resource}` — **never** under a shared event key.

| Endpoint | Suggested TTL | Notes |
|---|---|---|
| `GET /me` | 2 min | Points, tier, profile |
| `GET /events/:id/my-rank` | 60 s | User's own leaderboard position |
| `GET /events/:id/my-leads` | 90 s | Sponsor-only; per-user leads list |
| `GET /events/:id/my-meetings` | 30 s | Connection requests per user |
| `GET /events/:id/giveaways` | 2 min | Giveaway list scoped per event (shared), winners per sponsor |
| `GET /me/badge` | 5 min | QR code / badge data |

### ❌ Must NOT use a single global key — filter state is part of the key

These endpoints take query parameters that change the result. Each unique
parameter combination is a separate cache key. Caching naively serves one
user's filtered view to every other user.

| Endpoint | Risky param | Correct cache strategy |
|---|---|---|
| `GET /events/:id/members?per_page=N&page=P` | `page`, `checked_in_only` | Key includes ALL query params |
| `GET /events/:id/attendees?per_page=N&page=P` | `page` | Same — paginated responses are distinct |
| `GET /events/:id/leaderboard?period=today\|week` | `period` | Separate key per period |
| `GET /events/:id/members?role=speaker&page=N` | `role`, `page` | Full query string in key |

---

## 2. Client-side hardening (added in this release)

The following patterns were identified as load amplifiers at 100–300 concurrent
users and have been addressed client-side:

### 2.1 In-flight request deduplication (`src/app/api/client.ts`)

`fetchWithRetry` now maintains a `Map<string, Promise<Response>>` keyed by
`METHOD::url`. Concurrent GET/HEAD/OPTIONS calls for the same URL share a single
in-flight Promise — the network call fires exactly once regardless of how many
React components request the same resource simultaneously.

**Effect**: eliminates the N-fold request amplification that occurs when multiple
components mount in the same render cycle (e.g. Home + preloader both calling
`/events/:id/agenda` on load).

### 2.2 Preloader burst jitter (`src/app/hooks/usePreloader.ts`)

The 7+ parallel prefetch requests that fire when a user enters an event are now
delayed by a random **0–5 000 ms** offset. Each session also uses a jittered
refresh interval (**15 min ± 30 s**) so ticks desynchronize across long sessions.

**Effect**: 300 simultaneous joins spread their first cache-warm burst across a
5-second window instead of all arriving at t=0.

### 2.3 Short-TTL caching for high-churn endpoints (`src/app/lib/pageCache.ts`)

`pageCache` now supports per-entry custom TTLs alongside the default 15-minute
window. Exported constants:

- `SHORT_TTL_MS` = 90 s — for meetings list, feed page 1
- `LEADERBOARD_TTL_MS` = 60 s — for leaderboard rows

The `LeaderboardPage` uses a module-level 60 s throttle (`lastLeaderboardFetch`)
so re-mounting the tab within 60 s reuses AppContext state without a new network
call.

### 2.4 Unified speaker fetch limit (`src/app/components/HomePage.tsx`)

Previously `HomePage` fetched 24 speakers (`speakers:home` cache key) and the
preloader fetched 200 (`speakers` cache key). The backend received two distinct
URLs — two Redis cache entries for the same data.

**Fix**: both code paths now use `speakers` as the cache key and
`per_page=200&page=1` as the URL. The backend sees one cache key.
`HomePage` slices the display list to 24 from the shared 200-item set.

### 2.5 Polling interval jitter (`src/app/hooks/useAuthedInterval.ts`)

`useAuthedInterval` accepts a new `initialDelayMs` option. When set, the first
tick and interval start are delayed by that many milliseconds. Call-sites pass
a `useRef`-stable random value in `[0, 30_000)` so timers are computed once on
mount.

Applied to: **MeetingsPage** (30 s poll), **MyBadgePage** (30 s poll),
**AppContext points sync** (2 min poll).

**Effect**: 300 sessions no longer produce aligned load spikes every 30 s.

### 2.6 Audience N+1 guard (`src/app/api/audienceClient.ts`)

`AUDIENCE_DETAIL_PREFETCH_LIMIT = 5` is exported as a named constant. Member
detail is fetched on-demand only (no bulk prefetch currently exists). Any future
pre-fetch loop **must** cap at this constant, consistent with `POLL_DETAIL_PREFETCH_LIMIT`
and `SURVEY_DETAIL_PREFETCH_LIMIT` in the preloader.

---

## 3. Load profile at 100–300 concurrent users (post-hardening)

| Concern | Before | After |
|---|---|---|
| Join burst per 100 users | ~700 simultaneous requests | Spread over 5 s → ~140 req/s |
| Meetings poll spike (300 users) | All 300 hit server at :00, :30, 1:00… | Uniformly spread across 30 s window |
| Speaker fetch: backend cache keys | 2 (per_page=24 + per_page=200) | 1 (per_page=200 only) |
| Duplicate concurrent GETs | Up to 3× per URL (multiple components) | 1× (in-flight dedup) |

---

## 4. What still needs backend work

- **Install Predis** on the dev server so sessions actually land in Redis
  (tracked in task #46).
- **Add `Cache-Control: max-age=N` / `ETag` headers** on leaderboard, sessions,
  and speaker list responses so browsers and Vite proxy can cache at the HTTP
  layer without requiring client-side workarounds.
- **Rate-limit `/events/:id/leaderboard`** per event — this endpoint is called
  on every Leaderboard tab open and every period-pill click.
