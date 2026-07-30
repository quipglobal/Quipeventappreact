# Backend Instructions: Universal Badge Scan & Leads Endpoints

## Context

The web/mobile app now has universal badge scanning and lead capture for **all roles** (not just sponsors). Every attendee, sponsor, or any other role can:
1. Show their own QR badge (`My Badge` tab)
2. Scan another person's badge and save them as a lead (`Scan` tab)
3. View and manage their saved contacts (`Leads` tab)

The app's QR payload format (encoded on each user's badge):
```json
{ "id": "<userId>", "badge_code": "<badgeCode>", "event": "<eventCode>" }
```

Admin token for testing: `227|g0oVmrpaJ29S4jm4dFbc6FAtiulHajjzw5Crttkp7b6e65d6`

Test data: memberId=107, userId=137, event=21

---

## Required Endpoints

All endpoints are **event-scoped** and require the authenticated user's Bearer token.

---

### 1. Resolve Badge → Member Profile

Used by the scanner to look up who was scanned from a QR code payload.

```
GET /api/v1/events/:eventId/members?badge_code=:badge_code
```

**Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: 3`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "membership_id": 107,
      "id": 137,
      "name": "Ruk User",
      "title": "Software Engineer",
      "company": { "id": 5, "name": "Acme Corp" },
      "company_name": "Acme Corp",
      "badge_code": "855DM",
      "avatar_url": "https://...",
      "roles": ["ATTENDEE"]
    }
  ]
}
```

> This endpoint may already exist via the existing members listing. If `badge_code` filter is not supported, add it as a query parameter filter.

---

### 2. Save a Scanned Lead (resolves attendee + auto check-in)

```
POST /api/v1/events/:eventId/leads/scan
```

**Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: 3`, `Content-Type: application/json`

**Request body:**
```json
{
  "code": "855DM",
  "name": "Ruk User",
  "company": "Acme Corp",
  "title": "Software Engineer",
  "notes": "Interested in enterprise plan",
  "tags": ["Decision Maker", "Follow Up"],
  "priority": "hot",
  "avatar": "https://..."
}
```

> **Only `code` is required.** All other fields are optional client-supplied
> hints (used as fallbacks if the badge code can't be resolved server-side).
> When the badge code resolves to a known event member, the backend MUST
> overwrite `name`/`title`/`company`/`avatar` with the canonical profile from
> `event_members` so the lead form pre-fills the authoritative values.

**Success response (201):**
```json
{
  "success": true,
  "data": {
    "id": "lead-uuid",
    "code": "855DM",
    "name": "Ruk User",
    "company": "Acme Corp",
    "title": "Software Engineer",
    "notes": "Interested in enterprise plan",
    "tags": ["Decision Maker", "Follow Up"],
    "priority": "hot",
    "avatar": "https://...",
    "timestamp": "2026-04-16T10:30:00Z",

    "pointsAwarded": 10,
    "checkedIn": true,
    "isCheckedIn": true,
    "memberId": 107
  }
}
```

**Required behavior (single round-trip — the client no longer falls back to
member lookup + a separate check-in call when this works):**

1. **Resolve attendee from `code`.** Look up `event_members` for this
   `event_id` where `badge_code = :code`. If a row is found, use its
   canonical `name`, `title`, `company` (object or `company_name`), and
   `avatar_url` for the lead — ignore any conflicting client-supplied
   fields. Include the resolved `memberId` (= `membership_id`) in the
   response.
2. **Auto check-in.** If the resolved member is not currently checked-in
   (status != `ACTIVE` or `joined_at` is null), set
   `status = 'ACTIVE'` and `joined_at = now()` as part of the same
   request. Return `checkedIn: true` when this scan is what flipped them,
   and `isCheckedIn: true` whenever the member is checked-in after the
   call (covers both "we just did it" and "they were already in").
   Already-checked-in attendees: `checkedIn: false`, `isCheckedIn: true`.
3. **Award points.** Look up the event's gamification config for the
   `lead_scan` activity and credit those points to the **scanning** user
   (`auth()->id()`). Echo the points granted as `pointsAwarded` (number,
   `0` if no config / already at daily cap). This must be idempotent per
   `(event_id, scanned_by, badge_code)` — re-scanning the same person
   updates the existing lead row and returns `pointsAwarded: 0`.
4. **If the code does NOT resolve** to any event member, still create
   the lead row using the client-supplied fields (so manual entry / QR
   payloads from other events still work), and return
   `memberId: null`, `checkedIn: false`, `isCheckedIn: false`.

**Notes:**
- The scanner belongs to the **authenticated user** — store `scanned_by: auth()->id()`.
- The `code` field is the scanned badge code; resolution against
  `event_members.badge_code` is now **required**, not optional.
- `priority` is one of: `hot`, `warm`, `cold`.
- `tags` is a JSON array of strings.

---

### 2b. Manual / Idempotent Check-In (client fallback)

```
POST /api/v1/events/:eventId/members/:memberId/check-in
```

**Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: 3`

