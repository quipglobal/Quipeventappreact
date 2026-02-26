import React from 'react';
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, Mic2, Building2,
  Wifi, Coffee, Award, ChevronRight, Globe, Zap, Star,
  MessageCircle, FileText, BarChart3, Gift, ScanLine, Target,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { mockSessions, mockSponsors } from '@/app/data/mockData';
import { motion } from 'motion/react';

// ─── Schedule highlights ─────────────────────────────────────────────────────

const scheduleHighlights = [
  { time: '8:00 AM',  label: 'Registration & Check-in Opens', icon: Users,    color: '#10b981' },
  { time: '9:00 AM',  label: 'Keynote: The Future of AI & Humanity', icon: Mic2, color: '#7c3aed' },
  { time: '10:30 AM', label: 'Workshop: Building Scalable ML Pipelines', icon: Target, color: '#3b82f6' },
  { time: '12:00 PM', label: 'Networking Lunch & Exhibit Hall', icon: Coffee,  color: '#f59e0b' },
  { time: '1:30 PM',  label: 'Panel: Sustainability in Technology', icon: Globe, color: '#10b981' },
  { time: '3:00 PM',  label: 'Startup Pitch Competition Finals', icon: Award,  color: '#ec4899' },
  { time: '5:00 PM',  label: 'Closing Remarks & Prize Draw', icon: Gift,     color: '#f97316' },
];

const venueAmenities = [
  { label: 'Free Wi-Fi', icon: Wifi },
  { label: 'Catering', icon: Coffee },
  { label: 'AV Equipment', icon: Mic2 },
  { label: 'Exhibit Hall', icon: Building2 },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface SponsorEventPageProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
}

