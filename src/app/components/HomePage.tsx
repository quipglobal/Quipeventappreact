import React from 'react';
import { Gift, ChevronRight, Sparkles } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { SocialFeed } from '@/app/components/feed/SocialFeed';

interface HomePageProps { onNavigate: (page: string) => void; }

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { user } = useApp();
  const { t } = useTheme();

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
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            <Gift size={18} color="white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-white leading-tight">Giveaways &amp; Lucky Draw</p>
            <p className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>Enter for a chance to win prizes</p>
          </div>
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

      {/* ── Feed ──────────────────────────────────────────────────────── */}
      <SocialFeed onNavigate={onNavigate} />
    </div>
  );
};
