import React from 'react';
import { PlaySquare, Sparkles, Users, Handshake, ScanLine, UserCheck, Calendar, MoreHorizontal } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenMore: () => void;
  isMoreOpen?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, onOpenMore, isMoreOpen }) => {
  const { t } = useTheme();
  const { user } = useApp();

  const isSponsor = user?.role === 'sponsor';

  const tabs = isSponsor
    ? [
        { id: 'home',             label: 'Home',     icon: PlaySquare,    highlight: false },
        { id: 'engage-audience',  label: 'Audience', icon: Users,         highlight: false },
        { id: 'engage',           label: 'Engage',   icon: Sparkles,      highlight: true  },
        { id: 'attendees',        label: 'Leads',    icon: UserCheck,     highlight: false },
        { id: '__more',           label: 'More',     icon: MoreHorizontal, highlight: false, isMore: true },
      ]
    : [
        { id: 'home',             label: 'Home',     icon: PlaySquare,    highlight: false },
        { id: 'engage-audience',  label: 'Audience', icon: Users,         highlight: false },
        { id: 'engage',           label: 'Engage',   icon: Sparkles,      highlight: true  },
        { id: 'partners',         label: 'Partners', icon: Handshake,     highlight: false },
        { id: '__more',           label: 'More',     icon: MoreHorizontal, highlight: false, isMore: true },
      ];

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
          const isMore = (tab as { isMore?: boolean }).isMore === true;
          const isActive = isMore ? !!isMoreOpen : activeTab === tab.id;
          const handleClick = () => (isMore ? onOpenMore() : onTabChange(tab.id));

          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={handleClick}
                className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all active:scale-95"
              >
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.3))'
                      : 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.12))',
                    border: `1px solid ${isActive ? 'rgba(124,58,237,0.4)' : 'rgba(124,58,237,0.2)'}`,
                  }}
                />
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

          return (
            <button
              key={tab.id}
              onClick={handleClick}
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
