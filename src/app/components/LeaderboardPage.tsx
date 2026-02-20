import React, { useState } from 'react';
import { Trophy, Medal, Award, TrendingUp, Crown } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';

export const LeaderboardPage: React.FC = () => {
  const { user } = useApp();
  const { t } = useTheme();
  const [timeFilter, setTimeFilter] = useState<'overall' | 'today' | 'week'>('overall');

  const leaderboard = [
    { id: '1',  rank: 1,  name: 'Sarah Martinez', company: 'TechFlow Inc.',  points: 485, avatar: 'https://ui-avatars.com/api/?name=Sarah+Martinez&background=6366f1&color=fff', tier: 'Gold',   change: 0 },
    { id: '2',  rank: 2,  name: 'James Chen',     company: 'InnovateLab',   points: 450, avatar: 'https://ui-avatars.com/api/?name=James+Chen&background=8b5cf6&color=fff',     tier: 'Gold',   change: 1 },
    { id: '3',  rank: 3,  name: 'Emma Wilson',    company: 'DataCorp',      points: 420, avatar: 'https://ui-avatars.com/api/?name=Emma+Wilson&background=ec4899&color=fff',    tier: 'Gold',   change: -1 },
    { id: user?.id || '4', rank: 4, name: user?.name || 'Alex Johnson', company: user?.company || 'Innovation Inc.', points: user?.points || 0, avatar: user?.avatar || '', isCurrentUser: true, tier: user?.tier || 'Bronze', change: 2 },
    { id: '5',  rank: 5,  name: 'Michael Brown',  company: 'CloudTech',     points: 310, avatar: 'https://ui-avatars.com/api/?name=Michael+Brown&background=10b981&color=fff',  tier: 'Silver', change: 0 },
    { id: '6',  rank: 6,  name: 'Lisa Anderson',  company: 'SecureNet',     points: 285, avatar: 'https://ui-avatars.com/api/?name=Lisa+Anderson&background=f59e0b&color=fff',  tier: 'Silver', change: -2 },
    { id: '7',  rank: 7,  name: 'David Kim',      company: 'AI Solutions',  points: 250, avatar: 'https://ui-avatars.com/api/?name=David+Kim&background=3b82f6&color=fff',      tier: 'Silver', change: 1 },
    { id: '8',  rank: 8,  name: 'Sophie Taylor',  company: 'GreenTech',     points: 215, avatar: 'https://ui-avatars.com/api/?name=Sophie+Taylor&background=ef4444&color=fff',  tier: 'Silver', change: 0 },
    { id: '9',  rank: 9,  name: 'Ryan Park',      company: 'StartupHub',    points: 180, avatar: 'https://ui-avatars.com/api/?name=Ryan+Park&background=06b6d4&color=fff',      tier: 'Silver', change: 3 },
    { id: '10', rank: 10, name: 'Nina Patel',      company: 'DesignCo',      points: 165, avatar: 'https://ui-avatars.com/api/?name=Nina+Patel&background=8b5cf6&color=fff',     tier: 'Silver', change: -1 },
  ];

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

  const userRank = leaderboard.find(p => p.isCurrentUser);
  const top3 = leaderboard.slice(0, 3);

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
        {/* Time filter */}
        <div className="flex p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
          {(['overall', 'today', 'week'] as const).map(f => (
            <button key={f} onClick={() => setTimeFilter(f)}
              className="flex-1 py-2 rounded-lg transition-all"
              style={{ background: timeFilter === f ? '#fff' : 'transparent', color: timeFilter === f ? '#4f46e5' : '#fff', fontSize: 13, fontWeight: 600 }}>
              {f === 'overall' ? 'Overall' : f === 'today' ? 'Today' : 'This Week'}
            </button>
          ))}
        </div>
      </div>

      {/* Your Rank */}
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

      {/* Podium */}
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

      {/* Full list */}
      <div className="px-5">
        <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>All Rankings</h2>
        <div className="space-y-2">
          {leaderboard.map(person => (
            <div key={person.id}
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
                <p style={{ color: t.textMuted, fontSize: 12 }} className="truncate">{person.company}</p>
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
      </div>
    </div>
  );
};
