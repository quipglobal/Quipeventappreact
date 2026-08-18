---
name: Giveaway API contracts
description: Exact endpoint URLs, request shapes, and gotchas for the giveaway + draw module, confirmed by the backend agent.
---

## Endpoint URLs

| Verb | URL | Who |
|---|---|---|
| GET | `/api/v1/events/:id/giveaways` | Admin / sponsor rep (requires admin/organizer/sponsor role) |
| POST | `/api/v1/events/:id/giveaways` | Admin / sponsor rep |
| PUT | `/api/v1/events/:id/giveaways/:gid` | Admin / sponsor rep (PUT only, no PATCH) |
| DELETE | `/api/v1/events/:id/giveaways/:gid` | Admin / sponsor rep |
| POST | `/api/v1/events/:id/giveaways/:gid/draw` | Admin / sponsor rep — server picks random winner |
| POST | `/api/v1/events/:id/giveaways/:gid/winners` | Admin / sponsor rep — client picks, server records |
| GET | `/api/v1/events/:id/mobile-giveaways` | Attendees (event.member middleware) |

## Key contracts

### POST /giveaways (create)
- `company_id` (integer, required for sponsor reps) — NOT `sponsor_id`
- Returns 201 with the full created row under `{ success, data }`.

### POST /giveaways/:id/winners
- Only accepts `{ winner_user_id: integer }` — nothing else.
- `winner_user_id` MUST have an entry in the giveaway (via scan/auto-enter). Returns 422 NO_ENTRY if not.
- Idempotent: if already DRAWN, returns 200 with `was_already_drawn: true`.
- Returns the full updated giveaway row.

### POST /giveaways/:id/draw
- Server picks randomly from the giveaway's entry list.
- Returns the full updated giveaway row with `winner: { id, name, email, company }` populated.
- The `winner.id` IS the user_id integer — use it directly as `winner_user_id` if you also call /winners (redundant but safe, idempotent).

### GET /mobile-giveaways (attendees)
- Returns `has_entered`, `is_winner`, `is_drawn` boolean flags per attendee.
- Single `winner` object (not array) — non-null only when DRAWN.
- DRAFT giveaways never returned.

### /leads/draw — DOES NOT EXIST
The backend confirmed there is no `/leads/draw` endpoint. The old client code pointing at that URL was completely wrong. Fixed to call `/giveaways/:id/draw`.

## normalizeGiveaway quirks
- `company_id` → `sponsorId`, `company_name` → `sponsorName` (canonical fields)
- Single `winner` object → converted to single-item `winners` array (with `userId = winner.id`)
- `created_by_user_id` → also mapped to `sponsorId` as fallback

## DrawParticipant / Lead userId chain
- `Lead.userId` = backend user_id (separate from scan_id which is `Lead.id`).
- `basePool` in `SponsorDrawPage` maps Lead→DrawParticipant; MUST copy `userId` or the local fallback loses it.
- Local fallback uses `w.userId ?? w.id` as the DrawWinner id. `saveGiveawayWinner` receives `winner_user_id = parseInt(userId)`.
- `parseInt` must succeed (integer user_id); if userId is a non-numeric scan_id, the /winners POST is skipped gracefully.

**Why:** The /winners endpoint requires an integer user_id. Leads have both a scan_id (primary key of lead_scans) and a user_id (the attendee's account). These are different and must be propagated separately through the draw flow.
