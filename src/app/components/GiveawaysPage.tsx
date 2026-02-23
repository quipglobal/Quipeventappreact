import React, { useState } from 'react';
import {
  ArrowLeft, Gift, MapPin, Clock, Star, ChevronRight,
  Ticket, CheckCircle, Sparkles, Users, Tag,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Giveaway {
  id: string;
  sponsorName: string;
  sponsorLogo: string;
  sponsorTier: 'Platinum' | 'Gold' | 'Silver';
  booth: string;
  title: string;
  description: string;
  image: string;
  type: 'raffle' | 'swag' | 'offer' | 'demo';
  requirement: string;
  pointsBonus: number;
  claimed: boolean;
  claimCount: number;
  totalAvailable: number | null;
  endsAt: string;
  featured?: boolean;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockGiveaways: Giveaway[] = [
  {
    id: 'g1',
    sponsorName: 'TechCorp Solutions',
    sponsorLogo: 'https://ui-avatars.com/api/?name=TechCorp&background=6366f1&color=fff&size=128',
    sponsorTier: 'Platinum',
    booth: 'A-12',
    title: 'Win a MacBook Pro M4',
    description: 'Visit our booth for a product demo and enter the raffle for a brand new MacBook Pro with M4 chip.',
    image: 'https://images.unsplash.com/photo-1764650909534-ebe7b1206466?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnaWZ0JTIwYm94JTIwZ2l2ZWF3YXklMjBwcml6ZSUyMHJhZmZsZXxlbnwxfHx8fDE3NzE4MzkxNTJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    type: 'raffle',
    requirement: 'Complete a booth demo',
    pointsBonus: 50,
    claimed: false,
    claimCount: 342,
    totalAvailable: null,
    endsAt: 'Jan 18, 5:00 PM',
    featured: true,
  },
  {
    id: 'g2',
    sponsorName: 'InnovateLab',
    sponsorLogo: 'https://ui-avatars.com/api/?name=InnovateLab&background=8b5cf6&color=fff&size=128',
    sponsorTier: 'Gold',
    booth: 'B-05',
    title: 'Free Cloud Credits — $500',
    description: 'Get $500 in free cloud credits when you sign up for a trial at our booth. Limited to first 200 attendees.',
    image: 'https://images.unsplash.com/photo-1746937618165-c8dc7f11dd77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNoJTIwY29uZmVyZW5jZSUyMGV4cG8lMjBib290aCUyMGRpc3BsYXl8ZW58MXx8fHwxNzcxODM5MTUyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    type: 'offer',
    requirement: 'Sign up for trial',
    pointsBonus: 30,
    claimed: false,
    claimCount: 147,
    totalAvailable: 200,
    endsAt: 'Jan 18, 5:00 PM',
    featured: true,
  },
  {
    id: 'g3',
    sponsorName: 'DataFlow Systems',
    sponsorLogo: 'https://ui-avatars.com/api/?name=DataFlow&background=ec4899&color=fff&size=128',
    sponsorTier: 'Gold',
    booth: 'A-08',
    title: 'Exclusive T-Shirt & Sticker Pack',
    description: 'Grab a limited-edition DataFlow t-shirt and developer sticker pack at our booth.',
    image: '',
    type: 'swag',
    requirement: 'Check in at booth',
    pointsBonus: 20,
    claimed: false,
    claimCount: 89,
    totalAvailable: 150,
    endsAt: 'While supplies last',
  },
  {
    id: 'g4',
    sponsorName: 'SecureNet Inc',
    sponsorLogo: 'https://ui-avatars.com/api/?name=SecureNet&background=10b981&color=fff&size=128',
    sponsorTier: 'Silver',
    booth: 'C-15',
    title: 'Free Security Audit Report',
    description: 'Get a complimentary security audit report for your infrastructure. Book a 15-minute consultation at our booth.',
    image: '',
    type: 'demo',
    requirement: 'Book a consultation',
    pointsBonus: 40,
    claimed: false,
    claimCount: 34,
    totalAvailable: 50,
    endsAt: 'Jan 17, 6:00 PM',
  },
  {
    id: 'g5',
    sponsorName: 'CloudStream',
    sponsorLogo: 'https://ui-avatars.com/api/?name=CloudStream&background=f59e0b&color=fff&size=128',
    sponsorTier: 'Silver',
    booth: 'B-22',
    title: '3 Months Premium Free',
    description: 'Scan the QR code at our booth to claim 3 months of CloudStream Premium absolutely free.',
    image: '',
    type: 'offer',
    requirement: 'Scan QR at booth',
    pointsBonus: 25,
    claimed: false,
    claimCount: 210,
    totalAvailable: null,
    endsAt: 'Jan 18, 5:00 PM',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const typeConfig: Record<string, { label: string; gradient: string; icon: React.ElementType }> = {
  raffle: { label: 'Raffle',      gradient: 'linear-gradient(135deg,#7c3aed,#ec4899)', icon: Star },
  swag:   { label: 'Swag',        gradient: 'linear-gradient(135deg,#f59e0b,#f97316)', icon: Gift },
  offer:  { label: 'Offer',       gradient: 'linear-gradient(135deg,#10b981,#0d9488)', icon: Tag },
  demo:   { label: 'Demo Reward', gradient: 'linear-gradient(135deg,#3b82f6,#06b6d4)', icon: Ticket },
};

const tierColor: Record<string, string> = {
  Platinum: '#94a3b8',
  Gold: '#f59e0b',
  Silver: '#9ca3af',
};

// ─── Component ───────────────────────────────────────────────────────────────

interface GiveawaysPageProps {
  onBack: () => void;
}

export const GiveawaysPage: React.FC<GiveawaysPageProps> = ({ onBack }) => {
  const { addPoints, showToast } = useApp();
  const { t, isDark } = useTheme();
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const handleClaim = (giveaway: Giveaway) => {
    if (claimedIds.includes(giveaway.id)) return;
    setClaimedIds(prev => [...prev, giveaway.id]);
    addPoints(giveaway.pointsBonus, `Claimed: ${giveaway.title}`);
  };

  const types = ['all', 'raffle', 'swag', 'offer', 'demo'];
  const filtered = mockGiveaways.filter(g => filter === 'all' || g.type === filter);

  return (
    <div className="pb-24 min-h-screen" style={{ background: t.bgPage }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 pt-12 pb-6"
        style={{ background: 'linear-gradient(160deg,#78350f 0%,#92400e 30%,#d97706 65%,#f59e0b 100%)' }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #fde68a, transparent 70%)' }} />
        <div className="absolute bottom-2 -left-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fbbf24, transparent 70%)' }} />

        <div className="relative z-10">
          <button onClick={onBack}
            className="flex items-center gap-1.5 mb-4 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Back</span>
          </button>

          <div className="flex items-center gap-2.5 mb-1">
            <Gift style={{ width: 22, height: 22, color: '#fde68a' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Sponsor Giveaways
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            Giveaways & Offers
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            Exclusive prizes, swag, and deals from our exhibitors
          </p>

          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
              <Gift style={{ width: 14, height: 14, color: '#fde68a' }} />
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{mockGiveaways.length}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Available</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
              <Sparkles style={{ width: 14, height: 14, color: '#fde68a' }} />
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {mockGiveaways.reduce((s, g) => s + g.pointsBonus, 0)}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Pts available</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Chips ──────────────────────────────────────────── */}
      <div className="px-5 py-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {types.map(tp => {
          const label = tp === 'all' ? 'All' : typeConfig[tp]?.label ?? tp;
          return (
            <button key={tp} onClick={() => setFilter(tp)}
              className="px-3.5 py-1.5 rounded-full flex-shrink-0 transition-all"
              style={{
                background: filter === tp ? t.accent : t.surface2,
                color: filter === tp ? '#fff' : t.textSec,
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${filter === tp ? t.accent : t.border}`,
              }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Giveaway Cards ────────────────────────────────────────── */}
      <div className="px-5 space-y-4 pb-6">
        {filtered.map(g => {
          const cfg = typeConfig[g.type] ?? typeConfig.swag;
          const TypeIcon = cfg.icon;
          const isClaimed = claimedIds.includes(g.id);
          const isExpanded = expandedId === g.id;
          const fillPct = g.totalAvailable
            ? Math.min((g.claimCount / g.totalAvailable) * 100, 100)
            : null;

          return (
            <button key={g.id}
              onClick={() => setExpandedId(isExpanded ? null : g.id)}
              className="w-full text-left rounded-2xl overflow-hidden transition-all active:scale-[0.99]"
              style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>

              {/* Optional image */}
              {g.image && g.featured && (
                <div className="relative h-36 overflow-hidden">
                  <ImageWithFallback src={g.image} alt={g.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                  <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg" style={{ background: cfg.gradient }}>
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{g.title}</h3>
                  </div>
                </div>
              )}

              <div className="p-4">
                {/* Header when no image */}
                {(!g.image || !g.featured) && (
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cfg.gradient }}>
                      <TypeIcon style={{ width: 20, height: 20, color: '#fff' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 style={{ color: t.text, fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{g.title}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md w-fit"
                        style={{ background: cfg.gradient }}>
                        <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sponsor info */}
                <div className="flex items-center gap-2.5 mb-3">
                  <img src={g.sponsorLogo} alt={g.sponsorName}
                    className="w-6 h-6 rounded-md flex-shrink-0" />
                  <span style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>{g.sponsorName}</span>
                  <span className="px-1.5 py-0.5 rounded"
                    style={{ background: `${tierColor[g.sponsorTier]}20`, color: tierColor[g.sponsorTier], fontSize: 10, fontWeight: 700 }}>
                    {g.sponsorTier}
                  </span>
                  <span className="flex items-center gap-1 ml-auto"
                    style={{ color: t.textMuted, fontSize: 11 }}>
                    <MapPin style={{ width: 10, height: 10 }} /> Booth {g.booth}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: t.surface2 }}>
                    <Users style={{ width: 11, height: 11, color: t.textMuted }} />
                    <span style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>{g.claimCount} claimed</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: 'rgba(16,185,129,0.1)' }}>
                    <Sparkles style={{ width: 11, height: 11, color: '#10b981' }} />
                    <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>+{g.pointsBonus} pts</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Clock style={{ width: 11, height: 11, color: t.textMuted }} />
                    <span style={{ color: t.textMuted, fontSize: 11 }}>{g.endsAt}</span>
                  </div>
                </div>

                {/* Supply bar */}
                {fillPct !== null && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color: t.textMuted, fontSize: 10, fontWeight: 600 }}>
                        {g.claimCount}/{g.totalAvailable} claimed
                      </span>
                      <span style={{ color: fillPct > 80 ? '#ef4444' : t.textMuted, fontSize: 10, fontWeight: 600 }}>
                        {fillPct > 80 ? 'Almost gone!' : `${g.totalAvailable! - g.claimCount} left`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: t.surface2 }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${fillPct}%`,
                          background: fillPct > 80
                            ? 'linear-gradient(90deg,#ef4444,#f97316)'
                            : 'linear-gradient(90deg,#f59e0b,#d97706)',
                        }} />
                    </div>
                  </div>
                )}

                {/* Expanded */}
                {isExpanded && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${t.divider}` }}>
                    <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                      {g.description}
                    </p>
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                      style={{ background: t.accentBg, border: `1px solid ${t.borderAcc}` }}>
                      <Ticket style={{ width: 14, height: 14, color: t.accentSoft }} />
                      <span style={{ color: t.textSec, fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: t.text }}>How to claim:</span> {g.requirement}
                      </span>
                    </div>

                    {isClaimed ? (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                        style={{ background: t.successBg, border: `1px solid ${t.successText}30` }}>
                        <CheckCircle style={{ width: 16, height: 16, color: t.successText }} />
                        <span style={{ color: t.successText, fontSize: 13, fontWeight: 700 }}>Claimed!</span>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => { e.stopPropagation(); handleClaim(g); }}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white cursor-pointer active:scale-[0.98] transition-transform"
                        style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)' }}>
                        <Gift style={{ width: 16, height: 16 }} />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Claim Giveaway</span>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>· +{g.pointsBonus} pts</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
