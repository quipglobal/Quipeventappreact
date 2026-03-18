import React, { useState } from 'react';
import { Gift, Video, CalendarDays, ChevronRight, Sparkles } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { SocialFeed } from '@/app/components/feed/SocialFeed';
import { EventsPage } from '@/app/components/EventsPage';
import { motion, AnimatePresence } from 'motion/react';

interface HomePageProps { onNavigate: (page: string) => void; }

type MainTab = 'feed' | 'events';

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { user } = useApp();
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState<MainTab>('feed');

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: t.bgPage }}>

      {/* ── Giveaways Shortcut ─────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        <button
          onClick={() => onNavigate('engage-giveaways')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-[0.98] transition-all relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(79,70,229,0.18))',
            border: '1px solid rgba(124,58,237,0.3)',
            boxShadow: '0 4px 20px rgba(124,58,237,0.12)',
          }}
        >
          {/* Glow blob */}
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />

          {/* Icon */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            <Gift size={18} color="white" />
          </div>

          {/* Text */}
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-white leading-tight">Giveaways &amp; Lucky Draw</p>
            <p className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>Enter for a chance to win prizes</p>
          </div>

          {/* Badge + arrow */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(167,139,250,0.2)' }}>
              <Sparkles size={10} color="#a78bfa" />
              <span className="text-[10px] font-bold" style={{ color: '#a78bfa' }}>Live</span>
            </div>
            <ChevronRight size={16} style={{ color: t.textMuted }} />
          </div>
        </button>
      </div>

      {/* ── Feed / Events Tab Bar ──────────────────────────────────────── */}
      <div className="sticky top-0 z-30 pt-1 pb-0" style={{ background: t.bgPage }}>
        <div className="flex items-center gap-1 px-4 pb-0">
          {([
            { id: 'feed' as MainTab,   label: 'Feed',   icon: Video },
            { id: 'events' as MainTab, label: 'Events', icon: CalendarDays },
          ] as { id: MainTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: isActive ? t.surface : 'transparent',
                  color: isActive ? t.accent : t.textMuted,
                  border: isActive ? `1px solid ${t.border}` : '1px solid transparent',
                  boxShadow: isActive ? t.shadow : 'none',
                }}>
                <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 h-px" style={{ background: t.divider }} />
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'feed' ? (
          <motion.div key="feed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <SocialFeed onNavigate={onNavigate} />
          </motion.div>
        ) : (
          <motion.div key="events" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <EventsPage onNavigate={onNavigate} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
