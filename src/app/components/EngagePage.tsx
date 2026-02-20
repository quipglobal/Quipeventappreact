import React from 'react';
import { Building2, FileText, BarChart3, Trophy, Sparkles, ArrowRight, Users } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { mockSurveys, mockPolls, mockSponsors, mockChallenges } from '@/app/data/mockData';

interface EngagePageProps {
  onNavigate: (page: string) => void;
}

export const EngagePage: React.FC<EngagePageProps> = ({ onNavigate }) => {
  const { completedSurveys, votedPolls, metSponsors, completedChallenges, eventConfig, gamificationConfig } = useApp();

  const newSurveysCount = mockSurveys.filter(s => !completedSurveys.includes(s.id)).length;
  const livePollsCount = mockPolls.filter(p => p.isLive && !votedPolls.includes(p.id)).length;
  const availableSponsors = mockSponsors.filter(s => !metSponsors.includes(s.id)).length;
  const activeChallenges = mockChallenges.filter(c => !completedChallenges.includes(c.id)).length;

  const engageModules = [
    {
      id: 'sponsors',
      title: 'Sponsors & Companies',
      description: 'Connect with sponsors at their booths',
      icon: Building2,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      points: `+${gamificationConfig.pointActions.sponsorCheckIn} per check-in`,
      badge: availableSponsors > 0 ? `${availableSponsors} available` : null,
      enabled: eventConfig.modulesEnabled.sponsors,
    },
    {
      id: 'surveys',
      title: 'Surveys',
      description: 'Share your feedback and earn points',
      icon: FileText,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      points: `+${gamificationConfig.pointActions.completeSurvey} per survey`,
      badge: newSurveysCount > 0 ? `${newSurveysCount} new` : null,
      enabled: eventConfig.modulesEnabled.surveys,
    },
    {
      id: 'polls',
      title: 'Live Polls',
      description: 'Vote on live polls and see results',
      icon: BarChart3,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      points: `+${gamificationConfig.pointActions.votePoll} per poll`,
      badge: livePollsCount > 0 ? `${livePollsCount} live` : null,
      enabled: eventConfig.modulesEnabled.polls,
    },
    {
      id: 'challenges',
      title: 'Challenges',
      description: 'Complete challenges for bonus points',
      icon: Trophy,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      points: `+${gamificationConfig.pointActions.completeChallenge} per challenge`,
      badge: activeChallenges > 0 ? `${activeChallenges} active` : null,
      enabled: eventConfig.modulesEnabled.challenges,
    },
    {
      id: 'audience',
      title: 'Networking',
      description: 'Connect with other attendees',
      icon: Users,
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      points: 'Connect & collaborate',
      badge: null,
      enabled: eventConfig.modulesEnabled.audience,
    },
  ];

  const enabledModules = engageModules.filter(m => m.enabled);

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-6 pt-12 pb-8 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Engage</h1>
        </div>
        <p className="text-white/90">Earn points and unlock rewards by participating</p>
      </div>

      {/* Engagement Stats */}
      <div className="px-6 -mt-4 mb-6">
        <div className="bg-white rounded-2xl shadow-xl p-5">
          <p className="text-sm text-gray-500 mb-3">Your Engagement Today</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{completedSurveys.length}</p>
              <p className="text-xs text-gray-600">Surveys</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{votedPolls.length}</p>
              <p className="text-xs text-gray-600">Polls</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{metSponsors.length}</p>
              <p className="text-xs text-gray-600">Sponsors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Engagement Modules */}
      <div className="px-6 space-y-4">
        {enabledModules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              onClick={() => onNavigate(`engage-${module.id}`)}
              className={`w-full bg-white border ${module.borderColor} rounded-2xl p-5 hover:shadow-lg transition-all text-left group`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 bg-gradient-to-br ${module.color} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{module.title}</h3>
                    {module.badge && (
                      <span className={`px-2 py-0.5 ${module.bgColor} rounded-full text-xs font-bold`}>
                        {module.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{module.description}</p>
                  <p className="text-xs font-medium text-emerald-600">{module.points}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all flex-shrink-0 mt-2" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Disabled Module Notice */}
      {enabledModules.length < engageModules.length && (
        <div className="px-6 mt-6">
          <div className="bg-gray-100 border border-gray-200 rounded-2xl p-4 text-center">
            <p className="text-sm text-gray-600">
              Some engagement modules are currently disabled
            </p>
          </div>
        </div>
      )}

      {/* Pro Tip */}
      <div className="px-6 mt-6">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Pro Tip</h3>
              <p className="text-sm text-gray-700">
                Complete all surveys and polls to maximize your points and climb the leaderboard!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};