import React, { useState } from 'react';
import { Trophy, Medal, Award, TrendingUp, Crown } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';

export const LeaderboardPage: React.FC = () => {
  const { user } = useApp();
  const [timeFilter, setTimeFilter] = useState<'overall' | 'today' | 'week'>('overall');

  const leaderboard = [
    { id: '1', rank: 1, name: 'Sarah Martinez', company: 'TechFlow Inc.', points: 485, avatar: 'https://ui-avatars.com/api/?name=Sarah+Martinez&background=6366f1&color=fff', tier: 'Gold', change: 0 },
    { id: '2', rank: 2, name: 'James Chen', company: 'InnovateLab', points: 450, avatar: 'https://ui-avatars.com/api/?name=James+Chen&background=8b5cf6&color=fff', tier: 'Gold', change: 1 },
    { id: '3', rank: 3, name: 'Emma Wilson', company: 'DataCorp', points: 420, avatar: 'https://ui-avatars.com/api/?name=Emma+Wilson&background=ec4899&color=fff', tier: 'Gold', change: -1 },
    { id: user?.id || '4', rank: 4, name: user?.name || 'Alex Johnson', company: user?.company || 'Innovation Inc.', points: user?.points || 0, avatar: user?.avatar || '', isCurrentUser: true, tier: user?.tier || 'Bronze', change: 2 },
    { id: '5', rank: 5, name: 'Michael Brown', company: 'CloudTech', points: 310, avatar: 'https://ui-avatars.com/api/?name=Michael+Brown&background=10b981&color=fff', tier: 'Silver', change: 0 },
    { id: '6', rank: 6, name: 'Lisa Anderson', company: 'SecureNet', points: 285, avatar: 'https://ui-avatars.com/api/?name=Lisa+Anderson&background=f59e0b&color=fff', tier: 'Silver', change: -2 },
    { id: '7', rank: 7, name: 'David Kim', company: 'AI Solutions', points: 250, avatar: 'https://ui-avatars.com/api/?name=David+Kim&background=3b82f6&color=fff', tier: 'Silver', change: 1 },
    { id: '8', rank: 8, name: 'Sophie Taylor', company: 'GreenTech', points: 215, avatar: 'https://ui-avatars.com/api/?name=Sophie+Taylor&background=ef4444&color=fff', tier: 'Silver', change: 0 },
    { id: '9', rank: 9, name: 'Ryan Park', company: 'StartupHub', points: 180, avatar: 'https://ui-avatars.com/api/?name=Ryan+Park&background=06b6d4&color=fff', tier: 'Silver', change: 3 },
    { id: '10', rank: 10, name: 'Nina Patel', company: 'DesignCo', points: 165, avatar: 'https://ui-avatars.com/api/?name=Nina+Patel&background=8b5cf6&color=fff', tier: 'Silver', change: -1 },
  ];

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500';
    if (rank === 3) return 'bg-gradient-to-br from-amber-500 to-amber-700';
    return 'bg-gradient-to-br from-indigo-500 to-purple-600';
  };

  const getTierColor = (tier: string) => {
    if (tier === 'Platinum') return 'bg-gradient-to-r from-slate-300 to-slate-400';
    if (tier === 'Gold') return 'bg-gradient-to-r from-yellow-400 to-amber-500';
    if (tier === 'Silver') return 'bg-gradient-to-r from-gray-300 to-gray-400';
    return 'bg-gradient-to-r from-amber-700 to-amber-800';
  };

  const userRank = leaderboard.find(p => p.isCurrentUser);

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-6 pt-12 pb-6 text-white">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Leaderboard</h1>
            <p className="text-white/90 text-sm">Top performers at the event</p>
          </div>
        </div>

        {/* Time Filter */}
        <div className="flex bg-white/20 backdrop-blur-sm rounded-xl p-1">
          <button
            onClick={() => setTimeFilter('overall')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              timeFilter === 'overall' ? 'bg-white text-indigo-600' : 'text-white'
            }`}
          >
            Overall
          </button>
          <button
            onClick={() => setTimeFilter('today')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              timeFilter === 'today' ? 'bg-white text-indigo-600' : 'text-white'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeFilter('week')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              timeFilter === 'week' ? 'bg-white text-indigo-600' : 'text-white'
            }`}
          >
            This Week
          </button>
        </div>
      </div>

      {/* Your Rank Card */}
      {userRank && (
        <div className="px-6 -mt-3 mb-6">
          <div className="bg-white rounded-2xl shadow-xl p-5 border-2 border-indigo-200">
            <p className="text-sm text-gray-500 mb-3">Your Ranking</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 ${getRankBadgeColor(userRank.rank)} rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                  #{userRank.rank}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">{userRank.points} pts</p>
                  <p className="text-sm text-gray-600">{userRank.tier} Tier</p>
                </div>
              </div>
              {userRank.change !== 0 && (
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${
                  userRank.change > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  <TrendingUp className={`w-4 h-4 ${userRank.change < 0 ? 'rotate-180' : ''}`} />
                  <span className="text-sm font-bold">{Math.abs(userRank.change)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top 3 Podium */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Top 3 Leaders</h2>
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-end justify-center gap-4">
            {/* 2nd Place */}
            <div className="flex flex-col items-center flex-1">
              <div className="relative mb-2">
                <img
                  src={leaderboard[1].avatar}
                  alt={leaderboard[1].name}
                  className="w-16 h-16 rounded-full border-4 border-gray-300"
                />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-md">
                  <Medal className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="font-bold text-sm text-gray-900 text-center truncate w-full">{leaderboard[1].name.split(' ')[0]}</p>
              <p className="text-xs text-gray-500">{leaderboard[1].points} pts</p>
              <div className="w-full bg-gray-100 rounded-t-xl mt-3 py-6" />
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center flex-1 -mt-4">
              <div className="relative mb-2">
                <img
                  src={leaderboard[0].avatar}
                  alt={leaderboard[0].name}
                  className="w-20 h-20 rounded-full border-4 border-yellow-400 shadow-lg"
                />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Crown className="w-8 h-8 text-yellow-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-md">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="font-bold text-gray-900 text-center truncate w-full">{leaderboard[0].name.split(' ')[0]}</p>
              <p className="text-sm text-gray-500">{leaderboard[0].points} pts</p>
              <div className="w-full bg-yellow-50 rounded-t-xl mt-3 py-10" />
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center flex-1">
              <div className="relative mb-2">
                <img
                  src={leaderboard[2].avatar}
                  alt={leaderboard[2].name}
                  className="w-16 h-16 rounded-full border-4 border-amber-500"
                />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center shadow-md">
                  <Award className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="font-bold text-sm text-gray-900 text-center truncate w-full">{leaderboard[2].name.split(' ')[0]}</p>
              <p className="text-xs text-gray-500">{leaderboard[2].points} pts</p>
              <div className="w-full bg-amber-50 rounded-t-xl mt-3 py-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Full Leaderboard */}
      <div className="px-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">All Rankings</h2>
        <div className="space-y-3">
          {leaderboard.map((person) => (
            <div
              key={person.id}
              className={`bg-white rounded-xl shadow-md p-4 flex items-center gap-4 transition-all ${
                person.isCurrentUser ? 'ring-2 ring-indigo-500 shadow-lg' : ''
              }`}
            >
              <div className={`w-11 h-11 ${getRankBadgeColor(person.rank)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow`}>
                #{person.rank}
              </div>
              <img
                src={person.avatar}
                alt={person.name}
                className="w-12 h-12 rounded-full flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-bold truncate ${person.isCurrentUser ? 'text-indigo-600' : 'text-gray-900'}`}>
                    {person.name}
                    {person.isCurrentUser && <span className="text-xs ml-1">(You)</span>}
                  </p>
                  <div className={`px-2 py-0.5 ${getTierColor(person.tier)} rounded text-xs font-bold text-white`}>
                    {person.tier}
                  </div>
                </div>
                <p className="text-sm text-gray-500 truncate">{person.company}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                <p className="font-bold text-gray-900">{person.points}</p>
                {person.change !== 0 && (
                  <div className={`flex items-center gap-0.5 text-xs ${
                    person.change > 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    <TrendingUp className={`w-3 h-3 ${person.change < 0 ? 'rotate-180' : ''}`} />
                    <span className="font-medium">{Math.abs(person.change)}</span>
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
