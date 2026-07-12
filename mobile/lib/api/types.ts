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
  /** Human-readable display time — venue wall-clock, e.g. "9:00 AM CST" */
  startTime: string;
  /** Human-readable display time — venue wall-clock, e.g. "10:00 AM CST" */
  endTime: string;
  /** Raw ISO 8601 string from the backend for machine-readable comparisons */
  startIso?: string;
  /** Raw ISO 8601 string from the backend for machine-readable comparisons */
  endIso?: string;
  /** Short timezone abbreviation derived from event_timezone, e.g. "CST" */
  tzAbbr?: string;
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
  userId: string;
  memberId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  title: string;
  company: string;
  industry: string | null;
  role: string;
  points: number;
  tier: string;
  interests: string[];
  interestedTopics: string[];
  avatar: string | null;
  bio: string | null;
  isCheckedIn: boolean;
  status: string;
  badgeCode: string | null;
  linkedinUrl: string | null;
  socialLinks: Record<string, string>;
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
  isLive: boolean;
  /** Option ID the current user voted for, if returned by the backend. */
  userVotedOptionId?: string;
}

export interface Survey {
  id: string;
  title: string;
  desc: string;
  questions: number;
  points: number;
}

export type SurveyQuestionType =
  | 'text'
  | 'single_choice'
  | 'multiple_choice'
  | 'checkbox'
  | 'rating'
  | 'yes_no';

export interface SurveyQuestionOption {
  id: string;
  text: string;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  text: string;
  required?: boolean;
  options?: SurveyQuestionOption[];
  min?: number;
  max?: number;
}

export interface SurveyDetail extends Omit<Survey, 'questions'> {
  questionList: SurveyQuestion[];
  questions: number;
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
  /** Number of prize items available. Parsed from the backend's
   *  number_of_items/quantity fields; used by the sponsor manage UI. */
  numberOfItems?: number;
  /** Optional prize image (data-URL or remote URL). Optional on mobile —
   *  the create form only requires a title + item count. */
  image?: string;
  /** Owner sponsor id, when the backend attributes the giveaway. */
  sponsorId?: string;
  /** ISO 8601 creation timestamp, when the backend returns it. */
  createdAt?: string;
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
  company?: string;
}

export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
  documentCount: number;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  /** URL to a PDF or other binary file attached to this document. When set
   *  and `content` is empty the reader opens it directly; when both are
   *  present a "View PDF" button is shown alongside the HTML body. */
  fileUrl: string | null;
  authorName: string;
  authorAvatar: string | null;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  thumbnailUrl: string | null;
  estimatedReadMinutes: number;
  publishedAt: string;
  updatedAt: string;
}

export interface ArticleAnalytics {
  session_id: string;
  article_id: string;
  click_count: number;
  active_read_seconds: number;
  total_elapsed_seconds: number;
  max_scroll_percent: number;
  started_at: string;
  ended_at: string;
  completed: boolean;
}
