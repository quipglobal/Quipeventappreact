/**
 * Leaderboard API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend contract (event-scoped, multi-tenant):
 *
 *   GET /api/v1/events/:eventId/leaderboard?period=overall|today|week&limit=20
 *     → { success: true, data: LeaderboardEntry[] }
 *
 * Used by the home-screen leaderboard preview and the full Leaderboard
 * page. The list MUST be scoped to the active event so attendees only
 * see scores earned at the event they're currently inside — switching
 * events refetches.
 *
 * Endpoint-missing handling
 * ─────────────────────────
 * Mirrors `giveawaysClient` / `leadsClient`: a single 404/405 from the
 * backend flips a session-scoped flag so subsequent calls short-circuit
 * to NOT_IMPLEMENTED instead of spamming the network. Reset on event
 * change so a deploy mid-session is picked up the next time the user
 * switches events. Falls back gracefully — the UI keeps showing
 * whatever state it had (empty / stale) without erroring.
 *
 * Backend response tolerance
 * ──────────────────────────
 * The normalizer accepts both the documented mobile shape
 * (`{ rank, userId, name, points, tier, tierColor }`) and the broader
 * Laravel-style shape used elsewhere in the v1 namespace
 * (`{ user_id, full_name, company, avatar_url, total_points, ... }`).
 * Either side can ship without breaking the other.
 */

import { apiGet } from './client';

const HEADERS = { 'Accept': 'application/json' };

let listEndpointMissing = false;
let warnedListMissing = false;

export type LeaderboardPeriod = 'overall' | 'today' | 'week';

export interface LeaderboardEntry {
  /** 1-based rank as returned by the backend (sorted by points DESC). */
  rank: number;
  /** Stable user id — used to flag the current user's row. */
  userId: string;
  name: string;
  /** Optional company / org affiliation. May be empty. */
  company: string;
  /** Optional job title. May be empty. */
  title: string;
  /** Avatar URL. May be empty — UI substitutes a generated placeholder. */
  avatar: string;
  /** Cumulative points balance for the chosen period. */
  points: number;
  /** Membership tier label: Bronze | Silver | Gold | Platinum. */
  tier: string;
  /** Optional rank delta vs. previous tick. Positive = moved up. */
  change: number;
}

export interface LeaderboardResponse {
  success: boolean;
  data?: LeaderboardEntry[];
  error?: { code: string; message: string };
}

/** Reset the missing-endpoint memo (called on event change). */
export function resetLeaderboardEndpointMissing(): void {
  listEndpointMissing = false;
  warnedListMissing = false;
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return '';
}

/**
 * Like `pickString`, but also accepts numeric values (coerced via
 * `String()`). Used for IDs because Laravel commonly returns
 * `user_id` as an integer — without the coercion the row would get a
 * synthetic `row-N` id and the current-user highlight would never
 * match against `user.id` (which is always a string in AppContext).
 */
function pickId(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function pickNumber(...vals: unknown[]): number {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  }
  return 0;
}

function normalizeTier(raw: unknown): string {
  const t = pickString(raw).toLowerCase();
  if (t === 'platinum') return 'Platinum';
  if (t === 'gold') return 'Gold';
  if (t === 'silver') return 'Silver';
  if (t === 'bronze') return 'Bronze';
  // Unknown / empty → Bronze (matches the default the rest of the app
  // assumes when no tier has been earned yet).
  return 'Bronze';
}

function normalizeEntry(raw: any, fallbackRank: number): LeaderboardEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const user = raw.user ?? raw.attendee ?? raw.member ?? null;
  const id = pickId(
    raw.userId, raw.user_id, raw.id, raw.attendee_id, raw.attendeeId,
    user?.id, user?.uuid,
  );
  const name = pickString(
    raw.name, raw.full_name, raw.fullName, raw.display_name,
    user?.name, user?.full_name, user?.fullName,
  );
  if (!id && !name) return null; // a row needs at least one of them to render
  return {
    rank: pickNumber(raw.rank, raw.position) || fallbackRank,
    userId: id || `row-${fallbackRank}`,
    name: name || 'Anonymous',
    company: pickString(
      raw.company, raw.company_name, raw.companyName, raw.organization,
      user?.company, user?.company_name,
    ),
    title: pickString(raw.title, raw.job_title, raw.jobTitle, user?.title, user?.job_title),
    avatar: pickString(
      raw.avatar, raw.avatar_url, raw.avatarUrl, raw.photo, raw.photo_url,
      user?.avatar, user?.avatar_url,
    ),
    points: pickNumber(
      raw.points, raw.total_points, raw.totalPoints, raw.gamification_points,
      raw.score, raw.event_points, raw.event_score, raw.total_score,
      user?.points, user?.total_points, user?.gamification_points,
    ),
    tier: normalizeTier(raw.tier ?? raw.membership_tier ?? user?.tier ?? user?.membership_tier),
    change: pickNumber(raw.change, raw.rank_change, raw.rankChange, raw.delta),
  };
}

