# Backend Agent Instructions — CXO Inc Mobile API

## Context

The mobile app is a React Native (Expo SDK 52) application that calls a Laravel 11 / PHP 8.4
backend. The app is **currently running in mock mode** (`EXPO_PUBLIC_USE_MOCK_API=true`).
When the backend is ready, set `EXPO_PUBLIC_USE_MOCK_API=false` and point
`EXPO_PUBLIC_API_BASE_URL` at the Laravel root URL.

Your job: implement every route listed below so the real app works identically to the mock.
The mock data for each screen is the authoritative reference for data shapes.

---

## Universal Contract

### Base URL
```
https://<your-laravel-domain>
```

### Request headers (mobile sends these on every call)
```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <sanctum_token>   ← omitted only on auth endpoints
```

### Response envelope — always wrap in this shape
```json
// success
{ "success": true, "data": { ... } }

// error
{ "success": false, "error": { "code": "SNAKE_CASE_CODE", "message": "Human-readable." } }
```

The mobile `request()` function checks `res.success`, not the HTTP status code, so
**always return 2xx with the envelope** — never rely on the client reading a 4xx body field.

### Important URL prefixes
- Auth routes: `/auth/...`  ← **no /api prefix**
- Everything else: `/api/...`

---

## Screen-by-Screen API Plan

---

### SCREEN 1 — Welcome / Auth (`app/(auth)/welcome.tsx`)

**What the screen does:**
1. User enters phone number → app calls `sendOtp`.
2. User enters 6-digit OTP → app calls `verifyOtp`.
3. If existing user (`isNewUser: false`), logs in immediately.
4. If new user (`isNewUser: true`), shows registration form → calls `register`.

---

#### `POST /auth/send-otp`

**Request:**
```json
{ "phone": "5550000001" }
```

**Response (200):**
```json
{ "success": true, "data": { "message": "OTP sent" } }
```

**Notes:**
- Strip non-digits from `phone` before matching.
- Generate a 6-digit random OTP, hash it (bcrypt or SHA-256+salt), store with `expires_at = now() + 5 minutes`.
- Send SMS via Twilio / AWS SNS.
- **Always return 200** even for unknown phones (security — don't leak account existence).
- Rate-limit to 5 sends per phone per 10 minutes → return `429` on breach.

---

#### `POST /auth/verify-otp`

**Request:**
```json
{ "phone": "5550000001", "otp": "123456" }
```

**Response — existing user (200):**
```json
{
  "success": true,
  "data": {
    "token": "1|AbCd...",
    "user": {
      "id": 1,
      "phone": "5550000001",
      "name": "Jessica Williams",
      "email": "jessica@stripe.com",
      "title": "Product Designer",
      "company": "Stripe",
      "role": "attendee",
      "points": 120,
      "tier": "Silver",
      "interests": ["Design", "Product"],
      "avatar": null,
      "bio": "Passionate about crafting intuitive user experiences.",
      "profile_complete": true
    },
    "is_new_user": false
  }
}
```

**Response — new/unknown phone (200):**
```json
{
  "success": true,
  "data": {
    "token": "",
    "user": null,
    "is_new_user": true
  }
}
```

**Response — wrong OTP (200 envelope, not 422):**
```json
{
  "success": false,
  "error": { "code": "INVALID_OTP", "message": "Incorrect code. Please try again." }
}
```

**Notes:**
- The mobile normalizer reads `raw.token ?? raw.access_token ?? raw.auth_token` and
  `raw.is_new_user ?? raw.is_new ?? !raw.user`, so stick to `token` and `is_new_user`.
- If phone exists and OTP is valid: create a Sanctum token, return it with the full user.
- Mark OTP record as `used_at = now()`.
- Expired/used OTPs must fail with `INVALID_OTP`.

---

#### `POST /auth/register`

**Request:**
```json
{
  "phone": "5550000001",
  "name": "Jessica Williams",
  "email": "jessica@stripe.com",
  "title": "Product Designer",
  "company": "Stripe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "token": "2|XyZw...",
    "user": { /* full user object, same shape as verify-otp */ }
  }
}
```

**Notes:**
- Default `role = "attendee"`, `points = 0`, `tier = "Bronze"`.
- If phone already exists return `{ "success": false, "error": { "code": "PHONE_EXISTS", ... } }`.
- Issue a Sanctum token immediately — user is logged in after registration.

---

#### `GET /auth/me`

Auth required. Called on every app launch to validate the stored token.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { /* full user object */ }
  }
}
```

**Response — bad/expired token:**
Return HTTP `401` (no envelope needed; the mobile client handles 401 specially by clearing
the token and redirecting to the welcome screen).

---

### SCREEN 2 — Join Event (`app/join.tsx`)

User scans a QR code or types an event code to join an event.

---

#### `POST /api/events/join`

Auth required.

**Request:**
```json
{ "code": "CXOSUMMIT26" }
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "evt-1",
    "name": "CXO Tech Summit 2026",
    "code": "CXOSUMMIT26",
    "startDate": "2026-01-16",
    "endDate": "2026-01-18",
    "location": "San Francisco, CA",
    "description": "The premier executive tech conference...",
    "status": "live"
  }
}
```

**Response — unknown code:**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "No event found for that code." } }
```

