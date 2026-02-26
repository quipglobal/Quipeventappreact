// @refresh reset
import React, { createContext, useContext, useState } from 'react';
import { EventConfig, GamificationConfig } from '@/app/types/config';

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
}

interface PointEvent {
  id: string;
  action: string;
  points: number;
  timestamp: Date;
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
}

interface AppContextType extends AppState {
  setUser: (user: User | null) => void;
  joinEvent: () => void;
  addPoints: (points: number, activity: string) => void;
  setCompletedSurveys: (surveys: string[]) => void;
  setInProgressSurvey: (surveyId: string, data: any) => void;
  setVotedPolls: (polls: string[]) => void;
  setMetSponsors: (sponsors: string[]) => void;
  toggleBookmark: (sessionId: string) => void;
  completeChallenge: (challengeId: string) => void;
  saveLead: (lead: Omit<Lead, 'id' | 'timestamp'>) => void;
  updateLead: (id: string, updates: Partial<Pick<Lead, 'notes' | 'tags' | 'priority'>>) => void;
  showToast: (message: string, points?: number) => void;
  updateTier: () => void;
  switchEvent: (config: EventConfig) => void;
}

// ─── Mock configs ─────────────────────────────────────────────────────────────

const mockEventConfig: EventConfig = {
  eventId: 'tech-summit-2026',
  name: 'Tech Summit 2026',
  dates: 'January 16-18, 2026',
  timezone: 'PST',
  location: 'San Francisco, CA',
  logoURL: '',
  backgroundURL: '',
  themeColors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
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
  const [activeEventConfig, setActiveEventConfig] = useState<EventConfig>(mockEventConfig);
  const [completedSurveys, setCompletedSurveys] = useState<string[]>([]);
  const [inProgressSurveys, setInProgressSurveysState] = useState<Record<string, any>>({});
  const [votedPolls, setVotedPolls] = useState<string[]>([]);
  const [metSponsors, setMetSponsors] = useState<string[]>([]);
  const [bookmarkedSessions, setBookmarkedSessions] = useState<string[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [hasJoinedEvent, setHasJoinedEvent] = useState(false);
  const [toast, setToast] = useState<{ message: string; points?: number } | null>(null);

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

  const completeChallenge = (challengeId: string) => {
    if (!completedChallenges.includes(challengeId)) {
      setCompletedChallenges((prev) => [...prev, challengeId]);
      addPoints(mockGamificationConfig.pointActions.completeChallenge, 'Challenge completed!');
    }
  };

  const saveLead = (leadData: Omit<Lead, 'id' | 'timestamp'>) => {
    const newLead: Lead = {
      ...leadData,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setLeads(prev => [newLead, ...prev]);
    showToast('Lead saved successfully');
  };

  const updateLead = (id: string, updates: Partial<Pick<Lead, 'notes' | 'tags' | 'priority'>>) => {
    setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, ...updates } : lead));
    showToast('Lead updated successfully');
  };

  const switchEvent = (config: EventConfig) => {
    setActiveEventConfig(config);
    setCompletedSurveys([]);
    setInProgressSurveysState({});
    setVotedPolls([]);
    setMetSponsors([]);
    setBookmarkedSessions([]);
    setCompletedChallenges([]);
    showToast(`Switched to ${config.name}`);
  };

  return (
    <AppContext.Provider
      value={{
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
        showToast,
        updateTier,
        switchEvent,
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