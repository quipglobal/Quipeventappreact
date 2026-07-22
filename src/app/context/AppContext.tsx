// @refresh reset
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { EventConfig, GamificationConfig } from '@/app/types/config';
import { getMeApi } from '@/app/api/authClient';
import { clearToken } from '@/app/api/client';
import {
  sendMeetingRequest as sendMeetingRequestApi,
  resetMeetingsEndpointMissing,
} from '@/app/api/meetingsClient';
import {
  listConversations as listConversationsApi,
  listMessages as listMessagesApi,
  sendMessageApi,
  editMessageApi,
  deleteMessageApi,
  resetMessagesEndpointMissing,
} from '@/app/api/messagesClient';
import {
  encryptMessage,
  decryptMessage,
  getOrDeriveConversationKey,
  clearMessageCryptoCache,
  MESSAGE_CRYPTO_SCHEME,
  type EncryptedPayload,
} from '@/app/lib/messageCrypto';
import { fetchPointsFromBackend, scheduleSyncPoints, cancelPendingSyncPoints } from '@/app/api/pointsClient';
import { getMyEventRoleApi } from '@/app/api/audienceClient';
import { loadLeadsFromStorage, saveLeadsToStorage, clearLeadsStorage } from '@/app/lib/leadsStorage';
import { saveLeadEdit } from '@/app/lib/leadEditsStorage';
import {
  GiveawayWinner,
  loadGiveawayWinners,
  writeGiveawayWinners,
  appendGiveawayWinner,
  migrateGiveawayWinnersKey,
} from '@/app/lib/giveawayWinnersStorage';
import { listLeads as listLeadsApi, scanBadgeLead, resetScanEndpointMissing } from '@/app/api/leadsClient';
import {
  listGiveaways as listGiveawaysApi,
  createGiveaway as createGiveawayApi,
  updateGiveaway as updateGiveawayApi,
  removeGiveaway as removeGiveawayApi,
  saveGiveawayWinner as saveGiveawayWinnerApi,
  resetGiveawaysEndpointMissing,
} from '@/app/api/giveawaysClient';
import {
  listLeaderboard as listLeaderboardApi,
  resetLeaderboardEndpointMissing,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '@/app/api/leaderboardClient';
import { useAuthedEffect } from '@/app/hooks/useAuthedEffect';
import { getCached } from '@/app/lib/pageCache';

interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  avatar: string;
  points: number;
  tier: string;
  role: 'attendee' | 'sponsor';
  interests: string[];
  profileComplete: boolean;
  emailVerified?: boolean;
  isRegistered?: boolean;
  badgeCode?: string;
  // Extended profile (populated after a profile fetch / edit)
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  linkedinUrl?: string;
  socialLinks?: Record<string, string>;
  companyId?: number | null;
  industry?: string;
  industryId?: number | null;
  profileImage?: string;
  interestedTopics?: { id: number; name: string; slug?: string }[];
}

export interface Lead {
  id: string;
  code: string;
  name: string;
  company: string;
  title: string;
  notes: string;
  timestamp: Date;
  avatar?: string;
  tags: string[];
  priority: 'hot' | 'warm' | 'cold';
  /** True when this lead was saved client-side only (the backend rejected the
   *  /leads/scan call) and still needs to be reconciled with the server.
   *  Cleared once the server confirms the lead and we replace the synthetic
   *  id with the canonical server id. */
  pendingSync?: boolean;
  /** Optional email captured at scan time — used as a secondary dedupe key
   *  alongside `code` when reconciling local-only leads with the backend. */
  email?: string;
}

interface PointEvent {
  id: string;
  action: string;
  points: number;
  timestamp: Date;
}

export interface ConnectionRequest {
  id: string;
  fromUser: { id: string; name: string; title: string; company: string; avatar: string };
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: Date;
  message?: string;
  direction: 'incoming' | 'outgoing';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  /** Plaintext (decrypted in-memory only — never sent to the server). */
  text: string;
  timestamp: Date;
  read: boolean;
  /** Set to a future epoch ms while the message is in its 5-second
   *  "Undo" window. The actual POST hasn't fired yet — the bubble
   *  shows a Sending indicator and an Undo affordance. Cleared once
   *  the POST is committed (or removed if the user undid). */
  pendingSendUntil?: number;
  /** Set on optimistic edit/delete operations until the backend
   *  acknowledges. UI greys the bubble. */
  pendingSync?: boolean;
  /** Populated by an `editMessage` round-trip; UI shows "(edited)". */
  editedAt?: Date;
  /** Populated when the user (or the peer) deletes the message; the
   *  bubble renders as an italic "Message deleted" placeholder so the
   *  conversation stays coherent. */
  deletedAt?: Date;
}

export interface Conversation {
  id: string;
  connectionId: string;
  participant: { id: string; name: string; title: string; company: string; avatar: string };
  messages: ChatMessage[];
  lastActivity: Date;
}

export interface SponsorGiveaway {
  id: string;
  title: string;
  numberOfItems: number;
  image: string;
  createdAt: Date;
  sponsorName: string;
  sponsorId: string;
  /**
   * Lucky-draw winners associated with this giveaway. Hydrated from the
   * `cxo:giveaway_winners:v1:<eventId>` localStorage overlay since the
   * backend giveaway list endpoint does not (yet) return winners.
   * Oldest first.
   */
  winners?: GiveawayWinner[];
}

export type { GiveawayWinner } from '@/app/lib/giveawayWinnersStorage';

interface AppState {
  user: User | null;
  eventConfig: EventConfig;
  gamificationConfig: GamificationConfig;
  completedSurveys: string[];
  inProgressSurveys: Record<string, any>;
  votedPolls: string[];
  metSponsors: string[];
  bookmarkedSessions: string[];
  completedChallenges: string[];
  pointsHistory: PointEvent[];
  hasJoinedEvent: boolean;
  leads: Lead[];
  sponsorGiveaways: SponsorGiveaway[];
  connectionRequests: ConnectionRequest[];
  conversations: Conversation[];
  /** Event-scoped leaderboard rows hydrated from the backend on event
   *  change and on demand via `refreshLeaderboard`. Empty until the
   *  first hydration completes (or the backend returns NOT_IMPLEMENTED,
   *  in which case it stays empty and the UI shows an empty state). */
  leaderboard: LeaderboardEntry[];
  /** True while a `listLeaderboard` request is in flight. UI uses this
   *  to render skeletons / spinners without flickering. */
  leaderboardLoading: boolean;
  /** Last period the leaderboard was hydrated for. Mirrors the filter
   *  pill on the Leaderboard page so a hard refresh after switching
   *  pills keeps the right data. */
  leaderboardPeriod: LeaderboardPeriod;
}

