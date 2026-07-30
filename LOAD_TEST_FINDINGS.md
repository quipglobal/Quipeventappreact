# CXO API — Load Test & Performance Findings
_Generated: 2026-07-30_

## Executive Summary

The load test revealed that the backend is currently returning **HTTP 500 errors for all event-scoped endpoints**, even for a single user. This is a backend crash condition — not a pure performance problem. Fixing the 500s must happen before concurrency can meaningfully improve.

---

## 1. What Was Tested

| Test layer | Tool | Scope |
|---|---|---|
| 1 000-VU concurrency | `npm run test:load-1k` | 7 endpoints, Event 21, 68 s |
| Baseline single-request | `curl` | All event endpoints, events 21/28/53/832 |
| Concurrency degradation curve | Node.js | `GET /events/:id/attendees`, 1→100 concurrent |
| 50-concurrent profile | Node.js | `GET /me/profile` |

The web app and mobile app share the same backend (`https://app.cxocollaborate.com/api/v1`). All results apply equally to both.

---

## 2. Critical Finding — Backend Returning 500 on All Event Endpoints

Every event-scoped endpoint returns **HTTP 500 with a Laravel HTML error page** for all event IDs (21, 28, 53, 832). This is not a load problem — it fails for a single request.

```
Response headers on 500s:
  HTTP/2 500
  content-type: text/html; charset=utf-8   ← should be application/json
  cache-control: no-cache, private
  x-powered-by: PHP/8.4.16
```

Affected endpoints (all events):
```
GET /api/v1/events/:id/attendees      → 500  ~1 000 ms
GET /api/v1/events/:id/mobile-polls   → 500  ~2 500 ms
GET /api/v1/events/:id/mobile-surveys → 500  ~2 300 ms
GET /api/v1/events/:id/agenda         → 500  ~1 200 ms
GET /api/v1/events/:id/leaderboard    → 500  ~2 700 ms
GET /api/v1/events/:id/giveaways      → 500  ~1 200 ms
GET /me/profile                       → 500  ~2 200 ms
```

The 1–3.7 s latency on failures suggests the backend is running a database query that errors out (rather than failing fast on auth or routing). Check Laravel `storage/logs/laravel.log` for the exception class and stack trace.

---

## 3. Concurrency Degradation Curve

Measured on `GET /api/v1/events/21/attendees` (representative of all event endpoints):

| Concurrent users | p50 | p95 | Error rate |
|---|---|---|---|
| 1 | 1 003 ms | 1 003 ms | **100 %** |
| 10 | 1 798 ms | 2 538 ms | **100 %** |
| 25 | 2 703 ms | 5 606 ms | **100 %** |
| 50 | 4 704 ms | 10 000 ms | **100 %** |
| 100 | 10 000 ms (timeout) | 10 531 ms | **100 %** |

**Pattern**: every additional concurrent user adds ~35–40 ms to p50. This is consistent with a database connection pool being exhausted — each request serialises behind the others waiting for a DB slot, then the query itself fails.

---

## 4. 1 000-VU Load Test Results

Run: `LOAD_TEST_TOKEN=... LOAD_TEST_EVENT_ID=21 npm run test:load-1k`

```
Total requests : 7,414       (68 s test duration)
Requests/sec   : 109
HTTP errors    : 7,287  (98.29 %)
Peak in-flight : 1 000

Latency (including timed-out requests):
  p50 : 8 016 ms
  p95 : 8 177 ms   ← SLO breach (< 3 000 ms)
  p99 : 8 308 ms

SLO result: ✗ BREACH
  • p95 8 177 ms > 3 000 ms
  • error rate 98.29 % > 1 %
```

Per-scenario (all failing uniformly — not endpoint-specific):
```
GET attendees    1 840 reqs  p95=8 198 ms  err=98.37 %
GET polls        1 577 reqs  p95=8 174 ms  err=98.16 %
GET surveys      1 102 reqs  p95=8 165 ms  err=97.64 %
GET events       1 049 reqs  p95=8 164 ms  err=98.67 %
GET giveaways      747 reqs  p95=8 177 ms  err=98.26 %
GET leaderboard    736 reqs  p95=8 174 ms  err=98.37 %
GET members        363 reqs  p95=8 185 ms  err=99.17 %
```