**Notes:**
- `status` values the app uses: `"upcoming"`, `"live"`, `"past"`.
- Create an `event_users` pivot row so the user is linked to the event.
- Idempotent: if already joined, return the event object without creating a duplicate row.

---

#### `GET /api/events`

Auth required. Returns all events the current user has joined.

**Response (200):**
```json
{
  "success": true,
  "data": [
    { /* event object */ },
    { /* event object */ }
  ]
}
```

---

#### `GET /api/events/:id`

Auth required.

**Response (200):** `{ "success": true, "data": { /* event object */ } }`

---

### SCREEN 3 — Event Dashboard (`app/event-dashboard.tsx`)

The home screen after joining. Shows upcoming sessions and leaderboard preview.
Calls two endpoints on mount:

1. `GET /api/leaderboard` (top 3 used for preview)
2. `GET /api/sessions` (filtered to current day, upcoming sessions shown as cards)

Both are documented below under their respective screens (Agenda / Audience).

---

### SCREEN 4 — Feed (`app/(tabs)/feed.tsx`)

The main content feed — vertical scroll of videos and polls interleaved.

---

#### `GET /api/feed?cursor=<string>`

Auth required. Cursor-based pagination.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `cursor` | string (optional) | Omit for first page. Pass `nextCursor` from previous response. |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "v1",
        "type": "video",
        "title": "Opening Keynote: The Future of AI",
        "speaker": "Dr. Sarah Chen",
        "company": "TechCorp Solutions",
        "duration": "58:22",
        "views": "1.2K",
        "accentColor": "#7c3aed",
        "live": true,
        "videoUrl": "https://cdn.example.com/session1.mp4"
      },
      {
        "id": "poll1",
        "type": "poll",
        "question": "Which topic are you most excited about today?",
        "session": "Opening Keynote",
        "points": 10,
        "options": [
          { "id": "o1", "text": "AI & Machine Learning", "votes": 48 },
          { "id": "o2", "text": "Startup Ecosystem", "votes": 31 },
          { "id": "o3", "text": "Sustainable Tech", "votes": 22 },
          { "id": "o4", "text": "Leadership & Culture", "votes": 19 }
        ]
      }
    ],
    "nextCursor": "eyJpZCI6MTB9",
    "hasMore": true
  }
}
```

**Notes:**
- `type` field on each item must be exactly `"video"` or `"poll"` — the app switches on this.
- Interleave: 2 videos → 1 poll → 2 videos → 1 poll (configurable, but start here).
- `nextCursor: null` and `hasMore: false` on the last page.
- `views` is a pre-formatted string like `"1.2K"` or `"847"`.
- `accentColor` is a hex color for the card's visual accent.

---

#### `POST /api/feed/video/watched`

Auth required.

**Request:**
```json
{ "videoId": "v1" }
```

**Response (200):**
```json
{ "success": true, "data": { "points": 20 } }
```

**Notes:**
- Idempotent — if the user already watched this video, return `{ "points": 0 }` (don't
  double-award).
- On first watch: add 20 points to user, recalculate tier.

---

#### `POST /api/polls/vote`

Auth required. Used for BOTH feed polls and Engage screen polls.

**Request:**
```json
{ "pollId": "poll1", "optionId": "o2" }
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "points": 10,
    "results": [
      { "id": "o1", "votes": 48 },
      { "id": "o2", "votes": 32 },
      { "id": "o3", "votes": 22 },
      { "id": "o4", "votes": 19 }
    ]
  }
}
```

**Notes:**
- One vote per user per poll. On second call: return `{ "points": 0, "results": [...] }`.
- `results` must include all options (not just the voted one) with updated counts.

---

### SCREEN 5 — Agenda (`app/(tabs)/agenda.tsx`)

Shows all conference sessions in a day-by-track grid. Users can bookmark sessions.

---

#### `GET /api/sessions?day=1&track=Engineering`

Auth required.

**Query params (all optional):**
| Param | Type | Example |
|-------|------|---------|
| `day` | int | `1`, `2`, `3` (1-indexed) |
| `track` | string | `"Main Stage"`, `"Engineering"`, `"AI/ML"` |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "s1",
      "title": "Opening Keynote: The Future of AI",
      "speaker": "Dr. Sarah Chen",
      "speakerTitle": "Chief AI Officer",
      "speakerCompany": "TechCorp Solutions",
      "speakerAvatar": null,
      "track": "Keynote",
      "room": "Main Hall",
      "day": 1,
      "startTime": "09:00",
      "endTime": "10:00",
      "description": "An exploration of how AI is fundamentally reshaping every industry.",
      "tags": ["AI", "Strategy", "Keynote"],
      "capacity": 500,
      "attending": 312,
      "accentColor": "#7c3aed"
    }
  ]
}
```

