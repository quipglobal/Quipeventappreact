import React, { useEffect } from 'react';
import { Calendar, IdCard, ScanLine, Settings, Repeat, MessageCircle, X } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onSwitchEvents: () => void;
  unreadCount?: number;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  action: () => void;
  badge?: number;
}

export const SideMenu: React.FC<SideMenuProps> = ({ open, onClose, onNavigate, onSwitchEvents, unreadCount = 0 }) => {
  const { t, isDark } = useTheme();
  const { user } = useApp();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const go = (page: string) => { onNavigate(page); onClose(); };

  const items: MenuItem[] = [
    { id: 'agenda',     label: 'Agenda',        icon: Calendar,      action: () => go('agenda') },
    { id: 'my-badge',   label: 'My Badge',      icon: IdCard,        action: () => go('my-badge') },
    { id: 'scan',       label: 'Scan Badge',    icon: ScanLine,      action: () => go('scan') },
    { id: 'messages',   label: 'Messages',      icon: MessageCircle, action: () => go('meetings'), badge: unreadCount },
    { id: 'settings',   label: 'Settings',      icon: Settings,      action: () => go('profile') },
    { id: 'switch',     label: 'Switch Events', icon: Repeat,        action: () => { onSwitchEvents(); onClose(); } },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[60] transition-opacity"
        style={{
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Drawer (right side, constrained to mobile preview width) */}
      <div
        className="fixed top-0 bottom-0 z-[61] mx-auto"
        style={{
          left: 0,
          right: 0,
          maxWidth: 430,
          pointerEvents: 'none',
        }}
      >
        <div
          className="absolute top-0 bottom-0 right-0 transition-transform"
          style={{
            width: '78%',
            maxWidth: 320,
            background: isDark ? '#0d0a1a' : '#ffffff',
            borderLeft: `1px solid ${t.border}`,
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            pointerEvents: open ? 'auto' : 'none',
            boxShadow: '-12px 0 40px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            className="px-5 pt-6 pb-5"
            style={{
              background: 'linear-gradient(160deg,rgba(124,58,237,0.85) 0%,rgba(79,70,229,0.85) 100%)',
              color: '#fff',
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2"
                  style={{ borderColor: 'rgba(255,255,255,0.4)' }}>
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Me" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-violet-700 text-white font-bold">
                      {user?.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{user?.name ?? 'Guest'}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{user?.email ?? ''}</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.18)' }}
                aria-label="Close menu"
              >
                <X size={16} color="#fff" />
              </button>
            </div>
            {user && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-semibold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.18)' }}>
                  {user.points} pts
                </span>
                <span style={{ opacity: 0.85 }}>·</span>
                <span style={{ opacity: 0.9 }}>{user.tier} Tier</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto py-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors active:scale-[0.98]"
                  style={{ color: t.text }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.1)',
                      border: `1px solid ${isDark ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.2)'}`,
                    }}
                  >
                    <Icon size={17} color={isDark ? '#a78bfa' : '#7c3aed'} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span
                      className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center"
                      style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700 }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
            <p style={{ color: t.textMuted, fontSize: 11, textAlign: 'center' }}>
              CXO Inc · Event Companion
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