interface AppContextType extends AppState {
  sessionRestored: boolean;
  setUser: (user: User | null) => void;
  joinEvent: () => void;
  addPoints: (points: number, activity: string) => void;
  setCompletedSurveys: (surveys: string[]) => void;
  setInProgressSurvey: (surveyId: string, data: any) => void;
  setVotedPolls: (polls: string[]) => void;
  setMetSponsors: (sponsors: string[]) => void;
  toggleBookmark: (sessionId: string) => void;
  completeChallenge: (challengeId: string, skipPoints?: boolean) => void;
  saveLead: (lead: Omit<Lead, 'id' | 'timestamp'> & { id?: string }, options?: { silent?: boolean }) => void;
  updateLead: (id: string, updates: Partial<Pick<Lead, 'notes' | 'tags' | 'priority'>>) => void;
  /** Replace a local-only lead (matched by `oldId`) with the canonical
   *  server-side lead now that the backend has accepted it. Clears
   *  `pendingSync` and substitutes the synthetic id with the server id. */
  replaceLead: (oldId: string, newLead: Lead) => void;
  /** Reconcile any locally-saved (`pendingSync: true`) leads with the
   *  backend right now. Shared between the LeadsPage on-mount flow and
   *  the in-context background timer; an internal in-flight guard
   *  prevents the two paths from double-pushing the same lead. Resolves
   *  to the number of pending leads that successfully synced. */
  reconcilePendingLeadsNow: () => Promise<number>;
  showToast: (message: string, points?: number) => void;
  updateTier: () => void;
  switchEvent: (config: EventConfig) => void;
  addSponsorGiveaway: (giveaway: Omit<SponsorGiveaway, 'id' | 'createdAt'>) => Promise<void>;
  /**
   * Edit an existing giveaway — only the supplied fields are
   * modified. Optimistic: the in-memory row updates immediately and
   * is reverted if the backend rejects the change. Local-only rows
   * (synthetic ids) are mutated in place without a network call.
   */
  updateSponsorGiveaway: (
    id: string,
    updates: { title?: string; numberOfItems?: number; image?: string },
  ) => Promise<void>;
  removeSponsorGiveaway: (id: string) => Promise<void>;
  /**
   * Returns true when `giveaway` was created by the current user
   * OR by another rep from the same company (same `company` value,
   * case-insensitive). Used by the sponsor-only "manage giveaways"
   * and "lucky draw" surfaces so co-workers can see and (per
   * product request) manage each other's prizes to prevent
   * duplicate entries at the booth.
   */
  isMyGiveaway: (giveaway: SponsorGiveaway) => boolean;
  /**
   * Append a lucky-draw winner to a giveaway and persist it to the
   * per-event overlay so it survives reloads and is visible on the
   * public Giveaways screen. Safe to call repeatedly; each call adds
   * one entry (use cases like multi-quantity prizes draw N times).
   *
   * Callers should pass `eventIdAtDrawStart` — the event id captured
   * BEFORE the async draw was kicked off — so a mid-flight
   * `switchEvent` can't cause a winner from event A to be persisted
   * under event B's overlay key. When the snapshot disagrees with
   * the current active event the in-memory state mutation is also
   * skipped (the overlay still gets the write under the correct
   * event so it'll surface on the next return to that event).
   */
  /** Force a fresh fetch of the event-scoped leaderboard. Optional
   *  `period` switches the active filter (defaults to whatever
   *  `leaderboardPeriod` already is). Resolves once the request
   *  completes — used by the Leaderboard page's pull-to-refresh and
   *  by the period pill onClick. */
  refreshLeaderboard: (period?: LeaderboardPeriod) => Promise<void>;
  recordGiveawayWinner: (
    giveawayId: string,
    winner: GiveawayWinner,
    eventIdAtDrawStart?: string,
  ) => void;
  sendConnectionRequest: (toUser: ConnectionRequest['fromUser'], message?: string) => Promise<void>;
  acceptConnection: (requestId: string) => void;
  declineConnection: (requestId: string) => void;
  /** Optimistically append a message to the given conversation and
   *  schedule its encrypted POST to fire after a 5-second undo
   *  window. Resolves immediately — UI never blocks on the network
   *  round-trip. The conversation MUST belong to an accepted
   *  connection or this is a no-op (silent guard against the UI
   *  somehow reaching here for an unaccepted request). */
  sendMessage: (conversationId: string, text: string) => void;
  /** Cancel a `sendMessage` while it's still in its 5-second undo
   *  window — the encrypted POST never fires and the optimistic row
   *  is removed from the conversation. After the window closes, this
   *  is a no-op (use `deleteMessage` instead). */
  undoSendMessage: (conversationId: string, messageId: string) => void;
  /** Re-encrypt and PUT the message body. Optimistic — bubble
   *  updates immediately and rolls back on hard failure. Allowed
   *  only on the user's own non-deleted messages. */
  editMessage: (conversationId: string, messageId: string, newText: string) => Promise<void>;
  /** Soft-delete (own message). Bubble immediately renders as
   *  "Message deleted" italic placeholder; backend gets DELETE. */
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  markConversationRead: (conversationId: string) => void;
  setConnectionRequests: React.Dispatch<React.SetStateAction<ConnectionRequest[]>>;
}

// ─── Mock configs ─────────────────────────────────────────────────────────────

const mockEventConfig: EventConfig = {
  eventId: '23',
  name: 'TechForward Summit',
  dates: '',
  timezone: 'UTC',
  location: '',
  logoURL: '',
  backgroundURL: '',
  themeColors: {
    primary: '#7c3aed',
    secondary: '#4f46e5',
    accent: '#ec4899',
  },
  modulesEnabled: {
    agenda: true,
    sponsors: true,
    surveys: true,
    polls: true,
    leaderboard: true,
    audience: true,
    challenges: true,
    notifications: true,
  },
  permissions: {
    guestAccess: true,
    sponsorRoleEnabled: true,
    networkingEnabled: true,
  },
};

const mockGamificationConfig: GamificationConfig = {
  pointActions: {
    completeSurvey: 50,
    votePoll: 10,
    sponsorCheckIn: 30,
    sessionCheckIn: 20,
    dailyLogin: 5,
    completeProfile: 25,
    completeChallenge: 100,
  },
  badges: [
    { name: 'Early Bird', threshold: 0, icon: 'calendar', color: 'blue' },
    { name: 'Survey Master', threshold: 3, icon: 'check-circle', color: 'emerald' },
    { name: 'Social Butterfly', threshold: 5, icon: 'users', color: 'purple' },
    { name: 'Poll Enthusiast', threshold: 5, icon: 'bar-chart', color: 'amber' },
  ],
  tiers: [
    { name: 'Bronze', minPoints: 0, maxPoints: 99, color: '#cd7f32' },
    { name: 'Silver', minPoints: 100, maxPoints: 249, color: '#c0c0c0' },
    { name: 'Gold', minPoints: 250, maxPoints: 499, color: '#ffd700' },
    { name: 'Platinum', minPoints: 500, maxPoints: 999999, color: '#e5e4e2' },
  ],
};

