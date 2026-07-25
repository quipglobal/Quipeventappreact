# Load Testing

Self-contained Node.js load test for the four API endpoints most sensitive to
concurrent user traffic: audience (attendees), surveys, polls, and event
listing. Zero external dependencies — uses only Node.js built-in `https`/`http`.

## Why these endpoints?

During a live event, all attendees open the app roughly simultaneously.
Before the caching fixes applied in this session, every tab navigation fired a
fresh network request with zero coalescing:

| Endpoint | Old behaviour | Fixed behaviour |
|---|---|---|
| `GET /attendees` | `staleTime:0, gcTime:0` → full refetch on every tab switch | `staleTime:60s` — cache serves repeated visits |
| `GET /mobile-surveys` + detail | 10 detail prefetches per mount → 11 req/user | Capped at 3 prefetches per mount |
| `GET /mobile-polls` | `staleTime:0` (RQ default) → refetch on every focus | `staleTime:60s` |
| `GET /tenants/3/events` | 5-min staleTime — already fine | Unchanged |

Under 100 concurrent users the old survey behaviour alone generated
**~1 100 simultaneous requests** every time the Engage tab was opened.

## Prerequisites

| Variable | Description | Example |
|---|---|---|
| `LOAD_TEST_TOKEN` | Valid `Bearer` token for the target environment | `export LOAD_TEST_TOKEN=227\|g0oVmr...` |
| `LOAD_TEST_EVENT_ID` | Numeric event id to test against | `export LOAD_TEST_EVENT_ID=21` |
| `LOAD_TEST_BASE_URL` | API base URL (defaults to production) | `export LOAD_TEST_BASE_URL=https://staging.cxocollaborate.com` |

### Getting a token

Log in via the app (or use the admin token in `BACKEND_SCAN_ENDPOINTS.md`
for staging/dev only — never use admin tokens against production).

## Running the suite

```bash
# Against production (default)
export LOAD_TEST_TOKEN="<your-token>"
export LOAD_TEST_EVENT_ID=21
npm run test:load

# Against a staging environment
export LOAD_TEST_BASE_URL="https://staging.cxocollaborate.com"
export LOAD_TEST_TOKEN="<staging-token>"
export LOAD_TEST_EVENT_ID=21
npm run test:load
```

## Load profile

The test ramps from 0 → 100 virtual users over 30 seconds, holds at 100 VUs
for 60 seconds, then ramps back down over 15 seconds. Total runtime: ~105 s.

```
VUs
100 ┤                      ┌─────────────────────────────────────────┐
    │                     /                                           \
  1 ┤────────────────────/                                             \──
    └──────────────────────────────────────────────────────────────────────
     0s                 30s                                       90s  105s
```

Each VU fires one request per 1-second tick. Scenario is selected by weighted
random to match real usage distribution.

## Pass/fail thresholds

The suite exits non-zero (fails CI) if:

- **p95 response time > 3 000 ms** across all requests
- **Error rate > 1 %** (`5xx` + timeouts combined)

## Scenario weights

| Scenario | Weight | Endpoint |
|---|---|---|
| GET attendees | 30 % | `/api/v1/events/:id/attendees` |
| GET surveys | 20 % | `/api/v1/events/:id/mobile-surveys` |
| GET polls | 25 % | `/api/v1/events/:id/mobile-polls` |
| GET events | 25 % | `/api/v1/tenants/3/events` |

## Sample output

```
CXO API Load Test
  Target  : https://app.cxocollaborate.com
  Event   : 21
  Profile : ramp 0→100 VUs / hold 60s / ramp down
  p95 SLO : 3000 ms   error SLO: <1%

[ramp-up] 1 → 100 VUs over 30s
[sustained] 100 → 100 VUs over 60s
[ramp-down] 100 → 1 VUs over 15s

══════════════════════════════════════════════════════════════
 CXO API Load Test Report
══════════════════════════════════════════════════════════════
  Total requests : 8547
  Errors (5xx/TO): 12  (0.14%)
  Latency avg    : 412 ms
  Latency p50    : 380 ms
  Latency p95    : 890 ms  [threshold: <3000 ms]
  Latency p99    : 1420 ms

  Per-scenario breakdown:
    GET attendees              reqs= 2561  p95=1240ms  err=0.1%
    GET surveys                reqs= 1710  p95=780ms   err=0.2%
    GET polls                  reqs= 2140  p95=690ms   err=0.1%
    GET events (tenant)        reqs= 2136  p95=520ms   err=0.1%

  ✓ All thresholds passed
══════════════════════════════════════════════════════════════
```

## Interpreting results

- **`p95` high on attendees** → backend needs server-side caching headers
  (`Cache-Control: public, max-age=60, stale-while-revalidate=120`) or query
  optimisation. See the backend agent prompt in the project notes.
- **`p95` high on surveys** → the 3-detail prefetch cap is helping, but backend
  may still need pagination for large events.
- **Error rate > 1 %** → check for rate limiting (backend should allow 30 req/10s
  per user) or infrastructure issues.
