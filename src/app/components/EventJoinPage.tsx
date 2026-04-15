import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket, Calendar, MapPin, Users, ChevronRight, Clock,
  ArrowRight, Globe, Video, Hash, Loader2, Play, Tv2,
  LayoutGrid as GridIcon, RefreshCw, Lock, KeyRound, X, LogOut,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { clearToken } from '@/app/api/client';
import { useTheme } from '@/app/context/ThemeContext';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { EventConfig } from '@/app/types/config';
import {
  listEventsApi, OrganizerEvent,
  checkEventAccess, joinEventWithCode,
} from '@/app/api/eventsClient';
import { getVideoFeedCategories, getVideoFeeds, VideoFeed } from '@/app/api/videoFeedsClient';

type EventStatus = 'live' | 'upcoming' | 'past';
type EventCategory = 'conference' | 'workshop' | 'webinar' | 'meetup' | 'hackathon' | 'summit';
type ActiveTab = 'feeds' | 'events';

const statusConfig: Record<EventStatus, { label: string; color: string; dotColor: string }> = {
  live:     { label: 'Happening Now', color: '#10b981', dotColor: '#34d399' },
  upcoming: { label: 'Upcoming',      color: '#3b82f6', dotColor: '#60a5fa' },
  past:     { label: 'Completed',     color: '#6b7280', dotColor: '#9ca3af' },
};