/**
 * Returns true when a raw leaderboard row belongs to a sponsor / exhibitor
 * / vendor. Sponsors accumulate points through badge scans (lead capture),
 * which is a different activity from attendee gamification. Including them
 * in the attendee leaderboard inflates scores unfairly, so we filter them
 * out client-side regardless of what the backend sends.
 *
 * We check every known field name the Laravel backend might use for role.
 */
function isSponsorRow(row: any): boolean {
  if (!row || typeof row !== 'object') return false;
  const nested = row.user ?? row.attendee ?? row.member ?? null;
  const rawRole = String(
    row.role ?? row.user_role ?? row.userRole ??
    row.account_type ?? row.accountType ??
    row.user_type ?? row.userType ??
    row.type ??
    nested?.role ?? nested?.user_role ?? nested?.account_type ?? nested?.user_type ?? ''
  ).toLowerCase().trim();
  return (
    rawRole === 'sponsor' ||
    rawRole === 'exhibitor' ||
    rawRole === 'vendor' ||
    rawRole === 'sponsor_rep' ||
    rawRole === 'sponsorrep'
  );
}

/**
 * GET /api/v1/events/:eventId/leaderboard
 *
 * `period` is forwarded as a query string; the backend may ignore it
 * (returning the same overall ranking) — that's fine, the UI still
 * works because the filter pill is a presentation hint, not a
 * client-side slice.
 *
 * `role=attendee` is sent as a hint so a cooperating backend can
 * pre-filter on its side; if not supported it is silently ignored
 * and we filter sponsor rows client-side in the step below.
 */
export async function listLeaderboard(
  eventId: string | number,
  period: LeaderboardPeriod = 'overall',
  limit = 50,
): Promise<LeaderboardResponse> {
  if (listEndpointMissing) {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Leaderboard endpoint not deployed.' } };
  }
  const path = `/api/v1/events/${eventId}/leaderboard?period=${encodeURIComponent(period)}&limit=${limit}&role=attendee`;
  const res = await apiGet<unknown>(path, HEADERS);
  if (!res.success || !res.data) {
    if (res.error?.code === '404' || res.error?.code === '405') {
      listEndpointMissing = true;
      if (!warnedListMissing && typeof console !== 'undefined') {
        warnedListMissing = true;
        console.warn(
          '[leaderboardClient] GET /events/:id/leaderboard returned ' +
            res.error.code +
            '. Falling back to empty leaderboard. Backend needs to register the route.',
        );
      }
      return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Leaderboard endpoint not deployed.' } };
    }
    return { success: false, error: res.error ?? { code: 'LIST_FAILED', message: 'Failed to fetch leaderboard.' } };
  }
  // Tolerate `[]`, `{ data: [] }`, `{ leaderboard: [] }`,
  // `{ entries: [] }` — Laravel API resources commonly wrap
  // collections under one of these names.
  const data = res.data as any;
  let raw: any[] | null = null;
  if (Array.isArray(data)) raw = data;
  else if (Array.isArray(data?.data)) raw = data.data;
  else if (Array.isArray(data?.leaderboard)) raw = data.leaderboard;
  else if (Array.isArray(data?.entries)) raw = data.entries;
  if (raw === null) {
    if (typeof console !== 'undefined') {
      console.warn('[leaderboardClient] unexpected response shape; expected an array.', data);
    }
    return { success: true, data: [] };
  }
  // Strip sponsor / exhibitor / vendor rows — their points come from badge
  // scans (lead capture), not attendee gamification, so they must not appear
  // in the attendee leaderboard. Re-rank sequentially after filtering so
  // rank numbers remain contiguous (1, 2, 3 … rather than 1, 3, 5 …).
  const attendeeRows = raw.filter((row) => !isSponsorRow(row));
  const entries = attendeeRows
    .map((row, idx) => normalizeEntry(row, idx + 1))
    .filter((e): e is LeaderboardEntry => e !== null);
  return { success: true, data: entries };
}
