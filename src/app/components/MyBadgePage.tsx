import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { getMyBadgeApi, type BadgeData } from '@/app/api/badgeClient';

export const MyBadgePage: React.FC = () => {
  const { user, eventConfig } = useApp();
  const { isDark } = useTheme();

  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBadge = async () => {
    setLoading(true);
    setError(null);
    const res = await getMyBadgeApi();
    if (res.success && res.data) {
      setBadge(res.data);
    } else {
      setError(res.error ?? 'Could not load badge');
    }
    setLoading(false);
  };

  useEffect(() => { fetchBadge(); }, []);

  const displayName    = user?.name    ?? '';
  const displayTitle   = user?.title   ?? '';
  const displayCompany = user?.company ?? '';
  const displayAvatar  = user?.avatar  ?? '';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const eventBg   = eventConfig?.backgroundURL;
  const eventName = eventConfig?.name ?? 'Event';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center pb-28 px-6"
      style={{
        background: eventBg
          ? `linear-gradient(160deg,rgba(10,5,30,0.92) 0%,rgba(30,10,60,0.85) 100%),url(${eventBg}) center/cover no-repeat fixed`
          : isDark
            ? 'linear-gradient(160deg,#0c0918 0%,#130d2e 50%,#0a0715 100%)'
            : 'linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)',
      }}
    >

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <Loader2 size={28} color="#a78bfa" className="animate-spin" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>Loading your badge…</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={28} color="#f87171" />
          </div>
          <p style={{ color: '#f87171', fontSize: 14, fontWeight: 600 }}>Badge unavailable</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{error}</p>
          <button
            onClick={fetchBadge}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all active:scale-[0.97]"
            style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      )}

      {/* ── Badge Card ──────────────────────────────────────────────────── */}
      {!loading && badge && (
        <div
          className="w-full max-w-[320px] rounded-3xl overflow-hidden"
          style={{
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          {/* ─ Event banner ─ */}
          <div
            className="relative h-24 flex flex-col items-center justify-center px-4"
            style={{
              background: eventBg
                ? `linear-gradient(160deg,rgba(20,5,50,0.7) 0%,rgba(50,10,80,0.55) 100%),url(${eventBg}) center/cover no-repeat`
                : 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 55%,#6366f1 100%)',
            }}
          >
            {/* lanyard hole */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.25)' }} />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: 18 }}>
              Event Pass
            </p>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', lineHeight: 1.2 }}>
              {eventName}
            </p>
          </div>

          {/* ─ White body ─ */}
          <div className="bg-white px-6 pt-5 pb-6 flex flex-col items-center">

            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden mb-3 -mt-10 flex-shrink-0"
              style={{
                border: '3px solid #ffffff',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              }}
            >
              {displayAvatar ? (
                <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)' }}
                >
                  <span style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>{initials}</span>
                </div>
              )}
            </div>

            {/* Name */}
            <p style={{ color: '#0f0f1a', fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', lineHeight: 1.1, marginBottom: 4 }}>
              {displayName}
            </p>

            {/* Title + Company */}
            {(displayTitle || displayCompany) && (
              <div className="flex flex-col items-center gap-0.5 mb-5">
                {displayTitle && (
                  <p style={{ color: '#7c3aed', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                    {displayTitle}
                  </p>
                )}
                {displayCompany && (
                  <p style={{ color: '#6b7280', fontSize: 11, textAlign: 'center' }}>
                    {displayCompany}
                  </p>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="w-full h-px mb-5" style={{ background: 'linear-gradient(90deg,transparent,rgba(124,58,237,0.15),transparent)' }} />

            {/* QR Code */}
            {(badge.qr_image || badge.qr_image_url) && (
              <div
                className="rounded-2xl p-4 flex items-center justify-center mb-5"
                style={{
                  background: '#f5f3ff',
                  border: '1px solid rgba(124,58,237,0.12)',
                }}
              >
                <img
                  src={badge.qr_image ?? badge.qr_image_url}
                  alt="Badge QR code"
                  style={{ width: 180, height: 180, objectFit: 'contain', display: 'block' }}
                />
              </div>
            )}

            {/* Badge code */}
            {badge.badge_code && (
              <div
                className="px-5 py-2 rounded-full"
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.15)',
                }}
              >
                <span style={{ color: '#7c3aed', fontSize: 14, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.12em' }}>
                  {badge.badge_code}
                </span>
              </div>
            )}

            {/* Scan hint */}
            <p style={{ color: '#9ca3af', fontSize: 10, marginTop: 10, textAlign: 'center', letterSpacing: '0.02em' }}>
              Scan to connect at the event
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
