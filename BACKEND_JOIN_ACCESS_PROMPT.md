# Backend Agent Prompt: Event Join & Access Endpoints

## Context
The mobile and web apps at `app.cxocollaborate.com` are experiencing two bugs for user `rukmint1011@gmail.com`:
1. **Join code re-prompted on every event access** — user enters a code, joins the event, goes back to the event list, taps the same event, and is asked for the code again.
2. **"Couldn't load audience" error** on the Audience/Directory tab after joining.

Both bugs trace back to the same root cause: the backend either (a) is not recording the user's membership correctly after a join, or (b) the membership-check endpoint is not yet deployed / returning incorrect data.

---

## Required Backend Work

### 1. POST /api/v1/events/join — accept BOTH `code` and `event_code` fields

The apps now send both fields for backward compat:
```json
{ "event_code": "ABC123", "code": "ABC123" }
```

**Action:** Ensure the route handler reads `event_code` first and falls back to `code`:
```php
$code = $request->input('event_code') ?? $request->input('code');
```

If only one field is read, the join silently returns 404 → user never gets registered → audience returns 403 → "Couldn't load audience".

**Expected response (200 or 201):**
```json
{
  "success": true,
  "message": "Joined successfully",
  "auto_checked_in": true,
  "role": "attendee",
  "event_id": 28,
  "membership_id": 107,
  "event": {
    "id": 28,
    "name": "CXO Summit 2026",
    "code": "CXOS26",
    "slug": "cxo-summit-2026",
    "status": "live"
  }
}
```

**On duplicate join (user already a member):** Return `409 Conflict` (or `200` with a message like `"already a member"`) — do NOT return a hard error that blocks entry.

---

### 2. GET /api/v1/events/{eventId}/access — deploy this endpoint

The apps call this before showing the event code gate. If deployed and returning correct data, users who already joined will never be asked for a code again.

**Route:** `GET /api/v1/events/{eventId}/access`
**Auth:** Bearer token required
**Headers:** `X-Tenant-ID: 3`

**Response when user IS a member:**
```json
{
  "success": true,
  "data": {
    "is_member": true,
    "membership_id": "107",
    "role": "attendee",
    "status": "active",
    "joined_at": "2026-07-15T10:00:00Z",
    "event": {
      "id": 28,
      "name": "CXO Summit 2026",
      "slug": "cxo-summit-2026",
      "status": "live",
      "requires_code": true
    }
  }
}
```

**Response when user is NOT a member:**
```json
{
  "success": true,
  "data": {
    "is_member": false,
    "membership_id": null,
    "role": null,
    "status": null,
    "joined_at": null,
    "event": {
      "id": 28,
      "name": "CXO Summit 2026",
      "slug": "cxo-summit-2026",
      "status": "live",
      "requires_code": true
    }
  }
}
```

**IMPORTANT:** This endpoint must ALWAYS return HTTP 200 — never 403/404 — regardless of membership status. The `is_member` boolean is the gate, not the HTTP status.

---

### 3. POST /api/v1/events/{eventId}/self-check-in — deploy this endpoint

After joining, the app fires a self check-in so the user appears in the audience "Checked In" list. This endpoint is idempotent — safe to call multiple times.

**Route:** `POST /api/v1/events/{eventId}/self-check-in`
**Auth:** Bearer token (resolves membership from token — no memberId in body)
**Headers:** `X-Tenant-ID: 3`
**Body:** `{}` (empty)

**Response:**
```json
{
  "success": true,
  "message": "Checked in successfully",
  "checked_in_at": "2026-07-16T10:00:00Z"
}
```

If already checked in, return `200` with the same shape (idempotent, not an error).

---

### 4. GET /api/v1/events/{eventId}/attendees — ensure members can access

The Audience tab calls:
```
GET /api/v1/events/{eventId}/attendees?per_page=100&checked_in_only=false
GET /api/v1/events/{eventId}/attendees?per_page=100&checked_in_only=true
```

**Requirements:**
- Any authenticated user who is a **member** of the event (active membership) should receive 200 with the audience list.
- The `checked_in_only` query parameter should be supported: `false` = all registered members, `true` = only members with a `joined_at` timestamp (checked in).
- Do NOT return 403 for users who are members. If `checked_in_only` is not yet supported, ignore the parameter and return all members.

---

## Test User
- **Email:** rukmint1011@gmail.com
- **Events to test:** IDs 21, 28, 53 (CXO tenant = 3)

## Quick Verification
1. POST `/api/v1/events/join` with `{ "event_code": "CXOS26", "code": "CXOS26" }` → should return 200/201 with `membership_id`
2. GET `/api/v1/events/28/access` → should return `{ "data": { "is_member": true } }` for rukmint1011@gmail.com
3. GET `/api/v1/events/28/attendees?per_page=10` → should return 200 with member list (not 403)
