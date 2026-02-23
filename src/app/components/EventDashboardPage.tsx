import React, { useState } from 'react';
import {
  Calendar, Users, Building2, FileText, BarChart3, Gift,
  MapPin, Clock, ChevronRight, Sparkles, Trophy, Zap,
  Bell, ArrowLeft, Star, Bookmark, Play, Mic2, Target,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { mockSessions, mockSurveys, mockPolls, mockSponsors, mockChallenges } from '@/app/data/mockData';
import { motion } from 'motion/react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModuleShortcut {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  glowColor: string;
  badge?: string | null;
  badgeColor?: string;
  page: string;
}

// ─── Happening Now mock ──────────────────────────────────────────────────────

const happeningNow = {
  session: {
    title: 'Keynote: The Future of AI & Humanity',
    speaker: 'Dr. Sarah Chen',
    speakerRole: 'Chief AI Officer, TechCorp',
    speakerAvatar: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=6366f1&color=fff',
    room: 'Main Hall',
    time: '9:00 AM – 10:00 AM',
    track: 'Keynote',
    attendees: 2100,
  },
  upNext: {
    title: 'Workshop: Building Scalable ML Pipelines',
    time: '10:30 AM',
    room: 'Workshop A',
  },
};

// ─── Giveaway highlight ──────────────────────────────────────────────────────

const featuredGiveaway = {
  title: 'Win a MacBook Pro M4',
  sponsor: 'TechCorp Solutions',
  sponsorLogo: 'https://ui-avatars.com/api/?name=TechCorp&background=6366f1&color=fff&size=128',
  booth: 'A-12',
  claimed: 342,
  pointsBonus: 50,
};

// ─── Component ───────────────────────────────────────────────────────────────

interface EventDashboardPageProps {
  onNavigate: (page: string) => void;
  onBack?: () => void;
}

