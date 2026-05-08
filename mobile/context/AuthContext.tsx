import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AuthUser, getMe, getMyEventRole, setToken, clearToken, setUnauthorizedHandler, clearUnauthorizedHandler } from '@/lib/apiClient';

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
  votedPolls: string[];
  markPollVoted: (id: string) => void;
  completedSurveys: string[];
  markSurveyDone: (id: string) => void;
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
  const [votedPolls, setVotedPolls] = useState<string[]>([]);
  const [completedSurveys, setCompletedSurveys] = useState<string[]>([]);
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
      setVotedPolls([]);
      setCompletedSurveys([]);
      AsyncStorage.multiRemove([TOKEN_KEY, CACHED_USER_KEY]).catch(() => {});
      router.replace('/(auth)/welcome');
    });
    return () => clearUnauthorizedHandler();
  }, [user?.id, queryClient]);

  async function restoreSession() {
    try {
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
        // Backend /me always returns the global role ("attendee" for everyone).
        // Roles are stored per-event. Read the cached event ID and fetch the
        // event-scoped role so sponsor reps see the correct footer immediately.
        let freshUser = res.data;
        try {
          const cachedEventId = await AsyncStorage.getItem('cxo_current_event_id');
          if (cachedEventId) {
            const eventRole = await getMyEventRole(cachedEventId, freshUser.id);
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
    await AsyncStorage.multiRemove([TOKEN_KEY, CACHED_USER_KEY]);
    setTokenState(null);
    setUserState(null);
    setCompletedChallenges([]);
    setBookmarkedSessions([]);
    setVotedPolls([]);
    setCompletedSurveys([]);
  }, []);

  const setUser = useCallback((u: AuthUser) => {
    setUserState(u);
    AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
  }, []);

  const refreshEventRole = useCallback(async (eventId: string) => {
    // Use userRef so this always sees the current user without stale closures.
    const userId = userRef.current?.id;
    if (!userId) return;
    const role = await getMyEventRole(eventId, userId);
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

  const markPollVoted = useCallback((id: string) => {
    setVotedPolls((prev) => {
      if (prev.includes(id)) return prev;
      addPoints(10, 'Poll voted!');
      return [...prev, id];
    });
  }, [addPoints]);

  const markSurveyDone = useCallback((id: string) => {
    setCompletedSurveys((prev) => {
      if (prev.includes(id)) return prev;
      addPoints(50, 'Survey completed!');
      return [...prev, id];
    });
  }, [addPoints]);

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, isOffline,
      login, logout, setUser, refreshEventRole,
      completedChallenges, completeChallenge,
      bookmarkedSessions, toggleBookmark,
      votedPolls, markPollVoted,
      completedSurveys, markSurveyDone,
      addPoints, toast, showToast,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
