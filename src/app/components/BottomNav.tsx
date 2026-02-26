import React from 'react';
import { Home, Calendar, Sparkles, User, Users, ScanLine, ClipboardList } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: 'attendee' | 'sponsor';
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, userRole }) => {
  const { t } = useTheme();

  // Audience: Home, Events, Engage (highlighted), Profile
  const attendeeTabs = [
    { id: 'home',    label: 'Home',    icon: Home,     highlight: false },
    { id: 'events',  label: 'Events',  icon: Calendar, highlight: false },
    { id: 'engage',  label: 'Engage',  icon: Sparkles, highlight: true  },
    { id: 'profile', label: 'Profile', icon: User,     highlight: false },
  ];

  // Sponsor tabs: Home, Audience, Scan (highlighted), Leads, Profile
  const sponsorTabs = [
    { id: 'home',             label: 'Home',     icon: Home,          highlight: false },
    { id: 'engage-audience',  label: 'Audience', icon: Users,         highlight: false },
    { id: 'scan',             label: 'Scan',     icon: ScanLine,      highlight: true  },
    { id: 'attendees',        label: 'Leads',    icon: ClipboardList, highlight: false },
    { id: 'profile',          label: 'Profile',  icon: User,          highlight: false },
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

          // Highlighted tab (Engage for audience, Scan for sponsor) gets special treatment
          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all active:scale-95"
              >
                {/* Glowing background for highlighted tab */}
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.3))'
                      : 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.12))',
                    border: `1px solid ${isActive ? 'rgba(124,58,237,0.4)' : 'rgba(124,58,237,0.2)'}`,
                  }}
                />
                {/* Outer glow on active */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-2xl blur-lg"
                    style={{ background: 'rgba(124,58,237,0.2)' }}
                  />
                )}
                <Icon
                  className="relative w-5 h-5 transition-transform"
                  style={{
                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                    color: isActive ? '#a78bfa' : '#c4b5fd',
                  }}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className="relative"
                  style={{
                    fontSize: 10,
                    fontWeight: isActive ? 700 : 600,
                    letterSpacing: '0.03em',
                    color: isActive ? '#a78bfa' : '#c4b5fd',
                  }}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: '#a78bfa' }}
                  />
                )}
              </button>
            );
          }

          // Normal tab
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