**Critical notes:**
- `day` is **1-indexed** — the app does `(session.day ?? 1) - 1` to get the tab index.
  Day 1 = Jan 16, Day 2 = Jan 17, Day 3 = Jan 18.
- `tags` and `description` are optional but highly recommended.
- `accentColor` is a hex string used for visual theming on session cards.
- `startTime` / `endTime` format: `"HH:MM"` (24h, e.g. `"09:00"`, `"14:30"`).

---

#### `GET /api/sessions/:id`

Auth required. Returns a single session by ID.

**Response (200):** `{ "success": true, "data": { /* session object */ } }`

---

#### `POST /api/sessions/bookmark`

Auth required. Toggles a bookmark.

**Request:**
```json
{ "sessionId": "s1", "bookmarked": true }
```

**Response (200):**
```json
{ "success": true, "data": { "bookmarked": true } }
```

**Notes:** Idempotent. Store in `session_bookmarks(user_id, session_id)` table.

---

### SCREEN 6 — Audience (`app/(tabs)/audience.tsx`)

Attendee directory + leaderboard. Two separate data sources.

---

#### `GET /api/attendees?tier=Gold&search=jessica`

Auth required.

**Query params (all optional):**
| Param | Type | Description |
|-------|------|-------------|
| `tier` | string | `Bronze`, `Silver`, `Gold`, `Platinum` |
| `search` | string | Searches name, company, and title |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Jessica Williams",
      "title": "Product Designer",
      "company": "Stripe",
      "role": "attendee",
      "points": 120,
      "tier": "Silver",
      "interests": ["Design", "Product"],
      "avatar": null,
      "bio": "Passionate about crafting intuitive user experiences."
    }
  ]
}
```

**Critical notes:**
- `id` **must be a string** — the mobile type expects `string`, not `int`.
- `role` must be exactly `"attendee"` or `"sponsor"`.
- **Do NOT include a `color` field** — the app generates avatar color client-side from the ID.
- `avatar` can be `null` or a URL string; the app shows initials if null.
- Sponsors (role = "sponsor") should be excluded from this list, or include them — your choice,
  but the app renders everyone the same way.

---

#### `GET /api/attendees/:id`

Auth required. Returns a single attendee profile.

**Response (200):** `{ "success": true, "data": { /* attendee object */ } }`

---

#### `GET /api/leaderboard`

Auth required. Returns top-ranked attendees by accumulated points.

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "rank": 1, "userId": "1", "name": "Aisha Kamara", "points": 680, "tier": "Platinum", "tierColor": "#e5e4e2" },
    { "rank": 2, "userId": "2", "name": "Dev Sharma",   "points": 540, "tier": "Gold",     "tierColor": "#ffd700" },
    { "rank": 3, "userId": "3", "name": "Lena Fischer", "points": 420, "tier": "Gold",     "tierColor": "#ffd700" },
    { "rank": 4, "userId": "4", "name": "Omar Hassan",  "points": 310, "tier": "Silver",   "tierColor": "#c0c0c0" },
    { "rank": 5, "userId": "5", "name": "Yuki Tanaka",  "points": 290, "tier": "Silver",   "tierColor": "#c0c0c0" }
  ]
}
```

