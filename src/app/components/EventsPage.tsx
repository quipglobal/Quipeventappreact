import React, { useState } from 'react';
import {
  Calendar, Clock, MapPin, Users, ChevronRight, Ticket,
  Search, Sparkles, ArrowRight, Globe, Star, Video,
  CheckCircle, Zap, Filter,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

// ─── Types ───────────────────────────────────────────────────────────────────

type EventStatus = 'live' | 'upcoming' | 'past';
type EventCategory = 'conference' | 'workshop' | 'webinar' | 'meetup' | 'hackathon' | 'summit';

interface OrganizerEvent {
  id: string;
  title: string;
  organizer: string;
  cover: string;
  status: EventStatus;
  category: EventCategory;
  dates: string;
  dateRange: { start: string; end: string };
  location: string;
  isVirtual: boolean;
  attendees: number;
  capacity: number;
  description: string;
  tags: string[];
  speakers: number;
  sessions: number;
  isFeatured?: boolean;
  isRegistered?: boolean;
  price?: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockOrganizerEvents: OrganizerEvent[] = [
  {
    id: 'ev-1',
    title: 'Tech Summit 2026',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1762968269894-1d7e1ce8894e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNoJTIwY29uZmVyZW5jZSUyMHN0YWdlJTIwYXVkaWVuY2V8ZW58MXx8fHwxNzcxODMyNDc5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'live',
    category: 'conference',
    dates: 'Jan 16–18, 2026',
    dateRange: { start: '2026-01-16', end: '2026-01-18' },
    location: 'San Francisco, CA',
    isVirtual: false,
    attendees: 2400,
    capacity: 3000,
    description: 'The premier technology conference connecting innovators, developers, and industry leaders for three days of keynotes, workshops, and networking.',
    tags: ['AI', 'Cloud', 'Startups', 'Sustainability'],
    speakers: 48,
    sessions: 36,
    isFeatured: true,
    isRegistered: true,
    price: 'Free',
  },
  {
    id: 'ev-2',
    title: 'AI & Machine Learning Masterclass',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1691026336764-f24456f76e03?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxBSSUyMHN1bW1pdCUyMGtleW5vdGUlMjBzcGVha2VyfGVufDF8fHx8MTc3MTgzMjQ4MHww&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'workshop',
    dates: 'Feb 10–11, 2026',
    dateRange: { start: '2026-02-10', end: '2026-02-11' },
    location: 'Online',
    isVirtual: true,
    attendees: 850,
    capacity: 1500,
    description: 'A two-day intensive workshop on building production-grade ML pipelines, LLM fine-tuning, and responsible AI deployment.',
    tags: ['AI', 'Machine Learning', 'LLMs', 'Hands-on'],
    speakers: 12,
    sessions: 8,
    price: '$99',
  },
  {
    id: 'ev-3',
    title: 'Global Hackathon: Build for Good',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1625335534303-a3c1a3744694?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFydHVwJTIwaGFja2F0aG9uJTIwd29ya3Nob3B8ZW58MXx8fHwxNzcxODMyNDc5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'hackathon',
    dates: 'Mar 1–3, 2026',
    dateRange: { start: '2026-03-01', end: '2026-03-03' },
    location: 'Hybrid — SF + Online',
    isVirtual: false,
    attendees: 320,
    capacity: 500,
    description: '48-hour hackathon focused on building technology solutions for social impact. Open to all skill levels with $50K in prizes.',
    tags: ['Hackathon', 'Social Impact', 'Open Source'],
    speakers: 6,
    sessions: 4,
    isFeatured: true,
    price: 'Free',
  },
  {
    id: 'ev-4',
    title: 'GreenTech Innovation Forum',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1763543007050-4dac73ffc67f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdXN0YWluYWJpbGl0eSUyMGdyZWVuJTIwdGVjaCUyMGlubm92YXRpb258ZW58MXx8fHwxNzcxODMyNDgxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'summit',
    dates: 'Apr 22–23, 2026',
    dateRange: { start: '2026-04-22', end: '2026-04-23' },
    location: 'Austin, TX',
    isVirtual: false,
    attendees: 180,
    capacity: 800,
    description: 'A two-day summit exploring sustainability in tech — from carbon-neutral data centers to circular electronics and ESG compliance.',
    tags: ['Sustainability', 'CleanTech', 'ESG'],
    speakers: 22,
    sessions: 16,
    price: '$149',
  },
  {
    id: 'ev-5',
    title: 'Product & Design Leadership',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1763630730206-2c3a5d6c82d1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ24lMjBjb25mZXJlbmNlJTIwY3JlYXRpdmUlMjB3b3Jrc2hvcHxlbnwxfHx8fDE3NzE4MzI0ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'conference',
    dates: 'May 15–16, 2026',
    dateRange: { start: '2026-05-15', end: '2026-05-16' },
    location: 'New York, NY',
    isVirtual: false,
    attendees: 0,
    capacity: 600,
    description: 'Where product managers and design leaders come together to share frameworks, case studies, and strategies for building world-class products.',
    tags: ['Product', 'Design', 'Leadership', 'UX'],
    speakers: 18,
    sessions: 14,
    price: '$199',
  },
  {
    id: 'ev-6',
    title: 'DevOps & Platform Engineering Summit',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1517309561013-16f6e4020305?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXZlbG9wZXIlMjBwcm9ncmFtbWluZyUyMGNvbW11bml0eSUyMGdyb3VwfGVufDF8fHx8MTc3MTgzMjQ4NXww&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'summit',
    dates: 'Jun 5–6, 2026',
    dateRange: { start: '2026-06-05', end: '2026-06-06' },
    location: 'Online',
    isVirtual: true,
    attendees: 0,
    capacity: 2000,
    description: 'Deep-dive into platform engineering, Kubernetes, CI/CD pipelines, and the future of developer experience.',
    tags: ['DevOps', 'Kubernetes', 'Platform', 'CI/CD'],
    speakers: 24,
    sessions: 20,
    price: 'Free',
  },
  {
    id: 'ev-7',
    title: 'Women in Tech Leadership Mixer',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1768508949307-044ec3c1836a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG5ldHdvcmtpbmclMjBldmVudCUyMGNvY2t0YWlsfGVufDF8fHx8MTc3MTgyMjM3Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'past',
    category: 'meetup',
    dates: 'Dec 8, 2025',
    dateRange: { start: '2025-12-08', end: '2025-12-08' },
    location: 'San Francisco, CA',
    isVirtual: false,
    attendees: 210,
    capacity: 250,
    description: 'An evening of networking, mentorship, and inspiration celebrating women leaders shaping the future of technology.',
    tags: ['Networking', 'Diversity', 'Leadership'],
    speakers: 5,
    sessions: 3,
    price: 'Free',
  },
  {
    id: 'ev-8',
    title: 'Cloud Security Webinar Series',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1758598306845-8630d064a244?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aXJ0dWFsJTIwd2ViaW5hciUyMG9ubGluZSUyMHByZXNlbnRhdGlvbnxlbnwxfHx8fDE3NzE4MzI0ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'past',
    category: 'webinar',
    dates: 'Nov 12–14, 2025',
    dateRange: { start: '2025-11-12', end: '2025-11-14' },
    location: 'Online',
    isVirtual: true,
    attendees: 1050,
    capacity: 1500,
    description: 'Three-part webinar series covering zero-trust architecture, cloud-native security, and incident response best practices.',
    tags: ['Security', 'Cloud', 'Zero Trust'],
    speakers: 8,
    sessions: 3,
    price: 'Free',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<EventStatus, { label: string; color: string; bg: string; dotColor: string }> = {
  live:     { label: 'Happening Now', color: '#10b981', bg: 'rgba(16,185,129,0.12)', dotColor: '#34d399' },
  upcoming: { label: 'Upcoming',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', dotColor: '#60a5fa' },
  past:     { label: 'Completed',     color: '#6b7280', bg: 'rgba(107,114,128,0.12)', dotColor: '#9ca3af' },
};

const categoryConfig: Record<EventCategory, { label: string; gradient: string }> = {
  conference: { label: 'Conference', gradient: 'linear-gradient(135deg,#7c3aed,#4f46e5)' },
  workshop:   { label: 'Workshop',   gradient: 'linear-gradient(135deg,#10b981,#0d9488)' },
  webinar:    { label: 'Webinar',    gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)' },
  meetup:     { label: 'Meetup',     gradient: 'linear-gradient(135deg,#ec4899,#db2777)' },
  hackathon:  { label: 'Hackathon',  gradient: 'linear-gradient(135deg,#f59e0b,#ea580c)' },
  summit:     { label: 'Summit',     gradient: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
};

type TabFilter = 'all' | 'live' | 'upcoming' | 'past';

// ─── Component ───────────────────────────────────────────────────────────────

interface EventsPageProps {
  onNavigate?: (page: string) => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({ onNavigate }) => {
  const { eventConfig, showToast } = useApp();
  const { t, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Filter logic ──
  const filtered = mockOrganizerEvents.filter(ev => {
    const matchesTab = activeTab === 'all' || ev.status === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      ev.title.toLowerCase().includes(q) ||
      ev.location.toLowerCase().includes(q) ||
      ev.tags.some(tag => tag.toLowerCase().includes(q));
    const matchesCat = selectedCategory === 'all' || ev.category === selectedCategory;
    return matchesTab && matchesSearch && matchesCat;
  });

  const liveCount = mockOrganizerEvents.filter(e => e.status === 'live').length;
  const upcomingCount = mockOrganizerEvents.filter(e => e.status === 'upcoming').length;

  const tabs: { id: TabFilter; label: string; count?: number }[] = [
    { id: 'all',      label: 'All' },
    { id: 'live',     label: 'Live',     count: liveCount },
    { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
    { id: 'past',     label: 'Past' },
  ];

  const categories = Array.from(new Set(mockOrganizerEvents.map(e => e.category)));

  const handleRegister = (ev: OrganizerEvent) => {
    showToast(`Registered for ${ev.title}!`);
  };

  // ── Featured / live event (hero) ──
  const heroEvent = mockOrganizerEvents.find(e => e.status === 'live') ?? mockOrganizerEvents.find(e => e.isFeatured);

  return (
    <div className="pb-24 min-h-screen" style={{ background: t.bgPage }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-5 pt-12 pb-5"
        style={{ background: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 40%,#4f46e5 75%,#7c3aed 100%)' }}
      >
        {/* Decorative blurs */}
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
        <div className="absolute bottom-4 -left-10 w-36 h-36 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar style={{ width: 18, height: 18, color: '#c4b5fd' }} />
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Event Calendar
                </span>
              </div>
              <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>
                Events
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl flex items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                <Ticket style={{ width: 14, height: 14, color: '#c4b5fd' }} />
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                  {mockOrganizerEvents.length}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Events</span>
              </div>
            </div>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>
            Browse all events by <span style={{ color: '#c4b5fd', fontWeight: 600 }}>TechConnect Global</span>
          </p>
        </div>
      </div>

      {/* ── Hero Card (Current / Featured Event) ──────────────────── */}
      {heroEvent && (
        <div className="px-5 -mt-1 mb-4 pt-4">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              boxShadow: isDark
                ? '0 8px 40px rgba(124,58,237,0.25)'
                : '0 8px 32px rgba(124,58,237,0.15)',
            }}
          >
            {/* Cover */}
            <div className="relative h-44 overflow-hidden">
              <ImageWithFallback
                src={heroEvent.cover}
                alt={heroEvent.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />

              {/* Status badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: `1px solid ${statusConfig[heroEvent.status].color}40` }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusConfig[heroEvent.status].dotColor }} />
                <span style={{ color: statusConfig[heroEvent.status].color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {statusConfig[heroEvent.status].label}
                </span>
              </div>

              {/* Category */}
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg"
                style={{ background: categoryConfig[heroEvent.category].gradient }}>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {categoryConfig[heroEvent.category].label}
                </span>
              </div>

              {/* Title overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 6 }}>
                  {heroEvent.title}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                    <Calendar style={{ width: 12, height: 12 }} /> {heroEvent.dates}
                  </span>
                  <span className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                    <MapPin style={{ width: 12, height: 12 }} /> {heroEvent.location}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="p-4" style={{ background: t.surface, borderTop: `1px solid ${t.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Users style={{ width: 13, height: 13, color: t.accent }} />
                    <span style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{heroEvent.attendees.toLocaleString()}</span>
                    <span style={{ color: t.textMuted, fontSize: 12 }}>attending</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Video style={{ width: 13, height: 13, color: t.accent }} />
                    <span style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{heroEvent.sessions}</span>
                    <span style={{ color: t.textMuted, fontSize: 12 }}>sessions</span>
                  </div>
                </div>
                {heroEvent.price && (
                  <span className="px-2.5 py-1 rounded-lg" style={{
                    background: heroEvent.price === 'Free' ? t.successBg : t.accentBg,
                    color: heroEvent.price === 'Free' ? t.successText : t.accentSoft,
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {heroEvent.price}
                  </span>
                )}
              </div>

              {/* Capacity bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 600 }}>
                    {Math.round((heroEvent.attendees / heroEvent.capacity) * 100)}% capacity filled
                  </span>
                  <span style={{ color: t.textMuted, fontSize: 11 }}>
                    {heroEvent.capacity.toLocaleString()} max
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: t.surface2 }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((heroEvent.attendees / heroEvent.capacity) * 100, 100)}%`,
                      background: 'linear-gradient(90deg,#7c3aed,#4f46e5)',
                    }}
                  />
                </div>
              </div>

              {heroEvent.isRegistered ? (
                <button
                  onClick={() => onNavigate?.('event-dashboard')}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl active:scale-[0.98] transition-transform"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle style={{ width: 16, height: 16, color: '#fff' }} />
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Enter Event Dashboard</span>
                  </div>
                  <ArrowRight style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.7)' }} />
                </button>
              ) : (
                <button
                  onClick={() => handleRegister(heroEvent)}
                  className="w-full py-3 rounded-xl text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}
                >
                  <Ticket style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Register Now</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs + Search ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 px-5 pt-3 pb-3 border-b"
        style={{
          background: isDark ? 'rgba(7,7,15,0.95)' : 'rgba(255,255,255,0.95)',
          borderColor: t.border,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Status tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl mb-3" style={{ background: t.surface2 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 rounded-lg transition-all active:scale-[0.97] flex items-center justify-center gap-1.5"
              style={{
                background: activeTab === tab.id
                  ? isDark ? t.surface : '#fff'
                  : 'transparent',
                boxShadow: activeTab === tab.id ? t.shadow : 'none',
              }}
            >
              <span style={{
                color: activeTab === tab.id ? t.text : t.textMuted,
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 700 : 500,
              }}>
                {tab.label}
              </span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1"
                  style={{
                    background: activeTab === tab.id ? t.accent : t.surface2,
                    color: activeTab === tab.id ? '#fff' : t.textMuted,
                    fontSize: 10,
                    fontWeight: 700,
                  }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: t.textMuted }} />
          <input
            type="text"
            placeholder="Search events, topics, locations…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none"
            style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 13 }}
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-0.5 -mx-5 px-5" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            className="px-3 py-1.5 rounded-full flex-shrink-0 transition-all"
            style={{
              background: selectedCategory === 'all' ? t.accent : t.surface2,
              color: selectedCategory === 'all' ? '#fff' : t.textSec,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${selectedCategory === 'all' ? t.accent : t.border}`,
            }}
          >
            All Types
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-3 py-1.5 rounded-full flex-shrink-0 transition-all"
              style={{
                background: selectedCategory === cat ? t.accent : t.surface2,
                color: selectedCategory === cat ? '#fff' : t.textSec,
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${selectedCategory === cat ? t.accent : t.border}`,
              }}
            >
              {categoryConfig[cat]?.label ?? cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Event List ──────────────────────────────────────────────── */}
      <div className="px-5 py-5 space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Calendar style={{ width: 48, height: 48, color: t.emptyIcon, margin: '0 auto 12px' }} />
            <h3 style={{ color: t.text, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No Events Found</h3>
            <p style={{ color: t.textSec, fontSize: 14 }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          filtered
            .filter(ev => ev.id !== heroEvent?.id || activeTab !== 'all')
            .map(ev => {
              const stCfg = statusConfig[ev.status];
              const catCfg = categoryConfig[ev.category];
              const isExpanded = expandedId === ev.id;
              const fillPct = ev.capacity > 0 ? Math.min((ev.attendees / ev.capacity) * 100, 100) : 0;

              return (
                <button
                  key={ev.id}
                  onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                  className="w-full text-left rounded-2xl overflow-hidden transition-all active:scale-[0.99]"
                  style={{
                    background: t.surface,
                    boxShadow: t.shadow,
                    border: `1px solid ${ev.status === 'live' ? 'rgba(16,185,129,0.3)' : t.border}`,
                  }}
                >
                  {/* Cover strip */}
                  <div className="relative h-32 overflow-hidden">
                    <ImageWithFallback
                      src={ev.cover}
                      alt={ev.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0"
                      style={{
                        background: ev.status === 'past'
                          ? 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)'
                          : 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
                        ...(ev.status === 'past' ? { filter: 'grayscale(0.4)' } : {}),
                      }}
                    />

                    {/* Status */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{
                        background: stCfg.dotColor,
                        ...(ev.status === 'live' ? { animation: 'pulse 1.5s infinite' } : {}),
                      }} />
                      <span style={{ color: stCfg.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {stCfg.label}
                      </span>
                    </div>

                    {/* Category */}
                    <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg" style={{ background: catCfg.gradient }}>
                      <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {catCfg.label}
                      </span>
                    </div>

                    {/* Price */}
                    {ev.price && (
                      <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                        <span style={{ color: ev.price === 'Free' ? '#4ade80' : '#fff', fontSize: 12, fontWeight: 700 }}>
                          {ev.price}
                        </span>
                      </div>
                    )}

                    {/* Bottom info */}
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2">
                      {ev.isVirtual && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md"
                          style={{ background: 'rgba(6,182,212,0.2)', border: '1px solid rgba(6,182,212,0.3)' }}>
                          <Globe style={{ width: 10, height: 10, color: '#22d3ee' }} />
                          <span style={{ color: '#22d3ee', fontSize: 10, fontWeight: 600 }}>Virtual</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 style={{ color: t.text, fontSize: 15, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>
                      {ev.title}
                    </h3>

                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center gap-1" style={{ color: t.textSec, fontSize: 12 }}>
                        <Calendar style={{ width: 12, height: 12, color: t.textMuted }} /> {ev.dates}
                      </span>
                      <span className="flex items-center gap-1" style={{ color: t.textSec, fontSize: 12 }}>
                        <MapPin style={{ width: 12, height: 12, color: t.textMuted }} /> {ev.location}
                      </span>
                    </div>

                    {/* Quick stats */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: t.surface2 }}>
                        <Users style={{ width: 11, height: 11, color: t.textMuted }} />
                        <span style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>
                          {ev.attendees > 0 ? ev.attendees.toLocaleString() : 'TBA'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: t.surface2 }}>
                        <Video style={{ width: 11, height: 11, color: t.textMuted }} />
                        <span style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>{ev.sessions} sessions</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: t.surface2 }}>
                        <Zap style={{ width: 11, height: 11, color: t.textMuted }} />
                        <span style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>{ev.speakers} speakers</span>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {ev.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-md"
                          style={{ background: t.accentBg, color: t.accentSoft, fontSize: 10, fontWeight: 600 }}>
                          {tag}
                        </span>
                      ))}
                      {ev.tags.length > 3 && (
                        <span className="px-2 py-0.5 rounded-md"
                          style={{ background: t.surface2, color: t.textMuted, fontSize: 10, fontWeight: 600 }}>
                          +{ev.tags.length - 3}
                        </span>
                      )}
                    </div>

                    {/* ── Expanded Detail ── */}
                    {isExpanded && (
                      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${t.divider}` }}>
                        <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                          {ev.description}
                        </p>

                        {/* Capacity bar */}
                        {ev.attendees > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-1.5">
                              <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 600 }}>
                                {Math.round(fillPct)}% capacity filled
                              </span>
                              <span style={{ color: t.textMuted, fontSize: 11 }}>
                                {ev.capacity.toLocaleString()} max
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: t.surface2 }}>
                              <div className="h-full rounded-full transition-all"
                                style={{
                                  width: `${fillPct}%`,
                                  background: fillPct > 80
                                    ? 'linear-gradient(90deg,#ef4444,#f97316)'
                                    : 'linear-gradient(90deg,#7c3aed,#4f46e5)',
                                }} />
                            </div>
                          </div>
                        )}

                        {ev.status !== 'past' ? (
                          ev.isRegistered ? (
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                              style={{ background: t.successBg, border: `1px solid ${t.successText}30` }}>
                              <CheckCircle style={{ width: 15, height: 15, color: t.successText }} />
                              <span style={{ color: t.successText, fontSize: 13, fontWeight: 600 }}>
                                Registered
                              </span>
                            </div>
                          ) : (
                            <div
                              onClick={(e) => { e.stopPropagation(); handleRegister(ev); }}
                              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white cursor-pointer active:scale-[0.98] transition-transform"
                              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
                            >
                              <Ticket style={{ width: 15, height: 15 }} />
                              <span style={{ fontSize: 13, fontWeight: 700 }}>Register for Event</span>
                              <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.8 }}>
                                · {ev.price}
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                            style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
                            <Star style={{ width: 15, height: 15, color: t.textMuted }} />
                            <span style={{ color: t.textSec, fontSize: 13, fontWeight: 600 }}>
                              Event has ended · Recordings available soon
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
        )}
      </div>

      {/* ── Bottom CTA ──────────────────────────────────────────────── */}
      <div className="px-5 pb-5">
        <div className="rounded-2xl p-5" style={{ background: t.accentBg, border: `1px solid ${t.borderAcc}` }}>
          <div className="flex items-start gap-3">
            <Sparkles style={{ width: 18, height: 18, color: t.accentSoft, flexShrink: 0, marginTop: 2 }} />
            <div>
              <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Stay in the Loop</h3>
              <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5 }}>
                Register early for upcoming events to secure your spot and receive early-bird perks and gamification bonuses.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};