**Request body:** empty (`{}`)

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "membership_id": 107,
    "status": "ACTIVE",
    "joined_at": "2026-04-23T10:30:00Z"
  }
}
```

**Behavior:**
- Idempotent. If the member is already `ACTIVE` (and `joined_at` set),
  return `success: true` with the existing values — do NOT 4xx.
- Sets `status = 'ACTIVE'` and `joined_at = now()` if not yet checked-in.
- Used by the web/mobile client as a fallback when the scan endpoint
  could not resolve the badge code itself but a subsequent member lookup
  succeeded. Must be safe to call repeatedly.
- Permissions: any authenticated event member can call this (the action
  is performed by a sponsor/staff scanning a badge — it does not require
  audience-list permissions).

---

### 3. List Leads for the Current User

```
GET /api/v1/events/:eventId/leads
```

**Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: 3`

**Success response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead-uuid",
      "code": "855DM",
      "name": "Ruk User",
      "company": "Acme Corp",
      "title": "Software Engineer",
      "notes": "",
      "tags": [],
      "priority": "warm",
      "avatar": "https://...",
      "timestamp": "2026-04-16T10:30:00Z"
    }
  ]
}
```

**Notes:**
- Return only leads scanned **by the authenticated user** for that event.
- Ordered by `timestamp` descending (most recent first).

---

### 4. Update a Lead

```
PATCH /api/v1/events/:eventId/leads/:id
```

> **Note:** The live Laravel backend registers this route as `PATCH` (not `PUT`). A `PUT` request returns HTTP 405. The client must use `PATCH`.

**Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: 3`, `Content-Type: application/json`

**Request body (partial update):**
```json
{
  "notes": "Updated conversation notes",
  "tags": ["Decision Maker"],
  "priority": "hot"
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "id": "lead-uuid",
    "notes": "Updated conversation notes",
    "tags": ["Decision Maker"],
    "priority": "hot"
  }
}
```

**Notes:**
- Only the authenticated user who created the lead should be able to update it (ownership check).

---

### 5. Lucky Draw (Optional)

```
POST /api/v1/events/:eventId/leads/draw
```

**Request body:**
```json
{
  "giveawayId": "optional-giveaway-id",
  "excludeIds": ["lead-uuid-1", "lead-uuid-2"]
}
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "id": "lead-uuid",
    "name": "Winner Name",
    "company": "Winner Co",
    "title": "CEO",
    "avatar": "https://..."
  }
}
```

---

### 6. Save Giveaway Winner

```
POST /api/v1/events/:eventId/giveaways/:giveawayId/winners
```

**Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: 3`,
`Accept: application/json`, `Content-Type: application/json`

Notifies the backend that a winner has been picked for a giveaway —
either server-arbitrated (via `/leads/draw` once it ships) or, in the
meantime, by the in-app client-side fallback. The frontend POSTs this
fire-and-forget after every successful Lucky Draw resolve so the win
gets persisted in the DB and surfaces on subsequent
`GET /events/:id/giveaways` responses under each giveaway's `winners`
array (where the frontend already merges them with its local overlay).

**Request body** (the frontend sends camelCase + snake_case
duplicates of every field, so either backend convention works without
a contract change here — pick whichever pair you read on the server):
```json
{
  "id": "lead-uuid",
  "winner_id": "lead-uuid",
  "winnerId": "lead-uuid",
  "lead_id": "lead-uuid",
  "leadId": "lead-uuid",
  "name": "Winner Name",
  "company": "Winner Co",
  "title": "CEO",
  "avatar": "https://...",
  "avatar_url": "https://...",
  "drawn_at": "2026-04-30T19:42:11.000Z",
  "drawnAt": "2026-04-30T19:42:11.000Z"
}
```

**Success response (200 / 201):**
```json
{ "success": true }
```

**Notes:**
- The `id` / `lead_id` is the attendee/lead row that was selected.
- Idempotency: if the same `(giveaway_id, winner_id)` pair already
  exists, treat as a no-op and return success — the frontend may
  retry on poor connectivity.
- `GET /events/:id/giveaways` SHOULD include each saved winner under
  the giveaway's `winners` array so other devices and the back-office
  see the same list. The frontend keys on winner `id` for dedupe
  against its local overlay.
- Until this route is deployed the frontend short-circuits on
  404/405 and only persists locally — no UI degradation, but
  cross-device sync stays per-device.

---

### 7. Event Leaderboard

#### `GET /api/v1/events/{eventId}/leaderboard?period=overall|today|week&limit=50`

Returns the points ranking for the given event. Powers both the
home-screen Top-3 preview and the full Leaderboard page. The
frontend caches the result in `AppContext` and refreshes on event
change + period-pill clicks.

**Query parameters**

| Param   | Type    | Default   | Notes                                               |
| ------- | ------- | --------- | --------------------------------------------------- |
| period  | string  | `overall` | One of `overall`, `today`, `week`. Backend may ignore — UI treats as a hint. |
| limit   | integer | `50`      | Max rows to return. Frontend asks for 50.            |

**Success response**

```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "userId": "137",
      "name": "Sarah Martinez",
      "company": "TechFlow Inc.",
      "title": "Head of Growth",
      "avatar": "https://…/avatars/137.jpg",
      "points": 485,
      "tier": "Gold",
      "change": 0
    }
  ]
}
```

**Field tolerance** — the frontend normalizer accepts both
camelCase and snake_case (`user_id`, `full_name`, `total_points`,
`avatar_url`, `rank_change`, etc.) and unwraps `{ data: [] }`,
`{ leaderboard: [] }`, or `{ entries: [] }` envelopes, so the
existing v1 collection convention works without changes.

**Tier values** — must be one of `Bronze`, `Silver`, `Gold`,
`Platinum`. Anything else is coerced to `Bronze` client-side.

**Notes**

- `change` is the rank delta vs. the previous tick (positive = moved
  up). Optional — omit and the UI hides the indicator.
- `userId` MUST match the id returned by `/api/v1/auth/me` so the
  current user's row is highlighted and the home-page "Your Rank"
  pill picks up their real position.
- 404 / 405 from this endpoint flips a session flag and the UI
  renders the empty-state ("No rankings yet, earn points by …")
  until the user re-enters the event.

---

### 8. Meeting Requests (Connect tab)

The Connect/Message tab issues a meeting request from one attendee
to another. After the recipient accepts, a chat conversation opens.
Until then chat is disabled — the UI explicitly gates on
`status === 'accepted'` before showing the chat panel.

**Routes** (all event-scoped, multi-tenant via `X-Tenant-ID` header).
These match what the deployed Laravel backend already exposes —
verified live with method probes on April 30, 2026:

```
GET   /api/v1/events/:eventId/my-meetings                                  → list inbox
POST  /api/v1/events/:eventId/meeting-requests              body: { to_user_id, message? }
PATCH /api/v1/events/:eventId/meeting-requests/:id/respond  body: { status: 'accepted' | 'declined' }
```

**Response shape — list (`GET /my-meetings`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "from_user_id": 17,
      "to_user_id": 23,
      "status": "pending",                   // pending | accepted | declined
      "message": "Hey, let's connect about the AI panel",
      "created_at": "2026-04-30T12:34:56Z",
      "from_user": {
        "id": 17,
        "name": "Jane Doe",
        "title": "VP Engineering",
        "company": { "name": "Acme" },
        "avatar_url": "https://…"
      },
      "to_user":   { "id": 23, "name": "John Smith", "company": { "name": "BetaCo" }, "avatar_url": "…" }
    }
  ]
}
```

