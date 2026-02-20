import React from 'react';
import { Home, Calendar, Zap, Trophy, User, Users, Building2 } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: 'attendee' | 'sponsor';
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, userRole }) => {
  const attendeeTabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'engage', label: 'Engage', icon: Zap },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const sponsorTabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'attendees', label: 'Attendees', icon: Users },
    { id: 'booth', label: 'Booth', icon: Building2 },
    { id: 'engage', label: 'Engage', icon: Zap },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const tabs = userRole === 'attendee' ? attendeeTabs : sponsorTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 z-40 max-w-md mx-auto shadow-2xl">
      <div className="flex items-center justify-around px-1 py-2 safe-area-bottom">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl transition-all ${
                isActive
                  ? 'text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl -z-10 shadow-sm" />
              )}
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform drop-shadow-sm`} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
              {isActive && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};