**Critical notes:**
- Field is `tierColor` (camelCase), **NOT** `color`. The app uses `l.tierColor` explicitly.
- `userId` is the string user ID — used by the app to find the current user's own rank.
- Tier color hex values: Bronze `#cd7f32`, Silver `#c0c0c0`, Gold `#ffd700`, Platinum `#e5e4e2`.
- Return top 20 entries sorted by `points DESC`.

---

### SCREEN 7 — Engage (`app/(tabs)/engage.tsx`)

Gamification hub: challenges, polls, surveys, giveaways.

---

#### `GET /api/challenges`

Auth required.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "c1",
      "title": "First Connection",
      "desc": "Connect with 3 other attendees",
      "emoji": "🤝",
      "points": 50,
      "progress": 1,
      "total": 3
    }
  ]
}
```

**Notes:**
- `progress` and `total` are **per-user** values.
- App shows "Claim" button when `progress === total`.
- When claimed, app calls `completeChallenge`.

---

#### `POST /api/challenges/complete`

Auth required.

**Request:**
```json
{ "challengeId": "c1" }
```

**Response (200):**
```json
{ "success": true, "data": { "points": 50 } }
```

**Notes:**
- Idempotent — only award points once. On repeat calls return `{ "points": 0 }`.
- Update user points and tier.

---

#### `GET /api/polls`

Auth required. Returns standalone polls (Engage tab — separate from feed polls).

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "p1",
      "question": "Which AI use case excites you most in 2026?",
      "session": "Keynote",
      "points": 10,
      "totalVotes": 219,
      "options": [
        { "id": "o1", "text": "Generative AI",        "votes": 87 },
        { "id": "o2", "text": "AI Agents",             "votes": 61 },
        { "id": "o3", "text": "Computer Vision",       "votes": 29 },
        { "id": "o4", "text": "Predictive Analytics",  "votes": 42 }
      ]
    }
  ]
}
```

**Notes:**
- Voting uses the shared `POST /api/polls/vote` endpoint (documented under Feed).

---

#### `GET /api/surveys`

Auth required.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "sv1",
      "title": "Morning Workshop Feedback",
      "desc": "Rate the workshop sessions you attended this morning.",
      "questions": 5,
      "points": 50
    }
  ]
}
```

**Notes:**
- `questions` is the question count (displayed as "5 questions"). The full question list is not
  fetched by the current mobile screen — the survey sheet is a native modal that just shows
  the title/desc and a "Start Survey" button.

---

#### `POST /api/surveys/submit`

Auth required.

**Request:**
```json
{
  "surveyId": "sv1",
  "answers": { "q1": "Very satisfied", "q2": "Dr. Sarah Chen" }
}
```

**Response (200):**
```json
{ "success": true, "data": { "points": 50 } }
```

**Notes:** Idempotent — one submission per user per survey.

---

#### `GET /api/giveaways`

Auth required.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "g1",
      "title": "MacBook Pro 16\"",
      "sponsor": "TechCorp Solutions",
      "entries": 142,
      "ends": "3:00 PM",
      "color": "#7c3aed",
      "entered": false
    }
  ]
}
```

**Notes:**
- `entered` must be `true` if the current user has already entered.
- `color` is a hex used as the giveaway card's accent color.
- `ends` is a pre-formatted time string (`"3:00 PM"`), not a timestamp.

---

#### `POST /api/giveaways/enter`

Auth required.

**Request:**
```json
{ "giveawayId": "g1" }
```

**Response (200):**
```json
{ "success": true, "data": { "entries": 143 } }
```

**Notes:** Idempotent. Only award entry points once.

---

### SCREEN 8 — Partners (`app/(tabs)/partners.tsx`)

Sponsor directory for attendees + full sponsor toolbox for sponsor-role users.

---

#### `GET /api/sponsors?tier=Gold`

Auth required (all roles).

