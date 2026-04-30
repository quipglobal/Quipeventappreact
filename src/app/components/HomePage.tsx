import React, { useEffect, useMemo, useState } from 'react';
import {
  Gift, ChevronRight, Sparkles, Star, TrendingUp, Calendar,
  MapPin, Trophy, Mic, Clock, Crown, ArrowRight, Users,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { SocialFeed } from '@/app/components/feed/SocialFeed';
import { listSessionsApi } from '@/app/api/agendaClient';
import { getEventSpeakersApi, type EventMember } from '@/app/api/audienceClient';
import type { Session, Speaker } from '@/app/types/config';

interface HomePageProps { onNavigate: (page: string) => void; }

const TIER_COLORS: Record<string, string> = {
  Bronze:   '#cd7f32',
  Silver:   '#c0c0c0',
  Gold:     '#ffd700',
  Platinum: '#e5e4e2',
};

function pickNextSession(sessions: Session[]): Session | null {
  const now = Date.now();
  const upcoming = sessions
    .filter(s => s.startIso && new Date(s.startIso).getTime() > now)
    .sort((a, b) => new Date(a.startIso!).getTime() - new Date(b.startIso!).getTime());
  if (upcoming.length > 0) return upcoming[0];
  // fall back to live (started but not ended) session
  const live = sessions.find(s => {
    if (!s.startIso || !s.endIso) return false;
    const start = new Date(s.startIso).getTime();
    const end   = new Date(s.endIso).getTime();
    return start <= now && now <= end;
  });
  if (live) return live;
  return sessions[0] ?? null;
}

function formatRelativeStart(iso: string | undefined): string {
  if (!iso) return '';
  const start = new Date(iso).getTime();
  const now = Date.now();
  const diff = start - now;
  if (diff < 0) return 'Live now';
  const mins = Math.round(diff / 60000);
  if (mins < 1)   return 'Starting now';
  if (mins < 60)  return `In ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `In ${hours} hr`;
  const days = Math.round(hours / 24);
  return `In ${days} day${days === 1 ? '' : 's'}`;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { user, eventConfig, gamificationConfig, sponsorGiveaways, leaderboard } = useApp();
  const { t, isDark } = useTheme();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [, setLoadingSessions]  = useState(false);
  const [audienceSpeakers, setAudienceSpeakers] = useState<EventMember[]>([]);

  useEffect(() => {
    if (!eventConfig?.eventId) return;
    let cancelled = false;
    setLoadingSessions(true);
    listSessionsApi(eventConfig.eventId)
      .then(res => { if (!cancelled && res.success && res.data) setSessions(res.data); })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoadingSessions(false); });
    return () => { cancelled = true; };
  }, [eventConfig?.eventId]);

  // Pull the actual people in the event with the SPEAKER role so we can show
  // them on the home page even if the agenda doesn't link to user profiles.
  useEffect(() => {
    // Reset on every event change so stale speakers from a previous event
    // never linger and incorrectly suppress the agenda fallback.
    setAudienceSpeakers([]);
    if (!eventConfig?.eventId) return;
    const targetEventId = eventConfig.eventId;
    let cancelled = false;
    getEventSpeakersApi(targetEventId, 24)
      .then(res => {
        // Guard against stale async races if the user switched events
        // before this request resolved.
        if (cancelled || targetEventId !== eventConfig.eventId) return;
        if (res.success && res.data) setAudienceSpeakers(res.data);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [eventConfig?.eventId]);

  const nextSession = useMemo(() => pickNextSession(sessions), [sessions]);

  // Prefer real audience speakers (richer profile data); fall back to speakers
  // mentioned in agenda sessions for events whose audience isn't tagged yet.
  const featuredSpeakers: Speaker[] = useMemo(() => {
    if (audienceSpeakers.length > 0) {
      return audienceSpeakers.map(m => ({
        id: String(m.userId),
        name: m.name,
        title: m.title ?? '',
        company: m.company ?? '',
        avatar: m.avatar ?? '',
        bio: m.bio ?? '',
      }));
    }
    const seen = new Set<string>();
    const all: Speaker[] = [];
    sessions.forEach(s => {
      s.speakers.forEach(sp => {
        const key = sp.id || sp.name;
        if (!key || seen.has(key)) return;
        seen.add(key);
        all.push(sp);
      });
    });
    return all.slice(0, 8);
  }, [audienceSpeakers, sessions]);

  if (!user) return null;

  const nextTier = gamificationConfig.tiers.find(ti => ti.minPoints > user.points);
  const ptsToNextTier = nextTier ? nextTier.minPoints - user.points : 0;
  const tierColor = TIER_COLORS[user.tier] ?? '#7c3aed';

  // Top-3 preview is derived from the same context-backed leaderboard
  // the full Leaderboard page consumes — single source of truth, so a
  // refresh on either screen propagates everywhere. Each row falls back
  // to a generated avatar when the backend hasn't supplied one.
  const leaderboardTop3 = leaderboard.slice(0, 3).map(entry => ({
    rank: entry.rank,
    name: entry.name,
    company: entry.company,
    points: entry.points,
    avatar:
      entry.avatar && entry.avatar.trim() !== ''
        ? entry.avatar
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name || 'Attendee')}&background=6366f1&color=fff`,
  }));
  // Prefer the backend-supplied rank for the current user when they
  // appear in the rankings; otherwise fall back to a points-based
  // estimate against whoever's in the top-3 cache. This keeps the
  // "Your Rank" pill meaningful even when the user's outside the
  // top-3 returned for the home preview.
  const meFromLeaderboard = leaderboard.find(e => e.userId === user.id);
  const youRank = meFromLeaderboard
    ? meFromLeaderboard.rank
    : (leaderboardTop3.findIndex(p => p.points <= user.points) + 1 || (leaderboardTop3.length + 1));

  const bannerBg = eventConfig?.backgroundURL
    ? `linear-gradient(160deg,rgba(10,5,30,0.55) 0%,rgba(30,10,60,0.7) 100%),url(${eventConfig.backgroundURL}) center/cover no-repeat`
    : 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 55%,#6366f1 100%)';

  const liveGiveaway = sponsorGiveaways[0];

  return (
    <div className="min-h-screen pb-6" style={{ background: t.bgPage }}>

      {/* ── Event Banner ───────────────────────────────────────────────── */}
      <div className="px-4 pt-3">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: bannerBg,
            minHeight: 132,
            border: '1px solid rgba(124,58,237,0.25)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
          }}
        >
          <div className="relative p-4 flex items-end h-full" style={{ minHeight: 132 }}>
            <div className="flex-1">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-2"
                style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
                  YOU'RE ATTENDING
                </span>
              </span>
              <h1 style={{ color: '#fff', fontSize: 19, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                {eventConfig?.name || 'Event'}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {eventConfig?.dates && (
                  <span className="flex items-center gap-1"><Calendar size={11} /> {eventConfig.dates}</span>
                )}
                {eventConfig?.location && (
                  <span className="flex items-center gap-1"><MapPin size={11} /> {eventConfig.location}</span>
                )}
              </div>
            </div>
            {eventConfig?.logoURL && (
              <div className="ml-3 w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
                style={{ background: '#fff', padding: 4, border: '1px solid rgba(255,255,255,0.5)' }}>
                <img src={eventConfig.logoURL} alt="" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Points summary card ─────────────────────────────────────────── */}
      <div className="px-4 pt-3">
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1))',
            border: '1px solid rgba(124,58,237,0.25)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                <Star size={16} color="white" fill="white" />
              </div>
              <div>
                <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Points</p>
                <p style={{ color: t.text, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{user.points.toLocaleString()}</p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl"
              style={{ background: `rgba(${tierColor === '#ffd700' ? '255,215,0' : '124,58,237'},0.18)`, border: `1px solid ${tierColor}40` }}>
              <span style={{ color: tierColor, fontSize: 12, fontWeight: 700 }}>{user.tier}</span>
            </div>
          </div>
          {nextTier && ptsToNextTier > 0 && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ color: t.textMuted, fontSize: 11 }}>{ptsToNextTier} pts to {nextTier.name}</span>
                <span style={{ color: t.textMuted, fontSize: 11 }}>{user.points} / {nextTier.minPoints}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, ((user.points - (gamificationConfig.tiers.find(ti => ti.name === user.tier)?.minPoints ?? 0)) / (nextTier.minPoints - (gamificationConfig.tiers.find(ti => ti.name === user.tier)?.minPoints ?? 0))) * 100)}%`,
                    background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Spotlight: Next Session ─────────────────────────────────────── */}
      {nextSession && (
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h2 style={{ color: t.text, fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>
              Up Next
            </h2>
            <button onClick={() => onNavigate('agenda')}
              className="flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: '#a78bfa' }}>
              View agenda <ChevronRight size={12} />
            </button>
          </div>
          <button
            onClick={() => onNavigate('agenda')}
            className="w-full text-left rounded-2xl p-4 active:scale-[0.99] transition-all relative overflow-hidden"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <Clock size={10} color="#a78bfa" />
                <span style={{ color: '#a78bfa', fontSize: 10, fontWeight: 700 }}>
                  {formatRelativeStart(nextSession.startIso)}
                </span>
              </span>
              {nextSession.track && (
                <span style={{ color: t.textMuted, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {nextSession.track}
                </span>
              )}
            </div>
            <p style={{ color: t.text, fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>
              {nextSession.title}
            </p>
            <div className="flex items-center gap-3 mt-2 text-[11px]" style={{ color: t.textSec }}>
              <span className="flex items-center gap-1">
                <Clock size={11} /> {nextSession.startTime} – {nextSession.endTime}
              </span>
              {nextSession.room && (
                <span className="flex items-center gap-1"><MapPin size={11} /> {nextSession.room}</span>
              )}
            </div>
            {nextSession.speakers.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${t.divider}` }}>
                <div className="flex -space-x-2">
                  {nextSession.speakers.slice(0, 3).map((sp, i) => (
                    <div key={sp.id || i}
                      className="w-7 h-7 rounded-full overflow-hidden border-2"
                      style={{ borderColor: t.surface }}>
                      {sp.avatar ? (
                        <img src={sp.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                          {sp.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <span style={{ color: t.textSec, fontSize: 11 }}>
                  {nextSession.speakers.map(s => s.name).slice(0, 2).join(', ')}
                  {nextSession.speakers.length > 2 ? ` +${nextSession.speakers.length - 2}` : ''}
                </span>
              </div>
            )}
            {nextSession.assignedAudience && nextSession.assignedAudience.length > 0 && (
              <div className="flex items-center gap-2 mt-2.5 pt-2.5"
                style={{ borderTop: `1px dashed ${t.divider}` }}>
                <Users size={11} color={t.textMuted} />
                <div className="flex -space-x-1.5">
                  {nextSession.assignedAudience.slice(0, 4).map((m, i) => (
                    <div key={m.id || i}
                      title={m.name}
                      className="w-6 h-6 rounded-full overflow-hidden border-2 flex-shrink-0"
                      style={{ borderColor: t.surface, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                  {nextSession.assignedAudience.length > 4 && (
                    <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: t.surface, background: t.surface2, color: t.textSec, fontSize: 9, fontWeight: 700 }}>
                      +{nextSession.assignedAudience.length - 4}
                    </div>
                  )}
                </div>
                <span style={{ color: t.textMuted, fontSize: 11 }}>
                  {nextSession.assignedAudience.length} attending
                </span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* ── Speakers Spotlight ──────────────────────────────────────────── */}
      {featuredSpeakers.length > 0 && (
        <div className="pt-4">
          <div className="px-4 flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-1.5" style={{ color: t.text, fontSize: 14, fontWeight: 800 }}>
              <Mic size={14} color="#a78bfa" /> Speaker Spotlight
            </h2>
            <button onClick={() => onNavigate('agenda')}
              className="flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: '#a78bfa' }}>
              See all <ChevronRight size={12} />
            </button>
          </div>
          <div className="overflow-x-auto px-4 no-scrollbar">
            <div className="flex gap-3 pb-1">
              {featuredSpeakers.map((sp, i) => (
                <button
                  key={sp.id || i}
                  onClick={() => onNavigate('agenda')}
                  className="flex-shrink-0 w-[120px] rounded-2xl p-3 text-center active:scale-[0.97] transition-all"
                  style={{ background: t.surface, border: `1px solid ${t.border}` }}
                >
                  <div className="w-14 h-14 mx-auto rounded-full overflow-hidden mb-2"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                    {sp.avatar ? (
                      <img src={sp.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                        {sp.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p style={{ color: t.text, fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}
                    className="truncate">{sp.name}</p>
                  {sp.title && (
                    <p style={{ color: t.textMuted, fontSize: 10, marginTop: 2, lineHeight: 1.2 }}
                      className="line-clamp-2">{sp.title}</p>
                  )}
                  {sp.company && (
                    <p style={{ color: '#a78bfa', fontSize: 10, fontWeight: 600, marginTop: 3 }}
                      className="truncate">{sp.company}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Giveaways & Draws ───────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="flex items-center gap-1.5" style={{ color: t.text, fontSize: 14, fontWeight: 800 }}>
            <Gift size={14} color="#ec4899" /> Giveaways &amp; Draws
          </h2>
          <button onClick={() => onNavigate('engage-giveaways')}
            className="flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: '#ec4899' }}>
            View all <ChevronRight size={12} />
          </button>
        </div>
        <button
          onClick={() => onNavigate('engage-giveaways')}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:scale-[0.98] transition-all relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(236,72,153,0.18), rgba(124,58,237,0.18))',
            border: '1px solid rgba(236,72,153,0.3)',
            boxShadow: '0 4px 20px rgba(236,72,153,0.12)',
          }}
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #f472b6, transparent 70%)' }} />
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#ec4899,#7c3aed)' }}>
            <Gift size={20} color="white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold" style={{ color: t.text }}>
              {liveGiveaway ? liveGiveaway.title : 'Lucky Draw'}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>
              {liveGiveaway
                ? `${liveGiveaway.numberOfItems} prize${liveGiveaway.numberOfItems === 1 ? '' : 's'} from ${liveGiveaway.sponsorName}`
                : 'Enter for a chance to win prizes'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(244,114,182,0.2)' }}>
              <Sparkles size={10} color="#f472b6" />
              <span className="text-[10px] font-bold" style={{ color: '#f472b6' }}>Live</span>
            </div>
            <ChevronRight size={16} style={{ color: t.textMuted }} />
          </div>
        </button>
      </div>

      {/* ── Leaderboard Status ──────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="flex items-center gap-1.5" style={{ color: t.text, fontSize: 14, fontWeight: 800 }}>
            <Trophy size={14} color="#f59e0b" /> Leaderboard
          </h2>
          <button onClick={() => onNavigate('leaderboard')}
            className="flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: '#f59e0b' }}>
            Full ranking <ChevronRight size={12} />
          </button>
        </div>
        <div className="rounded-2xl overflow-hidden"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          {/* Your rank strip */}
          <div className="px-4 py-3 flex items-center gap-3"
            style={{
              background: 'linear-gradient(90deg, rgba(245,158,11,0.12), rgba(124,58,237,0.12))',
              borderBottom: `1px solid ${t.divider}`,
            }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#7c3aed)' }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>#{youRank}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>Your Rank</p>
              <p style={{ color: t.textMuted, fontSize: 11, marginTop: 3 }}>
                {user.points} pts · {user.tier} Tier
              </p>
            </div>
            <ArrowRight size={16} style={{ color: t.textMuted }} />
          </div>
          {/* Top 3 — empty placeholder shown until the backend hydrates
              the leaderboard so the card never looks "cut off". */}
          {leaderboardTop3.length === 0 && (
            <div className="px-4 py-3" style={{ color: t.textMuted, fontSize: 11 }}>
              Rankings will appear once attendees start earning points.
            </div>
          )}
          {leaderboardTop3.map((p, i) => (
            <div key={p.rank}
              className="px-4 py-2.5 flex items-center gap-3"
              style={{ borderBottom: i < leaderboardTop3.length - 1 ? `1px solid ${t.divider}` : undefined }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: p.rank === 1 ? 'linear-gradient(135deg,#fbbf24,#d97706)'
                    : p.rank === 2 ? 'linear-gradient(135deg,#cbd5e1,#64748b)'
                    : 'linear-gradient(135deg,#fb923c,#c2410c)',
                }}>
                {p.rank === 1
                  ? <Crown size={13} color="#fff" />
                  : <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>#{p.rank}</span>}
              </div>
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                <img src={p.avatar} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: t.text, fontSize: 12, fontWeight: 700 }}
                  className="truncate">{p.name}</p>
                <p style={{ color: t.textMuted, fontSize: 10 }} className="truncate">{p.company}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star size={10} fill="#f59e0b" color="#f59e0b" />
                <span style={{ color: t.text, fontSize: 12, fontWeight: 700 }}>{p.points}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feed label ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-1 flex items-center justify-between">
        <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Video Feed · Watch to earn
        </p>
        <div className="flex items-center gap-1">
          <Star size={10} fill="#f59e0b" color="#f59e0b" />
          <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>Points for every video</span>
        </div>
      </div>

      {/* ── Feed ──────────────────────────────────────────────────────── */}
      <SocialFeed onNavigate={onNavigate} />
    </div>
  );
};
