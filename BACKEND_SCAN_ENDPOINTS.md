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

### 2. Save a Scanned Lead

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
    "timestamp": "2026-04-16T10:30:00Z"
  }
}
```

**Notes:**
- The scanner belongs to the **authenticated user** — store `scanned_by: auth()->id()`.
- The `code` field is the scanned badge code. Optionally cross-reference to `event_members.badge_code`.
- `priority` is one of: `hot`, `warm`, `cold`.
- `tags` is a JSON array of strings.

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
PUT /api/v1/events/:eventId/leads/:id
```

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
