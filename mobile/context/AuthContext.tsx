import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AuthUser, getMe, getMyEventRole, setToken, clearToken, setUnauthorizedHandler, clearUnauthorizedHandler } from '@/lib/apiClient';
import { getUserPoints } from '@/lib/api/users';

interface AppContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  /** True when session was restored from cache because the backend was unreachable. */
  isOffline: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  /** Re-fetch the user's event-scoped role and update user.role in context. */
  refreshEventRole: (eventId: string) => Promise<void>;
  completedChallenges: string[];
  completeChallenge: (id: string) => void;
  bookmarkedSessions: string[];
  toggleBookmark: (id: string) => void;
  /** Map of pollId → optionId the user voted for. Survives navigation within a session. */
  votedPolls: Record<string, string>;
  markPollVoted: (id: string, optionId: string) => void;
  /** Merge server-confirmed poll votes into local state WITHOUT awarding points.
   *  Used after the poll list loads to re-sync prior votes after logout/reinstall. */
  seedVotedPolls: (map: Record<string, string>) => void;
  completedSurveys: string[];
  markSurveyDone: (id: string) => void;
  /** Merge a list of server-confirmed completed survey IDs into local state
   *  WITHOUT awarding points. Used to re-sync state after login / app restart
   *  from the backend list response so already-done surveys don't appear fresh. */
  seedCompletedSurveys: (ids: string[]) => void;
  /** Last-submitted answers per survey, keyed by surveyId. Used to pre-populate on re-open. */
  savedSurveyAnswers: Record<string, Record<string, string>>;
  saveSurveyAnswers: (id: string, answers: Record<string, string>) => void;
  /** Event IDs for which the user has already received check-in points. Persisted across app restarts. */
  checkedInEvents: string[];
  /** Award check-in points once per event, ever. No-op if already checked in. */
  markEventCheckedIn: (eventId: string) => void;
  addPoints: (pts: number, reason: string) => void;
  toast: { message: string; points?: number } | null;
  showToast: (message: string, points?: number) => void;
}

const AuthContext = createContext<AppContextValue | undefined>(undefined);

export function useAuth(): AppContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const TOKEN_KEY = 'cxo_auth_token';
const CACHED_USER_KEY = 'cxo_cached_user';
const CHECKED_IN_EVENTS_KEY = 'cxo_checked_in_events';
const COMPLETED_SURVEYS_KEY = 'cxo_completed_surveys';
const SURVEY_ANSWERS_KEY = 'cxo_survey_answers';
const VOTED_POLLS_KEY = 'cxo_voted_polls';

// ── Event-role cache ──────────────────────────────────────────────────────────
// Resolved roles are stored per (userId, eventId) so different users and events
// never collide. TTL is 24 h — long enough to survive an app restart, short
// enough that a role change (e.g. attendee → sponsor rep) takes effect by the
// next day at the latest. refreshEventRole() always writes a fresh value and
// therefore resets the clock on demand.
const EVENT_ROLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function eventRoleCacheKey(userId: string, eventId: string): string {
  return `cxo_event_role_${userId}_${eventId}`;
}

