import React, { useState } from 'react';
import {
  Ticket, Calendar, MapPin, Users, ChevronRight, Clock,
  ArrowRight, Globe, Video, Hash,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { EventConfig } from '@/app/types/config';

type EventStatus = 'live' | 'upcoming' | 'past';
type EventCategory = 'conference' | 'workshop' | 'webinar' | 'meetup' | 'hackathon' | 'summit';

interface OrganizerEvent {
  id: string;
  title: string;
  cover: string;
  status: EventStatus;
  category: EventCategory;
  dates: string;
  location: string;
  isVirtual: boolean;
  attendees: number;
  sessions: number;
  isFeatured?: boolean;
  eventCode: string;
  config: EventConfig;
}

const allEvents: OrganizerEvent[] = [
  {
    id: 'ev-1',
    title: 'Tech Summit 2026',
    cover: 'https://images.unsplash.com/photo-1762968269894-1d7e1ce8894e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNoJTIwY29uZmVyZW5jZSUyMHN0YWdlJTIwYXVkaWVuY2V8ZW58MXx8fHwxNzcxODMyNDc5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'live',
    category: 'conference',
    dates: 'Jan 16–18, 2026',
    location: 'San Francisco, CA',
    isVirtual: false,
    attendees: 2400,
    sessions: 36,
    isFeatured: true,
    eventCode: 'TECH26',
    config: {
      eventId: 'tech-summit-2026',
      name: 'Tech Summit 2026',
      dates: 'January 16–18, 2026',
      timezone: 'PST',
      location: 'San Francisco, CA',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#ec4899' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: true, leaderboard: true, audience: true, challenges: true, notifications: true },
      permissions: { guestAccess: true, sponsorRoleEnabled: true, networkingEnabled: true },
    },
  },
  {
    id: 'ev-2',
    title: 'DevCon Winter 2026',
    cover: 'https://images.unsplash.com/photo-1691026336764-f24456f76e03?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxBSSUyMHN1bW1pdCUyMGtleW5vdGUlMjBzcGVha2VyfGVufDF8fHx8MTc3MTgzMjQ4MHww&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'workshop',
    dates: 'Feb 20–22, 2026',
    location: 'Austin, TX',
    isVirtual: false,
    attendees: 1800,
    sessions: 24,
    eventCode: 'DEVCON',
    config: {
      eventId: 'devcon-winter-2026',
      name: 'DevCon Winter 2026',
      dates: 'February 20–22, 2026',
      timezone: 'CST',
      location: 'Austin, TX',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#0ea5e9', secondary: '#3b82f6', accent: '#6366f1' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: true, leaderboard: true, audience: false, challenges: true, notifications: true },
      permissions: { guestAccess: false, sponsorRoleEnabled: true, networkingEnabled: true },
    },
  },
  {
    id: 'ev-3',
    title: 'Leadership Summit 2026',
    cover: 'https://images.unsplash.com/photo-1625335534303-a3c1a3744694?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFydHVwJTIwaGFja2F0aG9uJTIwd29ya3Nob3B8ZW58MXx8fHwxNzcxODMyNDc5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'summit',
    dates: 'Mar 5–7, 2026',
    location: 'New York, NY',
    isVirtual: false,
    attendees: 950,
    sessions: 18,
    eventCode: 'SUMMIT',
    config: {
      eventId: 'leadership-summit-2026',
      name: 'Leadership Summit 2026',
      dates: 'March 5–7, 2026',
      timezone: 'EST',
      location: 'New York, NY',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#f59e0b', secondary: '#ef4444', accent: '#f97316' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: false, leaderboard: false, audience: true, challenges: false, notifications: true },
      permissions: { guestAccess: false, sponsorRoleEnabled: true, networkingEnabled: true },
    },
  },
  {
    id: 'ev-4',
    title: 'HealthTech Expo 2026',
    cover: 'https://images.unsplash.com/photo-1763543007050-4dac73ffc67f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdXN0YWluYWJpbGl0eSUyMGdyZWVuJTIwdGVjaCUyMGlubm92YXRpb258ZW58MXx8fHwxNzcxODMyNDgxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'conference',
    dates: 'Apr 10–12, 2026',
    location: 'Boston, MA',
    isVirtual: false,
    attendees: 3100,
    sessions: 30,
    eventCode: 'HEALTH',
    config: {
      eventId: 'healthtech-expo-2026',
      name: 'HealthTech Expo 2026',
      dates: 'April 10–12, 2026',
      timezone: 'EST',
      location: 'Boston, MA',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#10b981', secondary: '#14b8a6', accent: '#06b6d4' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: true, leaderboard: true, audience: true, challenges: true, notifications: true },
      permissions: { guestAccess: true, sponsorRoleEnabled: true, networkingEnabled: true },
    },
  },
  {
    id: 'ev-5',
    title: 'Design Forward 2026',
    cover: 'https://images.unsplash.com/photo-1763630730206-2c3a5d6c82d1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ24lMjBjb25mZXJlbmNlJTIwY3JlYXRpdmUlMjB3b3Jrc2hvcHxlbnwxfHx8fDE3NzE4MzI0ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'workshop',
    dates: 'May 8–9, 2026',
    location: 'Seattle, WA',
    isVirtual: false,
    attendees: 1200,
    sessions: 14,
    eventCode: 'DESIGN',
    config: {
      eventId: 'design-forward-2026',
      name: 'Design Forward 2026',
      dates: 'May 8–9, 2026',
      timezone: 'PST',
      location: 'Seattle, WA',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#ec4899', secondary: '#f43f5e', accent: '#a855f7' },
      modulesEnabled: { agenda: true, sponsors: false, surveys: true, polls: true, leaderboard: true, audience: true, challenges: false, notifications: true },
      permissions: { guestAccess: true, sponsorRoleEnabled: false, networkingEnabled: true },
    },
  },
  {
    id: 'ev-7',
    title: 'Women in Tech Leadership Mixer',
    cover: 'https://images.unsplash.com/photo-1768508949307-044ec3c1836a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG5ldHdvcmtpbmclMjBldmVudCUyMGNvY2t0YWlsfGVufDF8fHx8MTc3MTgyMjM3Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'past',
    category: 'meetup',
    dates: 'Dec 8, 2025',
    location: 'San Francisco, CA',
    isVirtual: false,
    attendees: 210,
    sessions: 3,
    eventCode: 'WITLEAD',
    config: {
      eventId: 'wit-mixer-2025',
      name: 'Women in Tech Leadership Mixer',
      dates: 'December 8, 2025',
      timezone: 'PST',
      location: 'San Francisco, CA',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#ec4899', secondary: '#db2777', accent: '#a855f7' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: false, leaderboard: false, audience: true, challenges: false, notifications: true },
      permissions: { guestAccess: true, sponsorRoleEnabled: false, networkingEnabled: true },
    },
  },
  {
    id: 'ev-8',
    title: 'Cloud Security Webinar Series',
    cover: 'https://images.unsplash.com/photo-1758598306845-8630d064a244?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aXJ0dWFsJTIwd2ViaW5hciUyMG9ubGluZSUyMHByZXNlbnRhdGlvbnxlbnwxfHx8fDE3NzE4MzI0ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'past',
    category: 'webinar',
    dates: 'Nov 12–14, 2025',
    location: 'Online',
    isVirtual: true,
    attendees: 1050,
    sessions: 3,
    eventCode: 'CSEC25',
    config: {
      eventId: 'cloud-security-2025',
      name: 'Cloud Security Webinar Series',
      dates: 'November 12–14, 2025',
      timezone: 'EST',
      location: 'Online',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#06b6d4', secondary: '#0284c7', accent: '#3b82f6' },
      modulesEnabled: { agenda: true, sponsors: false, surveys: true, polls: true, leaderboard: false, audience: false, challenges: false, notifications: true },
      permissions: { guestAccess: true, sponsorRoleEnabled: false, networkingEnabled: false },
    },
  },
];

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

interface EventJoinPageProps {
  onJoinEvent: () => void;
  onViewDashboard: () => void;
}

export const EventJoinPage: React.FC<EventJoinPageProps> = ({ onJoinEvent, onViewDashboard }) => {
  const { user, showToast, joinEvent, switchEvent } = useApp();
  const { t, isDark } = useTheme();
  const [eventCode, setEventCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [codeError, setCodeError] = useState('');

  const upcomingEvents = allEvents.filter(e => e.status === 'upcoming' || e.status === 'live');
  const pastEvents = allEvents.filter(e => e.status === 'past');

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');

    const code = eventCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (code.length < 4) {
      setCodeError('Please enter a valid event code');
      return;
    }

    const matched = allEvents.find(
      ev => ev.eventCode === code
    );

    if (!matched) {
      setCodeError('Event not found. Please check your code and try again.');
      return;
    }

    setIsJoining(true);
    setTimeout(() => {
      switchEvent(matched.config);
      joinEvent();
      setIsJoining(false);
      onJoinEvent();
    }, 1200);
  };

  const handleEventCardClick = (ev: OrganizerEvent) => {
    switchEvent(ev.config);
    onViewDashboard();
  };

  const EventCard: React.FC<{ event: OrganizerEvent; compact?: boolean }> = ({ event, compact }) => {
    const stCfg = statusConfig[event.status];
    const catCfg = categoryConfig[event.category];

    return (
      <button
        onClick={() => handleEventCardClick(event)}
        className="w-full text-left rounded-2xl overflow-hidden transition-all active:scale-[0.98]"
        style={{
          background: t.surface,
          boxShadow: t.shadow,
          border: `1px solid ${event.status === 'live' ? 'rgba(16,185,129,0.3)' : t.border}`,
        }}
      >
        <div className={`relative ${compact ? 'h-24' : 'h-32'} overflow-hidden`}>
          <ImageWithFallback
            src={event.cover}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: event.status === 'past'
                ? 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)'
                : 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
              ...(event.status === 'past' ? { filter: 'grayscale(0.4)' } : {}),
            }}
          />

          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{
              background: stCfg.dotColor,
              ...(event.status === 'live' ? { animation: 'pulse 1.5s infinite' } : {}),
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
            <span className="flex items-center gap-1" style={{ color: t.textSec, fontSize: 11 }}>
              <Calendar style={{ width: 11, height: 11, color: t.textMuted }} /> {event.dates}
            </span>
            <span className="flex items-center gap-1" style={{ color: t.textSec, fontSize: 11 }}>
              <MapPin style={{ width: 11, height: 11, color: t.textMuted }} /> {event.location}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: t.surface2 }}>
                <Users style={{ width: 10, height: 10, color: t.textMuted }} />
                <span style={{ color: t.textSec, fontSize: 10, fontWeight: 600 }}>
                  {event.attendees > 0 ? event.attendees.toLocaleString() : 'TBA'}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: t.surface2 }}>
                <Video style={{ width: 10, height: 10, color: t.textMuted }} />
                <span style={{ color: t.textSec, fontSize: 10, fontWeight: 600 }}>{event.sessions}</span>
              </div>
            </div>
            <ChevronRight style={{ width: 16, height: 16, color: t.textMuted }} />
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: t.bgPage }}>
      <div
        className="relative overflow-hidden px-5 pt-12 pb-6"
        style={{ background: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 40%,#4f46e5 75%,#7c3aed 100%)' }}
      >
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
        <div className="absolute bottom-4 -left-10 w-36 h-36 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Ticket style={{ width: 18, height: 18, color: '#c4b5fd' }} />
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Join Event
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
            Welcome{user ? `, ${user.name.split(' ')[0]}` : ''}!
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.5 }}>
            Enter your event code to join, or browse events below.
          </p>
        </div>
      </div>

      <div className="px-5 -mt-1 pt-5">
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
                    color: t.text,
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                  }}
                  maxLength={12}
                />
              </div>
              <button
                type="submit"
                disabled={isJoining || !eventCode.trim()}
                className="px-5 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-[0.97]"
                style={{
                  background: isJoining || !eventCode.trim()
                    ? t.surface2
                    : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  color: isJoining || !eventCode.trim() ? t.textMuted : '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  opacity: isJoining ? 0.7 : 1,
                }}
              >
                {isJoining ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Join</span>
                    <ArrowRight style={{ width: 16, height: 16 }} />
                  </>
                )}
              </button>
            </div>
            {codeError && (
              <p style={{ color: t.errorText, fontSize: 12, marginTop: 8, fontWeight: 500 }}>
                {codeError}
              </p>
            )}
            <p style={{ color: t.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
              Try: <span style={{ fontFamily: 'monospace', color: t.accentSoft }}>TECH26 · DEVCON · SUMMIT · HEALTH</span>
            </p>
          </form>
        </div>
      </div>

      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock style={{ width: 16, height: 16, color: '#3b82f6' }} />
            <h2 style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Upcoming Events</h2>
          </div>
          <span className="px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontSize: 11, fontWeight: 700 }}>
            {upcomingEvents.length}
          </span>
        </div>

        {upcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {upcomingEvents.map(ev => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 rounded-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <Calendar style={{ width: 40, height: 40, color: t.emptyIcon, margin: '0 auto 8px' }} />
            <p style={{ color: t.textSec, fontSize: 14 }}>No upcoming events</p>
          </div>
        )}
      </div>

      <div className="px-5 mt-8 mb-8">
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

        {pastEvents.length > 0 ? (
          <div className="space-y-3">
            {pastEvents.map(ev => (
              <EventCard key={ev.id} event={ev} compact />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 rounded-2xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <Calendar style={{ width: 40, height: 40, color: t.emptyIcon, margin: '0 auto 8px' }} />
            <p style={{ color: t.textSec, fontSize: 14 }}>No past events</p>
          </div>
        )}
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
