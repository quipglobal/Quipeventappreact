import React from 'react';
import { Gift, ChevronRight, Sparkles, Star, TrendingUp } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { SocialFeed } from '@/app/components/feed/SocialFeed';

interface HomePageProps { onNavigate: (page: string) => void; }

const TIER_COLORS: Record<string, string> = {
  Bronze:   '#cd7f32',
  Silver:   '#c0c0c0',
  Gold:     '#ffd700',
  Platinum: '#e5e4e2',
};

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { user, pointsHistory, gamificationConfig } = useApp();
  const { t } = useTheme();

  if (!user) return null;

  const videoPoints = pointsHistory
    .filter(e => e.action.toLowerCase().includes('watched') || e.action.toLowerCase().includes('video'))
    .reduce((sum, e) => sum + e.points, 0);

  const nextTier = gamificationConfig.tiers.find(ti => ti.minPoints > user.points);
  const ptsToNextTier = nextTier ? nextTier.minPoints - user.points : 0;
  const tierColor = TIER_COLORS[user.tier] ?? '#7c3aed';

  return (
    <div className="min-h-screen" style={{ background: t.bgPage }}>

      {/* ── Points summary card ─────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-1">
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1))',
            border: '1px solid rgba(124,58,237,0.25)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                <Star size={16} color="white" fill="white" />
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Points</p>
                <p style={{ color: '#fff', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{user.points.toLocaleString()}</p>
              </div>
            </div>
            <div>
              <div
                className="px-3 py-1.5 rounded-xl"
                style={{ background: `rgba(${tierColor === '#ffd700' ? '255,215,0' : '124,58,237'},0.18)`, border: `1px solid ${tierColor}40` }}>
                <span style={{ color: tierColor, fontSize: 12, fontWeight: 700 }}>{user.tier}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {videoPoints > 0 && (
              <div className="flex items-center gap-1.5">
                <TrendingUp size={12} color="#10b981" />
                <span style={{ color: '#10b981', fontSize: 11, fontWeight: 600 }}>+{videoPoints} from videos</span>
              </div>
            )}
            {nextTier && ptsToNextTier > 0 && (
              <div className="flex items-center gap-1.5">
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{ptsToNextTier} pts to {nextTier.name}</span>
              </div>
            )}
          </div>

          {nextTier && (
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, ((user.points - (gamificationConfig.tiers.find(ti => ti.name === user.tier)?.minPoints ?? 0)) / (nextTier.minPoints - (gamificationConfig.tiers.find(ti => ti.name === user.tier)?.minPoints ?? 0))) * 100)}%`,
                  background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Giveaways Shortcut ─────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-1">
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

      {/* ── Feed label ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Video Feed · Watch to earn
        </p>
        <div className="flex items-center gap-1">
          <Star size={10} fill="#f59e0b" color="#f59e0b" />
          <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>Points for every video</span>
        </div>
      </div>

      {/* ── Feed ──────────────────────────────────────────────────────── */}
      <SocialFeed onNavigate={onNavigate} />
    </div>
  );
};
