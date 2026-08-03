---
name: Lead sync contract
description: How notes/tags/priority reach the server and stay there — scan_id, priority casing, overlay retirement, syncPending retry.
---

# Lead Notes / Tags / Priority Sync Contract

**Why:** The backend stores enrichment in `lead_scans`. If the app never sends notes/tags/priority, the admin CSV export is blank. All sync failures traced back to the scan_id bug below.

## scan_id probe (CRITICAL — root cause of all PATCH failures)

`normalizeLead` in both clients must probe `raw.scan_id` and `raw.leadId` **before** `profile.id`:

```typescript
const idCandidate =
  raw?.id ?? raw?.lead_id ?? raw?.scan_id ?? raw?.leadId ??
  raw?.attendee_id ?? raw?.member_id ?? raw?.user_id ??
  profile?.id ?? ...;
```

**Why:** `GET /my-leads` rows use `scan_id` (not `id`) as the primary key. Without this probe, `normalizeLead` fell through to `profile.id` (the attendee's user ID, e.g. 17360), so PATCH calls went to `/leads/17360` (wrong) instead of `/leads/2702` (correct). This flipped `leadsUpdateEndpointMissing = true` and killed all subsequent edits.

## Priority casing

Server expects **uppercase** on the wire: `"HOT"` | `"WARM"` | `"COLD"` | `null`.
Clients store lowercase internally. `normalizeLead` already lowercases incoming. All outgoing PATCH/POST bodies must uppercase via `toServerPriority()` helper (web: `leadsClient.ts`) or `.toUpperCase()` (mobile: `leads.ts`).

## Paginated GET /my-leads shape

Response is `{ success, data: { current_page, data: [...], total } }`. The `listLeads` parsers must probe `data?.data?.data` (nested) as a fallback when `data?.data` is not itself an array.

## Overlay lifecycle

1. **POST /leads/scan** — include notes/tags/priority inline (§5A); store returned `lead_id` via `saveLeadEdit(uid, leadId, {}, badgeCode)` immediately so PATCH can find it before `/my-leads` lists the row.
2. **PATCH success** — call `clearLeadEdit(uid, leadId, code)` to retire both the `leadId` key and the `code:<badge_code>` mirror key. Server values are authoritative.
3. **PATCH failure (not 404/NOT_IMPLEMENTED)** — set `syncPending: true` on `LeadEditOverlay`.
4. **Next leads-list load** — `LeadsPage` (web) and `useUpdateLead.onSuccess` (mobile) retry entries with `syncPending: true` and call `clearLeadEdit` on success.

## `clearLeadEdit` signature updated

Both `src/app/lib/leadEditsStorage.ts` and `mobile/lib/leadEditsStorage.ts` now accept an optional `code` parameter and delete both the id key and the `code:<badge_code>` mirror key atomically.

## Full spec

See `docs/MOBILE_AGENT_LEAD_SYNC_PROMPT.md` for the complete API reference (POST/PATCH/GET endpoints, field validation, error handling table).