The backend does **not** ship a per-row `direction` flag — the
client computes incoming-vs-outgoing by comparing
`from_user.id === currentUserId`. The `currentUserId` is plumbed
through `listMeetingRequests` so this is deterministic.

**Response shape — send (`POST /meeting-requests`)**:
Same row shape as above, returned either bare or wrapped in
`{ data: {...} }`. The client tolerates both.

**Notes**:
- The client coerces numeric ids to strings everywhere and accepts
  envelope shapes `data` / `requests` / `meeting_requests` /
  `meetings` / `items`.
- For a tenant where these routes ever 404/405, the client falls
  back to a `NOT_IMPLEMENTED` mode that keeps the optimistic row
  locally and is up-front about the degraded state in the toast.

---

### 9. Messages (encrypted)

Each accepted connection becomes a *conversation*. Message bodies
are **encrypted on the client** (AES-GCM 256, key derived per
conversation via HKDF-SHA256 from `connectionId + sorted user ids`).
The server only ever sees `{ ciphertext, iv, scheme }` — a database
scrape leaks no plaintext.

**Threat model**:

- ✓ Defends against passive at-rest leaks (DB backups, logs).
- ✗ NOT full forward-secrecy E2E. The server knows the participant
  ids and the connection id, so a fully malicious server could
  re-derive the key. Treat this as a meaningful upgrade over
  plaintext-on-server, not as a Signal-grade guarantee.
- **Hardening path**: when the backend can store per-user public
  keys, swap the deterministic derivation for an ECDH key exchange.
  The wire format and client API stay the same — only the key
  resolution step changes.

**Routes**:

```
GET    /api/v1/events/:eventId/conversations
GET    /api/v1/events/:eventId/conversations/:cid/messages?since=<unix_ms>
POST   /api/v1/events/:eventId/conversations/:cid/messages
PUT    /api/v1/events/:eventId/conversations/:cid/messages/:mid
DELETE /api/v1/events/:eventId/conversations/:cid/messages/:mid
```

**Wire format** (request body for POST / PUT, persisted as-is):
```json
{
  "ciphertext": "<base64>",
  "iv":         "<base64, 12 bytes>",
  "scheme":     "aes-gcm-hkdf-v1"
}
```

The server **must not** attempt to decode `ciphertext`. Treat it as
opaque bytes. The `scheme` field is reserved for future format
revisions.

**Response shape — message resource**:
```json
{
  "id":          "msg_99",
  "sender_id":   "17",
  "ciphertext":  "<base64>",      // null when soft-deleted
  "iv":          "<base64>",
  "scheme":      "aes-gcm-hkdf-v1",
  "created_at":  "2026-04-30T12:35:01Z",
  "edited_at":   "2026-04-30T12:36:10Z",   // present iff edited
  "deleted_at":  null                       // populated on soft delete
}
```

**Edit / delete semantics**:
- `PUT` replaces the ciphertext + IV (a fresh nonce per edit) and
  bumps `edited_at`. The client renders "(edited)" beside the bubble.
