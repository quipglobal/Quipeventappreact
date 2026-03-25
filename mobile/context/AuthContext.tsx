import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, getMe, setToken, clearToken } from '@/lib/apiClient';

interface AppContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([]);
  const [bookmarkedSessions, setBookmarkedSessions] = useState<string[]>([]);
  const [votedPolls, setVotedPolls] = useState<string[]>([]);
  const [completedSurveys, setCompletedSurveys] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; points?: number } | null>(null);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (!storedToken) { setIsLoading(false); return; }
      await setToken(storedToken);
      setTokenState(storedToken);
      const res = await getMe();
      if (res.success && res.data) {
        setUserState(res.data);
      } else {
        await clearToken();
        setTokenState(null);
      }
    } catch {
      await clearToken();
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(async (tok: string, u: AuthUser) => {
    await setToken(tok);
    await AsyncStorage.setItem(TOKEN_KEY, tok);
    setTokenState(tok);
    setUserState(u);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    await AsyncStorage.removeItem(TOKEN_KEY);
    setTokenState(null);
    setUserState(null);
    setCompletedChallenges([]);
    setBookmarkedSessions([]);
    setVotedPolls([]);
    setCompletedSurveys([]);
  }, []);

  const setUser = useCallback((u: AuthUser) => setUserState(u), []);

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
      return { ...prev, points: newPoints, tier: newTier };
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
      user, token, isLoading,
      login, logout, setUser,
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
