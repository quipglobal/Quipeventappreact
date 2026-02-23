import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, Search, Users, Clock, MapPin, Sparkles, Trophy,
  Briefcase, Building2, ChevronRight, UserPlus, UserCheck,
  MessageCircle, Linkedin, Globe, Star, Filter, X, Bookmark,
  Calendar, Target, Zap,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Attendee {
  id: string;
  name: string;
  title: string;
  company: string;
  avatar: string;
  bio: string;
  interests: string[];
  points: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  checkedInAt: string;
  location: string;
  linkedIn?: string;
  website?: string;
  sessionsBookmarked: string[];
  isOnline: boolean;
  mutualConnections: number;
}

// ─── Mock Attendees ──────────────────────────────────────────────────────────

const mockAttendees: Attendee[] = [
  {
    id: 'att-1',
    name: 'Dr. Sarah Chen',
    title: 'Chief AI Officer',
    company: 'TechCorp Solutions',
    avatar: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=6366f1&color=fff',
    bio: 'Leading AI research and strategy at TechCorp. Passionate about responsible AI development and human-centered design. Published author and keynote speaker.',
    interests: ['AI', 'Machine Learning', 'Ethics in Tech', 'Innovation'],
    points: 520,
    tier: 'Platinum',
    checkedInAt: '8:15 AM',
    location: 'San Francisco, CA',
    linkedIn: 'sarah-chen',
    website: 'sarahchen.ai',
    sessionsBookmarked: ['1', '2'],
    isOnline: true,
    mutualConnections: 12,
  },
  {
    id: 'att-2',
    name: 'Marcus Johnson',
    title: 'VP of Engineering',
    company: 'InnovateLab',
    avatar: 'https://ui-avatars.com/api/?name=Marcus+Johnson&background=8b5cf6&color=fff',
    bio: 'Building scalable engineering teams and infrastructure. 15+ years in tech leadership across startups and enterprise. Speaker on DevOps culture.',
    interests: ['Cloud Architecture', 'DevOps', 'Team Leadership', 'Scalability'],
    points: 380,
    tier: 'Gold',
    checkedInAt: '8:32 AM',
    location: 'Seattle, WA',
    linkedIn: 'marcus-johnson',
    sessionsBookmarked: ['2', '3'],
    isOnline: true,
    mutualConnections: 8,
  },
  {
    id: 'att-3',
    name: 'Priya Patel',
    title: 'Data Science Lead',
    company: 'DataFlow Systems',
    avatar: 'https://ui-avatars.com/api/?name=Priya+Patel&background=ec4899&color=fff',
    bio: 'Data-driven strategist building ML pipelines at scale. Expert in NLP and computer vision. Active mentor in Women in Data community.',
    interests: ['Data Science', 'NLP', 'Computer Vision', 'Mentorship'],
    points: 290,
    tier: 'Gold',
    checkedInAt: '8:45 AM',
    location: 'Austin, TX',
    linkedIn: 'priya-patel',
    sessionsBookmarked: ['1', '2', '4'],
    isOnline: true,
    mutualConnections: 5,
  },
  {
    id: 'att-4',
    name: 'James Wilson',
    title: 'Sustainability Director',
    company: 'GreenTech Inc',
    avatar: 'https://ui-avatars.com/api/?name=James+Wilson&background=10b981&color=fff',
    bio: 'Driving sustainable technology initiatives and carbon-neutral computing strategies. Passionate about climate tech and green infrastructure.',
    interests: ['Sustainability', 'Climate Tech', 'Green Computing', 'ESG'],
    points: 210,
    tier: 'Silver',
    checkedInAt: '8:50 AM',
    location: 'Portland, OR',
    linkedIn: 'james-wilson',
    website: 'greentechjames.com',
    sessionsBookmarked: ['3'],
    isOnline: false,
    mutualConnections: 3,
  },
  {
    id: 'att-5',
    name: 'Aisha Rahman',
    title: 'Product Manager',
    company: 'SecureNet Inc',
    avatar: 'https://ui-avatars.com/api/?name=Aisha+Rahman&background=f59e0b&color=fff',
    bio: 'Product-minded technologist passionate about cybersecurity and privacy-first design. Building tools that make security accessible to everyone.',
    interests: ['Product Management', 'Cybersecurity', 'Privacy', 'UX Design'],
    points: 170,
    tier: 'Silver',
    checkedInAt: '9:05 AM',
    location: 'New York, NY',
    linkedIn: 'aisha-rahman',
    sessionsBookmarked: ['1', '3'],
    isOnline: true,
    mutualConnections: 7,
  },
  {
    id: 'att-6',
    name: 'David Kim',
    title: 'Startup Founder & CEO',
    company: 'NeuralWave AI',
    avatar: 'https://ui-avatars.com/api/?name=David+Kim&background=3b82f6&color=fff',
    bio: 'Founded NeuralWave to democratize AI for SMBs. Y Combinator alum. Believer in open-source innovation and community-driven development.',
    interests: ['Startups', 'AI', 'Open Source', 'Venture Capital'],
    points: 450,
    tier: 'Gold',
    checkedInAt: '7:55 AM',
    location: 'San Jose, CA',
    linkedIn: 'david-kim',
    website: 'neuralwave.ai',
    sessionsBookmarked: ['1', '4'],
    isOnline: true,
    mutualConnections: 15,
  },
  {
    id: 'att-7',
    name: 'Elena Rodriguez',
    title: 'UX Research Director',
    company: 'DesignFirst Studio',
    avatar: 'https://ui-avatars.com/api/?name=Elena+Rodriguez&background=a855f7&color=fff',
    bio: 'Bridging the gap between technology and human needs through inclusive research. Published researcher in human-computer interaction.',
    interests: ['UX Research', 'Accessibility', 'Design Thinking', 'HCI'],
    points: 130,
    tier: 'Silver',
    checkedInAt: '9:12 AM',
    location: 'Chicago, IL',
    linkedIn: 'elena-rodriguez',
    sessionsBookmarked: ['2', '3'],
    isOnline: true,
    mutualConnections: 4,
  },
  {
    id: 'att-8',
    name: 'Alex Thompson',
    title: 'Cloud Solutions Architect',
    company: 'CloudStream',
    avatar: 'https://ui-avatars.com/api/?name=Alex+Thompson&background=06b6d4&color=fff',
    bio: 'Designing resilient, high-availability cloud architectures. AWS & GCP certified professional. Advocate for infrastructure-as-code.',
    interests: ['Cloud', 'Infrastructure', 'Kubernetes', 'DevOps'],
    points: 310,
    tier: 'Gold',
    checkedInAt: '8:20 AM',
    location: 'Denver, CO',
    linkedIn: 'alex-thompson',
    sessionsBookmarked: ['2'],
    isOnline: false,
    mutualConnections: 6,
  },
  {
    id: 'att-9',
    name: 'Maya Okonkwo',
    title: 'ML Engineering Manager',
    company: 'Quantumly',
    avatar: 'https://ui-avatars.com/api/?name=Maya+Okonkwo&background=ef4444&color=fff',
    bio: 'Leading a team of ML engineers building next-gen recommendation systems. Advocate for diversity in tech and active speaker at global conferences.',
    interests: ['Machine Learning', 'Recommender Systems', 'Diversity', 'Engineering Leadership'],
    points: 90,
    tier: 'Bronze',
    checkedInAt: '9:25 AM',
    location: 'Atlanta, GA',
    linkedIn: 'maya-okonkwo',
    sessionsBookmarked: ['1', '2', '3'],
    isOnline: true,
    mutualConnections: 2,
  },
  {
    id: 'att-10',
    name: 'Ryan Mitchell',
    title: 'Blockchain Lead',
    company: 'ChainForge Labs',
    avatar: 'https://ui-avatars.com/api/?name=Ryan+Mitchell&background=f97316&color=fff',
    bio: 'Building decentralized solutions for enterprise. Expert in smart contracts and Web3 infrastructure. Speaker and educator in blockchain space.',
    interests: ['Blockchain', 'Web3', 'Smart Contracts', 'DeFi'],
    points: 260,
    tier: 'Gold',
    checkedInAt: '8:40 AM',
    location: 'Miami, FL',
    linkedIn: 'ryan-mitchell',
    sessionsBookmarked: ['4'],
    isOnline: false,
    mutualConnections: 9,
  },
  {
    id: 'att-11',
    name: 'Sophie Laurent',
    title: 'Head of Developer Relations',
    company: 'OpenAPI Collective',
    avatar: 'https://ui-avatars.com/api/?name=Sophie+Laurent&background=14b8a6&color=fff',
    bio: 'Connecting developers with the tools they need. Community builder and open-source evangelist. Running DevRel programs across 40+ countries.',
    interests: ['Developer Relations', 'Open Source', 'Community', 'APIs'],
    points: 340,
    tier: 'Gold',
    checkedInAt: '8:10 AM',
    location: 'London, UK',
    linkedIn: 'sophie-laurent',
    website: 'sophielaurent.dev',
    sessionsBookmarked: ['1', '4'],
    isOnline: true,
    mutualConnections: 11,
  },
  {
    id: 'att-12',
    name: 'Raj Malhotra',
    title: 'CTO',
    company: 'FinEdge Technologies',
    avatar: 'https://ui-avatars.com/api/?name=Raj+Malhotra&background=7c3aed&color=fff',
    bio: 'Architecting fintech platforms processing billions daily. Deep expertise in distributed systems, real-time processing, and regulatory compliance.',
    interests: ['FinTech', 'Distributed Systems', 'Real-time Processing', 'Compliance'],
    points: 410,
    tier: 'Gold',
    checkedInAt: '8:05 AM',
    location: 'Boston, MA',
    linkedIn: 'raj-malhotra',
    sessionsBookmarked: ['1', '2', '3', '4'],
    isOnline: true,
    mutualConnections: 14,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const tierConfig: Record<string, { color: string; bg: string; gradient: string }> = {
  Bronze:   { color: '#cd7f32', bg: 'rgba(205,127,50,0.12)',  gradient: 'linear-gradient(135deg,#cd7f32,#b87333)' },
  Silver:   { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', gradient: 'linear-gradient(135deg,#9ca3af,#6b7280)' },
  Gold:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  Platinum: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
};

const allInterests = Array.from(new Set(mockAttendees.flatMap(a => a.interests))).sort();

// ─── Detail Page Component ───────────────────────────────────────────────────

const AttendeeDetailPage: React.FC<{
  attendee: Attendee;
  onBack: () => void;
  onConnect: (id: string) => void;
  isConnected: boolean;
}> = ({ attendee, onBack, onConnect, isConnected }) => {
  const { t, isDark } = useTheme();
  const { user } = useApp();
  const tc = tierConfig[attendee.tier];

  // Mock shared sessions
  const sessionNames: Record<string, string> = {
    '1': 'Keynote: The Future of AI & Humanity',
    '2': 'Workshop: Building Scalable ML Pipelines',
    '3': 'Panel: Sustainability in Technology',
    '4': 'Startup Pitch Competition Finals',
  };

  // Shared interests with current user
  const userInterests = user?.interests ?? [];
  const sharedInterests = attendee.interests.filter(i =>
    userInterests.some(ui => ui.toLowerCase() === i.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="absolute inset-0 z-50 min-h-screen overflow-y-auto"
      style={{ background: t.bgPage }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 pt-12 pb-8"
        style={{ background: isDark
          ? 'linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)'
          : 'linear-gradient(160deg,#7c3aed 0%,#6366f1 50%,#818cf8 100%)'
        }}>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
        <div className="absolute bottom-0 -left-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />

        <div className="relative z-10">
          <button onClick={onBack}
            className="flex items-center gap-1.5 mb-5 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.75)' }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Audience</span>
          </button>

          {/* Avatar + Identity */}
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2"
                style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
                <img src={attendee.avatar} alt={attendee.name} className="w-full h-full object-cover" />
              </div>
              {attendee.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 flex items-center justify-center"
                  style={{ borderColor: isDark ? '#312e81' : '#6366f1' }}>
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 4 }}>
                {attendee.name}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.3 }}>
                {attendee.title}
              </p>
              <p className="flex items-center gap-1.5 mt-1" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                <Building2 style={{ width: 12, height: 12 }} /> {attendee.company}
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-2.5 mt-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
              <Zap style={{ width: 12, height: 12, color: '#fbbf24' }} />
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{attendee.points}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>pts</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
              style={{ background: tc.bg, backdropFilter: 'blur(8px)' }}>
              <Trophy style={{ width: 12, height: 12, color: tc.color }} />
              <span style={{ color: tc.color, fontSize: 12, fontWeight: 700 }}>{attendee.tier}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
              <MapPin style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.6)' }} />
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{attendee.location}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────── */}
      <div className="px-5 -mt-4 mb-5 relative z-10">
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: t.surface, boxShadow: t.shadowHov, border: `1px solid ${t.border}` }}>
          <button
            onClick={() => onConnect(attendee.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all active:scale-[0.97]"
            style={{
              background: isConnected ? t.successBg : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              border: isConnected ? `1px solid ${t.successText}30` : 'none',
              color: isConnected ? t.successText : '#fff',
            }}>
            {isConnected ? (
              <>
                <UserCheck style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Connected</span>
              </>
            ) : (
              <>
                <UserPlus style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Connect</span>
              </>
            )}
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all active:scale-[0.97]"
            style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
            <MessageCircle style={{ width: 16, height: 16, color: t.accentSoft }} />
            <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>Message</span>
          </button>
        </div>
      </div>

      {/* ── Bio ────────────────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>About</h3>
        <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.65 }}>{attendee.bio}</p>
      </div>

      {/* ── Interests ──────────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Interests</h3>
        <div className="flex flex-wrap gap-2">
          {attendee.interests.map(interest => {
            const isShared = sharedInterests.includes(interest);
            return (
              <span key={interest}
                className="px-3 py-1.5 rounded-full"
                style={{
                  background: isShared ? t.accentBg : t.surface2,
                  color: isShared ? t.accentSoft : t.textSec,
                  fontSize: 12,
                  fontWeight: 600,
                  border: `1px solid ${isShared ? t.borderAcc : t.border}`,
                }}>
                {isShared && '✦ '}{interest}
              </span>
            );
          })}
        </div>
        {sharedInterests.length > 0 && (
          <p className="mt-2.5 flex items-center gap-1.5"
            style={{ color: t.accentSoft, fontSize: 11, fontWeight: 600 }}>
            <Sparkles style={{ width: 11, height: 11 }} />
            {sharedInterests.length} shared interest{sharedInterests.length > 1 ? 's' : ''} with you
          </p>
        )}
      </div>

      {/* ── Event Activity ─────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Event Activity</h3>
        <div className="rounded-2xl overflow-hidden"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}>

          {/* Check-in */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${t.divider}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.1)' }}>
              <Clock style={{ width: 14, height: 14, color: '#10b981' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>Checked in</p>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{attendee.checkedInAt}</p>
            </div>
          </div>

          {/* Sessions bookmarked */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${t.divider}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.1)' }}>
              <Bookmark style={{ width: 14, height: 14, color: '#7c3aed' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>Sessions bookmarked</p>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{attendee.sessionsBookmarked.length} sessions</p>
            </div>
          </div>

          {/* Mutual connections */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)' }}>
              <Users style={{ width: 14, height: 14, color: '#6366f1' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>Mutual connections</p>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{attendee.mutualConnections} people</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Attending Sessions ─────────────────────────────────── */}
      {attendee.sessionsBookmarked.length > 0 && (
        <div className="px-5 mb-5">
          <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Attending Sessions</h3>
          <div className="space-y-2">
            {attendee.sessionsBookmarked.map(sId => (
              <div key={sId} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                  <Calendar style={{ width: 14, height: 14, color: '#fff' }} />
                </div>
                <p className="flex-1 min-w-0 truncate" style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>
                  {sessionNames[sId] ?? `Session #${sId}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Social Links ───────────────────────────────────────── */}
      {(attendee.linkedIn || attendee.website) && (
        <div className="px-5 mb-5">
          <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Social Links</h3>
          <div className="flex gap-2.5">
            {attendee.linkedIn && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <Linkedin style={{ width: 15, height: 15, color: '#0a66c2' }} />
                <span style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>LinkedIn</span>
              </div>
            )}
            {attendee.website && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <Globe style={{ width: 15, height: 15, color: t.accentSoft }} />
                <span style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>{attendee.website}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Privacy Notice ─────────────────────────────────────── */}
      <div className="px-5 pb-8">
        <div className="rounded-xl p-4" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
          <p style={{ color: t.textMuted, fontSize: 11, lineHeight: 1.5 }}>
            For privacy, personal contact information such as email and phone number is not shared. Use the Connect or Message button to reach out.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ─── AudiencePage Component ──────────────────────────────────────────────────

interface AudiencePageProps {
  onBack: () => void;
}

export const AudiencePage: React.FC<AudiencePageProps> = ({ onBack }) => {
  const { addPoints } = useApp();
  const { t, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInterest, setSelectedInterest] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [connectedIds, setConnectedIds] = useState<string[]>([]);

  // ── Filter ──
  const filteredAttendees = useMemo(() => {
    return mockAttendees.filter(att => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        att.name.toLowerCase().includes(q) ||
        att.company.toLowerCase().includes(q) ||
        att.title.toLowerCase().includes(q) ||
        att.interests.some(i => i.toLowerCase().includes(q));
      const matchesInterest = selectedInterest === 'all' ||
        att.interests.includes(selectedInterest);
      return matchesSearch && matchesInterest;
    });
  }, [searchQuery, selectedInterest]);

  const onlineCount = mockAttendees.filter(a => a.isOnline).length;

  const handleConnect = (id: string) => {
    if (!connectedIds.includes(id)) {
      setConnectedIds(prev => [...prev, id]);
      addPoints(10, 'New connection made!');
    }
  };

  // Top interests for quick filter
  const topInterests = useMemo(() => {
    const freq: Record<string, number> = {};
    mockAttendees.forEach(a => a.interests.forEach(i => { freq[i] = (freq[i] || 0) + 1; }));
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([interest]) => interest);
  }, []);

  return (
    <div className="min-h-screen relative" style={{ background: t.bgPage }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 pt-12 pb-5"
        style={{
          background: isDark
            ? 'linear-gradient(160deg,#1e1b4b 0%,#312e81 40%,#4f46e5 100%)'
            : 'linear-gradient(160deg,#7c3aed 0%,#6366f1 60%,#818cf8 100%)',
        }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-12"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />

        <div className="relative z-10">
          <button onClick={onBack}
            className="flex items-center gap-1.5 mb-4 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Back</span>
          </button>

          <div className="flex items-center gap-2.5 mb-1">
            <Users style={{ width: 22, height: 22, color: '#c4b5fd' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Event Audience
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            Checked-In Attendees
          </h1>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Users style={{ width: 13, height: 13, color: '#fff' }} />
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{mockAttendees.length}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>total</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(16,185,129,0.15)' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700 }}>{onlineCount}</span>
              <span style={{ color: 'rgba(52,211,153,0.7)', fontSize: 11 }}>online</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.4)' }}
            />
            <input
              type="text"
              placeholder="Search by name, company, or interest…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: 13,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 active:opacity-60">
                <X style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.5)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Interest Filter Chips ──────────────────────────────── */}
      <div className="px-5 py-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setSelectedInterest('all')}
          className="px-3.5 py-1.5 rounded-full flex-shrink-0 transition-all"
          style={{
            background: selectedInterest === 'all' ? t.accent : t.surface,
            color: selectedInterest === 'all' ? '#fff' : t.textSec,
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${selectedInterest === 'all' ? t.accent : t.border}`,
          }}>
          All
        </button>
        {topInterests.map(interest => (
          <button
            key={interest}
            onClick={() => setSelectedInterest(interest === selectedInterest ? 'all' : interest)}
            className="px-3.5 py-1.5 rounded-full flex-shrink-0 transition-all whitespace-nowrap"
            style={{
              background: selectedInterest === interest ? t.accent : t.surface,
              color: selectedInterest === interest ? '#fff' : t.textSec,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${selectedInterest === interest ? t.accent : t.border}`,
            }}>
            {interest}
          </button>
        ))}
      </div>

      {/* ── Results count ──────────────────────────────────────── */}
      <div className="px-5 mb-3">
        <p style={{ color: t.textMuted, fontSize: 12, fontWeight: 600 }}>
          {filteredAttendees.length} attendee{filteredAttendees.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* ── Attendee List ──────────────────────────────────────── */}
      <div className="px-5 pb-24 space-y-2.5">
        {filteredAttendees.map((att, index) => {
          const tc = tierConfig[att.tier];
          const isConn = connectedIds.includes(att.id);
          return (
            <motion.button
              key={att.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
              onClick={() => setSelectedAttendee(att)}
              className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
              style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}
            >
              <div className="flex items-center gap-3.5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden">
                    <img src={att.avatar} alt={att.name} className="w-full h-full object-cover" />
                  </div>
                  {att.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2"
                      style={{ borderColor: t.surface }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="truncate" style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>
                      {att.name}
                    </h3>
                    {isConn && (
                      <UserCheck style={{ width: 13, height: 13, color: t.successText, flexShrink: 0 }} />
                    )}
                  </div>
                  <p className="truncate" style={{ color: t.textSec, fontSize: 12, lineHeight: 1.3, marginBottom: 2 }}>
                    {att.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 truncate" style={{ color: t.textMuted, fontSize: 11 }}>
                      <Building2 style={{ width: 10, height: 10 }} /> {att.company}
                    </span>
                    <span className="w-px h-3" style={{ background: t.divider }} />
                    <span className="flex items-center gap-1" style={{ color: t.textMuted, fontSize: 11 }}>
                      <Clock style={{ width: 10, height: 10 }} /> {att.checkedInAt}
                    </span>
                  </div>
                </div>

                {/* Right section */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: tc.bg }}>
                    <Trophy style={{ width: 10, height: 10, color: tc.color }} />
                    <span style={{ color: tc.color, fontSize: 10, fontWeight: 700 }}>{att.tier}</span>
                  </div>
                  <ChevronRight style={{ width: 14, height: 14, color: t.textMuted }} />
                </div>
              </div>

              {/* Interest tags */}
              <div className="flex gap-1.5 mt-3 overflow-hidden">
                {att.interests.slice(0, 3).map(interest => (
                  <span key={interest}
                    className="px-2 py-0.5 rounded-md truncate"
                    style={{
                      background: t.surface2,
                      color: t.textMuted,
                      fontSize: 10,
                      fontWeight: 600,
                      maxWidth: 120,
                    }}>
                    {interest}
                  </span>
                ))}
                {att.interests.length > 3 && (
                  <span style={{ color: t.textMuted, fontSize: 10, fontWeight: 600, alignSelf: 'center' }}>
                    +{att.interests.length - 3}
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}

        {/* Empty state */}
        {filteredAttendees.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: t.surface2 }}>
              <Search style={{ width: 28, height: 28, color: t.emptyIcon }} />
            </div>
            <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              No attendees found
            </h3>
            <p style={{ color: t.textMuted, fontSize: 13 }}>
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>

      {/* ── Detail Overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {selectedAttendee && (
          <AttendeeDetailPage
            attendee={selectedAttendee}
            onBack={() => setSelectedAttendee(null)}
            onConnect={handleConnect}
            isConnected={connectedIds.includes(selectedAttendee.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
