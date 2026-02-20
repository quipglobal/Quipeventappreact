export interface EventConfig {
  eventId: string;
  name: string;
  dates: string;
  timezone: string;
  location: string;
  logoURL: string;
  backgroundURL: string;
  themeColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  modulesEnabled: {
    agenda: boolean;
    sponsors: boolean;
    surveys: boolean;
    polls: boolean;
    leaderboard: boolean;
    audience: boolean;
    challenges: boolean;
    notifications: boolean;
  };
  permissions: {
    guestAccess: boolean;
    sponsorRoleEnabled: boolean;
    networkingEnabled: boolean;
  };
}

export interface GamificationConfig {
  pointActions: {
    completeSurvey: number;
    votePoll: number;
    sponsorCheckIn: number;
    sessionCheckIn: number;
    dailyLogin: number;
    completeProfile: number;
    completeChallenge: number;
  };
  badges: {
    name: string;
    threshold: number;
    icon: string;
    color: string;
  }[];
  tiers: {
    name: string;
    minPoints: number;
    maxPoints: number;
    color: string;
  }[];
}

export interface Session {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  room: string;
  track: string;
  type: string;
  tags: string[];
  speakers: Speaker[];
  description: string;
  pollId?: string;
  surveyId?: string;
  isBookmarked?: boolean;
}

export interface Speaker {
  id: string;
  name: string;
  title: string;
  company: string;
  avatar: string;
  bio?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: string;
  logo: string;
  booth: string;
  tagline: string;
  description: string;
  website: string;
  resources: Resource[];
  staff: Speaker[];
  meetingEnabled: boolean;
  appointmentEnabled: boolean;
}

export interface Resource {
  id: string;
  title: string;
  type: 'pdf' | 'video' | 'link';
  url: string;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  estimatedTime: string;
  status: 'new' | 'in_progress' | 'completed';
  questions: SurveyQuestion[];
}

export interface SurveyQuestion {
  id: string;
  question: string;
  type: 'single' | 'multi' | 'rating' | 'nps' | 'text' | 'long_text';
  options?: string[];
  required: boolean;
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  isLive: boolean;
  startTime: string;
  endTime: string;
  options: PollOption[];
  resultsVisibility: 'immediate' | 'after_vote' | 'after_close';
  sessionId?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  progress: number;
  target: number;
  type: 'sponsor_visits' | 'survey_completion' | 'poll_votes' | 'session_attendance' | 'networking';
  expiresAt?: string;
  completed: boolean;
}