**Query params (optional):**
| Param | Type | Values |
|-------|------|--------|
| `tier` | string | `Platinum`, `Gold`, `Silver`, `Bronze` |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "s1",
      "name": "TechCorp Solutions",
      "tier": "Platinum",
      "tagline": "Building the future of enterprise AI",
      "category": "AI & Cloud",
      "boothNumber": "A1",
      "tierColor": "#e5e4e2",
      "accentColor": "#7c3aed",
      "giveaway": "MacBook Pro 16\"",
      "website": "techcorp.example.com",
      "description": "TechCorp is the global leader in AI-powered enterprise solutions.",
      "logoUrl": null
    }
  ]
}
```

**Notes:**
- `tier` values: exactly `"Platinum"`, `"Gold"`, `"Silver"`, `"Bronze"` (Title Case).
- `tierColor` and `accentColor` are hex strings.
- `giveaway`, `website`, `description`, `logoUrl` are optional.

---

#### `GET /api/sponsors/:id`

Auth required.

**Response (200):** `{ "success": true, "data": { /* sponsor object */ } }`

---

#### `GET /api/v1/events/:eventId/my-leads`

Auth required. **Any event member** (filtered server-side by `scanner_user_id = auth()->id()`).

Returns all leads the authenticated user personally scanned at this event.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "l1",
      "code": "ATT-4419",
      "name": "Alex Thompson",
      "title": "CTO",
      "company": "StartupXYZ",
      "email": "alex@startupxyz.com",
      "phone": null,
      "scannedAt": "9:32 AM",
      "color": "#7c3aed",
      "status": "hot",
      "priority": "hot",
      "notes": "Interested in enterprise plan",
      "tags": ["Decision Maker", "Budget Holder"]
    }
  ]
}
```

**Critical fields (DO NOT OMIT):**
- `notes` — string or null. The free-text note the scanner left on the lead.
- `tags` — JSON array of strings. Labels the scanner attached (e.g. `["Decision Maker"]`).
- `priority` — one of `"hot" | "warm" | "cold"`. Defaults to `"warm"`. Mirrors `status`
  for legacy clients; both fields MUST be present and equal in every response.

**Notes:**
- `color` **is required** on the Lead type — used for avatar theming. Generate it
  deterministically from the attendee's user ID, e.g. `$colors[$userId % count($colors)]`.
- `status` and `priority` must be one of: `"hot"`, `"warm"`, `"cold"`. Always emit BOTH.
- `tags` MUST be an array (use `[]` not `null` when empty) so the client doesn't have
  to defensively coalesce on every render.
- `scannedAt` is a pre-formatted time string (`"9:32 AM"`), not a timestamp.

---

#### `POST /api/v1/events/:eventId/leads/scan`

Auth required. **Any event member** (the scanner becomes the lead owner).

Resolve the badge code, auto check-in the attendee, and persist the lead row.

**Request:**
```json
{
  "code": "ATT-4419",
  "name": "Alex Thompson",
  "company": "StartupXYZ",
  "title": "CTO",
  "notes": "Met at booth A-12",
  "tags": ["Decision Maker"],
  "priority": "hot"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "l1",
    "code": "ATT-4419",
    "name": "Alex Thompson",
    "title": "CTO",
    "company": "StartupXYZ",
    "scannedAt": "9:32 AM",
    "color": "#7c3aed",
    "status": "hot",
    "priority": "hot",
    "notes": "Met at booth A-12",
    "tags": ["Decision Maker"],
    "email": null,
    "phone": null,
    "pointsAwarded": 10,
    "checkedIn": true,
    "isCheckedIn": true,
    "memberId": 42
  }
}
```

**Critical persistence rules:**
- `notes`, `tags`, and `priority` from the request body MUST be persisted on the `leads`
  row. If the request omits any of them, default to `null` / `[]` / `"warm"` respectively.
- The response MUST echo back the persisted `notes`, `tags`, and `priority` so the client
  can reconcile its optimistic local state against the canonical row.
- `badgeData` (legacy) and `code` are accepted as aliases. Prefer `code`.
- Idempotent: if this scanner already scanned this attendee at this event, return the
  existing lead record (do not double-credit points; set `pointsAwarded: 0`).
- Default `status = priority = "warm"` when the request does not specify.

---

#### `PUT /api/v1/events/:eventId/leads/:id`

Auth required. **Lead owner only** (the scanner who created the row).

Updates the captured lead's notes, tags, and priority. This is the endpoint the web
client (`updateLeadApi` in `src/app/api/leadsClient.ts`) and the mobile lead detail
screen call when the user edits a lead.

**Request (any subset of fields is allowed; missing fields are left unchanged):**
```json
{
  "notes": "Wants pricing before Q3",
  "tags": ["Decision Maker", "Budget Holder"],
  "priority": "hot"
}
```

**Response (200):** the full updated lead object — same shape as the GET above —
including the persisted `notes`, `tags`, and `priority` so the client can reconcile.
```json
{ "success": true, "data": { /* full updated lead object */ } }
```

