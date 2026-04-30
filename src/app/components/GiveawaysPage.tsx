import React from 'react';
import { ArrowLeft, Gift, Sparkles, Tag, Ticket } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';

interface GiveawaysPageProps {
  onBack: () => void;
}

export const GiveawaysPage: React.FC<GiveawaysPageProps> = ({ onBack }) => {
  const { sponsorGiveaways } = useApp();
  const { t } = useTheme();

  const giveaways = sponsorGiveaways;

  return (
    <div className="pb-24 min-h-screen" style={{ background: t.bgPage }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-5 pt-12 pb-6"
        style={{
          background:
            'linear-gradient(160deg,#78350f 0%,#92400e 30%,#d97706 65%,#f59e0b 100%)',
        }}
      >
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #fde68a, transparent 70%)' }}
        />
        <div
          className="absolute bottom-2 -left-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fbbf24, transparent 70%)' }}
        />

        <div className="relative z-10">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 mb-4 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Back</span>
          </button>

          <div className="flex items-center gap-2.5 mb-1">
            <Gift style={{ width: 22, height: 22, color: '#fde68a' }} />
            <span
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Sponsor Giveaways
            </span>
          </div>
          <h1
            style={{
              color: '#fff',
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: 6,
            }}
          >
            Giveaways & Offers
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            Visit a sponsor's booth and have your badge scanned to enter the lucky
            draw.
          </p>

          <div className="flex items-center gap-3 mt-4">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
            >
              <Gift style={{ width: 14, height: 14, color: '#fde68a' }} />
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {giveaways.length}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                Available
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Giveaway Cards ────────────────────────────────────────── */}
      <div className="px-5 pt-5 space-y-4 pb-6">
        {giveaways.length === 0 && (
          <div
            className="text-center py-16 rounded-2xl"
            style={{
              color: t.textSec,
              fontSize: 14,
              background: t.surface,
              border: `1px dashed ${t.border}`,
            }}
          >
            <Gift
              style={{
                width: 32,
                height: 32,
                color: t.textMuted,
                margin: '0 auto 12px',
              }}
            />
            No giveaways yet — check back soon.
          </div>
        )}

        {giveaways.map(g => (
          <div
            key={g.id}
            className="rounded-2xl overflow-hidden"
            style={{
              background: t.surface,
              boxShadow: t.shadow,
              border: `1px solid ${t.border}`,
            }}
          >
            {g.image && (
              <div className="relative h-36 overflow-hidden">
                <img
                  src={g.image}
                  alt={g.title}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
                  }}
                />
                <div className="absolute bottom-3 left-3 right-3">
                  <h3
                    style={{
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }}
                  >
                    {g.title}
                  </h3>
                </div>
              </div>
            )}

            <div className="p-4">
              {!g.image && (
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg,#d97706,#f59e0b)',
                    }}
                  >
                    <Gift style={{ width: 20, height: 20, color: '#fff' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      style={{
                        color: t.text,
                        fontSize: 15,
                        fontWeight: 700,
                        lineHeight: 1.3,
                      }}
                    >
                      {g.title}
                    </h3>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <Sparkles
                  style={{ width: 12, height: 12, color: '#f59e0b' }}
                />
                <span
                  style={{ color: t.textSec, fontSize: 12, fontWeight: 600 }}
                >
                  by {g.sponsorName || 'Sponsor'}
                </span>
                {g.numberOfItems > 0 && (
                  <span
                    className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-md"
                    style={{ background: t.surface2 }}
                  >
                    <Tag
                      style={{ width: 11, height: 11, color: t.textMuted }}
                    />
                    <span
                      style={{
                        color: t.textSec,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {g.numberOfItems} item
                      {g.numberOfItems !== 1 ? 's' : ''}
                    </span>
                  </span>
                )}
              </div>

              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  background: t.accentBg,
                  border: `1px solid ${t.borderAcc}`,
                }}
              >
                <Ticket
                  style={{ width: 14, height: 14, color: t.accentSoft }}
                />
                <span style={{ color: t.textSec, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: t.text }}>
                    How to enter:
                  </span>{' '}
                  Visit the sponsor's booth and have your badge scanned.
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
