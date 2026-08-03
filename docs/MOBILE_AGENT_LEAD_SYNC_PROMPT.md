# Lead Notes / Tags / Priority — Real-Time Sync

> **Source:** `attached_assets/Pasted-Mobile-Agent-Prompt-Lead-Notes-Tags-Priority-Real-Time-_1785791090639.txt`  
> Applies to: **web app** (`src/`) **and** mobile app (`mobile/`)

## 1 The problem being fixed

The app previously stored notes, tags, and priority in a local device overlay
(localStorage / AsyncStorage) only. The rep could see their notes in the app,
but the values were never reliably sent to the server. The admin export reads
from the `lead_scans` table in the database, which showed NULL for all three
fields.

**Fix:** always flush notes / tags / priority to the server on two occasions:

1. **At scan time** — inline with the `POST /leads/scan` payload
2. **After the rep edits them** — via `PATCH /leads/{scanId}`

---

## 2 API base URL

All endpoints are under `/api/v1/`. Send `Authorization: Bearer {token}` on
every request.

---

## 3 Endpoint reference

### 3.1 Scan a badge and optionally capture notes inline

```
POST /api/v1/events/{eventId}/leads/scan
Content-Type: application/json
Authorization: Bearer {token}

{
  "code":              "ABC123",
  "notes":             "Interested in enterprise plan",
  "tags":              ["follow-up", "vip"],
  "priority":          "HOT",
  "meeting_requested": true
}
```

> `priority` must be uppercase: `"HOT"` | `"WARM"` | `"COLD"` | `null`

**Success response (201 on first scan, 200 on re-scan):**

```json
{
  "success": true,
  "leadId": 2668,
  "lead_id": 2668,
  "isNew": true,
  "is_new": true,
  "notes": "Interested in enterprise plan",
  "tags": ["follow-up", "vip"],
  "priority": "HOT",
  "meeting_requested": false,
  "meetingRequested": false,
  "pointsAwarded": 50,
  "member": { "id": 17377, "name": "...", "company": "..." }
}
```

**What the app must do:**

- Persist `lead_id` / `leadId` to durable storage keyed by
  `(eventId, badgeCode)` — this is the `scanId` for all subsequent calls.
- **Replace the local overlay** with the server-returned `notes`, `tags`,
  `priority`. Do NOT keep showing what the user typed until the server
  confirms. Server is authoritative after any successful response.

---

### 3.2 Edit notes / tags / priority after the initial scan

```
PATCH /api/v1/events/{eventId}/leads/{scanId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "notes":             "Updated note",
  "tags":              ["demo"],
  "priority":          "WARM",
  "meeting_requested": true
}
```

**Rules:**

- `{scanId}` is the `lead_id` / `leadId` from the `POST /leads/scan` response.
- Send only the fields you want to change. Omitting a field leaves it untouched.
- Send `null` for `notes`/`priority`, or `[]` for `tags`, to explicitly clear.
- Only the rep who originally scanned can edit (403 if another user tries).
- Priority must be uppercase: `"HOT"` | `"WARM"` | `"COLD"` | `null`

**Success response (200):**

```json
{
  "success": true,
  "leadId": 2668,
  "lead_id": 2668,
  "notes": "Updated note",
  "tags": ["demo"],
  "priority": "WARM",
  "meeting_requested": true,
  "meetingRequested": true
}
```

**What the app must do:**

- **On success:** replace local overlay with the server response values.
  Call `clearLeadEdit(userId, leadId, code)` to retire the local overlay.
- **On failure:** show an error and set `syncPending: true` on the overlay
  entry — do NOT silently discard it.

---

### 3.3 Fetch a single lead's current server state

```
GET /api/v1/events/{eventId}/leads/{scanId}
Authorization: Bearer {token}
```

**Success response (200):**

```json
{
  "success": true,
  "lead_id": 2668,
  "scan_id": 2668,
  "scanned_at": "2026-08-03T04:19:00+00:00",
  "updated_at": "2026-08-03T10:42:00+00:00",
  "notes": "Updated note",
  "tags": ["demo"],
  "priority": "WARM",
  "meeting_requested": true,
  "profile": { "id": 17377, "name": "...", "email": "...", "company": "..." }
}
```

