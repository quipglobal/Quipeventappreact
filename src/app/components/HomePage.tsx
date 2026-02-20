import React, { useState } from 'react';
import { Award, Calendar, FileText, BarChart3, Building2, Trophy, TrendingUp, Clock, MapPin, Ticket } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { mockSessions } from '@/app/data/mockData';
import { SwitchEventModal } from '@/app/components/SwitchEventModal';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { user, eventConfig, gamificationConfig } = useApp();
  const [switchModalOpen, setSwitchModalOpen] = useState(false);

  if (!user) return null;

  const tierColor = user.tier === 'Platinum' ? 'from-slate-300 to-slate-400' 
    : user.tier === 'Gold' ? 'from-yellow-400 to-amber-500'
    : user.tier === 'Silver' ? 'from-gray-300 to-gray-400'
    : 'from-amber-700 to-amber-800';

  const nextSession = mockSessions[0];

  const quickActions = [
    { id: 'agenda', label: 'View Agenda', icon: Calendar, color: 'from-blue-500 to-cyan-500' },
    { id: 'engage-survey', label: 'Take Survey', icon: FileText, color: 'from-emerald-500 to-teal-500', points: `+${gamificationConfig.pointActions.completeSurvey}` },
    { id: 'engage-poll', label: 'Vote Poll', icon: BarChart3, color: 'from-purple-500 to-pink-500', points: `+${gamificationConfig.pointActions.votePoll}` },
    { id: 'engage-sponsors', label: 'Meet Sponsors', icon: Building2, color: 'from-orange-500 to-red-500', points: `+${gamificationConfig.pointActions.sponsorCheckIn}` },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, color: 'from-indigo-500 to-purple-500' },
  ];

  return (
    <div className="pb-20 min-h-screen" style={{ background: 'linear-gradient(to bottom, #fafafa 0%, #ffffff 100%)' }}>
      {/* Header with Event Info */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-6 pt-12 pb-12 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-300/10 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <div className="mb-8">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold mb-2 text-white tracking-tight">{eventConfig.name}</h1>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>{eventConfig.dates}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{eventConfig.location}</span>
                  </div>
                </div>
              </div>

              {/* Switch Event icon button */}
              <button
                onClick={() => setSwitchModalOpen(true)}
                aria-label="Switch Event"
                title="Switch Event"
                className="flex-shrink-0 flex flex-col items-center gap-1 group"
              >
                <div className="relative w-11 h-11 bg-white/15 backdrop-blur-sm border border-white/30 rounded-2xl flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all shadow-lg group-hover:shadow-white/20">
                  <Ticket className="w-5 h-5 text-white" />
                  {/* Pulse ring */}
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white/30 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  </span>
                </div>
                <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wider leading-none">
                  Switch
                </span>
              </button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-white/70 mb-2 font-medium uppercase tracking-wide">Welcome back,</p>
            <p className="text-2xl font-bold text-white tracking-tight">{user.name.split(' ')[0]}!</p>
          </div>
        </div>
      </div>

      {/* Points & Tier Card */}
      <div className="px-6 -mt-8 mb-8 relative z-20">
        <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 bg-gradient-to-br ${tierColor} rounded-2xl flex items-center justify-center shadow-lg`}>
                <Award className="w-9 h-9 text-white drop-shadow" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your Points</p>
                <p className="text-4xl font-bold text-gray-900 tracking-tight">{user.points}</p>
              </div>
            </div>
            <div className={`px-5 py-2.5 bg-gradient-to-br ${tierColor} rounded-2xl shadow-md`}>
              <p className="text-white font-bold text-sm tracking-wide">{user.tier}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 text-sm text-emerald-600 bg-emerald-50 px-4 py-3 rounded-2xl border border-emerald-100">
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">Keep engaging to reach the next tier!</span>
          </div>
        </div>
      </div>

      {/* Next Session Card */}
      {nextSession && (
        <div className="px-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Next Up</h2>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{nextSession.startTime}</span>
              </div>
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="text-sm font-medium">{nextSession.room}</span>
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2">{nextSession.title}</h3>
            <p className="text-sm text-white/90 mb-4">{nextSession.speakers[0]?.name}</p>
            <button
              onClick={() => onNavigate('agenda')}
              className="w-full bg-white text-indigo-600 py-3 rounded-xl font-medium hover:bg-white/90 transition-all"
            >
              View Full Agenda
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => {
                  if (action.id.startsWith('engage-')) {
                    onNavigate('engage');
                  } else {
                    onNavigate(action.id);
                  }
                }}
                className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition-all text-left group"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="font-bold text-gray-900 text-sm mb-1">{action.label}</p>
                {action.points && (
                  <p className="text-xs text-emerald-600 font-medium">{action.points} pts</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Announcements */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Announcements</h2>
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 mb-1">New Session Added</p>
                <p className="text-sm text-gray-600">Join us for a surprise fireside chat at 6 PM today!</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 mb-1">Poll Now Live</p>
                <p className="text-sm text-gray-600">Vote for tomorrow's keynote topic and earn +10 points!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How to Earn Points */}
      <div className="px-6 mb-6">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            How to Earn Points
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Complete a survey</span>
              <span className="font-bold text-emerald-600">+{gamificationConfig.pointActions.completeSurvey}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Check-in with sponsor</span>
              <span className="font-bold text-emerald-600">+{gamificationConfig.pointActions.sponsorCheckIn}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Vote in a poll</span>
              <span className="font-bold text-emerald-600">+{gamificationConfig.pointActions.votePoll}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Complete challenge</span>
              <span className="font-bold text-emerald-600">+{gamificationConfig.pointActions.completeChallenge}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Switch Event Modal */}
      <SwitchEventModal
        isOpen={switchModalOpen}
        onClose={() => setSwitchModalOpen(false)}
      />
    </div>
  );
};