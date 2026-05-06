export type { ApiResponse, AuthUser } from '@/lib/apiClient';

export interface Event {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  bannerUrl?: string;
  category?: string;
  status: 'upcoming' | 'live' | 'past';
}

export interface SessionAudienceMember {
  id: string;
  name: string;
  title?: string;
  company?: string;
  avatar?: string;
}

export interface Session {
  id: string;
  title: string;
  speaker: string;
  speakerTitle?: string;
  speakerCompany?: string;
  speakerAvatar?: string;
  track: string;
  room: string;
  day: number;
  startTime: string;
  endTime: string;
  description?: string;
  tags?: string[];
  capacity?: number;
  attending?: number;
  accentColor?: string;
  assignedAudience?: SessionAudienceMember[];
}

export interface FeedVideo {
  id: string;
  type: 'video';
  title: string;
  speaker: string;
  company: string;
  duration: string;
  views: string;
  accentColor: string;
  live: boolean;
  videoUrl: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface FeedPoll {
  id: string;
  type: 'poll';
  question: string;
  session: string;
  options: PollOption[];
  points?: number;
}

export type FeedItem = FeedVideo | FeedPoll;

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Attendee {
  id: string;
  name: string;
  title: string;
  company: string;
  role: 'attendee' | 'sponsor';
  points: number;
  tier: string;
  interests: string[];
  avatar?: string;
  bio?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  tagline: string;
  category: string;
  boothNumber: string;
  tierColor: string;
  accentColor: string;
  giveaway?: string;
  website?: string;
  description?: string;
  logoUrl?: string;
}

export interface Challenge {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  points: number;
  progress: number;
  total: number;
}

export interface Poll {
  id: string;
  question: string;
  session: string;
  options: PollOption[];
  points: number;
  totalVotes: number;
}

export interface Survey {
  id: string;
  title: string;
  desc: string;
  questions: number;
  points: number;
}

export interface GiveawayWinner {
  id: string;
  name: string;
  company?: string;
  title?: string;
  avatar?: string;
  drawnAt: string;
}

export interface Giveaway {
  id: string;
  title: string;
  sponsor: string;
  entries: number;
  ends: string;
  color: string;
  entered: boolean;
  winners?: GiveawayWinner[];
}

export interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  email?: string;
  phone?: string;
  scannedAt: string;
  color: string;
  status: 'hot' | 'warm' | 'cold';
  /** Mirror of `status` on the v1 leads endpoints (the web client sends and
   *  reads `priority`; the mobile client mirrors it here so cross-client
   *  edits round-trip without dropping the field). */
  priority?: 'hot' | 'warm' | 'cold';
  notes?: string;
  /** Free-form labels the scanner attached to the lead (e.g. "Decision
   *  Maker", "Budget Holder"). Always an array — the backend defaults to
   *  `[]` when no tags are set. */
  tags?: string[];
  /** Original badge code captured at scan time. Used as a secondary dedupe
   *  key when reconciling locally-saved (`pendingSync: true`) leads with the
   *  backend so a server-confirmed lead replaces its local twin instead of
   *  duplicating it. */
  code?: string;
  /** True when this lead was saved client-side only because the backend
   *  rejected /leads/scan. Cleared when reconciliation succeeds and we swap
   *  the synthetic id for the canonical server id. */
  pendingSync?: boolean;
}

export interface Meeting {
  id: string;
  type: 'incoming' | 'outgoing';
  attendee: Attendee;
  status: 'pending' | 'accepted' | 'declined';
  proposedTime?: string;
  message?: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  points: number;
  tier: string;
  tierColor: string;
}