Use this to hydrate the lead-detail screen after a crash or app reinstall.

---

### 3.4 List all scanned leads for an event

```
GET /api/v1/events/{eventId}/my-leads?page=1&per_page=20
Authorization: Bearer {token}
```

**Success response (200) — paginated:**

```json
{
  "success": true,
  "data": {
    "current_page": 1,
    "data": [
      {
        "scan_id": 2668,
        "scanned_at": "2026-08-03T04:19:00+00:00",
        "updated_at": "2026-08-03T10:42:00+00:00",
        "notes": "Updated note",
        "tags": ["demo"],
        "priority": "WARM",
        "is_inherited": false,
        "meeting_requested": true,
        "profile": { "id": 17377, "name": "...", "company": "..." }
      }
    ],
    "total": 8,
    "per_page": 20,
    "last_page": 1
  }
}
```

> **Important:** Each list row uses `scan_id` (not `id`) as its primary key.
> The `normalizeLead` function must probe `raw.scan_id` **before** falling
> back to `profile.id`, otherwise PATCH calls go to the wrong backend row.

`is_inherited: true` means the notes/tags/priority were copied from a
previous event where the same attendee was scanned. Show a subtle indicator
("from a previous event"). Any PATCH call makes this event own those values
and `is_inherited` becomes false.

---

## 4 The scan_id lifecycle

```
1. Rep scans badge QR code
2. App calls POST /events/{eventId}/leads/scan { code, notes?, tags?, priority? }
3. Server returns { lead_id: 2668, notes, tags, priority, ... }
4. App stores lead_id=2668 keyed by (eventId, badgeCode) in durable storage
5. Rep edits notes on the lead-detail screen
6. App calls PATCH /events/{eventId}/leads/2668 { notes: "new note" }
7. Server returns { notes: "new note", tags: [...], priority: "WARM" }
8. App replaces local overlay with server values (clearLeadEdit)
```

**Do NOT lose the scan_id.** If lost (app reinstall, etc.), use `GET /my-leads`
to recover: the `scan_id` field in each list item is the same ID to use in
PATCH / GET.

---

## 5 When to send enrichment data

### Option A — Inline at scan time (preferred)

If the rep adds notes on the same screen where they scan:

```typescript
const response = await api.post(`/events/${eventId}/leads/scan`, {
  code: decodedBadgeCode,
  notes: notesInput.value || null,
  tags: selectedTags,
  priority: selectedPriority?.toUpperCase() || null,
});
// Store scan_id for subsequent PATCH calls
await storage.set(`scan:${eventId}:${badgeCode}`, response.data.lead_id);
// Server is authoritative — replace local state with confirmed values
setNotes(response.data.notes);
setTags(response.data.tags);
setPriority(response.data.priority?.toLowerCase());
```

### Option B — Edit after scan (lead detail screen)

```typescript
const scanId = await storage.get(`scan:${eventId}:${badgeCode}`);
if (!scanId) {
  // scan_id not found — re-POST (upsert is safe)
  const scanResp = await api.post(`/events/${eventId}/leads/scan`, { code: badgeCode });
  scanId = scanResp.data.lead_id;
  await storage.set(`scan:${eventId}:${badgeCode}`, scanId);
}
const response = await api.patch(`/events/${eventId}/leads/${scanId}`, {
  notes: notesInput.value || null,
  tags: selectedTags,
  priority: selectedPriority?.toUpperCase() || null,
});
// Trust server response — replace local state
setNotes(response.data.notes);
setTags(response.data.tags);
setPriority(response.data.priority?.toLowerCase());
```

---

## 6 Error handling

