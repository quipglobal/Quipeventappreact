// @refresh reset
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { EventConfig, GamificationConfig } from '@/app/types/config';
import { getMeApi } from '@/app/api/authClient';
import { clearToken } from '@/app/api/client';
import { sendMeetingRequest as sendMeetingRequestApi } from '@/app/api/meetingsClient';
import { fetchPointsFromBackend, scheduleSyncPoints, cancelPendingSyncPoints } from '@/app/api/pointsClient';
import { getMyEventRoleApi } from '@/app/api/audienceClient';
import { loadLeadsFromStorage, saveLeadsToStorage, clearLeadsStorage } from '@/app/lib/leadsStorage';
import { saveLeadEdit } from '@/app/lib/leadEditsStorage';
import { listLeads as listLeadsApi, scanBadgeLead, resetScanEndpointMissing } from '@/app/api/leadsClient';
import {
  listGiveaways as listGiveawaysApi,
  createGiveaway as createGiveawayApi,
  removeGiveaway as removeGiveawayApi,
  resetGiveawaysEndpointMissing,
} from '@/app/api/giveawaysClient';
import { useAuthedEffect } from '@/app/hooks/useAuthedEffect';

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
  text: string;
  timestamp: Date;
  read: boolean;
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
}

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
  removeSponsorGiveaway: (id: string) => Promise<void>;
  sendConnectionRequest: (toUser: ConnectionRequest['fromUser'], message?: string) => Promise<void>;
  acceptConnection: (requestId: string) => void;
  declineConnection: (requestId: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
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
      listGiveawaysApi(eventId).then(res => {
        if (cancelled) return;
        if (res.success && res.data) {
          setSponsorGiveaways(res.data);
        }
        // On NOT_IMPLEMENTED / network error: silently keep current state.
        // The sponsor UI still works locally; reconciliation picks up
        // whenever the backend comes online and the user re-enters.
      });
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
    const res = await sendMeetingRequestApi({ toUserId: toUser.id, message, toUser });
    if (res.success) {
      if (res.data && res.data.id !== tempId) {
        setConnectionRequests(prev => prev.map(r => r.id === tempId ? { ...r, id: res.data!.id } : r));
      }
      showToast('Connection request sent!');
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

  const sendMessage = (conversationId: string, text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: user?.id || 'current-user',
      text,
      timestamp: new Date(),
      read: true,
    };
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, newMsg], lastActivity: new Date() }
          : c
      )
    );
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

    // If the active event or user changed while the POST was in
    // flight, drop the result on the floor — the post-switch
    // hydration owns the visible list now and applying our temp swap
    // would leak a giveaway from the previous context.
    if (
      activeEventIdRef.current !== eventIdAtCall ||
      userIdRef.current !== userIdAtCall
    ) {
      return;
    }

    if (res.success && res.data) {
      const saved = res.data;
      setSponsorGiveaways(prev => prev.map(g => (g.id === tempId ? saved : g)));
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

  const switchEvent = (config: EventConfig) => {
    setActiveEventConfig(config);
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
        removeSponsorGiveaway,
        sendConnectionRequest,
        acceptConnection,
        declineConnection,
        sendMessage,
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