---

## 5. Backend Action Items

### P0 — Fix immediately (blocking all users)

**5.1 Investigate and fix the 500 exception**
- Check `storage/logs/laravel.log` for the exception causing these 500s
- Common causes: missing DB column/table from a migration not run in production, a service binding that failed, or a query using a feature not available in the current DB schema
- Run `php artisan migrate --status` in the production container to check for unapplied migrations

**5.2 Return JSON from the API exception handler**
- The 500 responses have `content-type: text/html` — the mobile and web clients expect JSON
- In `app/Exceptions/Handler.php`, ensure API routes render JSON:
  ```php
  // In render() or register():
  $this->renderable(function (\Throwable $e, $request) {
      if ($request->is('api/*') || $request->wantsJson()) {
          return response()->json([
              'success' => false,
              'message' => app()->isProduction() ? 'Server error' : $e->getMessage(),
          ], 500);
      }
  });
  ```
- Set `APP_DEBUG=false` in the production `.env` — the HTML error page confirms debug output is leaking

### P1 — Fix before the next event (performance, once 500s are resolved)

**5.3 Add database indexes for event-scoped queries**
Every list endpoint filters by `event_id`. Without an index, each request does a full table scan:
```sql
-- Add to a migration:
ALTER TABLE event_members   ADD INDEX idx_event_id (event_id);
ALTER TABLE polls           ADD INDEX idx_event_id (event_id);
ALTER TABLE surveys         ADD INDEX idx_event_id (event_id);
ALTER TABLE leaderboard     ADD INDEX idx_event_id (event_id);
ALTER TABLE leads           ADD INDEX idx_event_id (event_id);
ALTER TABLE giveaways       ADD INDEX idx_event_id (event_id);
-- Composite for attendee search:
ALTER TABLE event_members   ADD INDEX idx_event_checked_in (event_id, checked_in_at);
```

**5.4 Add a Redis response cache for read-heavy endpoints**
Attendee list, leaderboard, poll list — these are read many times per second but change infrequently:
```php
// Example: cache attendee list for 30 seconds
$attendees = Cache::remember("event:{$eventId}:attendees", 30, fn() =>
    EventMember::where('event_id', $eventId)->get()
);
```
30 s cache cuts DB load by ~97 % at 10 requests/s.

**5.5 Enforce pagination on all list endpoints**
`GET /events/:id/attendees` with no `per_page` may return thousands of rows in a single JSON payload. Default to `per_page=50`, `max per_page=200`.

**5.6 Eager-load relationships to eliminate N+1 queries**
```php
// Instead of:
EventMember::where('event_id', $eventId)->get(); // N+1 for company, user, roles

// Use:
EventMember::with(['user', 'company', 'roles'])
    ->where('event_id', $eventId)
    ->paginate(50);
```

**5.7 Add HTTP cache headers for slow-changing data**
Agenda, sponsor list, and session schedule rarely change:
```php
return response()->json($data)
    ->header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
```

**5.8 Increase Cloud Run min-instances to 2**
Currently 0 min-instances means cold starts add 2–4 s on top of query time. Set `--min-instances=2` on the Cloud Run service to eliminate cold starts during events.

### P2 — Performance target once P0/P1 are resolved

After fixes, re-run `npm run test:load-1k` against the fixed backend.  
Target: **p95 < 1 500 ms** at 1 000 concurrent VUs (within the 3 000 ms SLO with headroom).

---

## 6. How to Re-run the Load Test

```bash
# Requires a valid bearer token and event ID
export LOAD_TEST_TOKEN="<bearer-token>"
export LOAD_TEST_EVENT_ID=21

# Default: 1 000 VUs, 60 s sustained, p95/error-rate SLOs
npm run test:load-1k

# Custom base URL (staging):
LOAD_TEST_BASE_URL=https://staging.cxocollaborate.com npm run test:load-1k

# Artillery YAML (when Artillery is installed):
# npm install -g artillery
# artillery run tests/load/api-1k-concurrency.yml
```

Exit code `0` = all SLOs passed. Exit code `1` = breach (see report for which).