- `DELETE` is a *soft* delete: the row remains but `ciphertext`
  becomes `null` and `deleted_at` is populated, so both participants
  see a "Message deleted" placeholder rather than a hole in history.

**Undo window**: the client buffers each just-sent message for 5
seconds before firing the POST. If the user hits Undo within that
window, the encrypted POST never happens. Backend doesn't need to
care — by the time it sees the request, the user has committed.

**NOT_IMPLEMENTED fallback**: same posture as Connections — the
client short-circuits on the first 404/405 and keeps the
conversation in-memory only, so the UX still demos cleanly without
the routes deployed.

---

### 10. Sponsor Giveaways (CRUD)

The frontend has a full giveaway management surface for sponsors and a
read-only attendee view. All four methods are needed. The list endpoint
is the most critical — it is called on every event switch to populate
**both** the sponsor management UI and the public attendee Giveaways
page.

#### CRITICAL — no date filtering

The `GET` route **MUST NOT** filter giveaways by the event's
`end_date`, the giveaway's own `end_date`, or any `active` / `status`
flag. Giveaways added by a sponsor rep must remain visible to all
attendees regardless of whether the event has ended. The frontend
relies on a blanket "show everything the backend returns" policy — any
server-side date filter produces an empty list that the user sees as
"no giveaways yet" even when prizes exist.

```
GET    /api/v1/events/:eventId/giveaways
POST   /api/v1/events/:eventId/giveaways          (sponsor/organizer only)
PUT    /api/v1/events/:eventId/giveaways/:id      (sponsor/organizer only)
DELETE /api/v1/events/:eventId/giveaways/:id      (sponsor/organizer only)
```

**GET response** (`200`):

```json
{
  "success": true,
  "data": [
    {
      "id": "42",
      "title": "MacBook Pro Raffle",
      "number_of_items": 3,
      "numberOfItems": 3,
      "image": "https://...",
      "sponsor_name": "Acme Corp",
      "sponsorName": "Acme Corp",
      "sponsor_id": "17",
      "sponsorId": "17",
      "created_at": "2026-04-30T10:00:00Z",
      "winners": [
        {
          "id": "lead-uuid",
          "name": "Jane Doe",
          "company": "TechCo",
          "title": "CTO",
          "avatar": "https://...",
          "drawn_at": "2026-04-30T15:00:00Z"
        }
      ]
    }
  ]
}
```

Field tolerance: the frontend normalizer accepts both camelCase and
snake_case variants. `winners` is optional — omit the key (or send
`[]`) if the winners sub-table hasn't been deployed yet; the frontend
will merge from its local overlay.

**POST request body**:

```json
{
  "title": "MacBook Pro Raffle",
  "number_of_items": 3,
  "numberOfItems": 3,
  "total_count": 3,
  "totalCount": 3,
  "prize_count": 3,
  "prizeCount": 3,
  "items_count": 3,
  "itemsCount": 3,
  "total_items": 3,
  "totalItems": 3,
  "quantity": 3,
  "count": 3,
  "image": "https://...",
  "sponsor_name": "Acme Corp",
  "sponsorName": "Acme Corp",
  "sponsor_id": "17",
  "sponsorId": "17"
}
```

> **⚠️ BACKEND BUG — Gift count not persisting to DB.**
> The frontend sends the giveaway item count under every common field
> name listed above (`number_of_items`, `quantity`, `total_count`,
> `count`, `prize_count`, `items_count`, `total_items` — both
> snake_case and camelCase). Despite this, the field is saved as `0`
> or `null` in the database, meaning the backend controller is NOT
> mapping any of these keys to its DB column.
>
> **Backend action required:**
> 1. Open the `GiveawayController@store` (and `@update`) method.
> 2. Find the DB column that stores the prize quantity (commonly
>    `number_of_items`, `quantity`, or `total_count` depending on the
>    migration).
> 3. Ensure that column is in the model's `$fillable` array.
> 4. Add a `validated()` / `request()->input()` mapping from the
>    request key to the column, e.g.:
>    `$giveaway->number_of_items = $request->input('number_of_items', $request->input('quantity', 0));`
> 5. Confirm the same field is returned in the `GET` response so the
>    frontend normalizer can read it back (field name must be one of
>    those listed in the GET response shape above).

