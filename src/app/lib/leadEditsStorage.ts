/**
 * Per-user, per-lead overlay storage for the editable fields the backend
 * doesn't yet persist (notes, tags, priority).
 *
 * Why this exists:
 *   The leads cache (`leadsStorage.ts`) holds whole Lead rows including
 *   `pendingSync` flags. We deliberately wipe that cache on user change
 *   so a different user on the same device can't see the prior user's
 *   un-synced rows.
 *
 *   But the main leads CRUD bug — "I edited a lead's notes, logged out,
 *   logged back in, and my notes are gone" — needs the user's own edits
 *   to survive logout/login until the backend ships notes/tags/priority
 *   persistence on its v1 leads endpoints.
 *
 *   So we store ONLY the three editable fields here, keyed by
 *   (userId, leadId). They're overlaid on top of the backend response by
 *   the LeadsPage merge so the UI shows the user's edits even when the
 *   backend echo is empty.
 *
 * Storage shape:
 *   localStorage key: `cxo:lead_edits:v1:<userId>`
 *   value:            JSON `{ [leadId]: { notes?, tags?, priority? } }`
 *
 * Cross-account isolation is preserved by the user-scoped key.
 */

export type LeadEditOverlay = {
  notes?: string;
  tags?: string[];
  priority?: 'hot' | 'warm' | 'cold';
};

export type LeadEditsMap = Record<string, LeadEditOverlay>;

const KEY_PREFIX = 'cxo:lead_edits:v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function keyFor(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

/**
 * Load the user's edit overlay map. Returns `{}` on any failure path
 * (no storage, no userId, malformed JSON, wrong root type) so callers
 * can use the result directly without guarding.
 */
export function loadLeadEdits(userId: string | null | undefined): LeadEditsMap {
  if (!isBrowser() || !userId) return {};
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as LeadEditsMap;
  } catch {
    return {};
  }
}

/**
 * Persist a single lead's edits. Pass `undefined` for any field you
 * don't want to change — only the fields explicitly provided are
 * written. Pass `null` for `notes` to clear it; pass `[]` for `tags`
 * to clear them. Silently no-ops without a userId so anonymous edits
 * never land in a user-scoped slot.
 */
export function saveLeadEdit(
  userId: string | null | undefined,
  leadId: string,
  edits: Partial<LeadEditOverlay>,
): void {
  if (!isBrowser() || !userId || !leadId) return;
  try {
    const current = loadLeadEdits(userId);
    const merged: LeadEditOverlay = { ...(current[leadId] ?? {}) };
    if ('notes' in edits) merged.notes = edits.notes;
    if ('tags' in edits) merged.tags = edits.tags;
    if ('priority' in edits) merged.priority = edits.priority;
    current[leadId] = merged;
    window.localStorage.setItem(keyFor(userId), JSON.stringify(current));
  } catch {
    // Storage quota / disabled — the in-memory state still has the edit
    // for this session, only the cross-session persistence is lost.
  }
}

/**
 * Drop a single lead's overlay entry — call this when the backend echo
 * confirms persistence so we don't permanently mask a future server-side
 * edit (e.g. from another device) with a stale local value.
 */
export function clearLeadEdit(userId: string | null | undefined, leadId: string): void {
  if (!isBrowser() || !userId || !leadId) return;
  try {
    const current = loadLeadEdits(userId);
    if (!(leadId in current)) return;
    delete current[leadId];
    window.localStorage.setItem(keyFor(userId), JSON.stringify(current));
  } catch {
    // ignore
  }
}

/**
 * Wipe the entire overlay map for a user. Currently unused — we
 * deliberately keep edits across logout so the same user logging
 * back in sees their own work — but exposed for completeness in case
 * a "reset all" flow is ever added.
 */
export function clearAllLeadEdits(userId: string | null | undefined): void {
  if (!isBrowser() || !userId) return;
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}
