// @refresh reset
import React, { createContext, useContext, useState, useEffect } from 'react';
import { EventConfig, GamificationConfig } from '@/app/types/config';
import { getMeApi } from '@/app/api/authClient';
import { clearToken } from '@/app/api/client';
import { sendMeetingRequest as sendMeetingRequestApi } from '@/app/api/meetingsClient';
import { fetchPointsFromBackend, scheduleSyncPoints } from '@/app/api/pointsClient';
import { getMyEventRoleApi } from '@/app/api/audienceClient';

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
  /** True when the lead was saved locally because the backend
   *  /leads/scan call failed. The lead is captured on this device but
   *  hasn't been synced to the server — switching devices or clearing
   *  storage will lose it. The UI shows a "Saved on this device"
   *  indicator and a Retry-sync action when this is set. */
  pendingSync?: boolean;
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
  /** Clear the `pendingSync` flag once a previously offline-only lead
   *  has been successfully posted to the backend. Optionally swaps the
   *  local synthetic id for the canonical server id. */
  markLeadSynced: (localId: string, serverId?: string) => void;
  showToast: (message: string, points?: number) => void;
  updateTier: () => void;
  switchEvent: (config: EventConfig) => void;
  addSponsorGiveaway: (giveaway: Omit<SponsorGiveaway, 'id' | 'createdAt'>) => void;
  removeSponsorGiveaway: (id: string) => void;
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sponsorGiveaways, setSponsorGiveaways] = useState<SponsorGiveaway[]>([]);
  const [hasJoinedEvent, setHasJoinedEvent] = useState(false);
  const [toast, setToast] = useState<{ message: string; points?: number } | null>(null);

  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);

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
      return [newLead, ...prev];
    });
    if (!options?.silent) {
      showToast('Lead saved successfully');
    }
  };

  const updateLead = (id: string, updates: Partial<Pick<Lead, 'notes' | 'tags' | 'priority'>>) => {
    setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, ...updates } : lead));
    showToast('Lead updated successfully');
  };

  const markLeadSynced = (localId: string, serverId?: string) => {
    setLeads(prev => prev.map(lead =>
      lead.id === localId
        ? { ...lead, id: serverId ?? lead.id, pendingSync: false }
        : lead,
    ));
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
        markLeadSynced,
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