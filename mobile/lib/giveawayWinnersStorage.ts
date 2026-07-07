import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GiveawayWinner } from '@/lib/api/types';

/**
 * Per-event AsyncStorage overlay for lucky-draw winners — the mobile
 * mirror of the web `giveawayWinnersStorage` localStorage overlay.
 *
 * Why: the backend may not (yet) persist the winner-per-giveaway
 * relationship, so on reload the sponsor — and every attendee — would
 * lose visibility of who won what. This overlay is keyed by
 * `cxo:giveaway_winners:v1:<eventId>` and merged into the giveaways
 * list on load so winners survive reloads and event switches without
 * commingling.
 *
 * All writes are best-effort: the in-memory / react-query state already
 * reflects the win for the active session, so a storage failure never
 * blocks the winner reveal.
 */

const KEY_PREFIX = 'cxo:giveaway_winners:v1:';

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
    // corrupt entry — treat as empty
  }
  return {};
}

export async function loadGiveawayWinners(
  eventId: string | undefined | null,
): Promise<GiveawayWinnersOverlay> {
  if (!eventId) return {};
  try {
    return safeParse(await AsyncStorage.getItem(storageKey(eventId)));
  } catch {
    return {};
  }
}

export async function appendGiveawayWinner(
  eventId: string | undefined | null,
  giveawayId: string,
  winner: GiveawayWinner,
): Promise<void> {
  if (!eventId || !giveawayId) return;
  try {
    const overlay = await loadGiveawayWinners(eventId);
    const existing = overlay[giveawayId] ?? [];
    overlay[giveawayId] = [...existing, winner];
    await AsyncStorage.setItem(storageKey(eventId), JSON.stringify(overlay));
  } catch {
    // best-effort; the in-memory state already reflects the win
  }
}

export async function clearGiveawayWinners(
  eventId: string | undefined | null,
): Promise<void> {
  if (!eventId) return;
  try {
    await AsyncStorage.removeItem(storageKey(eventId));
  } catch {
    // ignore
  }
}

/**
 * Reassign winners stored under a synthetic `giveaway-<ts>` id to the
 * canonical server id after `createGiveaway` round-trips — mirrors the
 * web overlay migration so a winner picked between the optimistic
 * insert and the server response isn't orphaned. No-op when keys match
 * or there's nothing to move.
 */
export async function migrateGiveawayWinnersKey(
  eventId: string | undefined | null,
  fromGiveawayId: string,
  toGiveawayId: string,
): Promise<void> {
  if (!eventId || !fromGiveawayId || !toGiveawayId || fromGiveawayId === toGiveawayId) return;
  try {
    const overlay = await loadGiveawayWinners(eventId);
    const moving = overlay[fromGiveawayId];
    if (!moving || moving.length === 0) return;
    const existing = overlay[toGiveawayId] ?? [];
    overlay[toGiveawayId] = [...existing, ...moving];
    delete overlay[fromGiveawayId];
    await AsyncStorage.setItem(storageKey(eventId), JSON.stringify(overlay));
  } catch {
    // best-effort
  }
}