export const SponsorEventPage: React.FC<SponsorEventPageProps> = ({ onBack, onNavigate }) => {
  const { eventConfig, leads, user } = useApp();
  const { t, isDark } = useTheme();

  if (!user) return null;

  const quickActions = [
    { label: 'Scan Badge',  icon: ScanLine,     page: 'scan',       gradient: 'linear-gradient(135deg,#7c3aed,#4f46e5)', desc: 'Capture leads' },
    { label: 'My Leads',    icon: FileText,      page: 'attendees',  gradient: 'linear-gradient(135deg,#10b981,#059669)', desc: `${leads.length} captured` },
    { label: 'Audience',    icon: Users,         page: 'engage-audience', gradient: 'linear-gradient(135deg,#3b82f6,#6366f1)', desc: 'All attendees' },
    { label: 'Lucky Draw',  icon: Gift,          page: 'sponsor-draw', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', desc: 'Pick winners' },
  ];

  return (
    <div className="pb-8 min-h-screen" style={{ background: t.bgPage }}>
      {/* ── Hero Header ──────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Background image + overlay */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1560523160-c4ef2f0c61a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm9sb2d5JTIwY29uZmVyZW5jZSUyMHZlbnVlJTIwc3RhZ2V8ZW58MXx8fHwxNzcxODQxNDA2fDA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Conference venue"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(30,27,75,0.85) 0%, rgba(49,46,129,0.9) 50%, rgba(7,7,15,0.98) 100%)' }} />
        </div>

        <div className="relative z-10 px-5 pt-12 pb-6">
          <button onClick={onBack}
            className="flex items-center gap-1.5 mb-5 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Back</span>
          </button>

          {/* Live badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-3 w-fit"
            style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span style={{ color: '#34d399', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Happening Now
            </span>
          </div>

          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 8 }}>
            {eventConfig.name}
          </h1>

          <div className="flex flex-col gap-2 mb-5">
            <div className="flex items-center gap-2">
              <Calendar style={{ width: 14, height: 14, color: '#c4b5fd' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{eventConfig.dates}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin style={{ width: 14, height: 14, color: '#c4b5fd' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{eventConfig.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock style={{ width: 14, height: 14, color: '#c4b5fd' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>9:00 AM – 5:00 PM ({eventConfig.timezone})</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { value: '2,400+', label: 'Attendees', icon: Users, color: '#7c3aed' },
              { value: `${mockSessions.length}`, label: 'Sessions', icon: Mic2, color: '#3b82f6' },
              { value: `${mockSponsors.length}`, label: 'Sponsors', icon: Building2, color: '#f59e0b' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-xl px-3 py-2.5 text-center"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Icon style={{ width: 16, height: 16, color: stat.color, margin: '0 auto 4px' }} />
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{stat.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}>{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Quick Actions Grid ────────────────────────────────── */}
      <div className="px-5 -mt-1 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                onClick={() => onNavigate(action.page)}
                className="rounded-2xl p-4 text-left active:scale-[0.97] transition-all"
                style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2.5"
                  style={{ background: action.gradient }}>
                  <Icon style={{ width: 18, height: 18, color: '#fff' }} />
                </div>
                <p style={{ color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{action.label}</p>
                <p style={{ color: t.textMuted, fontSize: 11 }}>{action.desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Your Booth Info ────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Your Booth</h3>
        <div className="rounded-2xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <div className="flex items-center gap-3.5 mb-3.5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
              <Building2 style={{ width: 22, height: 22, color: '#fff' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{user.company}</p>
              <p style={{ color: t.textSec, fontSize: 12 }}>Booth #A-12 · Exhibit Hall</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl px-3 py-2 text-center" style={{ background: t.surface2 }}>
              <p style={{ color: t.text, fontSize: 16, fontWeight: 800 }}>{leads.length}</p>
              <p style={{ color: t.textMuted, fontSize: 10 }}>Leads</p>
            </div>
            <div className="rounded-xl px-3 py-2 text-center" style={{ background: t.surface2 }}>
              <p style={{ color: t.text, fontSize: 16, fontWeight: 800 }}>156</p>
              <p style={{ color: t.textMuted, fontSize: 10 }}>Visitors</p>
            </div>
            <div className="rounded-xl px-3 py-2 text-center" style={{ background: t.surface2 }}>
              <p style={{ color: t.text, fontSize: 16, fontWeight: 800 }}>4.8</p>
              <p style={{ color: t.textMuted, fontSize: 10 }}>Rating</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Today's Schedule ───────────────────────────────────── */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>Today's Schedule</h3>
          <button onClick={() => onNavigate('agenda')}
            className="flex items-center gap-1 active:opacity-70 transition-opacity">
            <span style={{ color: t.accentSoft, fontSize: 12, fontWeight: 600 }}>Full Agenda</span>
            <ChevronRight style={{ width: 14, height: 14, color: t.accentSoft }} />
          </button>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          {scheduleHighlights.map((item, i) => {
            const Icon = item.icon;
            const isLast = i === scheduleHighlights.length - 1;
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: isLast ? 'none' : `1px solid ${t.divider}` }}>
                <div className="w-14 flex-shrink-0 text-right">
                  <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                    {item.time}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}15` }}>
                  <Icon style={{ width: 14, height: 14, color: item.color }} />
                </div>
                <p className="flex-1 min-w-0 truncate" style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Venue & Amenities ──────────────────────────────────── */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Venue & Amenities</h3>
        <div className="rounded-2xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <MapPin style={{ width: 14, height: 14, color: t.accentSoft }} />
            <p style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>Moscone Center, San Francisco</p>
          </div>
          <p style={{ color: t.textSec, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
            747 Howard Street, San Francisco, CA 94103. Located in the heart of the SoMa district with easy access to BART and Muni.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {venueAmenities.map(am => {
              const Icon = am.icon;
              return (
                <div key={am.label} className="rounded-xl py-2.5 flex flex-col items-center gap-1.5"
                  style={{ background: t.surface2 }}>
                  <Icon style={{ width: 16, height: 16, color: t.accentSoft }} />
                  <span style={{ color: t.textMuted, fontSize: 9, fontWeight: 600 }}>{am.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Key Contacts ───────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Event Organizer</h3>
        <div className="rounded-2xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
              <Star style={{ width: 18, height: 18, color: '#fff' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>Tech Summit Team</p>
              <p style={{ color: t.textMuted, fontSize: 11 }}>Event Operations</p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl active:scale-95 transition-transform"
              style={{ background: t.accentBg, border: `1px solid ${t.borderAcc}` }}>
              <MessageCircle style={{ width: 13, height: 13, color: t.accentSoft }} />
              <span style={{ color: t.accentSoft, fontSize: 11, fontWeight: 700 }}>Chat</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Sponsor Guidelines ─────────────────────────────────── */}
      <div className="px-5 pb-4">
        <div className="rounded-xl p-4" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap style={{ width: 14, height: 14, color: t.accentSoft }} />
            <span style={{ color: t.text, fontSize: 12, fontWeight: 700 }}>Sponsor Tips</span>
          </div>
          <ul className="space-y-1.5">
            {[
              'Set up your booth by 8:00 AM sharp',
              'Scan every badge — even casual visitors',
              'Tag leads as Hot / Warm / Cold immediately',
              'Run a Lucky Draw to drive booth traffic',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span style={{ color: t.accentSoft, fontSize: 12, lineHeight: 1 }}>•</span>
                <span style={{ color: t.textSec, fontSize: 12, lineHeight: 1.5 }}>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
