import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Trophy, Medal, Award, TrendingUp, Crown } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import type { LeaderboardEntry, LeaderboardPeriod } from '@/app/api/leaderboardClient';

/**
 * Build a placeholder avatar URL from a display name. Mirrors the
 * convention used elsewhere in the app for users without a profile
 * photo so the leaderboard never shows a broken image icon.
 */
const avatarFor = (name: string, fallback?: string): string => {
  if (fallback && fallback.trim() !== '') return fallback;
  const safe = encodeURIComponent(name || 'Attendee');
  return `https://ui-avatars.com/api/?name=${safe}&background=6366f1&color=fff`;
};

interface Row extends LeaderboardEntry {
  /** True for the row representing the signed-in user. Drives the
   *  highlight border and "(You)" suffix. Computed locally instead of
   *  shipped by the backend so the UI stays correct even if the
   *  backend leaves the current user out of its top-N. */
  isCurrentUser: boolean;
}

export const LeaderboardPage: React.FC = () => {
  const {
    user,
    leaderboard,
    leaderboardLoading,
    leaderboardPeriod,
    refreshLeaderboard,
  } = useApp();
  const { t } = useTheme();

  // Decorate rows with `isCurrentUser` so the render code stays clean.
  // We don't synthesize a row for the current user when the backend
  // doesn't include them — at that point we don't know their real
  // rank, and showing rank "—" alongside a real top-N feels worse
  // than just hiding the "Your Ranking" panel.
  const rows: Row[] = useMemo(
    () =>
      leaderboard.map(entry => ({
        ...entry,
        avatar: avatarFor(entry.name, entry.avatar),
        isCurrentUser: !!user?.id && entry.userId === user.id,
      })),
    [leaderboard, user?.id],
  );

  const userRank = rows.find(p => p.isCurrentUser);
  const top3 = rows.slice(0, 3);

  const LB_PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(LB_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCount(LB_PAGE_SIZE); }, [leaderboard]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + LB_PAGE_SIZE); },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Refresh on first mount so a deep-link straight to the
  // Leaderboard tab (without going through the Home page) still gets
  // fresh data — the context's on-event-change effect already covers
  // most cases but is a one-shot. The fetch is single-flight in the
  // context, so this is safe to no-op when one's already running.
  useEffect(() => {
    void refreshLeaderboard();
    // We deliberately fire-and-forget on mount only; the period
    // pills and event-change handler cover the other refresh paths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTimeFilter = (period: LeaderboardPeriod) => {
    if (period === leaderboardPeriod) return;
    void refreshLeaderboard(period);
  };

  const rankGrad = (rank: number) =>
    rank === 1 ? 'linear-gradient(135deg,#f59e0b,#d97706)'
    : rank === 2 ? 'linear-gradient(135deg,#94a3b8,#64748b)'
    : rank === 3 ? 'linear-gradient(135deg,#f97316,#ea580c)'
    : 'linear-gradient(135deg,#4f46e5,#7c3aed)';

  const tierGrad = (tier: string) =>
    tier === 'Platinum' ? 'linear-gradient(135deg,#94a3b8,#64748b)'
    : tier === 'Gold'   ? 'linear-gradient(135deg,#f59e0b,#d97706)'
    : tier === 'Silver' ? 'linear-gradient(135deg,#9ca3af,#6b7280)'
    :                     'linear-gradient(135deg,#92400e,#78350f)';

  return (
    <div className="pb-24 min-h-screen" style={{ background: t.bgPage }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-6" style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#9333ea 100%)' }}>
        <div className="flex items-center gap-3 mb-5">
          <Trophy style={{ width: 26, height: 26, color: '#fff' }} />
          <div>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Leaderboard</h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Top performers at the event</p>
          </div>
        </div>
        {/* Time filter 
        <div className="flex p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
          {(['overall', 'today', 'week'] as const).map(f => (
            <button key={f} onClick={() => setTimeFilter(f)}
              className="flex-1 py-2 rounded-lg transition-all"
              style={{ background: leaderboardPeriod === f ? '#fff' : 'transparent', color: leaderboardPeriod === f ? '#4f46e5' : '#fff', fontSize: 13, fontWeight: 600 }}>
              {f === 'overall' ? 'Overall' : f === 'today' ? 'Today' : 'This Week'}
            </button>
          ))}
        </div> By RT 07132026*/}
      </div>

      {/* Your Rank — only when the backend returned the current user
          in the rankings. Otherwise we'd be showing a fake rank. */}
      {userRank && (
        <div className="px-5 -mt-3 mb-5">
          <div className="rounded-2xl p-5" style={{ background: t.surface, boxShadow: t.shadow, border: `2px solid ${t.borderAcc}` }}>
            <p style={{ color: t.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Your Ranking</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-13 h-13 w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ background: rankGrad(userRank.rank) }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>#{userRank.rank}</span>
                </div>
                <div>
                  <p style={{ color: t.text, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{userRank.points} <span style={{ fontSize: 14, fontWeight: 600, color: t.textSec }}>pts</span></p>
                  <p style={{ color: t.textSec, fontSize: 13, marginTop: 3 }}>{userRank.tier} Tier</p>
                </div>
              </div>
              {userRank.change !== 0 && (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                  style={{ background: userRank.change > 0 ? t.successBg : t.errorBg, color: userRank.change > 0 ? t.successText : t.errorText }}>
                  <TrendingUp style={{ width: 14, height: 14, transform: userRank.change < 0 ? 'rotate(180deg)' : 'none' }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{Math.abs(userRank.change)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton — only shown when there's nothing to show
          yet. After the first hydration we keep the existing list
          visible during a refresh so period-pill clicks don't blank
          the page. */}
      {leaderboardLoading && rows.length === 0 && (
        <div className="px-5 mb-5">
          <div className="rounded-2xl p-8 text-center" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
            <div className="inline-block w-6 h-6 rounded-full animate-spin" style={{ border: `3px solid ${t.border}`, borderTopColor: t.accentSoft }} />
            <p style={{ color: t.textMuted, fontSize: 13, marginTop: 12 }}>Loading rankings…</p>
          </div>
        </div>
      )}

      {/* Empty state when the backend returned no rows (or the
          endpoint isn't deployed yet — same UX either way). */}
      {!leaderboardLoading && rows.length === 0 && (
        <div className="px-5 mb-5">
          <div className="rounded-2xl p-8 text-center" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
            <Trophy style={{ width: 32, height: 32, color: t.textMuted, margin: '0 auto 12px' }} />
            <p style={{ color: t.text, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No rankings yet</p>
            <p style={{ color: t.textMuted, fontSize: 13 }}>Earn points by joining sessions, scanning sponsors, and completing challenges.</p>
          </div>
        </div>
      )}

      {/* Podium — needs at least 3 rows to render the layout. With
          fewer than 3 we skip it; the All Rankings list below will
          still surface whoever's in the lead. */}
      {top3.length === 3 && (
        <div className="px-5 mb-5">
          <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Top 3 Leaders</h2>
          <div className="rounded-2xl p-5" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
            <div className="flex items-end justify-center gap-4">
              {/* 2nd */}
              <div className="flex flex-col items-center flex-1">
                <div className="relative mb-2">
                  <img src={top3[1].avatar} alt={top3[1].name} className="w-14 h-14 rounded-full" style={{ border: `3px solid #94a3b8` }} />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#94a3b8,#64748b)' }}>
                    <Medal style={{ width: 13, height: 13, color: '#fff' }} />
                  </div>
                </div>
                <p style={{ color: t.text, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{top3[1].name.split(' ')[0]}</p>
                <p style={{ color: t.textMuted, fontSize: 11 }}>{top3[1].points} pts</p>
                <div className="w-full rounded-t-xl mt-3 py-6" style={{ background: t.surface2 }} />
              </div>
              {/* 1st */}
              <div className="flex flex-col items-center flex-1 -mt-4">
                <Crown style={{ width: 24, height: 24, color: '#f59e0b', marginBottom: 4 }} />
                <div className="relative mb-2">
                  <img src={top3[0].avatar} alt={top3[0].name} className="w-[72px] h-[72px] rounded-full" style={{ border: `4px solid #f59e0b` }} />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    <Trophy style={{ width: 15, height: 15, color: '#fff' }} />
                  </div>
                </div>
                <p style={{ color: t.text, fontSize: 13, fontWeight: 800, textAlign: 'center' }}>{top3[0].name.split(' ')[0]}</p>
                <p style={{ color: t.textSec, fontSize: 12 }}>{top3[0].points} pts</p>
                <div className="w-full rounded-t-xl mt-3 py-10" style={{ background: 'rgba(245,158,11,0.12)' }} />
              </div>
              {/* 3rd */}
              <div className="flex flex-col items-center flex-1">
                <div className="relative mb-2">
                  <img src={top3[2].avatar} alt={top3[2].name} className="w-14 h-14 rounded-full" style={{ border: `3px solid #f97316` }} />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                    <Award style={{ width: 13, height: 13, color: '#fff' }} />
                  </div>
                </div>
                <p style={{ color: t.text, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{top3[2].name.split(' ')[0]}</p>
                <p style={{ color: t.textMuted, fontSize: 11 }}>{top3[2].points} pts</p>
                <div className="w-full rounded-t-xl mt-3 py-6" style={{ background: 'rgba(249,115,22,0.12)' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full list */}
      {rows.length > 0 && (
        <div className="px-5">
          <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>All Rankings</h2>
          <div className="space-y-2">
            {rows.slice(0, visibleCount).map(person => (
              <div key={person.userId}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all"
                style={{
                  background: t.surface,
                  border: person.isCurrentUser ? `2px solid ${t.borderAcc}` : `1px solid ${t.border}`,
                  boxShadow: person.isCurrentUser ? `0 0 0 1px ${t.borderAcc}` : t.shadow,
                }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: rankGrad(person.rank) }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>#{person.rank}</span>
                </div>
                <img src={person.avatar} alt={person.name} className="w-11 h-11 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p style={{ color: person.isCurrentUser ? t.accentSoft : t.text, fontWeight: 700, fontSize: 14 }} className="truncate">
                      {person.name}{person.isCurrentUser ? ' (You)' : ''}
                    </p>
                    <span className="px-2 py-0.5 rounded text-white flex-shrink-0" style={{ background: tierGrad(person.tier), fontSize: 10, fontWeight: 700 }}>
                      {person.tier}
                    </span>
                  </div>
                  {person.company && (
                    <p style={{ color: t.textMuted, fontSize: 12 }} className="truncate">{person.company}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p style={{ color: t.text, fontWeight: 800, fontSize: 15 }}>{person.points}</p>
                  {person.change !== 0 && (
                    <div className="flex items-center gap-0.5 justify-end" style={{ color: person.change > 0 ? t.successText : t.errorText, fontSize: 11, fontWeight: 700 }}>
                      <TrendingUp style={{ width: 11, height: 11, transform: person.change < 0 ? 'rotate(180deg)' : 'none' }} />
                      {Math.abs(person.change)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div ref={sentinelRef} className="h-4" />
        </div>
      )}
    </div>
  );
};