async function getCachedEventRole(
  userId: string,
  eventId: string,
): Promise<'sponsor' | 'attendee' | null> {
  try {
    const raw = await AsyncStorage.getItem(eventRoleCacheKey(userId, eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role: 'sponsor' | 'attendee'; resolvedAt: number };
    if (Date.now() - parsed.resolvedAt > EVENT_ROLE_CACHE_TTL_MS) return null;
    return parsed.role;
  } catch {
    return null;
  }
}

async function setCachedEventRole(
  userId: string,
  eventId: string,
  role: 'sponsor' | 'attendee',
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      eventRoleCacheKey(userId, eventId),
      JSON.stringify({ role, resolvedAt: Date.now() }),
    );
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, _setUserState] = useState<AuthUser | null>(null);
  // Mirror of user state in a ref so async callbacks always see the current value
  // without needing to be in a useCallback dependency array.
  const userRef = useRef<AuthUser | null>(null);
  const setUserState = useCallback((u: AuthUser | null | ((prev: AuthUser | null) => AuthUser | null)) => {
    if (typeof u === 'function') {
      _setUserState((prev) => {
        const next = u(prev);
        userRef.current = next;
        return next;
      });
    } else {
      userRef.current = u;
      _setUserState(u);
    }
  }, []);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([]);
  const [bookmarkedSessions, setBookmarkedSessions] = useState<string[]>([]);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});
  const [completedSurveys, setCompletedSurveys] = useState<string[]>([]);
  const [savedSurveyAnswers, setSavedSurveyAnswers] = useState<Record<string, Record<string, string>>>({});
  const [checkedInEvents, setCheckedInEvents] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; points?: number } | null>(null);

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    // Re-install on every user change so the handler captures the
    // *current* user id when the backend invalidates the session (e.g.
    // expired token). We deliberately do NOT wipe persisted leads
    // here: storage is keyed by `(userId, eventId)` (see
    // `leadsStorage.ts`), so a different user signing in cannot read
    // the prior user's slot, and the same user signing back in
    // expects their scanned leads to still be there. Wiping caused
    // the "leads disappeared after I signed out" report.
    setUnauthorizedHandler(() => {
      setTokenState(null);
      setUserState(null);
      setCompletedChallenges([]);
      setBookmarkedSessions([]);
      setVotedPolls({});
      setCompletedSurveys([]);
      setSavedSurveyAnswers({});
      setCheckedInEvents([]);
      AsyncStorage.multiRemove([TOKEN_KEY, CACHED_USER_KEY, COMPLETED_SURVEYS_KEY, SURVEY_ANSWERS_KEY, VOTED_POLLS_KEY]).catch(() => {});
      router.replace('/(auth)/welcome');
    });
    return () => clearUnauthorizedHandler();
  }, [user?.id, queryClient]);

  async function restoreSession() {
    try {
      // Restore persisted engagement state so survey answers, poll votes, and
      // completed survey IDs survive app restarts.
      const [storedCheckedIn, storedSurveys, storedAnswers, storedPolls] = await Promise.all([
        AsyncStorage.getItem(CHECKED_IN_EVENTS_KEY),
        AsyncStorage.getItem(COMPLETED_SURVEYS_KEY),
        AsyncStorage.getItem(SURVEY_ANSWERS_KEY),
        AsyncStorage.getItem(VOTED_POLLS_KEY),
      ]);
      if (storedCheckedIn) { try { setCheckedInEvents(JSON.parse(storedCheckedIn)); } catch {} }
      if (storedSurveys)   { try { setCompletedSurveys(JSON.parse(storedSurveys)); }   catch {} }
      if (storedAnswers)   { try { setSavedSurveyAnswers(JSON.parse(storedAnswers)); }  catch {} }
      if (storedPolls)     { try { setVotedPolls(JSON.parse(storedPolls)); }            catch {} }

      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      await setToken(storedToken);
      setTokenState(storedToken);

      const cachedRaw = await AsyncStorage.getItem(CACHED_USER_KEY);
      let hasCachedUser = false;
      if (cachedRaw) {
        try {
          const cachedUser: AuthUser = JSON.parse(cachedRaw);
          setUserState(cachedUser);
          hasCachedUser = true;
        } catch {}
      }

      if (hasCachedUser) {
        setIsLoading(false);
      }

      const res = await getMe();

      if (res.success && res.data) {
        // Backend /me returns the global role ("attendee" for everyone).
        // Roles are stored per-event. Read the cached event ID and resolve the
        // event-scoped role so sponsor reps see the correct footer immediately.
        //
        // Role resolution makes up to 3 sequential HTTP requests (badge_code
        // lookup → full roster → checked-in only). On repeat launches we serve
        // the locally-cached role instantly and refresh in the background so
        // the app starts fast without skipping the update.
        let freshUser = res.data;
        try {
          const cachedEventId = await AsyncStorage.getItem('cxo_current_event_id');
          if (cachedEventId) {
            const cachedRole = await getCachedEventRole(freshUser.id, cachedEventId);
            let eventRole: 'sponsor' | 'attendee';
            if (cachedRole !== null) {
              // Use the cached role immediately — no network call needed.
              eventRole = cachedRole;
              // Refresh in the background so a role change (e.g. attendee →
              // sponsor rep) takes effect without blocking the current launch.
              getMyEventRole(cachedEventId, freshUser.id, freshUser.badgeCode)
                .then((fresh) => setCachedEventRole(freshUser.id, cachedEventId, fresh))
                .catch(() => {});
            } else {
              // Cache miss (first launch for this event) — resolve synchronously
              // and persist the result so future launches are instant.
              eventRole = await getMyEventRole(cachedEventId, freshUser.id, freshUser.badgeCode);
              setCachedEventRole(freshUser.id, cachedEventId, eventRole).catch(() => {});
            }
            if (eventRole !== freshUser.role) {
              freshUser = { ...freshUser, role: eventRole };
            }
          }
        } catch {}
        setUserState(freshUser);
        setIsOffline(false);
        await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(freshUser));
      } else if (res.error?.code === 'NETWORK_ERROR') {
        // Network issue — keep cached user and flag as offline
        setIsOffline(true);
      } else {
        // Auth failure — clear token and session
        await clearToken();
        await AsyncStorage.multiRemove([TOKEN_KEY, CACHED_USER_KEY]);
        setTokenState(null);
        setUserState(null);
      }
    } catch {
      // Unexpected error — clear for safety
      await clearToken().catch(() => {});
      await AsyncStorage.multiRemove([TOKEN_KEY, CACHED_USER_KEY]).catch(() => {});
      setTokenState(null);
      setUserState(null);
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(async (tok: string, u: AuthUser) => {
    await setToken(tok);
    await AsyncStorage.setItem(TOKEN_KEY, tok);
    await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u));
    setTokenState(tok);
    setUserState(u);
    setIsOffline(false);
  }, []);

  const logout = useCallback(async () => {
    // Sign out by clearing the auth token + cached user only. We
    // intentionally **leave** the persisted leads in AsyncStorage:
    // the storage key is `(userId, eventId)`-scoped, so a different
    // user signing in next can't read the prior user's slot, and the
    // **same** user signing back in expects their scanned leads to
    // still be there for that event. Wiping on logout was the cause
    // of the "all my leads disappeared after I signed out" report.
    await clearToken();
    await AsyncStorage.multiRemove([TOKEN_KEY, CACHED_USER_KEY, COMPLETED_SURVEYS_KEY, SURVEY_ANSWERS_KEY, VOTED_POLLS_KEY]);
    setTokenState(null);
    setUserState(null);
    setCompletedChallenges([]);
    setBookmarkedSessions([]);
    setVotedPolls({});
    setCompletedSurveys([]);
    setSavedSurveyAnswers({});
    setCheckedInEvents([]);
    // Note: intentionally keep CHECKED_IN_EVENTS_KEY on logout so the
    // same user logging back in doesn't get duplicate check-in points.
  }, []);

  const setUser = useCallback((u: AuthUser) => {
    setUserState(u);
    AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
  }, []);

  const refreshEventRole = useCallback(async (eventId: string) => {
    // Use userRef so this always sees the current user without stale closures.
    const current = userRef.current;
    if (!current?.id) return;
    // Pass badgeCode as primary lookup key (single-record search, faster).
    const role = await getMyEventRole(eventId, current.id, current.badgeCode);
    // Persist the freshly resolved role so the next app launch is instant.
    setCachedEventRole(current.id, eventId, role).catch(() => {});
    setUserState((latest) => {
      if (!latest || latest.role === role) return latest;
      const updated = { ...latest, role };
      AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, [setUserState]);

  const showToast = useCallback((message: string, points?: number) => {
    setToast({ message, points });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const getTierForPoints = (pts: number): string => {
    if (pts >= 500) return 'Platinum';
    if (pts >= 250) return 'Gold';
    if (pts >= 100) return 'Silver';
    return 'Bronze';
  };

  const addPoints = useCallback((pts: number, reason: string) => {
    setUserState((prev) => {
      if (!prev) return prev;
      const newPoints = prev.points + pts;
      const newTier = getTierForPoints(newPoints);
      const updated = { ...prev, points: newPoints, tier: newTier };
      AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    showToast(reason, pts);
  }, [showToast]);

  const completeChallenge = useCallback((id: string) => {
    setCompletedChallenges((prev) => {
      if (prev.includes(id)) return prev;
      addPoints(100, 'Challenge completed!');
      return [...prev, id];
    });
  }, [addPoints]);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedSessions((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const markPollVoted = useCallback((id: string, optionId: string) => {
    setVotedPolls((prev) => {
      if (prev[id] !== undefined) return prev; // already voted, no duplicate points
      addPoints(10, 'Poll voted!');
      const next = { ...prev, [id]: optionId };
      AsyncStorage.setItem(VOTED_POLLS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [addPoints]);

  /** Merge server-confirmed votes without awarding points. Called after list load. */
  const seedVotedPolls = useCallback((map: Record<string, string>) => {
    if (!Object.keys(map).length) return;
    setVotedPolls((prev) => {
      const toAdd: Record<string, string> = {};
      for (const [pollId, optionId] of Object.entries(map)) {
        if (!(pollId in prev)) toAdd[pollId] = optionId;
      }
      if (!Object.keys(toAdd).length) return prev;
      const next = { ...prev, ...toAdd };
      AsyncStorage.setItem(VOTED_POLLS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const markSurveyDone = useCallback((id: string) => {
    setCompletedSurveys((prev) => {
      if (prev.includes(id)) return prev;
      addPoints(50, 'Survey completed!');
      const next = [...prev, id];
      AsyncStorage.setItem(COMPLETED_SURVEYS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [addPoints]);

  /** Merge server-confirmed completed IDs without awarding points.
   *  Called after the survey list loads so a fresh install / logout-login
   *  immediately reflects the user's true completion state from the backend. */
  const seedCompletedSurveys = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setCompletedSurveys((prev) => {
      const newIds = ids.filter((id) => !prev.includes(id));
      if (!newIds.length) return prev;
      const next = [...prev, ...newIds];
      AsyncStorage.setItem(COMPLETED_SURVEYS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const saveSurveyAnswers = useCallback((id: string, answers: Record<string, string>) => {
    setSavedSurveyAnswers(prev => {
      const next = { ...prev, [id]: answers };
      AsyncStorage.setItem(SURVEY_ANSWERS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const markEventCheckedIn = useCallback((eventId: string) => {
    setCheckedInEvents((prev) => {
      if (prev.includes(eventId)) return prev;
      addPoints(50, 'Event check-in! Welcome!');
      const next = [...prev, eventId];
      // Persist so app restarts don't re-award the same check-in points.
      AsyncStorage.setItem(CHECKED_IN_EVENTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [addPoints]);

  // ── Backend points sync ────────────────────────────────────────────────
  // Sponsor scan points are awarded server-side to the scanned attendee.
  // The local addPoints() only handles actions the user takes themselves,
  // so we periodically fetch /my-rank and take Math.max(local, backend) to
  // surface any server-awarded points (scan, admin grants, etc.) without
  // clobbering optimistic local updates that haven't synced yet.
  useEffect(() => {
    if (!user?.id) return;

    // Tracks the wall-clock time of the last completed sync so the
    // AppState listener can skip redundant calls (e.g. rapid lock/unlock
    // cycles). The periodic interval already covers the steady-state
    // refresh cadence; the AppState listener is only there to catch
    // long foreground gaps. A 5-minute cooldown prevents a burst of
    // GET /my-rank calls on every phone unlock.
    const lastSyncAt = { current: 0 };
    const FOREGROUND_COOLDOWN_MS = 5 * 60 * 1000;

    const sync = async () => {
      const res = await getUserPoints().catch(() => null);
      if (!res?.success || !res.data) return;
      lastSyncAt.current = Date.now();
      const backendPts = res.data.points;
      const backendTier = res.data.tier;
      setUserState((prev) => {
        if (!prev) return prev;
        const merged = Math.max(prev.points, backendPts);
        if (merged === prev.points && backendTier === prev.tier) return prev;
        const updated = { ...prev, points: merged, tier: backendTier || prev.tier };
        AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    };

    void sync();

    const interval = setInterval(sync, 2 * 60 * 1000);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      if (Date.now() - lastSyncAt.current < FOREGROUND_COOLDOWN_MS) return;
      void sync();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [user?.id, setUserState]);

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, isOffline,
      login, logout, setUser, refreshEventRole,
      completedChallenges, completeChallenge,
      bookmarkedSessions, toggleBookmark,
      votedPolls, markPollVoted, seedVotedPolls,
      completedSurveys, markSurveyDone, seedCompletedSurveys, savedSurveyAnswers, saveSurveyAnswers,
      checkedInEvents, markEventCheckedIn,
      addPoints, toast, showToast,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
