import React from 'react';
import { Home, Calendar, Zap, Trophy, User, Users, Building2 } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: 'attendee' | 'sponsor';
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, userRole }) => {
  const { t } = useTheme();

  const attendeeTabs = [
    { id: 'home',        label: 'Home',        icon: Home },
    { id: 'agenda',      label: 'Agenda',      icon: Calendar },
    { id: 'engage',      label: 'Engage',      icon: Zap },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'profile',     label: 'Profile',     icon: User },
  ];
  const sponsorTabs = [
    { id: 'home',        label: 'Home',        icon: Home },
    { id: 'attendees',   label: 'Attendees',   icon: Users },
    { id: 'booth',       label: 'Booth',       icon: Building2 },
    { id: 'engage',      label: 'Engage',      icon: Zap },
    { id: 'profile',     label: 'Profile',     icon: User },
  ];

  const tabs = userRole === 'attendee' ? attendeeTabs : sponsorTabs;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 max-w-[430px] mx-auto"
      style={{
        background: t.navBg,
        borderTop: `1px solid ${t.navBorder}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center justify-around px-2 py-2 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all active:scale-95"
              style={{ color: isActive ? t.navActive : t.navInactive }}
            >
              {isActive && (
                <div className="absolute inset-0 rounded-2xl" style={{ background: t.navActiveBg }} />
              )}
              <Icon
                className="relative w-5 h-5 transition-transform"
                style={{ transform: isActive ? 'scale(1.1)' : 'scale(1)' }}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className="relative" style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.03em' }}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: t.navActive }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