const categoryConfig: Record<EventCategory, { label: string; gradient: string }> = {
  conference: { label: 'Conference', gradient: 'linear-gradient(135deg,#7c3aed,#4f46e5)' },
  workshop:   { label: 'Workshop',   gradient: 'linear-gradient(135deg,#10b981,#0d9488)' },
  webinar:    { label: 'Webinar',    gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)' },
  meetup:     { label: 'Meetup',     gradient: 'linear-gradient(135deg,#ec4899,#db2777)' },
  hackathon:  { label: 'Hackathon',  gradient: 'linear-gradient(135deg,#f59e0b,#ea580c)' },
  summit:     { label: 'Summit',     gradient: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
};

const CATEGORY_COLORS: Record<string, string> = {
  Technology:     '#06b6d4',
  Innovation:     '#8b5cf6',
  Business:       '#f59e0b',
  Leadership:     '#10b981',
  Networking:     '#ec4899',
  Security:       '#ef4444',
  Finance:        '#3b82f6',
  Sustainability: '#22c55e',
  Events:         '#f97316',
  Wellness:       '#a78bfa',
};

function eventToConfig(ev: OrganizerEvent): EventConfig {
  return {
    eventId: ev.id,
    name: ev.title,
    dates: ev.dates,
    timezone: 'UTC',
    location: ev.location,
    logoURL: '',
    backgroundURL: ev.cover,
    themeColors: { primary: '#7c3aed', secondary: '#4f46e5', accent: '#ec4899' },
    modulesEnabled: {
      agenda: true, sponsors: true, surveys: true, polls: true,
      leaderboard: true, audience: true, challenges: true, notifications: true,
    },
    permissions: { guestAccess: true, sponsorRoleEnabled: true, networkingEnabled: true },
  };
}

interface EventJoinPageProps {
  onJoinEvent: () => void;
  onViewDashboard?: () => void;
}

export const EventJoinPage: React.FC<EventJoinPageProps> = ({ onJoinEvent }) => {
  const { user, joinEvent, switchEvent, setUser } = useApp();

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
  }, [setUser]);

  const { t, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<ActiveTab>('feeds');

  // ── Events tab state ─────────────────────────────────────────────────────
  const [eventCode, setEventCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // ── Access-gate state ─────────────────────────────────────────────────────
  const [checkingEventId, setCheckingEventId] = useState<string | null>(null);
  const [gateEvent, setGateEvent] = useState<OrganizerEvent | null>(null);
  const [eventKey, setEventKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [isJoiningEvent, setIsJoiningEvent] = useState(false);

  // ── Feeds tab state ──────────────────────────────────────────────────────
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<VideoFeed[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<VideoFeed | null>(null);

  // ── Fetch events ─────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    const res = await listEventsApi();
    if (res.success && res.data) setEvents(res.data);
    setEventsLoading(false);
  }, []);

  // ── Fetch feed categories ────────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    const res = await getVideoFeedCategories();
    if (res.success && res.data) setCategories(res.data);
  }, []);

  // ── Fetch feeds (re-runs when category filter changes) ───────────────────
  const fetchFeeds = useCallback(async (category?: string) => {
    setFeedsLoading(true);
    const res = await getVideoFeeds({ category: category ?? undefined, per_page: 30 });
    if (res.success && res.data) setFeeds(res.data);
    setFeedsLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); fetchCategories(); }, [fetchEvents, fetchCategories]);
  useEffect(() => { fetchFeeds(selectedCategory ?? undefined); }, [fetchFeeds, selectedCategory]);

  const upcomingEvents = events.filter(e => e.status === 'upcoming' || e.status === 'live');
  const pastEvents = events.filter(e => e.status === 'past');

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');
    const code = eventCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { setCodeError('Please enter a valid event code'); return; }
    setIsJoining(true);
    const matched = events.find(ev =>
      (ev.code ?? '').toUpperCase() === code ||
      ev.title.toUpperCase().replace(/\s+/g, '').includes(code)
    );
    if (!matched) {
      setCodeError('Event not found. Please check your code and try again.');
      setIsJoining(false);
      return;
    }
    switchEvent(eventToConfig(matched));
    joinEvent();
    setIsJoining(false);
    onJoinEvent();
  };

  const enterEvent = (ev: OrganizerEvent) => {
    switchEvent(eventToConfig(ev));
    joinEvent();
    onJoinEvent();
  };

  const handleEventCardClick = async (ev: OrganizerEvent) => {
    setCheckingEventId(ev.id);
    try {
      const res = await checkEventAccess(ev.id);
      if (res.success && res.data?.is_member) {
        enterEvent(ev);
      } else {
        setGateEvent(ev);
        setEventKey('');
        setKeyError('');
      }
    } catch {
      setGateEvent(ev);
      setEventKey('');
      setKeyError('');
    } finally {
      setCheckingEventId(null);
    }
  };

  const handleJoinWithKey = async () => {
    if (!gateEvent || !eventKey.trim()) return;
    setKeyError('');
    setIsJoiningEvent(true);
    const res = await joinEventWithCode(eventKey.trim());
    setIsJoiningEvent(false);
    if (res.success) {
      setGateEvent(null);
      enterEvent(gateEvent);
    } else {
      setKeyError(res.error?.message ?? 'Invalid event key. Please try again.');
    }
  };

  // ── Sub-components ───────────────────────────────────────────────────────

  const EventCard: React.FC<{ event: OrganizerEvent; compact?: boolean }> = ({ event, compact }) => {
    const stCfg = statusConfig[event.status] ?? statusConfig.upcoming;
    const catCfg = categoryConfig[event.category] ?? categoryConfig.conference;
    const isChecking = checkingEventId === event.id;
    return (
      <button
        onClick={() => !isChecking && handleEventCardClick(event)}
        disabled={isChecking}
        className="w-full text-left rounded-2xl overflow-hidden transition-all active:scale-[0.98]"
        style={{
          background: t.surface,
          boxShadow: t.shadow,
          border: `1px solid ${event.status === 'live' ? 'rgba(16,185,129,0.3)' : t.border}`,
          opacity: isChecking ? 0.85 : 1,
        }}
      >
        <div className={`relative ${compact ? 'h-24' : 'h-32'} overflow-hidden`}>
          <ImageWithFallback src={event.cover} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0"
            style={{
              background: event.status === 'past'
                ? 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)'
                : 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
              ...(event.status === 'past' ? { filter: 'grayscale(0.4)' } : {}),
            }} />
          {isChecking && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
              <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full"
                style={{ borderWidth: 3, animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{
              background: stCfg.dotColor,
              ...(event.status === 'live' ? { animation: 'live-dot 1.5s infinite' } : {}),
            }} />
            <span style={{ color: stCfg.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stCfg.label}
            </span>
          </div>
          <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg" style={{ background: catCfg.gradient }}>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {catCfg.label}
            </span>
          </div>
          {event.isVirtual && (
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-md"
              style={{ background: 'rgba(6,182,212,0.2)', border: '1px solid rgba(6,182,212,0.3)' }}>
              <Globe style={{ width: 10, height: 10, color: '#22d3ee' }} />
              <span style={{ color: '#22d3ee', fontSize: 10, fontWeight: 600 }}>Virtual</span>
            </div>
          )}
        </div>
        <div className="p-3.5">
          <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 4 }}>
            {event.title}
          </h3>
          <div className="flex items-center gap-3 mb-2.5">
            {event.dates && (
              <span className="flex items-center gap-1" style={{ color: t.textSec, fontSize: 11 }}>
                <Calendar style={{ width: 11, height: 11, color: t.textMuted }} /> {event.dates}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1" style={{ color: t.textSec, fontSize: 11 }}>
                <MapPin style={{ width: 11, height: 11, color: t.textMuted }} /> {event.location}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {event.attendees > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: t.surface2 }}>
                  <Users style={{ width: 10, height: 10, color: t.textMuted }} />
                  <span style={{ color: t.textSec, fontSize: 10, fontWeight: 600 }}>{event.attendees.toLocaleString()}</span>
                </div>
              )}
              {event.sessions > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: t.surface2 }}>
                  <Video style={{ width: 10, height: 10, color: t.textMuted }} />
                  <span style={{ color: t.textSec, fontSize: 10, fontWeight: 600 }}>{event.sessions}</span>
                </div>
              )}
            </div>
            <ChevronRight style={{ width: 16, height: 16, color: t.textMuted }} />
          </div>
        </div>
      </button>
    );
  };

  const VideoCard: React.FC<{ feed: VideoFeed }> = ({ feed }) => (
    <button
      onClick={() => setPlayingVideo(feed)}
      className="w-full text-left rounded-2xl overflow-hidden transition-all active:scale-[0.98]"
      style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={feed.thumbnail_url}
          alt={feed.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/480x270/1e1b4b/a78bfa?text=Video`; }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.85)', backdropFilter: 'blur(8px)', border: '2px solid rgba(255,255,255,0.3)' }}>
            <Play size={22} color="white" fill="white" />
          </div>
        </div>
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-md"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff0000">
            <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14c-1.88-.5-9.38-.5-9.38-.5s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81z" />
            <polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
          </svg>
          <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}>YouTube</span>
        </div>
      </div>
      <div className="p-3.5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, lineHeight: 1.4, marginBottom: 6 }}>
          {feed.title}
        </h3>
        <p style={{ color: t.textSec, fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}
          className="line-clamp-2">
          {feed.description}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {feed.event_categories.map(cat => (
            <span key={cat} className="px-2 py-0.5 rounded-full text-[10px] font-700"
              style={{
                background: `${CATEGORY_COLORS[cat] ?? '#7c3aed'}18`,
                color: CATEGORY_COLORS[cat] ?? '#a78bfa',
                fontWeight: 700,
                border: `1px solid ${CATEGORY_COLORS[cat] ?? '#7c3aed'}30`,
              }}>
              {cat}
            </span>
          ))}
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: t.bgPage }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 pt-12 pb-5"
        style={{ background: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 40%,#4f46e5 75%,#7c3aed 100%)' }}>
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
        <div className="absolute bottom-4 -left-10 w-36 h-36 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Ticket style={{ width: 18, height: 18, color: '#c4b5fd' }} />
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                CXO Inc
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-full transition-all active:scale-95"
              style={{
                padding: '5px 12px 5px 10px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
              }}
              aria-label="Log off"
            >
              <LogOut size={12} color="rgba(255,255,255,0.7)" />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600 }}>Log off</span>
            </button>
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
            Welcome{user ? `, ${user.name.split(' ')[0]}` : ''}!
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.5 }}>
            Explore feeds or join an event below.
          </p>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-5 pt-4 pb-2 sticky top-0 z-40 backdrop-blur-md"
        style={{ background: isDark ? 'rgba(7,7,15,0.92)' : 'rgba(255,255,255,0.92)', borderBottom: `1px solid ${t.border}` }}>
        {([
          { key: 'feeds', label: 'CXO Feeds', icon: <Tv2 size={15} /> },
          { key: 'events', label: 'Events', icon: <GridIcon size={15} /> },
        ] as { key: ActiveTab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all"
            style={{
              background: activeTab === tab.key
                ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                : 'transparent',
              color: activeTab === tab.key ? '#fff' : t.textMuted,
              fontWeight: 700,
              fontSize: 13,
              border: activeTab === tab.key ? 'none' : `1px solid ${t.border}`,
            }}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CXO FEEDS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'feeds' && (
        <div className="flex-1 pb-8">
          {/* Category filter pills */}
          <div className="pt-3 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex gap-2 px-5" style={{ minWidth: 'max-content' }}>
              <button
                onClick={() => setSelectedCategory(null)}
                className="px-3.5 py-1.5 rounded-full text-[12px] font-700 transition-all whitespace-nowrap"
                style={{
                  fontWeight: 700,
                  background: !selectedCategory ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : t.surface2,
                  color: !selectedCategory ? '#fff' : t.textSec,
                  border: !selectedCategory ? 'none' : `1px solid ${t.border}`,
                }}>
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className="px-3.5 py-1.5 rounded-full text-[12px] transition-all whitespace-nowrap"
                  style={{
                    fontWeight: 700,
                    background: selectedCategory === cat
                      ? `${CATEGORY_COLORS[cat] ?? '#7c3aed'}22`
                      : t.surface2,
                    color: selectedCategory === cat
                      ? (CATEGORY_COLORS[cat] ?? '#a78bfa')
                      : t.textSec,
                    border: `1px solid ${selectedCategory === cat ? (CATEGORY_COLORS[cat] ?? '#7c3aed') + '44' : t.border}`,
                  }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Feed count */}
          {!feedsLoading && (
            <div className="px-5 pt-3 pb-1 flex items-center justify-between">
              <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {selectedCategory ? selectedCategory : 'All'} · {feeds.length} videos
              </span>
            </div>
          )}

          {/* Video cards */}
          <div className="px-5 pt-2">
            {feedsLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw size={26} style={{ color: '#7c3aed', animation: 'spin-cw 1s linear infinite' }} />
              </div>
            ) : feeds.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <Tv2 size={40} style={{ color: t.emptyIcon, margin: '0 auto 8px' }} />
                <p style={{ color: t.textSec, fontSize: 14 }}>No videos in this category</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feeds.map(feed => <VideoCard key={feed.id} feed={feed} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EVENTS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'events' && (
        <div className="flex-1 pb-8">
          {/* Event code input */}
          <div className="px-5 pt-5">
            <div className="rounded-2xl p-5" style={{
              background: t.surface,
              boxShadow: isDark ? '0 8px 40px rgba(124,58,237,0.15)' : '0 8px 32px rgba(124,58,237,0.1)',
              border: `1px solid ${t.borderAcc}`,
            }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                  <Hash style={{ width: 20, height: 20, color: '#fff' }} />
                </div>
                <div>
                  <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>Enter Event Code</h2>
                  <p style={{ color: t.textSec, fontSize: 12 }}>Got an invite? Enter the code to join instantly.</p>
                </div>
              </div>
              <form onSubmit={handleSubmitCode}>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="e.g. TECH26"
                      value={eventCode}
                      onChange={e => { setEventCode(e.target.value.toUpperCase()); setCodeError(''); }}
                      className="w-full px-4 py-3 rounded-xl outline-none text-center tracking-widest"
                      style={{
                        background: t.inputBg,
                        border: `1.5px solid ${codeError ? t.errorText : eventCode ? t.borderAcc : t.inputBorder}`,
                        color: t.text, fontSize: 16, fontWeight: 700, letterSpacing: '0.15em',
                      }}
                      maxLength={12}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isJoining || !eventCode.trim()}
                    className="px-5 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-[0.97]"
                    style={{
                      background: isJoining || !eventCode.trim() ? t.surface2 : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                      color: isJoining || !eventCode.trim() ? t.textMuted : '#fff',
                      fontWeight: 700, fontSize: 14, opacity: isJoining ? 0.7 : 1,
                    }}>
                    {isJoining
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><span>Join</span><ArrowRight style={{ width: 16, height: 16 }} /></>
                    }
                  </button>
                </div>
                {codeError && (
                  <p style={{ color: t.errorText, fontSize: 12, marginTop: 8, fontWeight: 500 }}>{codeError}</p>
                )}
              </form>
            </div>
          </div>

          {/* Upcoming events */}
          <div className="px-5 mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock style={{ width: 16, height: 16, color: '#3b82f6' }} />
                <h2 style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Upcoming Events</h2>
              </div>
              {!eventsLoading && (
                <span className="px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontSize: 11, fontWeight: 700 }}>
                  {upcomingEvents.length}
                </span>
              )}
            </div>
            {eventsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={28} style={{ color: '#7c3aed', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map(ev => <EventCard key={ev.id} event={ev} />)}
              </div>
            ) : (
              <div className="text-center py-10 rounded-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <Calendar style={{ width: 40, height: 40, color: t.emptyIcon, margin: '0 auto 8px' }} />
                <p style={{ color: t.textSec, fontSize: 14 }}>No upcoming events</p>
              </div>
            )}
          </div>

          {/* Past events */}
          {!eventsLoading && pastEvents.length > 0 && (
            <div className="px-5 mt-8 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar style={{ width: 16, height: 16, color: '#6b7280' }} />
                  <h2 style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Past Events</h2>
                </div>
                <span className="px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(107,114,128,0.12)', color: '#9ca3af', fontSize: 11, fontWeight: 700 }}>
                  {pastEvents.length}
                </span>
              </div>
              <div className="space-y-3">
                {pastEvents.map(ev => <EventCard key={ev.id} event={ev} compact />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Event Key Gate Modal ─────────────────────────────────────────── */}
      {gateEvent && (
        <div
          className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => { setGateEvent(null); setKeyError(''); }}
        >
          <div
            className="w-full max-w-sm mx-4 mb-8 rounded-3xl overflow-hidden"
            style={{
              background: isDark ? '#111120' : '#fff',
              border: `1px solid rgba(124,58,237,0.3)`,
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="relative px-6 pt-7 pb-5"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(79,70,229,0.12))' }}>
              <button
                onClick={() => { setGateEvent(null); setKeyError(''); }}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)' }}>
                <X size={14} color="rgba(255,255,255,0.6)" />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                  <Lock size={20} color="white" />
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Access Required
                  </p>
                  <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>
                    {gateEvent.title}
                  </h2>
                </div>
              </div>

              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.55 }}>
                You are not a member of this event. Enter your event key to gain access.
              </p>
            </div>

            {/* Key input */}
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-1.5">
                <KeyRound size={13} style={{ color: '#7c3aed' }} />
                <span style={{ color: t.textSec, fontSize: 12, fontWeight: 600 }}>Event Key</span>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. CISO2026"
                  value={eventKey}
                  onChange={e => { setEventKey(e.target.value.toUpperCase()); setKeyError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleJoinWithKey()}
                  className="flex-1 px-4 py-3 rounded-xl outline-none text-center tracking-widest"
                  style={{
                    background: t.inputBg,
                    border: `1.5px solid ${keyError ? '#ef4444' : eventKey ? '#7c3aed' : t.inputBorder}`,
                    color: t.text,
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                  }}
                  maxLength={12}
                />
              </div>

              {keyError && (
                <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p style={{ color: '#f87171', fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>{keyError}</p>
                </div>
              )}

              <button
                onClick={handleJoinWithKey}
                disabled={isJoiningEvent || !eventKey.trim()}
                className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{
                  background: isJoiningEvent || !eventKey.trim()
                    ? 'rgba(124,58,237,0.3)'
                    : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  opacity: isJoiningEvent ? 0.8 : 1,
                  boxShadow: eventKey.trim() && !isJoiningEvent ? '0 4px 20px rgba(124,58,237,0.35)' : 'none',
                }}>
                {isJoiningEvent ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock size={15} />
                    Join Event
                  </>
                )}
              </button>

              <button
                onClick={() => { setGateEvent(null); setKeyError(''); setEventKey(''); }}
                className="w-full py-2.5 mt-2 rounded-xl text-center"
                style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Video modal ───────────────────────────────────────────────────── */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-[300] flex flex-col"
          style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)' }}
          onClick={() => setPlayingVideo(null)}>
          <div className="flex items-center justify-between px-5 pt-14 pb-4">
            <div className="flex-1 pr-4">
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{playingVideo.title}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {playingVideo.event_categories.map(cat => (
                  <span key={cat} className="px-2 py-0.5 rounded-full"
                    style={{ background: `${CATEGORY_COLORS[cat] ?? '#7c3aed'}22`, color: CATEGORY_COLORS[cat] ?? '#a78bfa', fontSize: 10, fontWeight: 700 }}>
                    {cat}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setPlayingVideo(null)}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div
            className="mx-5 rounded-2xl overflow-hidden"
            style={{ aspectRatio: '16/9' }}
            onClick={e => e.stopPropagation()}>
            <iframe
              src={`${playingVideo.embed_url}?autoplay=1&rel=0`}
              title={playingVideo.title}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ border: 'none' }}
            />
          </div>

          <div className="px-5 pt-4">
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6 }}>{playingVideo.description}</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes live-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
};
