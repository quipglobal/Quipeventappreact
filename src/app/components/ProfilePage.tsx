import React from 'react';
import { Mail, Building2, Award, CheckCircle, BarChart3, Calendar, Settings, Bell, Globe, LogOut, User as UserIcon, Briefcase, Trophy, TrendingUp, History } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';

export const ProfilePage: React.FC = () => {
  const { user, completedSurveys, votedPolls, metSponsors, completedChallenges, pointsHistory } = useApp();

  if (!user) return null;

  const tierColor = user.tier === 'Platinum' ? 'from-slate-300 to-slate-400'
    : user.tier === 'Gold' ? 'from-yellow-400 to-amber-500'
    : user.tier === 'Silver' ? 'from-gray-300 to-gray-400'
    : 'from-amber-700 to-amber-800';

  const stats = [
    { label: 'Total Points', value: user.points, icon: Trophy, color: 'text-indigo-600' },
    { label: 'Surveys Done', value: completedSurveys.length, icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Polls Voted', value: votedPolls.length, icon: BarChart3, color: 'text-purple-600' },
    { label: 'Sponsors Met', value: metSponsors.length, icon: Building2, color: 'text-orange-600' },
  ];

  const achievements = [
    { id: '1', title: 'Early Bird', description: 'Checked in on day 1', icon: Calendar, earned: true, color: 'from-blue-500 to-cyan-500' },
    { id: '2', title: 'Survey Master', description: 'Completed 3 surveys', icon: CheckCircle, earned: completedSurveys.length >= 3, color: 'from-emerald-500 to-teal-500' },
    { id: '3', title: 'Social Butterfly', description: 'Met 5 sponsors', icon: Building2, earned: metSponsors.length >= 5, color: 'from-purple-500 to-pink-500' },
    { id: '4', title: 'Poll Enthusiast', description: 'Voted in all polls', icon: BarChart3, earned: votedPolls.length >= 3, color: 'from-amber-500 to-orange-500' },
  ];

  const settingsOptions = [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'language', label: 'Language', icon: Globe },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header with Profile */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-6 pt-12 pb-16 text-white">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-24 h-24 rounded-full border-4 border-white shadow-xl"
            />
            <div className={`absolute -bottom-2 -right-2 px-3 py-1 bg-gradient-to-r ${tierColor} rounded-full text-xs font-bold text-white shadow-lg`}>
              {user.tier}
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-1">{user.name}</h1>
          <p className="text-white/90 text-sm mb-1">{user.title}</p>
          <p className="text-white/80 text-sm mb-3">{user.company}</p>
          <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
            <UserIcon className="w-4 h-4" />
            {user.role === 'attendee' ? 'Attendee' : 'Sponsor'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-6 -mt-10 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-2xl shadow-lg p-4 text-center">
                <Icon className={`w-6 h-6 ${stat.color} mx-auto mb-2`} />
                <p className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.value}</p>
                <p className="text-xs text-gray-600">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contact Information */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Contact Information</h2>
        <div className="bg-white rounded-2xl shadow-md p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Email</p>
              <p className="font-medium text-gray-900 truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Company</p>
              <p className="font-medium text-gray-900 truncate">{user.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-pink-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Title</p>
              <p className="font-medium text-gray-900 truncate">{user.title}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Achievements</h2>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((achievement) => {
            const Icon = achievement.icon;
            return (
              <div
                key={achievement.id}
                className={`bg-white rounded-2xl shadow-md p-4 ${
                  achievement.earned ? '' : 'opacity-50'
                }`}
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${achievement.color} rounded-xl flex items-center justify-center mb-3 relative`}>
                  <Icon className="w-6 h-6 text-white" />
                  {achievement.earned && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-sm text-gray-900 mb-1">{achievement.title}</h3>
                <p className="text-xs text-gray-600">{achievement.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div className="bg-white rounded-2xl shadow-md p-5">
          {pointsHistory.length > 0 ? (
            <div className="space-y-3">
              {pointsHistory.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm text-gray-900 truncate">{event.action}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 flex-shrink-0">+{event.points}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Settings</h2>
        <div className="bg-white rounded-2xl shadow-md divide-y divide-gray-100">
          {settingsOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-all first:rounded-t-2xl last:rounded-b-2xl"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">{option.label}</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sign Out Button */}
      <div className="px-6">
        <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-medium bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 transition-all shadow-md">
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
