/**
 * Per-event localStorage overlay for lucky-draw winners.
 *
 * Why: the backend may not (yet) persist the winner-per-giveaway
 * relationship. The draw endpoint (`POST /events/:id/leads/draw`)
 * records the pick server-side, but the giveaway list endpoint does
 * not currently return a `winners` field, so on reload the rep — and
 * every attendee — would lose visibility of who won what.
 *
 * This overlay is keyed by `cxo:giveaway_winners:v1:<eventId>` and
 * mirrors the same write-through pattern used by `leadEditsStorage`:
 * we always re-load before writing and we accept silent failures
 * (private-mode browsers, quota exhausted) since the data is also
 * carried by the in-memory React state for the active session.
 *
 * Per-event keying means switching between events doesn't blend
 * winner lists, and signing out doesn't have to scrub the cache —
 * a different rep looking at the same event id will see the same
 * winner names (which is the desired event-public behavior).
 */

const KEY_PREFIX = 'cxo:giveaway_winners:v1:';

export interface GiveawayWinner {
  id: string;
  name: string;
  company?: string;
  title?: string;
  avatar?: string;
  /** ISO 8601 timestamp of when the draw resolved. */
  drawnAt: string;
}

/** Map of giveawayId -> ordered list of winners (oldest first). */
export type GiveawayWinnersOverlay = Record<string, GiveawayWinner[]>;

function storageKey(eventId: string): string {
  return `${KEY_PREFIX}${eventId}`;
}

function safeParse(raw: string | null): GiveawayWinnersOverlay {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: GiveawayWinnersOverlay = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(v)) {
          out[k] = v.filter(
            (w): w is GiveawayWinner =>
              !!w &&
              typeof w === 'object' &&
              typeof (w as GiveawayWinner).id === 'string' &&
              typeof (w as GiveawayWinner).name === 'string',
          );
        }
      }
      return out;
    }
  } catch {
    // fallthrough — corrupt entry, treat as empty
  }
  return {};
}

export function loadGiveawayWinners(eventId: string | undefined | null): GiveawayWinnersOverlay {
  if (!eventId || typeof window === 'undefined') return {};
  try {
    return safeParse(window.localStorage.getItem(storageKey(eventId)));
  } catch {
    return {};
  }
}

export function appendGiveawayWinner(
  eventId: string | undefined | null,
  giveawayId: string,
  winner: GiveawayWinner,
): void {
  if (!eventId || !giveawayId || typeof window === 'undefined') return;
  try {
    const overlay = loadGiveawayWinners(eventId);
    const existing = overlay[giveawayId] ?? [];
    overlay[giveawayId] = [...existing, winner];
    window.localStorage.setItem(storageKey(eventId), JSON.stringify(overlay));
  } catch {
    // Best-effort; the in-memory state already reflects the win.
  }
}

export function clearGiveawayWinners(eventId: string | undefined | null): void {
  if (!eventId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(eventId));
  } catch {
    // ignore
  }
}

/**
 * Reassign all winners stored under `fromGiveawayId` to `toGiveawayId`
 * within the given event's overlay. Used after `addSponsorGiveaway`
 * swaps an optimistic synthetic id (`giveaway-<ts>`) for the canonical
 * server id — without this migration, any winner picked between the
 * sponsor's giveaway insert and the server round-trip would be
 * orphaned in the overlay (keyed under the temp id) while the merged
 * giveaway list looks for entries under the new canonical id.
 *
 * No-op when keys match, or when there's nothing to move. Existing
 * winners under the destination id are preserved (the migrated batch
 * is appended after them).
 */
export function migrateGiveawayWinnersKey(
  eventId: string | undefined | null,
  fromGiveawayId: string,
  toGiveawayId: string,
): void {
  if (!eventId || typeof window === 'undefined') return;
  if (!fromGiveawayId || !toGiveawayId || fromGiveawayId === toGiveawayId) return;
  try {
    const overlay = loadGiveawayWinners(eventId);
    const moving = overlay[fromGiveawayId];
    if (!moving || moving.length === 0) return;
    const existing = overlay[toGiveawayId] ?? [];
    overlay[toGiveawayId] = [...existing, ...moving];
    delete overlay[fromGiveawayId];
    window.localStorage.setItem(storageKey(eventId), JSON.stringify(overlay));
  } catch {
    // best-effort
  }
}