// ─── Context setup ────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [activeEventConfig, setActiveEventConfig] = useState<EventConfig>(mockEventConfig);
  const [completedSurveys, setCompletedSurveys] = useState<string[]>([]);
  const [inProgressSurveys, setInProgressSurveysState] = useState<Record<string, any>>({});
  const [votedPolls, setVotedPolls] = useState<string[]>([]);
  const [metSponsors, setMetSponsors] = useState<string[]>([]);
  const [bookmarkedSessions, setBookmarkedSessions] = useState<string[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointEvent[]>([]);
  // Leads start empty; a user-scoped hydration effect below pulls any
  // persisted offline leads from localStorage once the current user is
  // known, so a different user on the same device never sees the prior
  // user's leads.
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sponsorGiveaways, setSponsorGiveaways] = useState<SponsorGiveaway[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('overall');
  const [hasJoinedEvent, setHasJoinedEvent] = useState(false);
  const [toast, setToast] = useState<{ message: string; points?: number } | null>(null);

  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Tracks which user id (if any) the current `leads` array was last
  // hydrated for. State (not a ref) so the persistence effect below can
  // depend on it and avoid clobbering a freshly-loaded array with the
  // pre-hydration empty default on the same render.
  const [hydratedForUserId, setHydratedForUserId] = useState<string | null>(null);

  // Hydrate the user's persisted leads as soon as the current user is
  // known. Storage keys are namespaced by user id, so no other user's
  // leads can leak in here. On user change (logout → null, or account
  // switch) we also wipe the prior user's persisted slot so a different
  // user inspecting the same device can't recover those rows in-app.
  useEffect(() => {
    const uid = user?.id ?? null;
    if (hydratedForUserId === uid) return;
    if (hydratedForUserId) {
      // Transitioning away from a known user (logout or account switch):
      // explicitly clear their persisted leads. Trade-off: if the same
      // user logs back in, any unsynced leads are gone — but logout is a
      // strong signal of intent to wipe local state, and the alternative
      // (keeping the storage around) violates our cross-account isolation
      // guarantee.
      clearLeadsStorage(hydratedForUserId);
    }
    if (!uid) {
      setLeads([]);
      setHydratedForUserId(null);
      return;
    }
    setLeads(loadLeadsFromStorage(uid));
    setHydratedForUserId(uid);
  }, [user?.id, hydratedForUserId]);

  // Persist leads to localStorage (under the current user's namespaced
  // key) on every change so anything captured — especially
  // `pendingSync: true` rows that haven't reached the backend yet —
  // survives a tab close / page reload. Skips the write until hydration
  // has actually completed for this user so we don't overwrite the
  // freshly-loaded array with the pre-hydration empty default on the
  // same render.
  useEffect(() => {
    if (!user?.id || hydratedForUserId !== user.id) return;
    saveLeadsToStorage(user.id, leads);
  }, [leads, user?.id, hydratedForUserId]);

  useEffect(() => {
    getMeApi().then(async res => {
      if (res.success && res.data) {
        const u = res.data;
        const backendPoints = await fetchPointsFromBackend().catch(() => 0);
        const totalPoints = Math.max(u.points ?? 0, backendPoints);
        const tierForPoints = mockGamificationConfig.tiers.find(
          t => totalPoints >= t.minPoints && totalPoints <= t.maxPoints
        );
        setUser({
          id: u.id,
          name: u.name,
          email: u.email ?? '',
          title: u.title ?? '',
          company: u.company ?? '',
          role: u.role,
          avatar: u.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=7c3aed&color=fff`,
          points: totalPoints,
          tier: tierForPoints?.name ?? u.tier ?? 'Bronze',
          interests: u.interests ?? [],
          profileComplete: u.profileComplete ?? true,
          emailVerified: u.emailVerified ?? true,
          badgeCode: u.badgeCode,
        });
      } else {
        clearToken();
      }
    }).catch(() => {
      clearToken();
    }).finally(() => {
      setSessionRestored(true);
    });
  }, []);

  // Reconcile per-event role: the global /me record may say 'attendee' even
  // when the user is a sponsor rep for a specific event. Look up the user's
  // role in the active event's audience and override accordingly.
  //   found  → use the per-event role
  //   absent → safe default 'attendee' (avoids stale sponsor privilege when
  //            switching events)
  //   error  → leave user.role unchanged (don't downgrade on a transient
  //            network failure)
  useEffect(() => {
    if (!user?.email || !activeEventConfig?.eventId) return;
    let cancelled = false;
    getMyEventRoleApi(activeEventConfig.eventId, user.email).then(result => {
      if (cancelled || !result.ok) return;
      const desired: 'sponsor' | 'attendee' = result.found
        ? (result.role.toLowerCase() === 'sponsor' ? 'sponsor' : 'attendee')
        : 'attendee';
      setUser(prev => {
        if (!prev) return prev;
        if (prev.role === desired) return prev;
        return { ...prev, role: desired };
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, activeEventConfig?.eventId]);

  // ── Sponsor giveaways: hydrate from backend on event change ────────────
  // The giveaways feature is event-scoped and shared between the web
  // sponsor UI (where reps add prizes) and the attendee surfaces on web
  // and mobile (where attendees see and enter them). Loading from the
  // backend whenever the active event changes keeps every device's view
  // consistent. If the backend hasn't deployed the route yet the client
  // returns NOT_IMPLEMENTED and we keep whatever local-only state the
  // sponsor has already added — same graceful degradation we use for
  // the leads list.
  useAuthedEffect(
    user?.id,
    () => {
      const eventId = activeEventConfig?.eventId;
      if (!eventId) return;
      let cancelled = false;
      // Allow reconciliation to actually try the network on this event
      // change in case earlier in the session the route was missing.
      resetGiveawaysEndpointMissing();
      // Seed from preloader cache for instant display while network refreshes.
      const cachedGw = getCached<SponsorGiveaway[]>('giveaways', eventId);
      if (cachedGw?.length) setSponsorGiveaways(cachedGw);
      listGiveawaysApi(eventId).then(res => {
        if (cancelled) return;
        if (res.success && res.data) {
          // The backend giveaway list MAY return server-arbitrated
          // winners (e.g. picks made by an admin in the back-office, or
          // by another rep on a different device once a draw endpoint
          // ships). It also may not — until then, the only source of
          // truth is the per-event localStorage overlay this device
          // wrote when the rep ran a Lucky Draw locally.
          //
          // Union both sources by winner `id`, with the backend row
          // taking precedence on duplicates (it's authoritative). This
          // guarantees:
          //   • backend-only winners appear (admin-picked sync);
          //   • local-only winners appear (offline / endpoint-missing);
          //   • a winner present in both isn't double-counted.
          const winnersByGiveaway = loadGiveawayWinners(eventId);
          const normalized = res.data.map(g => {
              const local = winnersByGiveaway[g.id] ?? [];
              const fromServer = Array.isArray(g.winners) ? g.winners : [];
              if (local.length === 0 && fromServer.length === 0) return g;
              const seen = new Set<string>();
              const merged: GiveawayWinner[] = [];
              // Backend rows are canonical — their name/company/title take
              // precedence over what was stored locally at draw time.
              for (const w of fromServer) {
                if (w?.id && !seen.has(w.id)) { seen.add(w.id); merged.push(w); }
              }
              // Local-only entries appear after (offline picks, endpoint-missing).
              for (const w of local) {
                if (w?.id && !seen.has(w.id)) { seen.add(w.id); merged.push(w); }
              }
              // Write the canonical merged list back to localStorage so the
              // overlay stays in sync with backend names across reloads.
              // A stale local name (e.g. "Jane D." vs the backend's "Jane Doe")
              // is corrected the first time a hydration response carries the
              // winner — without this, the overlay would keep the stale copy
              // forever and diverge from what the mobile app sees.
              if (merged.length > 0) {
                writeGiveawayWinners(eventId, g.id, merged);
              }
              return { ...g, winners: merged };
            });
          setSponsorGiveaways(normalized);
        }
        // On NOT_IMPLEMENTED / network error: silently keep current state.
        // The sponsor UI still works locally; reconciliation picks up
        // whenever the backend comes online and the user re-enters.
      });
      return () => { cancelled = true; };
    },
    [activeEventConfig?.eventId],
  );

  // ── Leaderboard: hydrate from backend on event change ──────────────────
  // Event-scoped, multi-tenant. Refreshing on `activeEventConfig.eventId`
  // change keeps the home-screen preview and the full Leaderboard page in
  // sync with whichever event the user is currently inside. We use a
  // single-flight ref so the period-pill clicks (which call
  // `refreshLeaderboard('today')` etc.) don't race with the on-mount
  // hydration. NOT_IMPLEMENTED is treated as a no-op: the UI just shows
  // an empty state and the next event change will retry.
  const leaderboardInFlightRef = useRef<{ key: string; cancelled: boolean } | null>(null);
  /**
   * In-flight pending-send timers, one per optimistic message that's
   * still inside its 5-second Undo window. Map: messageId →
   * `{ timer, conversationId }`. We store the conversationId so the
   * sign-out cleanup can clear all of them without touching state
   * each time.
   */
  const pendingSendTimersRef = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; conversationId: string }>>(new Map());
  const refreshLeaderboard = useCallback(
    async (period?: LeaderboardPeriod) => {
      const eventId = activeEventConfig?.eventId;
      if (!eventId) {
        setLeaderboard([]);
        return;
      }
      const targetPeriod = period ?? leaderboardPeriod;
      if (period && period !== leaderboardPeriod) {
        setLeaderboardPeriod(period);
      }
      // Cancel any earlier in-flight call so its (possibly stale)
      // result can't overwrite this one's. We key by event+period so a
      // user mashing the period pills always ends up showing the last
      // pill they clicked.
      const key = `${eventId}::${targetPeriod}::${Date.now()}`;
      if (leaderboardInFlightRef.current) {
        leaderboardInFlightRef.current.cancelled = true;
      }
      const ticket = { key, cancelled: false };
      leaderboardInFlightRef.current = ticket;
      setLeaderboardLoading(true);
      try {
        const res = await listLeaderboardApi(eventId, targetPeriod);
        if (ticket.cancelled) return;
        if (res.success && res.data) {
          setLeaderboard(res.data);
        } else if (res.error?.code === 'NOT_IMPLEMENTED') {
          // Backend route not deployed yet — clear so we don't keep
          // stale rows from a prior event. UI renders the empty
          // state which already mentions points.
          setLeaderboard([]);
        }
        // Other errors: keep the existing array so a transient
        // network blip doesn't blank the UI.
      } finally {
        if (!ticket.cancelled) {
          setLeaderboardLoading(false);
        }
      }
    },
    [activeEventConfig?.eventId, leaderboardPeriod],
  );

  useAuthedEffect(
    user?.id,
    () => {
      const eventId = activeEventConfig?.eventId;
      if (!eventId) return;
      // Allow the first call on this event to actually hit the
      // network even if a prior event in the same session had a
      // missing route — backend may have been deployed since.
      resetLeaderboardEndpointMissing();
      // Reset to the default period on event switch so the pill
      // state matches what's actually loaded. Cheaper than
      // remembering per-event period selections.
      setLeaderboardPeriod('overall');
      // Clear immediately on event switch so the previous event's
      // rankings don't flash on screen while the new event's data
      // is in flight. The Leaderboard page falls back to its
      // skeleton/empty state during this gap.
      setLeaderboard([]);
      // Seed from preloader cache so the page renders instantly while the
      // network refresh runs in the background. The leaderboard skeleton
      // (leaderboardLoading && rows.length === 0) won't show when rows exist.
      const cachedLb = getCached<LeaderboardEntry[]>('leaderboard', eventId);
      if (cachedLb?.length) setLeaderboard(cachedLb);
      void refreshLeaderboard('overall');
    },
    [activeEventConfig?.eventId],
  );

  // ── Conversations: hydrate from backend on event change ─────────────────
  // Fetches the conversation index then decrypts each message with the
  // per-conversation HKDF key. When the backend hasn't deployed the route
  // yet (404/405) `listConversations` short-circuits to NOT_IMPLEMENTED and
  // this effect is a no-op — in-memory state from `acceptConnection` is
  // preserved unchanged.
  useAuthedEffect(
    user?.id,
    (userId) => {
      const eventId = activeEventConfig?.eventId;
      if (!eventId) return;
      let cancelled = false;

      // Reset the session flag so a backend deployment between event-switches
      // gets a fresh chance (same pattern as giveaways / leaderboard).
      resetMessagesEndpointMissing();

      (async () => {
        const convRes = await listConversationsApi(eventId);
        if (cancelled || !convRes.success || !convRes.data || convRes.data.length === 0) return;

        const hydratedConvs: Conversation[] = [];
        for (const summary of convRes.data) {
          if (cancelled) return;

          const msgRes = await listMessagesApi(eventId, summary.id);
          if (cancelled) return;

          const encMessages = msgRes.success && msgRes.data ? msgRes.data : [];

          // Derive the per-conversation AES-GCM key — same seed as
          // `encryptForConversation` (connectionId + sorted user ids).
          let convKey: CryptoKey | null = null;
          try {
            convKey = await getOrDeriveConversationKey(
              summary.connectionId,
              userId,
              summary.participantId,
            );
          } catch {
            convKey = null;
          }

          const messages: ChatMessage[] = await Promise.all(
            encMessages.map(async (m): Promise<ChatMessage> => {
              const isDeleted = !!m.deletedAt || m.ciphertext === null;
              let text = '';
              if (!isDeleted && m.ciphertext && convKey) {
                try {
                  text = await decryptMessage(
                    { ciphertext: m.ciphertext, iv: m.iv, scheme: m.scheme as typeof MESSAGE_CRYPTO_SCHEME },
                    convKey,
                  );
                } catch {
                  text = '[unable to decrypt]';
                }
              }
              return {
                id: m.id,
                senderId: m.senderId,
                text,
                timestamp: m.timestamp,
                read: m.senderId !== userId,
                editedAt: m.editedAt,
                ...(m.deletedAt ? { deletedAt: m.deletedAt } : {}),
              };
            }),
          );

          hydratedConvs.push({
            id: summary.id,
            connectionId: summary.connectionId,
            participant: {
              id: summary.participantId,
              name: summary.participantName,
              title: summary.participantTitle,
              company: summary.participantCompany,
              avatar: summary.participantAvatar,
            },
            messages,
            lastActivity: summary.lastActivityAt,
          });
        }

        if (cancelled || hydratedConvs.length === 0) return;

        // Merge: prefer server rows for known conversations; keep purely
        // local ones (e.g. just-accepted, synthetic id `conv-<ts>`) that
        // the backend hasn't indexed yet — they'll converge on the next
        // hydration tick once the backend picks them up.
        setConversations(prev => {
          const serverIds = new Set(hydratedConvs.map(c => c.id));
          const localOnly = prev.filter(c => !serverIds.has(c.id));
          return [...localOnly, ...hydratedConvs];
        });
      })();

      return () => { cancelled = true; };
    },
    [activeEventConfig?.eventId],
  );

  // ── Sign-out cleanup for outstanding background work ───────────────────
  // Mirror the leads-reconciler gating for any other deferred / in-flight
  // authenticated calls. The points sync in particular runs on a 300ms
  // debounce, so an `addPoints` triggered just before sign-out would
  // otherwise fire a PUT /me/profile *after* the token was cleared. Cancel
  // it (and any future stale timer) the moment the user transitions to
  // null. Re-runs only on user-id changes, so a refresh during an active
  // session doesn't drop a legitimately scheduled sync.
  useEffect(() => {
    if (user?.id) return;
    cancelPendingSyncPoints();
    // Drop any cached giveaways too — they're event-scoped backend
    // data, and a different user signing in on this device should
    // never see the previous user's view of the prize list (the next
    // hydration tick will refill from the backend under the new
    // session).
    setSponsorGiveaways([]);
    // Same reasoning for the leaderboard — and crucially, cancel any
    // in-flight fetch so its response can't land after sign-out and
    // re-populate state under a different user.
    if (leaderboardInFlightRef.current) {
      leaderboardInFlightRef.current.cancelled = true;
      leaderboardInFlightRef.current = null;
    }
    setLeaderboard([]);
    setLeaderboardLoading(false);
    // Cancel every still-buffered "Sending… (Undo)" message so its
    // delayed encrypted POST can't fire after the auth token is
    // gone. Drop the conversation cache + the cached AES-GCM keys
    // for the same reason as the leaderboard: a new user signing in
    // on the same device must never inherit the previous user's
    // decrypted message bodies.
    for (const { timer } of pendingSendTimersRef.current.values()) clearTimeout(timer);
    pendingSendTimersRef.current.clear();
    setConversations([]);
    setConnectionRequests([]);
    clearMessageCryptoCache();
    resetMeetingsEndpointMissing();
    resetMessagesEndpointMissing();
  }, [user?.id]);

  // ── Background pendingSync reconciliation ──────────────────────────────
  // Periodically retry pushing locally-saved (`pendingSync: true`) leads to
  // the backend so sponsors who never open the My Leads page during an event
  // still get their captures synced. Mirrors the on-mount reconciliation
  // flow in LeadsPage but runs app-wide:
  //
  //   • Wakes up every 60s while the page is visible (skipped while
  //     `document.hidden`; a `visibilitychange` listener triggers an
  //     immediate retry when the user returns).
  //   • Probes GET /events/:id/leads first — a successful response means
  //     the backend's leads routes are live, and we reset the
  //     session-scoped `/leads/scan` 404 short-circuit so retries actually
  //     hit the network. If the probe fails, we back off and try later
  //     instead of pushing scans the server can't accept.
  //   • Backs off exponentially on consecutive failures (60s → 120s → … →
  //     capped at 10 minutes) so a downed backend isn't hammered. Resets
  //     to the base interval the moment any reconciliation succeeds.
  //   • On success swaps the synthetic id for the canonical server id (via
  //     `replaceLead`, which clears `pendingSync`) and shows a single
  //     non-intrusive toast summarising the sync.
  //
  // Refs are used so the timer always sees the latest leads/eventId
  // without re-running the effect (which would reset the backoff state).
  const leadsRef = useRef<Lead[]>(leads);
  useEffect(() => { leadsRef.current = leads; }, [leads]);
  const activeEventIdRef = useRef<string>(activeEventConfig?.eventId ?? '0');
  useEffect(() => { activeEventIdRef.current = activeEventConfig?.eventId ?? '0'; }, [activeEventConfig?.eventId]);
  // Mirror the active user id so async giveaway mutations (whose
  // completion may straddle a sign-out or account switch) can detect
  // session changes without closing over a stale `user` snapshot.
  const userIdRef = useRef<string | null>(user?.id ?? null);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user?.id]);

  // ── Temp -> canonical giveaway id resolution ──────────────────────────
  // When `addSponsorGiveaway` succeeds, the optimistic temp id
  // (`giveaway-<ts>`) is swapped for the server's canonical id. A
  // lucky-draw started against the temp id may finish AFTER that swap
  // — by then the merged giveaway list looks for winners under the
  // canonical id, so we need a way for `recordGiveawayWinner` to
  // translate a stale temp id into the live canonical id. The map is
  // keyed `eventId -> Map<tempId, canonicalId>` so cross-event temp
  // collisions can't bleed into each other.
  const giveawayIdRemapRef = useRef<Map<string, Map<string, string>>>(new Map());

  const resolveGiveawayId = (eventId: string | undefined, id: string): string => {
    if (!eventId) return id;
    const perEvent = giveawayIdRemapRef.current.get(eventId);
    if (!perEvent) return id;
    let current = id;
    // Follow the chain in case a temp id was remapped multiple times
    // (defensive — in practice the chain is at most 1 hop).
    const seen = new Set<string>();
    while (perEvent.has(current) && !seen.has(current)) {
      seen.add(current);
      current = perEvent.get(current)!;
    }
    return current;
  };

  const rememberGiveawayIdSwap = (
    eventId: string | undefined,
    tempId: string,
    canonicalId: string,
  ): void => {
    if (!eventId || !tempId || !canonicalId || tempId === canonicalId) return;
    let perEvent = giveawayIdRemapRef.current.get(eventId);
    if (!perEvent) {
      perEvent = new Map();
      giveawayIdRemapRef.current.set(eventId, perEvent);
    }
    perEvent.set(tempId, canonicalId);
  };

  // Shared in-flight tracking so the page-mount reconciler in LeadsPage
  // and the background timer below don't both push the same pending
  // lead. A per-id Set lets independent leads still reconcile in parallel.
  const reconcileInFlightRef = useRef<Set<string>>(new Set());

  // Single shared implementation. Returns the number of leads that the
  // server confirmed (so callers can decide whether to surface a toast).
  // Skips any lead already in the per-id in-flight set, and probes the
  // list endpoint first — same gate the on-mount flow used historically.
  const reconcilePendingLeadsNow = React.useCallback(async (): Promise<number> => {
    const eventId = activeEventIdRef.current;
    const pending = leadsRef.current.filter(
      l => l.pendingSync && !!l.code && !reconcileInFlightRef.current.has(l.id),
    );
    if (pending.length === 0) return 0;

    // Probe — if the leads-list endpoint isn't reachable, skip the push
    // entirely (the backend likely can't accept scans either) so we
    // don't burn cycles or pollute logs with predictable failures.
    const probe = await listLeadsApi(eventId);
    if (!probe.success) return 0;
    resetScanEndpointMissing();

    pending.forEach(l => reconcileInFlightRef.current.add(l.id));
    try {
      const results = await Promise.all(
        pending.map(async (lead) => {
          const res = await scanBadgeLead(eventId, {
            code: lead.code,
            name: lead.name,
            company: lead.company,
            title: lead.title,
            notes: lead.notes,
            avatar: lead.avatar,
            tags: lead.tags,
            priority: lead.priority,
          });
          return { lead, res };
        }),
      );
      let synced = 0;
      for (const { lead, res } of results) {
        if (res.success && res.data?.id) {
          replaceLead(lead.id, {
            ...res.data,
            notes: lead.notes || res.data.notes || '',
            tags: lead.tags?.length ? lead.tags : (res.data.tags ?? []),
            priority: lead.priority ?? res.data.priority ?? 'warm',
            timestamp: res.data.timestamp ?? lead.timestamp ?? new Date(),
          });
          synced++;
        }
      }
      return synced;
    } finally {
      // Always release the in-flight slots so the next pass can retry
      // any that didn't succeed this round.
      pending.forEach(l => reconcileInFlightRef.current.delete(l.id));
    }
  // replaceLead is defined later in the same closure; it's stable across
  // renders for this provider so we don't add it to deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gate the background reconciler on an authenticated user *and* an active
  // event. The auth half of the gate is handled by the shared
  // `useAuthedEffect` hook (same primitive every other authenticated
  // periodic effect uses) — it skips the body and tears down the timer on
  // sign-out, then re-arms it cleanly on the next sign-in. The
  // `activeEventId` half is checked inline below since it's specific to
  // this effect. Without these gates the effect's setTimeout chain would
  // wake every minute after logout and fire a `GET /events/:id/leads`
  // probe, every one of which 401s.
  const activeEventId = activeEventConfig?.eventId ?? null;
  useAuthedEffect(user?.id, () => {
    if (!activeEventId) return;

    const BASE_DELAY_MS = 60 * 1000;
    const MAX_DELAY_MS = 10 * 60 * 1000;
    const INITIAL_DELAY_MS = 5 * 1000;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;
    let inFlight = false;

    const computeDelay = () => {
      const exp = Math.min(consecutiveFailures, 4); // cap at 60s * 2^4 = 16min, then clamped
      return Math.min(BASE_DELAY_MS * Math.pow(2, exp), MAX_DELAY_MS);
    };

    const schedule = (ms?: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void tick(); }, ms ?? computeDelay());
    };

    const tick = async () => {
      if (cancelled) return;
      // Don't burn cycles (or backend RPS) while the tab is hidden — the
      // visibility listener below will wake us as soon as the user returns.
      if (typeof document !== 'undefined' && document.hidden) {
        schedule(BASE_DELAY_MS);
        return;
      }

      const pending = leadsRef.current.filter(l => l.pendingSync && !!l.code);
      if (pending.length === 0) {
        // No work to do. Reset failure count so the next time pending leads
        // appear we start at the base interval, not deep in backoff.
        consecutiveFailures = 0;
        schedule(BASE_DELAY_MS);
        return;
      }

      if (inFlight) {
        schedule();
        return;
      }
      inFlight = true;

      try {
        // Delegate to the shared reconciler — it handles the list-endpoint
        // probe, the per-lead in-flight guard (so we don't race the
        // LeadsPage on-mount path), and the replaceLead swap.
        const synced = await reconcilePendingLeadsNow();
        if (cancelled) return;

        if (synced > 0) {
          consecutiveFailures = 0;
          showToast(
            synced === 1
              ? 'Synced 1 pending lead'
              : `Synced ${synced} pending leads`,
          );
        } else {
          // Either the probe failed or every push failed — back off so
          // we don't loop hot when the backend is down.
          consecutiveFailures++;
        }
      } catch {
        consecutiveFailures++;
      } finally {
        inFlight = false;
        if (!cancelled) schedule();
      }
    };

    // Kick off shortly after mount so a fresh pendingSync from a recent
    // scan gets retried promptly without waiting a full minute.
    schedule(INITIAL_DELAY_MS);

    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || document.hidden) return;
      // Returning to foreground — give the backend a fresh chance and
      // attempt soon (small delay so we don't race a focus-driven
      // re-render).
      consecutiveFailures = 0;
      schedule(2000);
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
    // `reconcilePendingLeadsNow` is stable for the provider's lifetime and
    // intentionally excluded so its inclusion can't accidentally retrigger
    // the effect mid-session. `useAuthedEffect` already keys on `userId`;
    // we add `activeEventId` as the only extra dep so the timer rebuilds
    // when the active event changes.
  }, [activeEventId]);

  const joinEvent = () => {
    setHasJoinedEvent(true);
    addPoints(mockGamificationConfig.pointActions.dailyLogin, 'Joined the event!');
  };

  const showToast = (message: string, points?: number) => {
    setToast({ message, points });
    setTimeout(() => setToast(null), 3000);
  };

  const getTierForPoints = (points: number): string => {
    const tier = mockGamificationConfig.tiers.find(
      (t) => points >= t.minPoints && points <= t.maxPoints
    );
    return tier?.name ?? 'Bronze';
  };

  const updateTier = () => {
    if (user) {
      const newTier = getTierForPoints(user.points);
      if (newTier !== user.tier) {
        setUser({ ...user, tier: newTier });
        showToast(`Tier upgraded to ${newTier}!`);
      }
    }
  };

  const addPoints = (points: number, activity: string) => {
    if (user) {
      const newPoints = user.points + points;
      const newTier = getTierForPoints(newPoints);
      setUser({ ...user, points: newPoints, tier: newTier });

      const pointEvent: PointEvent = {
        id: Date.now().toString(),
        action: activity,
        points,
        timestamp: new Date(),
      };
      setPointsHistory((prev) => [pointEvent, ...prev]);

      showToast(activity, points);

      scheduleSyncPoints(newPoints);

      if (newTier !== user.tier) {
        setTimeout(() => showToast(`🎉 Upgraded to ${newTier} tier!`), 3500);
      }
    }
  };

  const setInProgressSurvey = (surveyId: string, data: any) => {
    setInProgressSurveysState((prev) => ({ ...prev, [surveyId]: data }));
  };

  const toggleBookmark = (sessionId: string) => {
    if (bookmarkedSessions.includes(sessionId)) {
      setBookmarkedSessions((prev) => prev.filter((id) => id !== sessionId));
    } else {
      setBookmarkedSessions((prev) => [...prev, sessionId]);
      showToast('Session bookmarked');
    }
  };

  const completeChallenge = (challengeId: string, skipPoints?: boolean) => {
    if (!completedChallenges.includes(challengeId)) {
      setCompletedChallenges((prev) => [...prev, challengeId]);
      if (!skipPoints) {
        addPoints(mockGamificationConfig.pointActions.completeChallenge, 'Challenge completed!');
      }
    }
  };

  const saveLead = (
    leadData: Omit<Lead, 'id' | 'timestamp'> & { id?: string },
    options?: { silent?: boolean },
  ) => {
    const { id: providedId, ...rest } = leadData;
    const newLead: Lead = {
      ...rest,
      id: providedId ?? Date.now().toString(),
      timestamp: new Date(),
    };
    setLeads(prev => {
      // De-dupe by id so a backend-created lead mirrored at scan time doesn't
      // appear twice when the user later saves notes for it.
      const existing = prev.findIndex(l => l.id === newLead.id);
      if (existing !== -1) {
        const next = [...prev];
        next[existing] = { ...prev[existing], ...newLead };
        return next;
      }
      // Secondary dedupe: if there's a local-only (`pendingSync`) lead with
      // the same badge code (or email), this incoming lead is the
      // server-confirmed twin — replace the pending row in-place so the user
      // doesn't see a duplicate. We swap the id and clear `pendingSync` by
      // dropping the old entry entirely and inserting the new one at the
      // same index to preserve list ordering.
      const code = newLead.code?.toLowerCase();
      const email = newLead.email?.toLowerCase();
      const pendingTwinIdx = prev.findIndex(l =>
        l.pendingSync && (
          (code && l.code && l.code.toLowerCase() === code) ||
          (email && l.email && l.email.toLowerCase() === email)
        )
      );
      if (pendingTwinIdx !== -1) {
        const next = [...prev];
        next[pendingTwinIdx] = {
          ...prev[pendingTwinIdx],
          ...newLead,
          // Explicitly clear the pending flag now that the server confirmed it.
          pendingSync: false,
        };
        return next;
      }
      return [newLead, ...prev];
    });
    if (!options?.silent) {
      showToast('Lead saved successfully');
    }
  };

  const updateLead = (id: string, updates: Partial<Pick<Lead, 'notes' | 'tags' | 'priority'>>) => {
    // Look up the badge code BEFORE mutating state so we can mirror the
    // overlay under both `id` and `code:<code>` — handles the case where
    // the lead's id changes between scan-time (POST /leads/scan) and the
    // next list fetch (GET /my-leads), which has been observed in the
    // wild. The merge falls back to the code key when id misses.
    const existing = leads.find(l => l.id === id);
    const code = existing?.code ?? null;
    setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, ...updates } : lead));
    // Also write to the per-user, per-lead edits overlay so notes / tags /
    // priority survive logout → login (the main leads cache is wiped on
    // user change for cross-account isolation; this overlay is the one
    // place the user's edits are kept until the backend ships persistence
    // on the v1 leads endpoints).
    if (user?.id) {
      saveLeadEdit(user.id, id, updates, code);
    }
    showToast('Lead updated successfully');
  };

  const replaceLead = (oldId: string, newLead: Lead) => {
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === oldId);
      if (idx === -1) {
        // Old lead is gone (already reconciled or removed) — only add if the
        // new lead isn't already in the list under its server id.
        if (prev.some(l => l.id === newLead.id)) return prev;
        return [{ ...newLead, pendingSync: false }, ...prev];
      }
      // Drop any other lead that already lives under the server id (rare,
      // but possible if a parallel sync raced ahead) so we don't duplicate.
      const filtered = prev.filter((l, i) => i === idx || l.id !== newLead.id);
      const replaceIdx = filtered.findIndex(l => l.id === oldId);
      const next = [...filtered];
      next[replaceIdx] = { ...filtered[replaceIdx], ...newLead, pendingSync: false };
      return next;
    });
  };

  const sendConnectionRequest = async (toUser: ConnectionRequest['fromUser'], message?: string): Promise<void> => {
    const eventId = activeEventConfig?.eventId;
    if (!eventId) {
      showToast('Join an event to send connection requests.');
      return;
    }
    const tempId = `cr-${Date.now()}`;
    const newReq: ConnectionRequest = {
      id: tempId,
      fromUser: user ? { id: user.id, name: user.name, title: user.title, company: user.company, avatar: user.avatar } : { id: 'current-user', name: '', title: '', company: '', avatar: '' },
      toUserId: toUser.id,
      status: 'pending',
      timestamp: new Date(),
      message,
      direction: 'outgoing',
    };
    setConnectionRequests(prev => [newReq, ...prev]);
    const res = await sendMeetingRequestApi(
      eventId,
      { toUserId: toUser.id, message, toUser },
      user?.id,
    );
    if (res.success) {
      if (res.data && res.data.id !== tempId) {
        setConnectionRequests(prev => prev.map(r => r.id === tempId ? { ...r, id: res.data!.id } : r));
      }
      showToast('Connection request sent!');
    } else if (res.error?.code === 'NOT_IMPLEMENTED') {
      // Backend route missing — keep the optimistic row so the user
      // still sees their pending request locally. Same posture as
      // offline leads. Be honest in the toast: this is a degraded
      // mode and the recipient won't actually see it yet.
      showToast('Saved locally — recipient will see it once the backend route is live.');
    } else {
      setConnectionRequests(prev => prev.filter(r => r.id !== tempId));
      showToast(res.error?.message ?? 'Failed to send connection request.');
    }
  };

  const acceptConnection = (requestId: string) => {
    setConnectionRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: 'accepted' as const } : r)
    );
    const req = connectionRequests.find(r => r.id === requestId);
    if (req) {
      const newConv: Conversation = {
        id: `conv-${Date.now()}`,
        connectionId: requestId,
        participant: req.direction === 'incoming'
          ? req.fromUser
          : { id: req.toUserId, name: 'Attendee', title: '', company: '', avatar: '' },
        messages: [],
        lastActivity: new Date(),
      };
      setConversations(prev => [newConv, ...prev]);
      addPoints(10, 'New connection accepted!');
    }
  };

  const declineConnection = (requestId: string) => {
    setConnectionRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: 'declined' as const } : r)
    );
    showToast('Connection declined');
  };

  const markConversationRead = (conversationId: string) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId
          ? { ...c, messages: c.messages.map(m => ({ ...m, read: true })) }
          : c
      )
    );
  };

  /**
   * Window during which a just-sent message can still be undone.
   * Five seconds is the same affordance Gmail / Slack use — long
   * enough to catch a typo, short enough that the message *feels*
   * sent. The encrypted POST is deferred until the window closes.
   */
  const MESSAGE_UNDO_WINDOW_MS = 5_000;

  /** Resolve the participants for a conversation. Returns null if
   *  the conversation isn't backed by an *accepted* connection — the
   *  UI should never let us reach here in that case, but the guard
   *  keeps a buggy caller from quietly leaking encrypted-but-orphan
   *  rows to the server. */
  const resolveConversationContext = (
    conversationId: string,
  ): { conversation: Conversation; connection: ConnectionRequest; eventId: string } | null => {
    const eventId = activeEventConfig?.eventId;
    if (!eventId) return null;
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return null;
    const connection = connectionRequests.find(
      r => r.id === conversation.connectionId && r.status === 'accepted',
    );
    if (!connection) return null;
    return { conversation, connection, eventId };
  };

  /** Helper: encrypt + POST a message body. Used by both the
   *  deferred send (after the undo window) and `editMessage`. */
  const encryptForConversation = async (
    conversationId: string,
    plaintext: string,
  ): Promise<{ payload: EncryptedPayload; eventId: string } | null> => {
    const ctx = resolveConversationContext(conversationId);
    if (!ctx) return null;
    const me = user?.id || 'current-user';
    const peer = ctx.conversation.participant.id;
    const key = await getOrDeriveConversationKey(ctx.connection.id, me, peer);
    const payload = await encryptMessage(plaintext, key);
    return { payload, eventId: ctx.eventId };
  };

  const sendMessage = (conversationId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const ctx = resolveConversationContext(conversationId);
    if (!ctx) {
      // Connection isn't accepted (or no active event). Surface a
      // toast so the user understands why their message didn't send
      // instead of silently swallowing it.
      showToast('You can only message accepted connections.');
      return;
    }
    const tempId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sentAt = new Date();
    const newMsg: ChatMessage = {
      id: tempId,
      senderId: user?.id || 'current-user',
      text: trimmed,
      timestamp: sentAt,
      read: true,
      pendingSendUntil: Date.now() + MESSAGE_UNDO_WINDOW_MS,
    };
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, newMsg], lastActivity: sentAt }
          : c
      )
    );

    // Defer the actual encrypted POST so the user has a real
    // window to hit Undo. Once the timer fires, encrypt → POST →
    // swap the temp id for the server-issued canonical id.
    const timer = setTimeout(async () => {
      pendingSendTimersRef.current.delete(tempId);
      const enc = await encryptForConversation(conversationId, trimmed).catch(() => null);
      if (!enc) {
        // Encryption failed — refuse to fall back to plaintext.
        // Mark the bubble as failed-to-send instead of dropping it.
        setConversations(prev =>
          prev.map(c =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === tempId ? { ...m, pendingSendUntil: undefined, pendingSync: true } : m,
                  ),
                },
          ),
        );
        showToast('Could not encrypt your message. Try again.');
        return;
      }
      const res = await sendMessageApi(enc.eventId, ctx.conversation.id, enc.payload);
      if (res.success && res.data) {
        const serverId = res.data.id;
        setConversations(prev =>
          prev.map(c =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === tempId
                      ? { ...m, id: serverId, pendingSendUntil: undefined, timestamp: res.data!.timestamp }
                      : m,
                  ),
                },
          ),
        );
      } else if (res.error?.code === 'NOT_IMPLEMENTED') {
        // Backend not deployed yet — keep the local message; just
        // drop the pending flag so the UI stops showing "Sending".
        setConversations(prev =>
          prev.map(c =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === tempId ? { ...m, pendingSendUntil: undefined } : m,
                  ),
                },
          ),
        );
      } else {
        // Hard failure — keep the bubble but mark it pending so the
        // UI can offer a retry.
        setConversations(prev =>
          prev.map(c =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === tempId ? { ...m, pendingSendUntil: undefined, pendingSync: true } : m,
                  ),
                },
          ),
        );
        showToast(res.error?.message ?? 'Could not deliver your message.');
      }
    }, MESSAGE_UNDO_WINDOW_MS);
    pendingSendTimersRef.current.set(tempId, { timer, conversationId });
  };

  const undoSendMessage = (conversationId: string, messageId: string) => {
    const entry = pendingSendTimersRef.current.get(messageId);
    if (!entry) return; // window closed or already fired
    clearTimeout(entry.timer);
    pendingSendTimersRef.current.delete(messageId);
    setConversations(prev =>
      prev.map(c =>
        c.id !== conversationId
          ? c
          : { ...c, messages: c.messages.filter(m => m.id !== messageId) },
      ),
    );
  };

  const editMessage = async (conversationId: string, messageId: string, newText: string): Promise<void> => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const ctx = resolveConversationContext(conversationId);
    if (!ctx) {
      showToast('You can only edit messages on accepted connections.');
      return;
    }
    const original = ctx.conversation.messages.find(m => m.id === messageId);
    if (!original || original.senderId !== (user?.id || 'current-user') || original.deletedAt) return;
    if (original.text === trimmed) return;
    // Optimistic edit — flip pendingSync until the server ack lands.
    const editedAt = new Date();
    setConversations(prev =>
      prev.map(c =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              messages: c.messages.map(m =>
                m.id === messageId ? { ...m, text: trimmed, editedAt, pendingSync: true } : m,
              ),
            },
      ),
    );
    const enc = await encryptForConversation(conversationId, trimmed).catch(() => null);
    if (!enc) {
      // Roll back
      setConversations(prev =>
        prev.map(c =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                messages: c.messages.map(m =>
                  m.id === messageId ? { ...m, text: original.text, editedAt: original.editedAt, pendingSync: false } : m,
                ),
              },
        ),
      );
      showToast('Could not re-encrypt your edit. Try again.');
      return;
    }
    const res = await editMessageApi(enc.eventId, ctx.conversation.id, messageId, enc.payload);
    if (res.success || res.error?.code === 'NOT_IMPLEMENTED') {
      setConversations(prev =>
        prev.map(c =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                messages: c.messages.map(m => (m.id === messageId ? { ...m, pendingSync: false } : m)),
              },
        ),
      );
    } else {
      setConversations(prev =>
        prev.map(c =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                messages: c.messages.map(m =>
                  m.id === messageId ? { ...m, text: original.text, editedAt: original.editedAt, pendingSync: false } : m,
                ),
              },
        ),
      );
      showToast(res.error?.message ?? 'Could not save your edit.');
    }
  };

  const deleteMessage = async (conversationId: string, messageId: string): Promise<void> => {
    const ctx = resolveConversationContext(conversationId);
    if (!ctx) return;
    const original = ctx.conversation.messages.find(m => m.id === messageId);
    if (!original || original.senderId !== (user?.id || 'current-user') || original.deletedAt) return;
    // If the message is still in its undo window, treat delete as
    // an immediate undo — never persisted, never sent.
    const pending = pendingSendTimersRef.current.get(messageId);
    if (pending) {
      undoSendMessage(conversationId, messageId);
      return;
    }
    const deletedAt = new Date();
    setConversations(prev =>
      prev.map(c =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              messages: c.messages.map(m =>
                m.id === messageId ? { ...m, deletedAt, pendingSync: true } : m,
              ),
            },
      ),
    );
    const res = await deleteMessageApi(ctx.eventId, ctx.conversation.id, messageId);
    if (res.success || res.error?.code === 'NOT_IMPLEMENTED') {
      setConversations(prev =>
        prev.map(c =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                messages: c.messages.map(m => (m.id === messageId ? { ...m, pendingSync: false } : m)),
              },
        ),
      );
    } else {
      setConversations(prev =>
        prev.map(c =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                messages: c.messages.map(m =>
                  m.id === messageId ? { ...m, deletedAt: undefined, pendingSync: false } : m,
                ),
              },
        ),
      );
      showToast(res.error?.message ?? 'Could not delete the message.');
    }
  };

  const addSponsorGiveaway = async (giveaway: Omit<SponsorGiveaway, 'id' | 'createdAt'>) => {
    // Optimistic insert with a synthetic id so the sponsor sees their
    // prize immediately even if the network round-trip is slow. On
    // success we swap in the canonical server id; on failure we either
    // roll back (real error) or keep the local row (NOT_IMPLEMENTED —
    // backend route not deployed yet, same posture as offline leads).
    //
    // The event id and user id are *snapshotted* before the network
    // call so a mid-flight `switchEvent` or sign-out can't cause us
    // to merge a row from event A into event B's list (or into a
    // freshly signed-in user's list).
    const eventIdAtCall = activeEventConfig?.eventId;
    const userIdAtCall = user?.id ?? null;
    if (!eventIdAtCall) return;

    const tempId = `giveaway-${Date.now()}`;
    const tempRow: SponsorGiveaway = {
      ...giveaway,
      id: tempId,
      createdAt: new Date(),
    };
    setSponsorGiveaways(prev => [tempRow, ...prev]);
    showToast('Giveaway added successfully');

    const res = await createGiveawayApi(eventIdAtCall, {
      title: giveaway.title,
      numberOfItems: giveaway.numberOfItems,
      image: giveaway.image,
      sponsorName: giveaway.sponsorName,
      sponsorId: giveaway.sponsorId,
    });

    // Side-effects that MUST run regardless of whether the active
    // event/user changed mid-flight: persist the temp -> canonical
    // remap and migrate any overlay entries that were keyed under
    // the temp id while we were waiting on the network. If we don't
    // do this for an event the user has navigated away from, a
    // returning visit to that event would still see orphan winners
    // under the temp id — the merge in `listGiveaways` would miss.
    if (res.success && res.data) {
      const saved = res.data;
      rememberGiveawayIdSwap(eventIdAtCall, tempId, saved.id);
      migrateGiveawayWinnersKey(eventIdAtCall, tempId, saved.id);
    }

    // If the active event or user changed while the POST was in
    // flight, drop the visible-state mutation — the post-switch
    // hydration owns the visible list now and applying our temp swap
    // would leak a giveaway from the previous context. (The remap +
    // overlay migration above are still needed so a future return
    // to this event surfaces the right ids.)
    if (
      activeEventIdRef.current !== eventIdAtCall ||
      userIdRef.current !== userIdAtCall
    ) {
      return;
    }

    if (res.success && res.data) {
      const saved = res.data;
      setSponsorGiveaways(prev =>
        prev.map(g => {
          if (g.id !== tempId) return g;
          // Carry forward any in-memory winners as well, so the UI
          // doesn't briefly drop them between the swap and the
          // post-merge re-hydration.
          const carried = g.winners ?? [];
          return carried.length > 0
            ? { ...saved, winners: [...(saved.winners ?? []), ...carried] }
            : saved;
        }),
      );
      return;
    }
    if (res.error?.code === 'NOT_IMPLEMENTED') {
      // Backend not ready — keep the local row so the sponsor isn't
      // staring at an empty list. They'll be the only one who sees
      // it until the route ships, but the UI stays usable.
      return;
    }
    // Real failure — roll back the temp row and surface the error.
    setSponsorGiveaways(prev => prev.filter(g => g.id !== tempId));
    showToast(res.error?.message ?? 'Failed to save giveaway. Please try again.');
  };

  const updateSponsorGiveaway = async (
    id: string,
    updates: { title?: string; numberOfItems?: number; image?: string },
  ) => {
    const eventIdAtCall = activeEventConfig?.eventId;
    const userIdAtCall = user?.id ?? null;
    const before = sponsorGiveaways.find(g => g.id === id);
    if (!before) return;

    // Optimistic in-memory mutation: the rep sees the change
    // immediately. We snapshot `before` so we can roll back without
    // clobbering any other concurrent edits to the list.
    setSponsorGiveaways(prev =>
      prev.map(g => (g.id === id ? { ...g, ...updates } : g)),
    );

    if (!eventIdAtCall) return;
    // Synthetic ids never round-tripped through the backend (offline
    // or NOT_IMPLEMENTED), so a PATCH would 404. The optimistic
    // local mutation above is the only state change we need.
    if (id.startsWith('giveaway-')) {
      showToast('Giveaway updated');
      return;
    }

    const res = await updateGiveawayApi(eventIdAtCall, id, updates);

    // Mid-flight event/user switch: don't apply server response to
    // a list that no longer represents this event. Keep the
    // optimistic mutation in memory; the next hydration tick will
    // overwrite it with the canonical state for whichever event the
    // user is now viewing.
    if (
      activeEventIdRef.current !== eventIdAtCall ||
      userIdRef.current !== userIdAtCall
    ) {
      return;
    }

    if (res.success && res.data) {
      const saved = res.data;
      setSponsorGiveaways(prev =>
        prev.map(g => {
          if (g.id !== id) return g;
          // Preserve any in-memory winners — the update endpoint
          // doesn't (yet) know about them.
          const carried = g.winners ?? saved.winners ?? [];
          return carried.length > 0 ? { ...saved, winners: carried } : saved;
        }),
      );
      showToast('Giveaway updated');
      return;
    }
    if (res.error?.code === 'NOT_IMPLEMENTED') {
      // Backend route missing — keep the optimistic local mutation
      // so the rep isn't told their edit failed, same posture as
      // create/delete.
      showToast('Giveaway updated');
      return;
    }
    // Real failure — roll back.
    setSponsorGiveaways(prev => prev.map(g => (g.id === id ? before : g)));
    showToast(res.error?.message ?? 'Failed to update giveaway. Please try again.');
  };

  const removeSponsorGiveaway = async (id: string) => {
    const eventIdAtCall = activeEventConfig?.eventId;
    const userIdAtCall = user?.id ?? null;
    const removed = sponsorGiveaways.find(g => g.id === id);
    if (!removed) return;

    setSponsorGiveaways(prev => prev.filter(g => g.id !== id));
    showToast('Giveaway removed');

    if (!eventIdAtCall) return;
    // Synthetic ids (giveaway-<ts>) belong to rows that never made it
    // to the backend (offline-only, or NOT_IMPLEMENTED), so don't
    // try to delete a row the server has never heard of.
    if (id.startsWith('giveaway-')) return;

    const res = await removeGiveawayApi(eventIdAtCall, id);

    // If the active event or user changed while DELETE was in flight,
    // a stale rollback would resurrect a row inside the wrong
    // event's list — bail before touching state.
    if (
      activeEventIdRef.current !== eventIdAtCall ||
      userIdRef.current !== userIdAtCall
    ) {
      return;
    }

    if (res.success) return;
    if (res.error?.code === 'NOT_IMPLEMENTED') return;
    // Real failure — restore the single removed row functionally so
    // we don't clobber any other concurrent edits to the list.
    setSponsorGiveaways(prev => (prev.some(g => g.id === id) ? prev : [removed, ...prev]));
    showToast(res.error?.message ?? 'Failed to remove giveaway. Please try again.');
  };

  const recordGiveawayWinner = (
    giveawayId: string,
    winner: GiveawayWinner,
    eventIdAtDrawStart?: string,
  ) => {
    // Persist to the event the draw was *started* under, falling
    // back to the currently-active event if the caller didn't
    // snapshot one. This prevents a mid-draw `switchEvent` from
    // routing the winner into the wrong event's overlay.
    const targetEventId =
      eventIdAtDrawStart ?? activeEventConfig?.eventId ?? undefined;
    // If the draw was started against an optimistic temp id but
    // the create response has since landed, write under the
    // canonical id so the merge in `listGiveaways` finds it.
    const resolvedId = resolveGiveawayId(targetEventId, giveawayId);
    // Mirror to localStorage first so a quick reload still surfaces
    // the win even if the React state update gets blown away by a
    // mid-flight giveaways re-hydration.
    appendGiveawayWinner(targetEventId, resolvedId, winner);
    // Only mutate the visible giveaway list if we're STILL in the
    // event the draw started in. After a switch, the list belongs
    // to a different event and patching it would briefly leak the
    // winner across events until the next hydration tick.
    if (
      targetEventId &&
      activeEventIdRef.current === targetEventId
    ) {
      setSponsorGiveaways(prev =>
        prev.map(g =>
          g.id === resolvedId
            ? { ...g, winners: [...(g.winners ?? []), winner] }
            : g,
        ),
      );
    }
    // Best-effort push to the backend so the win is persisted to the
    // DB and other devices / the back-office can see it on the next
    // giveaway-list hydration. Fire-and-forget on purpose:
    //   • the localStorage overlay above is already the source of
    //     truth for THIS device, so the UX never depends on this
    //     succeeding;
    //   • the endpoint may not be deployed yet — `saveGiveawayWinner`
    //     short-circuits to NOT_IMPLEMENTED in that case;
    //   • we don't want a slow / failed request to block the winner
    //     reveal animation that's already running on screen.
    // Real failures are logged at warn level so a regression is still
    // visible in the dev console without surfacing as a UI toast.
    if (targetEventId) {
      void saveGiveawayWinnerApi(targetEventId, resolvedId, {
        id: winner.id,
        name: winner.name,
        company: winner.company,
        title: winner.title,
        avatar: winner.avatar,
        drawnAt: winner.drawnAt,
      })
        .then(res => {
          if (!res.success && res.error?.code !== 'NOT_IMPLEMENTED' && typeof console !== 'undefined') {
            console.warn('[recordGiveawayWinner] backend save failed:', res.error);
          }
        })
        .catch(err => {
          if (typeof console !== 'undefined') {
            console.warn('[recordGiveawayWinner] backend save threw:', err);
          }
        });
    }
  };

  // Should the current rep see edit/delete affordances on this
  // giveaway card? Permissive on purpose:
  //
  //   - Any signed-in sponsor at the active event can manage any
  //     giveaway the (event-scoped + authorized) backend list
  //     surfaced. The backend remains the source of truth — a
  //     PATCH/DELETE attempt on someone else's prize will be
  //     rejected server-side and the optimistic UI rolls back.
  //   - Field experience showed strict client-side matching
  //     (sponsorId === user.id OR sponsorName === user.company)
  //     was hiding the rep's own freshly-added prize whenever the
  //     backend re-stamped sponsor_id with a different foreign
  //     key value — so the safer default is "show the buttons,
  //     let the server arbitrate".
  //   - Non-sponsors (attendees) never see this surface at all,
  //     so the public Giveaways page is unaffected.
  //
  // Owner identity is still surfaced via the "Added by …" byline
  // on each card so co-workers know who originally created the
  // prize and don't accidentally duplicate it.
  const isMyGiveaway = (_g: SponsorGiveaway): boolean => {
    return user?.role === 'sponsor';
  };

  const switchEvent = (config: EventConfig) => {
    setActiveEventConfig(config);
    // Each event requires its own join code — reset so the user must verify
    // access to the new event via EventJoinPage or SwitchEventModal's real API.
    // Callers that already verified (e.g. EventJoinPage enterEvent, SwitchEventModal
    // handleConfirmSwitch) must call joinEvent() immediately after to re-gate.
    setHasJoinedEvent(false);
    setCompletedSurveys([]);
    setInProgressSurveysState({});
    setVotedPolls([]);
    setMetSponsors([]);
    setBookmarkedSessions([]);
    setCompletedChallenges([]);
    // Drop the prior event's giveaways immediately so the attendee
    // surfaces don't briefly render the wrong event's prizes (or keep
    // showing them if the new event's hydration fails). The
    // useAuthedEffect on `activeEventConfig.eventId` will refill from
    // the backend.
    setSponsorGiveaways([]);
    // Same posture for connections/conversations: meeting requests
    // and chats are event-scoped, so the prior event's rows must not
    // bleed into the new event's MeetingsPage. Cancel any pending
    // delayed sends for the same reason. Reset the session-scoped
    // NOT_IMPLEMENTED flags so that an event whose tenant has the
    // routes deployed isn't penalized for an earlier event that
    // didn't.
    for (const { timer } of pendingSendTimersRef.current.values()) clearTimeout(timer);
    pendingSendTimersRef.current.clear();
    setConnectionRequests([]);
    setConversations([]);
    clearMessageCryptoCache();
    resetMeetingsEndpointMissing();
    resetMessagesEndpointMissing();
    showToast(`Switched to ${config.name}`);
  };

  return (
    <AppContext.Provider
      value={{
        sessionRestored,
        user,
        eventConfig: activeEventConfig,
        gamificationConfig: mockGamificationConfig,
        completedSurveys,
        inProgressSurveys,
        votedPolls,
        metSponsors,
        bookmarkedSessions,
        completedChallenges,
        pointsHistory,
        hasJoinedEvent,
        leads,
        sponsorGiveaways,
        leaderboard,
        leaderboardLoading,
        leaderboardPeriod,
        connectionRequests,
        conversations,
        setUser,
        joinEvent,
        addPoints,
        setCompletedSurveys,
        setInProgressSurvey,
        setVotedPolls,
        setMetSponsors,
        toggleBookmark,
        completeChallenge,
        saveLead,
        updateLead,
        replaceLead,
        reconcilePendingLeadsNow,
        showToast,
        updateTier,
        switchEvent,
        addSponsorGiveaway,
        updateSponsorGiveaway,
        removeSponsorGiveaway,
        isMyGiveaway,
        recordGiveawayWinner,
        refreshLeaderboard,
        sendConnectionRequest,
        acceptConnection,
        declineConnection,
        sendMessage,
        undoSendMessage,
        editMessage,
        deleteMessage,
        markConversationRead,
        setConnectionRequests,
      }}
    >
      {children}

      {/* Global toast notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-top duration-300 max-w-sm w-[calc(100%-3rem)]">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(17,17,32,0.97)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-3">
              {toast.points !== undefined && (
                <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                  <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>+{toast.points}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>{toast.message}</p>
                {toast.points !== undefined && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Points earned!</p>
                )}
              </div>
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)' }}>
                <svg style={{ width: 13, height: 13, color: '#4ade80' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};