**Critical persistence rules:**
- `notes` accepts string (max ~2000 chars) or `null` to clear.
- `tags` accepts an array of strings. Replace the column wholesale on every PUT
  (do not merge). Use `[]` to clear.
- `priority` accepts `"hot" | "warm" | "cold"`. When set, also write the same value
  to the legacy `status` column so older clients keep working.
- All three fields persist independently — a PUT that contains only `notes` MUST NOT
  clobber the existing `tags` or `priority`.

---

#### `PATCH /api/sponsor/leads/:id` (legacy alias)

Auth required. **Sponsor role only.** Legacy status-only update kept for older clients.
New clients use `PUT /api/v1/events/:eventId/leads/:id` (above) which accepts the full
`{ notes, tags, priority }` payload.

**Request:**
```json
{ "status": "hot" }
```

**Response (200):**
```json
{ "success": true, "data": { /* full updated lead object */ } }
```

---

#### `POST /api/sponsor/lucky-draw`

Auth required. **Sponsor role only.**

**Request (optional):**
```json
{ "giveawayId": "g1" }
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "winner": {
      "id": "l2",
      "name": "Rachel Kim",
      "title": "VP Product",
      "company": "ScaleUp Co",
      "scannedAt": "10:15 AM",
      "color": "#06b6d4",
      "status": "warm",
      "email": "rachel@scaleup.com",
      "phone": null,
      "notes": null
    }
  }
}
```

**Notes:**
- Randomly select one lead from this sponsor's captured leads for this event.
- If `giveawayId` is provided, limit the draw to attendees who entered that giveaway.

---

### SCREEN 9 — Meetings (`app/meetings.tsx`)

Full meeting management screen. Meeting requests between attendees.

---

#### `GET /api/meetings`

Auth required.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "m1",
      "type": "incoming",
      "attendee": {
        "id": "1",
        "name": "Jessica Williams",
        "title": "Product Designer",
        "company": "Stripe",
        "role": "attendee",
        "points": 120,
        "tier": "Silver",
        "interests": []
      },
      "status": "pending",
      "proposedTime": "2:00 PM - 2:30 PM",
      "message": "I would love to discuss potential design partnerships.",
      "createdAt": "2026-01-16T09:15:00Z"
    }
  ]
}
```

**Notes:**
- `type: "incoming"` = the `attendee` field is the person who sent the request to the
  current user.
- `type: "outgoing"` = the `attendee` field is the person the current user sent to.
- `attendee` is a full `Attendee` object (same shape as `/api/attendees` items).
- `status` must be: `"pending"`, `"accepted"`, or `"declined"`.
- Return all meetings for the current user (both incoming and outgoing) combined.

---

#### `POST /api/meetings`

Auth required. Sends a meeting request.

**Request:**
```json
{
  "attendeeId": "3",
  "proposedTime": "2:00 PM - 2:30 PM",
  "message": "Would love to connect about your work at DesignFlow."
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "m-new",
    "type": "outgoing",
    "attendee": { /* target attendee object */ },
    "status": "pending",
    "proposedTime": "2:00 PM - 2:30 PM",
    "message": "Would love to connect about your work at DesignFlow.",
    "createdAt": "2026-01-16T13:00:00Z"
  }
}
```

---

#### `POST /api/meetings/:id/accept`  and  `POST /api/meetings/:id/decline`

Auth required. These are **two separate routes** (the mobile app calls
`/api/meetings/${meetingId}/${action}` where action is `accept` or `decline`).

**Request:** No body needed.

**Response (200):**
```json
{
  "success": true,
  "data": {
    /* full updated meeting object with status: "accepted" or "declined" */
  }
}
```

**IMPORTANT:** This is `POST /api/meetings/:id/accept` and `POST /api/meetings/:id/decline`,
not `PATCH /api/meetings/:id/respond`. Register both routes.

---

### SCREEN 10 — Profile (`app/profile.tsx`)

User's own profile view, editable. Shows points, tier, and bio.

---

#### `GET /api/profile/points`

Auth required.

**Response (200):**
```json
{
  "success": true,
  "data": { "points": 120, "tier": "Silver" }
}
```

---

#### `PATCH /api/profile`

Auth required.

**Request (all fields optional):**
```json
{
  "name": "Jessica Williams",
  "email": "jessica@stripe.com",
  "title": "Senior Product Designer",
  "company": "Stripe",
  "interests": ["Design", "Product", "AI"],
  "bio": "Crafting products people love."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { /* full updated AuthUser object */ }
}
```

---

#### `POST /api/profile/points/sync`

Auth required. Called whenever the app awards points locally (challenges, polls, videos).
Keeps the server in sync with client-side point additions.

**Request:**
```json
{ "delta": 20, "reason": "Video watched" }
```

**Response (200):**
```json
{ "success": true, "data": { "points": 140, "tier": "Silver" } }
```

**Notes:**
- `delta` is the number of points to add (always positive).
- Return the new absolute total, not the delta.
- Recalculate `tier` after updating points.

---

### SCREEN 11 — QR Badge (`app/qr-badge.tsx`)

Shows the current user's attendee badge as a scannable QR code.
**No API calls — data is read from the local auth context (cached user).**

The QR code encodes a JSON string:
```json
{
  "id": "user-123",
  "name": "Jessica Williams",
  "event": "cxo-summit-2026",
  "role": "attendee"
}
```

This is what sponsors scan via the `POST /api/sponsor/scan` endpoint.

---

### SCREEN 12 — Switch Event (`app/switch-event.tsx`)

Allows the user to switch between their joined events.
Calls `GET /api/events` (documented above).

---

## Points & Tier Reference

| Tier     | Points Range |
|----------|-------------|
| Bronze   | 0 – 99       |
| Silver   | 100 – 249    |
| Gold     | 250 – 499    |
| Platinum | 500+         |

| Tier color | Hex      |
|------------|----------|
| Bronze     | #cd7f32  |
| Silver     | #c0c0c0  |
| Gold       | #ffd700  |
| Platinum   | #e5e4e2  |

| Action                   | Points |
|--------------------------|--------|
| Watch video              | 20     |
| Vote in poll             | 10     |
| Complete survey          | 50–75  |
| Complete challenge       | 30–150 |
| Enter giveaway           | 10     |
| Send connection request  | 15     |
| Accept meeting           | 20     |

---

## Laravel Implementation Checklist

### Routes (`routes/api.php`)
```php
// Auth (no prefix /api)
Route::post('/auth/send-otp',     [AuthController::class, 'sendOtp']);
Route::post('/auth/verify-otp',   [AuthController::class, 'verifyOtp']);
Route::post('/auth/register',     [AuthController::class, 'register']);
Route::get('/auth/me',            [AuthController::class, 'me'])->middleware('auth:sanctum');