| HTTP status | Code in body   | Meaning                               | What to do                          |
|-------------|---------------|---------------------------------------|-------------------------------------|
| 401         | —             | Token expired or missing              | Re-authenticate, then retry         |
| 403         | FORBIDDEN     | PATCH on another rep's lead           | Show error, do not retry            |
| 404         | NOT_FOUND     | scanId doesn't exist or wrong event   | Re-POST /leads/scan for a fresh id  |
| 422         | NO_FIELDS     | PATCH body had no recognised fields   | Check field names (see §3.2)        |
| 422         | SELF_SCAN     | Rep scanned their own badge           | Show "cannot scan yourself"         |
| 429         | —             | Rate limited                          | Exponential back-off                |
| 5xx         | —             | Server error                          | Retry up to 3× with back-off        |

On any **network error or 5xx** from PATCH: set `syncPending: true` on the
overlay entry and retry on the next leads-list load. Never silently discard.

---

## 7 Field validation (mirror server rules client-side)

| Field              | Type              | Constraint                                    |
|--------------------|-------------------|-----------------------------------------------|
| `notes`            | string or null    | max 1 000 characters                          |
| `tags`             | string[] or null  | max 20 items; each item max 32 characters     |
| `priority`         | string or null    | `"HOT"` \| `"WARM"` \| `"COLD"` \| `null` (uppercase on the wire) |
| `meeting_requested`| boolean           | —                                             |

---

## 8 Do NOT do these things

- **Do NOT** only store notes in AsyncStorage / localStorage without syncing.
  The admin export reads from the database — local-only means export is blank.
- **Do NOT** omit notes/tags/priority from `POST /leads/scan` if the rep
  entered them at scan time. Inline is the most reliable path.
- **Do NOT** trust the local overlay as authoritative after a successful
  server response. Call `clearLeadEdit` and use the server-echoed values.
- **Do NOT** construct the PATCH URL with the scanned user's profile ID.
  The `{scanId}` is the `lead_scans` primary key (`lead_id` / `scan_id`),
  **not** `profile.id` or `member.id`.
- **Do NOT** call PATCH without the `Authorization` header.

---

## 9 Implementation notes for this codebase

### normalizeLead (both clients)

The `normalizeLead` function in `src/app/api/leadsClient.ts` and
`mobile/lib/api/leads.ts` probes the server row for its primary key. The
probe chain must include `raw.scan_id` and `raw.leadId` **before** falling
back to `profile.id`:

```typescript
const idCandidate =
  raw?.id ?? raw?.lead_id ?? raw?.scan_id ?? raw?.leadId ??
  raw?.attendee_id ?? raw?.member_id ?? raw?.user_id ??
  profile?.id ?? raw?.code ?? ...;
```

### Priority casing

Server accepts and returns uppercase (`"HOT"`, `"WARM"`, `"COLD"`). The
clients store lowercase internally. `normalizeLead` already lowercases
incoming values. All outgoing PATCH/POST bodies must uppercase the priority:

```typescript
body.priority = priority?.toUpperCase() ?? null;
```

### GET /my-leads paginated shape

The list endpoint returns a paginated Laravel collection:
`{ success, data: { current_page, data: [...], total, per_page } }`.
The `listLeads` parsers must probe `data?.data?.data` (nested) when
`data?.data` is not itself an array.

### syncPending retry

On `LeadEditOverlay`, `syncPending: true` means a PATCH failed and needs
retry. The leads-list load effect checks for these entries and retries them
before merging the server list. `clearLeadEdit(userId, leadId, code)` removes
both the id key and the `code:<badge_code>` mirror key when a sync succeeds.

---

## 10 Backend changes already deployed

| What changed | Why |
|---|---|
| All scan endpoints echo back `notes`, `tags`, `priority` | App can replace local state without a second GET |
| `PATCH /leads/{scanId}` accepts `meeting_requested` | Was missing, caused 422 |
| New `GET /leads/{scanId}` endpoint | Verify persistence, hydrate after crash |
| Cache busting fixed | my-leads list reflects edits within 30 s |
| `Cache::increment` wrapped in try/catch | Cache failures no longer cause 500s |
| Cross-event inheritance in `GET /my-leads` | `is_inherited: true` flags inherited values |