**POST response** (`201`): same shape as a single item in the GET
array, including the server-issued `id`. The frontend swaps the
optimistic temp id for this canonical id immediately on receipt.

**PUT request body**: same shape as POST, partial — only the fields to
update need to be supplied.

**PUT / DELETE responses**: `{ "success": true }` is sufficient; the
frontend updates its in-memory state optimistically and only rolls back
on a non-success, non-NOT_IMPLEMENTED error.

**Authorization**: `POST / PUT / DELETE` require the caller's membership
role to be `sponsor` or `organizer` for the given event. `GET` is open
to any authenticated event member (attendees AND sponsors).

**Notes**:
- If the routes are not yet deployed, a `404` / `405` from `GET`
  flips a session-scoped flag and all subsequent write attempts
  short-circuit to `NOT_IMPLEMENTED` — the frontend keeps the
  sponsor's locally-added giveaways in memory and shows a degraded
  but working UI until the routes go live.
- The `winners` sub-resource is documented separately in §6.

---

## Database Schema (suggested)

```sql
CREATE TABLE event_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      BIGINT NOT NULL REFERENCES events(id),
  scanned_by    BIGINT NOT NULL REFERENCES users(id),
  badge_code    VARCHAR(50),
  name          VARCHAR(255) NOT NULL,
  company       VARCHAR(255),
  title         VARCHAR(255),
  notes         TEXT DEFAULT '',
  tags          JSON DEFAULT '[]',
  priority      ENUM('hot', 'warm', 'cold') DEFAULT 'warm',
  avatar_url    VARCHAR(500),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (event_id, scanned_by, badge_code)
);
```

---

## Error Responses

All errors follow the existing API shape:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Lead not found or access denied."
  }
}
```

HTTP status codes: 401 (unauthenticated), 403 (forbidden), 404 (not found), 422 (validation error), 500 (server error).

---

### 11. Reader / Articles API

Used by both the web and mobile apps to display curated articles and track reading behaviour.

**Authentication:** `Authorization: Bearer <token>` required on all routes.
**Headers:** `Accept: application/json` — routes are tenant-scoped via the auth token; no `X-Tenant-ID` needed.

> Only **PUBLISHED** documents are returned — drafts are invisible to these endpoints.

---

#### 11a. List Article Categories

```
GET /api/v1/mobile/reader/categories
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Technology", "slug": "technology", "color": "#06b6d4", "document_count": 12 },
    { "id": 2, "name": "Business",    "slug": "business",    "color": "#f59e0b", "document_count": 8  }
  ]
}
```

> Field aliases accepted by the client: `title` → `name`, `accent_color` → `color`, `documents_count` / `count` → `document_count`.

---

#### 11b. List Articles (Documents)

```
GET /api/v1/mobile/reader/documents?category_id=:id&page=:n&per_page=:n&search=:q
```

All query params optional. Default `per_page`: 20.

**Response `200` — canonical shape (new):**
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "title": "State of AI 2025",
      "author_name": "Jane Smith",
      "category": "Technology",
      "short_description": "A deep dive into the trends shaping AI this year.",
      "pdf_url": "https://storage.googleapis.com/...?X-Goog-Signature=...&Expires=...",
      "cover_image_url": "https://cdn.example.com/articles/12.jpg",
      "created_at": "2025-07-15T10:00:00+00:00",
      "updated_at": "2025-07-15T10:00:00+00:00"
    }
  ],
  "meta": { "current_page": 1, "last_page": 3, "per_page": 20, "total": 52 }
}
```

**`pdf_url` storage backends (resolved by backend before sending):**