// Protected
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/api/events',              [EventController::class, 'index']);
    Route::post('/api/events/join',        [EventController::class, 'join']);
    Route::get('/api/events/{id}',         [EventController::class, 'show']);

    Route::get('/api/sessions',            [SessionController::class, 'index']);
    Route::get('/api/sessions/{id}',       [SessionController::class, 'show']);
    Route::post('/api/sessions/bookmark',  [SessionController::class, 'bookmark']);

    Route::get('/api/feed',                [FeedController::class, 'index']);
    Route::post('/api/feed/video/watched', [FeedController::class, 'watched']);
    Route::post('/api/polls/vote',         [PollController::class, 'vote']);

    Route::get('/api/attendees',           [UserController::class, 'index']);
    Route::get('/api/attendees/{id}',      [UserController::class, 'show']);
    Route::get('/api/leaderboard',         [UserController::class, 'leaderboard']);
    Route::get('/api/profile/points',      [ProfileController::class, 'points']);
    Route::post('/api/profile/points/sync',[ProfileController::class, 'syncPoints']);
    Route::patch('/api/profile',           [ProfileController::class, 'update']);

    Route::get('/api/challenges',          [EngageController::class, 'challenges']);
    Route::post('/api/challenges/complete',[EngageController::class, 'completeChallenge']);
    Route::get('/api/polls',               [EngageController::class, 'polls']);
    Route::get('/api/surveys',             [EngageController::class, 'surveys']);
    Route::post('/api/surveys/submit',     [EngageController::class, 'submitSurvey']);
    Route::get('/api/giveaways',           [EngageController::class, 'giveaways']);
    Route::post('/api/giveaways/enter',    [EngageController::class, 'enterGiveaway']);

    Route::get('/api/sponsors',            [SponsorController::class, 'index']);
    Route::get('/api/sponsors/{id}',       [SponsorController::class, 'show']);

    Route::get('/api/meetings',            [MeetingController::class, 'index']);
    Route::post('/api/meetings',           [MeetingController::class, 'store']);
    Route::post('/api/meetings/{id}/accept',  [MeetingController::class, 'accept']);
    Route::post('/api/meetings/{id}/decline', [MeetingController::class, 'decline']);

    // Leads — open to any event member; controller filters by scanner_user_id
    Route::get('/api/v1/events/{eventId}/my-leads',     [LeadController::class, 'myLeads']);
    Route::post('/api/v1/events/{eventId}/leads/scan',  [LeadController::class, 'scan']);
    Route::put('/api/v1/events/{eventId}/leads/{id}',   [LeadController::class, 'update']);

    // Sponsor-only (legacy + lucky draw)
    Route::middleware('role:sponsor')->group(function () {
        Route::get('/api/sponsor/leads',         [LeadController::class, 'index']);
        Route::post('/api/sponsor/scan',         [LeadController::class, 'scan']);
        Route::patch('/api/sponsor/leads/{id}',  [LeadController::class, 'updateLegacy']);
        Route::post('/api/sponsor/lucky-draw',   [LeadController::class, 'luckyDraw']);
    });
});
```

### Key Migration Tables

| Table | Key columns |
|-------|------------|
| `users` | id, phone, name, email, title, company, role (enum: attendee/sponsor), points, tier, interests (JSON), bio, avatar, profile_complete |
| `otps` | id, phone, code_hash, expires_at, used_at |
| `events` | id, name, code (unique), start_date, end_date, location, description, status |
| `event_users` | event_id, user_id — pivot |
| `sessions` | id, event_id, title, speaker, speaker_title, speaker_company, track, room, day, start_time, end_time, description, tags (JSON), accent_color |
| `session_bookmarks` | user_id, session_id — composite PK |
| `feed_videos` | id, event_id, session_id, title, speaker, company, duration, view_count, accent_color, video_url, is_live |
| `polls` | id, event_id, question, session, points, source (enum: feed/engage) |
| `poll_options` | id, poll_id, text, votes |
| `poll_votes` | user_id, poll_id, option_id — prevent duplicates with unique constraint |
| `challenges` | id, event_id, title, desc, emoji, points, total |
| `challenge_progress` | user_id, challenge_id, progress, completed_at |
| `surveys` | id, event_id, title, desc, question_count, points |
| `survey_submissions` | user_id, survey_id, answers (JSON), submitted_at |
| `giveaways` | id, sponsor_id, event_id, title, ends_at, color |
| `giveaway_entries` | user_id, giveaway_id — unique constraint |
| `sponsors` | id, name, tier, tagline, category, booth_number, tier_color, accent_color, giveaway_prize, website, description, logo_url |
| `leads` | id, scanner_user_id, sponsor_id (nullable), attendee_id, event_id, status (enum: hot/warm/cold), priority (enum: hot/warm/cold — mirror of status, kept for API symmetry), notes (text, nullable), tags (JSON, default `[]`), scanned_at — UNIQUE (scanner_user_id, attendee_id, event_id) for idempotent scans |
| `meetings` | id, requester_id, requestee_id, proposed_time, message, status, created_at |

### Sanctum Setup
```bash
php artisan install:api
```
```php
// config/sanctum.php — ensure mobile domain is in stateful if using cookies
// For token auth (recommended for mobile): no stateful domains needed
```
```php
// Create token: $user->createToken('mobile')->plainTextToken
// Validate:      middleware('auth:sanctum')
```

### Role Middleware
```php
// app/Http/Middleware/RoleMiddleware.php
public function handle(Request $request, Closure $next, string $role): Response {
    if ($request->user()?->role !== $role) {
        return response()->json([
            'success' => false,
            'error' => ['code' => 'FORBIDDEN', 'message' => 'Access denied.']
        ], 403);
    }
    return $next($request);
}
```

### CORS
The mobile app sends requests from the Expo bundler domain. Add your mobile dev/prod domains
to `config/cors.php` → `allowed_origins`.

---

## Go-Live Checklist (Mobile Side)

When the backend is ready, update these two env vars in the Replit mobile project:

```
EXPO_PUBLIC_API_BASE_URL=https://your-laravel-domain.replit.dev
EXPO_PUBLIC_USE_MOCK_API=false
```

Then restart the `Start Mobile` workflow. The mock layer is bypassed entirely when
`EXPO_PUBLIC_USE_MOCK_API` is not the string `"false"`.
