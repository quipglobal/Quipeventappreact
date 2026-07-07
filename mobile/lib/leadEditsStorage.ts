import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-user, per-lead overlay storage for the editable fields the backend
 * doesn't yet reliably persist (notes, tags, priority). Mirrors the web
 * `src/app/lib/leadEditsStorage.ts` pattern, but backed by AsyncStorage.
 *
 * Why this exists:
 *   The leads cache (`leadsStorage.ts`) holds whole Lead rows scoped by
 *   (user, event). On a successful `GET /my-leads` refetch the merge
 *   prefers the server row, which would wipe a locally-edited note/tag/
 *   priority the backend hasn't persisted yet. Storing ONLY the three
 *   editable fields here — keyed by (userId, leadId) plus a `code:<code>`
 *   mirror — lets the leads hook overlay the user's edits back on top of
 *   the server response so they survive refetch and logout → login.
 *
 * Storage shape:
 *   AsyncStorage key: `cxo:lead_edits:v1:<userId>`
 *   value:            JSON `{ [leadId | code:<code>]: { notes?, tags?, priority? } }`
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

function keyFor(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

/**
 * Build the secondary lookup key used when the lead `id` differs between
 * scan-time and a later list-fetch (the backend sometimes returns a
 * different identifier for the same lead). Indexing by badge code lets the
 * overlay still find the user's edits.
 */
function codeKey(code: string): string {
  return `code:${code.toLowerCase()}`;
}

/**
 * Load the user's edit overlay map. Resolves to `{}` on any failure path
 * (no storage, no userId, malformed JSON, wrong root type) so callers can
 * use the result directly without guarding. Never rejects.
 */
export async function loadLeadEdits(userId: string | null | undefined): Promise<LeadEditsMap> {
  if (!userId) return {};
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as LeadEditsMap;
  } catch {
    return {};
  }
}

/**
 * Persist a single lead's edits. Only the fields explicitly present in
 * `edits` are written (so passing `{ notes }` won't clobber a previously
 * stored `tags`). Silently no-ops without a userId so anonymous edits
 * never land in a user-scoped slot.
 *
 * When `code` is provided the edits are mirrored under a secondary
 * `code:<lower(code)>` key so the overlay can still find them if the
 * lead's id changes between scan-time and the next list fetch.
 */
export async function saveLeadEdit(
  userId: string | null | undefined,
  leadId: string,
  edits: Partial<LeadEditOverlay>,
  code?: string | null,
): Promise<void> {
  if (!userId || !leadId) return;
  try {
    const current = await loadLeadEdits(userId);
    const apply = (slotKey: string) => {
      const merged: LeadEditOverlay = { ...(current[slotKey] ?? {}) };
      if ('notes' in edits) merged.notes = edits.notes;
      if ('tags' in edits) merged.tags = edits.tags;
      if ('priority' in edits) merged.priority = edits.priority;
      current[slotKey] = merged;
    };
    apply(leadId);
    if (code && code.trim() !== '') apply(codeKey(code.trim()));
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(current));
  } catch {
    // Storage quota / disabled — the in-memory (React Query) cache still
    // has the edit for this session; only cross-session persistence is lost.
  }
}

/**
 * Look up an overlay entry for a lead, trying the `id` first and falling
 * back to the `code:<code>` mirror key. Returns `undefined` when neither
 * key is present.
 */
export function lookupLeadEdit(
  overlay: LeadEditsMap,
  leadId: string,
  code?: string | null,
): LeadEditOverlay | undefined {
  if (overlay[leadId]) return overlay[leadId];
  if (code && code.trim() !== '') {
    const k = codeKey(code.trim());
    if (overlay[k]) return overlay[k];
  }
  return undefined;
}

/**
 * Drop a single lead's overlay entry. Exposed for completeness; currently
 * unused because we deliberately keep edits across logout so the same user
 * logging back in sees their own work.
 */
export async function clearLeadEdit(
  userId: string | null | undefined,
  leadId: string,
): Promise<void> {
  if (!userId || !leadId) return;
  try {
    const current = await loadLeadEdits(userId);
    if (!(leadId in current)) return;
    delete current[leadId];
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(current));
  } catch {
    // ignore
  }
}
