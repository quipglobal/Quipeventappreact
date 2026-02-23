import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 400);
    const t2 = setTimeout(() => setPhase('exit'), 1900);
    const t3 = setTimeout(() => onComplete(), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: '#07070F' }}
    >
      {/* Radial gradient backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(109,40,217,0.28) 0%, rgba(79,70,229,0.12) 40%, transparent 70%)',
        }}
      />

      {/* Animated noise grain */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Orbiting halo rings */}
      <div className="absolute" style={{ width: 320, height: 320 }}>
        <div
          className="absolute inset-0 rounded-full border border-violet-500/10"
          style={{ animation: 'spin 12s linear infinite' }}
        />
        <div
          className="absolute rounded-full border border-indigo-400/10"
          style={{ inset: -40, animation: 'spin 18s linear infinite reverse' }}
        />
        <div
          className="absolute rounded-full border border-purple-500/8"
          style={{ inset: -80, animation: 'spin 24s linear infinite' }}
        />
      </div>

      {/* Center logo + text */}
      <div
        className="relative z-10 flex flex-col items-center"
        style={{
          opacity: phase === 'enter' ? 0 : phase === 'hold' ? 1 : 0,
          transform: phase === 'enter' ? 'scale(0.88) translateY(12px)' : phase === 'hold' ? 'scale(1) translateY(0)' : 'scale(1.04) translateY(-8px)',
          transition: phase === 'enter'
            ? 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)'
            : 'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        {/* Logo mark */}
        <div className="relative mb-8">
          {/* Outer glow */}
          <div
            className="absolute inset-0 rounded-[2rem] blur-2xl"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', opacity: 0.5, transform: 'scale(1.4)' }}
          />
          {/* Icon box */}
          <div
            className="relative w-24 h-24 rounded-[2rem] flex items-center justify-center"
            style={{
              background: 'linear-gradient(145deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.12) inset, 0 24px 48px rgba(109,40,217,0.5)',
            }}
          >
            {/* Custom sparkle / network icon */}
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="5" fill="white" fillOpacity="0.95" />
              <circle cx="8"  cy="10" r="3.5" fill="white" fillOpacity="0.7" />
              <circle cx="36" cy="10" r="3.5" fill="white" fillOpacity="0.7" />
              <circle cx="8"  cy="34" r="3.5" fill="white" fillOpacity="0.7" />
              <circle cx="36" cy="34" r="3.5" fill="white" fillOpacity="0.7" />
              <line x1="22" y1="22" x2="8"  y2="10" stroke="white" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="22" y1="22" x2="36" y2="10" stroke="white" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="22" y1="22" x2="8"  y2="34" stroke="white" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="22" y1="22" x2="36" y2="34" stroke="white" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <h1
          className="text-white tracking-tight mb-2"
          style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}
        >
          Audience App
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, letterSpacing: '0.18em', fontWeight: 500, textTransform: 'uppercase' }}>
          Connect · Engage · Win
        </p>

        {/* Loading bar */}
        <div className="mt-10 w-32 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg,#7c3aed,#4f46e5,#06b6d4)',
              width: phase === 'hold' ? '100%' : '0%',
              transition: 'width 1.4s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};