| Storage type | What's in DB | What `pdf_url` contains |
|---|---|---|
| Object Storage (new) | `objstore:reader-pdfs/t3_abc123.pdf` | Signed GCS URL, valid ~1 hour |
| Legacy local disk | `reader-pdfs/t1_abc123.pdf` | Full `https://…/storage/reader-pdfs/…` URL |
| External URL | `null` storage path, `pdf_url` column set | That URL directly |

> **`pdf_url` is always pre-resolved by the backend** — clients must never attempt to resolve `objstore:` paths themselves. `pdf_url` is `null` when no PDF is attached (draft or HTML-only) — hide the "Read PDF" button in that case.
>
> **Signed URLs expire in ~1 hour.** Always fetch `GET /documents/:id` fresh immediately before opening the PDF viewer rather than reusing a cached `pdf_url`.

> Legacy field aliases still accepted by the client normaliser: `file_url`/`document_url`/`attachment_url` → mapped to `pdfUrl`; `thumbnail_url`/`cover_image`/`featured_image` → mapped to `thumbnailUrl`; `excerpt`/`description`/`summary` → mapped to `excerpt`; `author` (object or string) → mapped to `authorName`; nested `category` object → `categoryName`.

---

#### 11c. Get Single Article

```
GET /api/v1/mobile/reader/documents/{id}
```

Same resource shape as the list. The detail endpoint must return the **full** content body; the list response may omit it for performance.

---

#### 11d. Analytics Event (impression / click / open)

```
POST /api/v1/mobile/reader/analytics/event
```

Fired by the client at three lifecycle points:

| When | `event_type` |
|---|---|
| Article card becomes visible in the list | `impression` |
| User taps a card | `click` |
| Reader screen finishes loading the article | `open` |

**Request body:**
```json
{ "event_type": "click", "article_id": 42 }
```

**Response `200`:**
```json
{ "success": true }
```

Fire-and-forget from the client — failures are silently discarded, never surfaced to the user.

---

#### 11e. Submit Read Session

```
POST /api/v1/mobile/reader/analytics/read-session
```

**Safe to re-send** — the server must upsert by `session_id` (merge, not insert). The client fires this on:
- Reader close / navigate away
- App going to background
- Scroll reaching 50 % milestone
- Scroll reaching 90 % milestone

**Request body:**
```json
{
  "session_id":            "web-lbqx4z-k8f2a",
  "article_id":            42,
  "click_count":           1,
  "active_read_seconds":   183,
  "total_elapsed_seconds": 240,
  "max_scroll_percent":    74,
  "started_at":            "2026-05-14T18:32:00.000Z",
  "ended_at":              "2026-05-14T18:36:00.000Z",
  "completed":             false
}
```

| Field | Type | Description |
|---|---|---|
| `session_id` | string | Client-generated unique ID per article open |
| `article_id` | integer | The document id |
| `click_count` | integer | Always `1` per session |
| `active_read_seconds` | integer | Seconds the app was foregrounded with article visible |
| `total_elapsed_seconds` | integer | Wall-clock seconds open → latest send |
| `max_scroll_percent` | integer | 0–100; deepest scroll point reached |
| `started_at` | ISO-8601 | When the article was opened |
| `ended_at` | ISO-8601 | Timestamp of this particular send |
| `completed` | boolean | `true` when scroll ≥ 80 % or active time ≥ 80 % of read_time |

**Response `200`:** `{ "success": true }`

---

#### 11f. Client behaviour notes

- **NOT_IMPLEMENTED short-circuit**: First 404/405 from `GET .../categories` or `GET .../documents` flips a session-scoped flag; all subsequent calls short-circuit and the UI shows an empty state.
- **Analytics are fire-and-forget**: All `POST .../analytics/*` failures are silently discarded.
- **Field normalisation**: Accepts both camelCase and snake_case variants (see aliases above).
- **Auth**: All routes require a valid Bearer token.