export const EventDashboardPage: React.FC<EventDashboardPageProps> = ({ onNavigate, onBack }) => {
  const {
    user, eventConfig, gamificationConfig,
    completedSurveys, votedPolls, metSponsors, completedChallenges, bookmarkedSessions,
  } = useApp();
  const { t, isDark } = useTheme();

  if (!user) return null;

  // ── Badge counts ──
  const newSurveys = mockSurveys.filter(s => !completedSurveys.includes(s.id)).length;
  const livePolls = mockPolls.filter(p => p.isLive && !votedPolls.includes(p.id)).length;
  const unvisitedExhibitors = mockSponsors.filter(s => !metSponsors.includes(s.id)).length;
  const activeChallenges = mockChallenges.filter(c => !completedChallenges.includes(c.id)).length;

  // ── Module grid ──
  const modules: ModuleShortcut[] = [
    {
      id: 'agenda',
      label: 'Agenda',
      description: 'Sessions & schedule',
      icon: Calendar,
      gradient: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
      glowColor: 'rgba(124,58,237,0.3)',
      badge: `${mockSessions.length} sessions`,
      badgeColor: '#7c3aed',
      page: 'agenda',
    },
    {
      id: 'audience',
      label: 'Audience',
      description: 'Connect & network',
      icon: Users,
      gradient: 'linear-gradient(135deg,#4f46e5,#6366f1)',
      glowColor: 'rgba(99,102,241,0.3)',
      badge: '12 checked in',
      badgeColor: '#6366f1',
      page: 'engage-audience',
    },
    {
      id: 'exhibitors',
      label: 'Exhibitors',
      description: 'Booths & demos',
      icon: Building2,
      gradient: 'linear-gradient(135deg,#f97316,#ef4444)',
      glowColor: 'rgba(249,115,22,0.3)',
      badge: unvisitedExhibitors > 0 ? `${unvisitedExhibitors} to visit` : null,
      badgeColor: '#f97316',
      page: 'engage-sponsors',
    },
    {
      id: 'surveys',
      label: 'Surveys',
      description: 'Share feedback',
      icon: FileText,
      gradient: 'linear-gradient(135deg,#10b981,#0d9488)',
      glowColor: 'rgba(16,185,129,0.3)',
      badge: newSurveys > 0 ? `${newSurveys} new` : null,
      badgeColor: '#10b981',
      page: 'engage-surveys',
    },
    {
      id: 'polls',
      label: 'Polls',
      description: 'Vote & see results',
      icon: BarChart3,
      gradient: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
      glowColor: 'rgba(236,72,153,0.3)',
      badge: livePolls > 0 ? `${livePolls} live` : null,
      badgeColor: '#ec4899',
      page: 'engage-polls',
    },
    {
      id: 'giveaways',
      label: 'Giveaways',
      description: 'Prizes & offers',
      icon: Gift,
      gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
      glowColor: 'rgba(245,158,11,0.3)',
      badge: '5 available',
      badgeColor: '#f59e0b',
      page: 'engage-giveaways',
    },
  ];

  // ── Quick stats ──
  const stats = [
    { value: completedSurveys.length, total: mockSurveys.length, label: 'Surveys', color: '#10b981', icon: FileText },
    { value: votedPolls.length, total: mockPolls.length, label: 'Polls', color: '#ec4899', icon: BarChart3 },
    { value: metSponsors.length, total: mockSponsors.length, label: 'Booths', color: '#f97316', icon: Building2 },
    { value: completedChallenges.length, total: mockChallenges.length, label: 'Tasks', color: '#3b82f6', icon: Target },
  ];

  return (
    <div className="pb-24 min-h-screen" style={{ background: t.bgPage }}>
      {/* ── Cinematic Header ─────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-5 pt-11 pb-6"
        style={{ background: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 35%,#4f46e5 70%,#7c3aed 100%)' }}
      >
        {/* Decorative */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-12"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
        <div className="absolute bottom-0 -left-10 w-36 h-36 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />

        <div className="relative z-10">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {onBack && (
                <button onClick={onBack}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <ArrowLeft style={{ width: 16, height: 16, color: '#fff' }} />
                </button>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span style={{ color: '#34d399', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Live Now
                </span>
              </div>
            </div>
            <button className="w-8 h-8 rounded-full flex items-center justify-center relative"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Bell style={{ width: 16, height: 16, color: '#fff' }} />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>

          {/* Event info */}
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 6 }}>
            {eventConfig.name}
          </h1>
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
              <Calendar style={{ width: 12, height: 12 }} /> {eventConfig.dates}
            </span>
            <span className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
              <MapPin style={{ width: 12, height: 12 }} /> {eventConfig.location}
            </span>
          </div>

          {/* User points strip */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
              <Zap style={{ width: 14, height: 14, color: '#fbbf24' }} />
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>{user.points}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>pts</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
              <Trophy style={{ width: 14, height: 14, color: '#c4b5fd' }} />
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{user.tier}</span>
            </div>
            <button onClick={() => onNavigate('leaderboard')}
              className="ml-auto flex items-center gap-1 px-3 py-2 rounded-xl active:scale-95 transition-transform"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <Star style={{ width: 12, height: 12, color: '#fbbf24' }} />
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600 }}>Leaderboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Progress Overview ────────────────────────────────────── */}
      <div className="px-5 -mt-3 mb-5 relative z-10">
        <div className="rounded-2xl p-4"
          style={{ background: t.surface, boxShadow: t.shadowHov, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Your Engagement
            </span>
            <span style={{ color: t.accentSoft, fontSize: 11, fontWeight: 700 }}>
              {completedSurveys.length + votedPolls.length + metSponsors.length + completedChallenges.length} / {mockSurveys.length + mockPolls.length + mockSponsors.length + mockChallenges.length} completed
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {stats.map(st => {
              const Icon = st.icon;
              return (
                <div key={st.label} className="text-center">
                  <div className="relative w-full">
                    {/* Circular-ish progress */}
                    <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center relative"
                      style={{ background: `${st.color}15` }}>
                      <svg className="absolute inset-0" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="24" cy="24" r="20" fill="none"
                          stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeWidth="3" />
                        <circle cx="24" cy="24" r="20" fill="none"
                          stroke={st.color} strokeWidth="3"
                          strokeDasharray={`${(st.value / Math.max(st.total, 1)) * 125.6} 125.6`}
                          strokeLinecap="round" />
                      </svg>
                      <span style={{ color: st.color, fontSize: 14, fontWeight: 800, position: 'relative', zIndex: 1 }}>
                        {st.value}
                      </span>
                    </div>
                  </div>
                  <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 600, marginTop: 4 }}>{st.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Happening Now ────────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 style={{ color: t.text, fontSize: 15, fontWeight: 800 }}>Happening Now</h2>
          </div>
          <button onClick={() => onNavigate('agenda')} className="flex items-center gap-1 active:opacity-70">
            <span style={{ color: t.accentSoft, fontSize: 12, fontWeight: 600 }}>Full Agenda</span>
            <ChevronRight style={{ width: 14, height: 14, color: t.accentSoft }} />
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: t.surface,
            boxShadow: t.shadow,
            border: `1px solid rgba(16,185,129,0.25)`,
          }}
        >
          {/* Subtle live glow */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%)' }} />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(16,185,129,0.12)' }}>
                <Play style={{ width: 10, height: 10, color: '#10b981', fill: '#10b981' }} />
                <span style={{ color: '#10b981', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Live
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>
                  {happeningNow.session.track}
                </span>
              </span>
              <span className="flex items-center gap-1 ml-auto"
                style={{ color: t.textMuted, fontSize: 11 }}>
                <Clock style={{ width: 11, height: 11 }} /> {happeningNow.session.time}
              </span>
            </div>

            <h3 style={{ color: t.text, fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 8 }}>
              {happeningNow.session.title}
            </h3>

            <div className="flex items-center gap-2.5 mb-3">
              <img src={happeningNow.session.speakerAvatar} alt="" className="w-7 h-7 rounded-full" />
              <div>
                <p style={{ color: t.text, fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{happeningNow.session.speaker}</p>
                <p style={{ color: t.textMuted, fontSize: 10 }}>{happeningNow.session.speakerRole}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5" style={{ color: t.textSec, fontSize: 11 }}>
                <MapPin style={{ width: 11, height: 11, color: t.textMuted }} /> {happeningNow.session.room}
              </span>
              <span className="flex items-center gap-1.5" style={{ color: t.textSec, fontSize: 11 }}>
                <Users style={{ width: 11, height: 11, color: t.textMuted }} /> {happeningNow.session.attendees.toLocaleString()}
              </span>
            </div>

            {/* Up Next teaser */}
            <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: `1px solid ${t.divider}` }}>
              <span style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Up Next
              </span>
              <span style={{ color: t.textSec, fontSize: 12 }}>
                {happeningNow.upNext.title}
              </span>
              <span className="ml-auto" style={{ color: t.textMuted, fontSize: 11 }}>
                {happeningNow.upNext.time}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Module Shortcuts Grid ────────────────────────────────── */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ color: t.text, fontSize: 15, fontWeight: 800 }}>Quick Access</h2>
          <div className="flex items-center gap-1">
            <Sparkles style={{ width: 12, height: 12, color: t.accentSoft }} />
            <span style={{ color: t.accentSoft, fontSize: 11, fontWeight: 600 }}>Earn points</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {modules.map((mod, index) => {
            const Icon = mod.icon;
            return (
              <motion.button
                key={mod.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.35 }}
                onClick={() => onNavigate(mod.page)}
                className="relative rounded-2xl p-4 text-center active:scale-[0.96] transition-transform overflow-hidden"
                style={{
                  background: t.surface,
                  boxShadow: t.shadow,
                  border: `1px solid ${t.border}`,
                }}
              >
                {/* Badge */}
                {mod.badge && (
                  <div className="absolute top-2 right-2">
                    <span className="px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `${mod.badgeColor}18`,
                        color: mod.badgeColor,
                        fontSize: 8,
                        fontWeight: 700,
                      }}>
                      {mod.badge}
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2.5"
                  style={{ background: mod.gradient, boxShadow: `0 4px 14px ${mod.glowColor}` }}>
                  <Icon style={{ width: 22, height: 22, color: '#fff' }} />
                </div>

                <h3 style={{ color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                  {mod.label}
                </h3>
                <p style={{ color: t.textMuted, fontSize: 10, lineHeight: 1.3 }}>
                  {mod.description}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Featured Giveaway Highlight ──────────────────────────── */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gift style={{ width: 15, height: 15, color: '#f59e0b' }} />
            <h2 style={{ color: t.text, fontSize: 15, fontWeight: 800 }}>Featured Giveaway</h2>
          </div>
          <button onClick={() => onNavigate('engage-giveaways')} className="flex items-center gap-1 active:opacity-70">
            <span style={{ color: t.accentSoft, fontSize: 12, fontWeight: 600 }}>View All</span>
            <ChevronRight style={{ width: 14, height: 14, color: t.accentSoft }} />
          </button>
        </div>

        <button
          onClick={() => onNavigate('engage-giveaways')}
          className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all relative overflow-hidden"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(217,119,6,0.04))'
              : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(254,243,199,0.5))',
            border: '1px solid rgba(245,158,11,0.2)',
            boxShadow: '0 4px 20px rgba(245,158,11,0.08)',
          }}
        >
          {/* Glow */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.3), transparent 70%)' }} />

          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}>
              <Gift style={{ width: 26, height: 26, color: '#fff' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 style={{ color: t.text, fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
                {featuredGiveaway.title}
              </h3>
              <div className="flex items-center gap-2 mb-2">
                <img src={featuredGiveaway.sponsorLogo} alt=""
                  className="w-4 h-4 rounded-sm flex-shrink-0" />
                <span style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>
                  {featuredGiveaway.sponsor}
                </span>
                <span style={{ color: t.textMuted, fontSize: 11 }}>
                  · Booth {featuredGiveaway.booth}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <Sparkles style={{ width: 10, height: 10, color: '#10b981' }} />
                  <span style={{ color: '#10b981', fontSize: 10, fontWeight: 700 }}>+{featuredGiveaway.pointsBonus} pts</span>
                </span>
                <span className="flex items-center gap-1"
                  style={{ color: t.textMuted, fontSize: 10 }}>
                  <Users style={{ width: 10, height: 10 }} />
                  {featuredGiveaway.claimed} entered
                </span>
              </div>
            </div>
            <ChevronRight style={{ width: 18, height: 18, color: '#f59e0b', flexShrink: 0 }} />
          </div>
        </button>
      </div>

      {/* ── Challenges Quick View ────────────────────────────────── */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy style={{ width: 15, height: 15, color: '#3b82f6' }} />
            <h2 style={{ color: t.text, fontSize: 15, fontWeight: 800 }}>Active Challenges</h2>
          </div>
          <button onClick={() => onNavigate('engage-challenges')} className="flex items-center gap-1 active:opacity-70">
            <span style={{ color: t.accentSoft, fontSize: 12, fontWeight: 600 }}>All</span>
            <ChevronRight style={{ width: 14, height: 14, color: t.accentSoft }} />
          </button>
        </div>

        <div className="space-y-2.5">
          {mockChallenges.slice(0, 3).map(ch => {
            const isComplete = completedChallenges.includes(ch.id);
            let progress = 0;
            if (ch.type === 'sponsor_visits') progress = metSponsors.length;
            else if (ch.type === 'survey_completion') progress = completedSurveys.length;
            else if (ch.type === 'poll_votes') progress = votedPolls.length;
            else if (ch.type === 'session_attendance') progress = bookmarkedSessions.length;
            progress = Math.min(progress, ch.target);
            const pct = (progress / ch.target) * 100;

            return (
              <div key={ch.id}
                className="rounded-xl p-3.5 flex items-center gap-3"
                style={{
                  background: isComplete ? t.successBg : t.surface,
                  border: `1px solid ${isComplete ? `${t.successText}30` : t.border}`,
                }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: isComplete ? t.successBg : 'rgba(59,130,246,0.1)' }}>
                  {isComplete
                    ? <Star style={{ width: 16, height: 16, color: t.successText, fill: t.successText }} />
                    : <Target style={{ width: 16, height: 16, color: '#3b82f6' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ color: t.text, fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{ch.title}</p>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: t.surface2 }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: isComplete
                          ? t.successText
                          : 'linear-gradient(90deg,#3b82f6,#6366f1)',
                      }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p style={{ color: isComplete ? t.successText : t.text, fontSize: 11, fontWeight: 700 }}>
                    {progress}/{ch.target}
                  </p>
                  <p style={{ color: '#10b981', fontSize: 9, fontWeight: 600 }}>
                    +{ch.rewardPoints}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Engagement CTA ───────────────────────────────────────── */}
      <div className="px-5 pb-5">
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(79,70,229,0.04))'
              : 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(237,233,254,0.5))',
            border: `1px solid ${t.borderAcc}`,
          }}>
          <div className="flex items-start gap-3">
            <Sparkles style={{ width: 18, height: 18, color: t.accentSoft, flexShrink: 0, marginTop: 2 }} />
            <div>
              <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                Maximize Your Experience
              </h3>
              <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5 }}>
                Visit exhibitor booths, complete surveys, and vote on polls to earn points and climb the leaderboard!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};