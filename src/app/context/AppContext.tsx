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
  addSponsorGiveaway: (giveaway: Omit<SponsorGiveaway, 'id' | 'createdAt'>) => void;
  removeSponsorGiveaway: (id: string) => void;
  sendConnectionRequest: (toUser: ConnectionRequest['fromUser'], message?: string) => void;
  acceptConnection: (requestId: string) => void;
  declineConnection: (requestId: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  markConversationRead: (conversationId: string) => void;
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
  const [sponsorGiveaways, setSponsorGiveaways] = useState<SponsorGiveaway[]>([]);
  const [hasJoinedEvent, setHasJoinedEvent] = useState(false);
  const [toast, setToast] = useState<{ message: string; points?: number } | null>(null);

  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([
    {
      id: 'cr-1', direction: 'incoming', status: 'pending',
      fromUser: { id: 'att-1', name: 'Dr. Sarah Chen', title: 'Chief AI Officer', company: 'TechCorp Solutions', avatar: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=6366f1&color=fff' },
      toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 12),
      message: 'Hi! I loved your talk on product design. Would love to connect and discuss collaboration opportunities.',
    },
    {
      id: 'cr-2', direction: 'incoming', status: 'pending',
      fromUser: { id: 'att-3', name: 'Priya Patel', title: 'Product Lead', company: 'DesignFlow', avatar: 'https://ui-avatars.com/api/?name=Priya+Patel&background=ec4899&color=fff' },
      toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 45),
      message: 'Hey! We should chat about the UX research panel.',
    },
    {
      id: 'cr-3', direction: 'incoming', status: 'pending',
      fromUser: { id: 'att-6', name: 'James Wilson', title: 'CTO', company: 'CloudNine Systems', avatar: 'https://ui-avatars.com/api/?name=James+Wilson&background=f59e0b&color=fff' },
      toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 90),
    },
    {
      id: 'cr-4', direction: 'outgoing', status: 'pending',
      fromUser: { id: 'user-001', name: '', title: '', company: '', avatar: '' },
      toUserId: 'att-5', timestamp: new Date(Date.now() - 1000 * 60 * 30),
      message: 'Would love to connect about your infrastructure work!',
    },
    {
      id: 'cr-5', direction: 'incoming', status: 'accepted',
      fromUser: { id: 'att-2', name: 'Marcus Johnson', title: 'VP of Engineering', company: 'InnovateLab', avatar: 'https://ui-avatars.com/api/?name=Marcus+Johnson&background=8b5cf6&color=fff' },
      toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
      message: 'Great meetup at the networking session!',
    },
    {
      id: 'cr-6', direction: 'incoming', status: 'accepted',
      fromUser: { id: 'att-4', name: 'Elena Rodriguez', title: 'Head of Data Science', company: 'QuantumLeap AI', avatar: 'https://ui-avatars.com/api/?name=Elena+Rodriguez&background=10b981&color=fff' },
      toUserId: 'current-user', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    },
  ]);

  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 'conv-1', connectionId: 'cr-5',
      participant: { id: 'att-2', name: 'Marcus Johnson', title: 'VP of Engineering', company: 'InnovateLab', avatar: 'https://ui-avatars.com/api/?name=Marcus+Johnson&background=8b5cf6&color=fff' },
      lastActivity: new Date(Date.now() - 1000 * 60 * 8),
      messages: [
        { id: 'm1', senderId: 'att-2', text: 'Hey! Great connecting at the networking session earlier.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), read: true },
        { id: 'm2', senderId: 'user-001', text: 'Likewise! Your talk on scaling engineering teams was really insightful.', timestamp: new Date(Date.now() - 1000 * 60 * 55), read: true },
        { id: 'm3', senderId: 'att-2', text: 'Thanks! Would you be interested in grabbing coffee tomorrow morning before the keynote?', timestamp: new Date(Date.now() - 1000 * 60 * 30), read: true },
        { id: 'm4', senderId: 'user-001', text: 'Absolutely! How about 8:30 AM at the lobby cafe?', timestamp: new Date(Date.now() - 1000 * 60 * 15), read: true },
        { id: 'm5', senderId: 'att-2', text: 'Perfect, see you there!', timestamp: new Date(Date.now() - 1000 * 60 * 8), read: false },
      ],
    },
    {
      id: 'conv-2', connectionId: 'cr-6',
      participant: { id: 'att-4', name: 'Elena Rodriguez', title: 'Head of Data Science', company: 'QuantumLeap AI', avatar: 'https://ui-avatars.com/api/?name=Elena+Rodriguez&background=10b981&color=fff' },
      lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 2),
      messages: [
        { id: 'm6', senderId: 'att-4', text: 'Hi there! I saw your profile and noticed we share an interest in ML applications.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), read: true },
        { id: 'm7', senderId: 'user-001', text: 'Yes! Are you attending the ML workshop tomorrow afternoon?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), read: true },
        { id: 'm8', senderId: 'att-4', text: 'Definitely! Save me a seat if you get there first.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), read: true },
      ],
    },
  ]);

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

  const sendConnectionRequest = (toUser: ConnectionRequest['fromUser'], message?: string) => {
    const newReq: ConnectionRequest = {
      id: `cr-${Date.now()}`,
      fromUser: user ? { id: user.id, name: user.name, title: user.title, company: user.company, avatar: user.avatar } : { id: 'current-user', name: '', title: '', company: '', avatar: '' },
      toUserId: toUser.id,
      status: 'pending',
      timestamp: new Date(),
      message,
      direction: 'outgoing',
    };
    setConnectionRequests(prev => [newReq, ...prev]);
    showToast('Connection request sent!');
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

  const addSponsorGiveaway = (giveaway: Omit<SponsorGiveaway, 'id' | 'createdAt'>) => {
    const newGiveaway: SponsorGiveaway = {
      ...giveaway,
      id: `giveaway-${Date.now()}`,
      createdAt: new Date(),
    };
    setSponsorGiveaways(prev => [newGiveaway, ...prev]);
    showToast('Giveaway added successfully');
  };

  const removeSponsorGiveaway = (id: string) => {
    setSponsorGiveaways(prev => prev.filter(g => g.id !== id));
    showToast('Giveaway removed');
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